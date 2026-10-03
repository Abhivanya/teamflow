import { env } from '../config/env';
import { Invitation } from '../models/Invitation';
import { Organization } from '../models/Organization';
import { OrganizationMember } from '../models/OrganizationMember';
import { User } from '../models/User';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';
import { hashToken, newToken, slugify } from '../utils/tokens';
import { enqueueEmail } from '../jobs/queues';
import { createNotification } from './notification.service';

const ASSIGNABLE: Role[] = ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];

function serializeOrg(org: { id: string; name: string; slug: string; createdAt: Date }, role: Role) {
  return { id: org.id, name: org.name, slug: org.slug, role, createdAt: org.createdAt };
}

export async function createOrganization(userId: string, name: string) {
  const org = await Organization.create({
    name: name.trim(),
    slug: slugify(name),
    ownerId: userId,
  });
  await OrganizationMember.create({ organizationId: org._id, userId, role: 'OWNER' });
  return serializeOrg(org, 'OWNER');
}

export async function listOrganizations(userId: string) {
  const memberships = await OrganizationMember.find({ userId });
  const orgs = await Organization.find({ _id: { $in: memberships.map((m) => m.organizationId) } }).sort({
    name: 1,
  });

  return orgs.map((org) => {
    const membership = memberships.find((m) => String(m.organizationId) === String(org._id));
    return serializeOrg(org, (membership?.role ?? 'MEMBER') as Role);
  });
}

export async function updateOrganization(orgId: string, name: string) {
  const org = await Organization.findByIdAndUpdate(orgId, { name: name.trim() }, { new: true });
  if (!org) throw new ApiError(404, 'Organization not found');
  const owner = await OrganizationMember.findOne({ organizationId: orgId, role: 'OWNER' });
  return serializeOrg(org, (owner?.role ?? 'OWNER') as Role);
}

export async function listMembers(orgId: string) {
  const rows = await OrganizationMember.find({ organizationId: orgId }).populate('userId', 'name email').sort({
    createdAt: 1,
  });

  return rows.map((row) => {
    const user = row.userId as unknown as { _id: unknown; name: string; email: string };
    return {
      id: row.id,
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: row.role,
    };
  });
}

export async function inviteMember(orgId: string, actorId: string, email: string, role: Role) {
  if (!ASSIGNABLE.includes(role)) throw new ApiError(400, 'That role cannot be invited');

  const normalized = email.toLowerCase();
  const existingUser = await User.findOne({ email: normalized });
  if (existingUser) {
    const already = await OrganizationMember.findOne({ organizationId: orgId, userId: existingUser._id });
    if (already) throw new ApiError(409, 'That person is already in the organization');
  }

  const token = newToken();
  await Invitation.deleteMany({ organizationId: orgId, email: normalized, status: 'pending' });
  await Invitation.create({
    organizationId: orgId,
    email: normalized,
    role,
    tokenHash: hashToken(token),
    status: 'pending',
    invitedBy: actorId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const org = await Organization.findById(orgId);
  await enqueueEmail({
    to: normalized,
    subject: `Join ${org?.name ?? 'an organization'} on TeamFlow`,
    text: `You were invited as ${role}. Accept: ${env.CLIENT_URL}/invite/${token}`,
  });

  if (existingUser) {
    await createNotification({
      userId: existingUser.id,
      organizationId: orgId,
      type: 'invite',
      title: 'Organization invite',
      body: `You were invited to ${org?.name ?? 'an organization'}.`,
      link: `/invite/${token}`,
    });
  }

  return { email: normalized, role };
}

export async function acceptInvite(userId: string, userEmail: string, rawToken: string) {
  const invite = await Invitation.findOne({ tokenHash: hashToken(rawToken), status: 'pending' });
  if (!invite || invite.expiresAt < new Date()) {
    throw new ApiError(400, 'Invite is invalid or expired');
  }
  if (invite.email !== userEmail.toLowerCase()) {
    throw new ApiError(403, 'This invite was sent to a different email');
  }

  await OrganizationMember.updateOne(
    { organizationId: invite.organizationId, userId },
    { $setOnInsert: { organizationId: invite.organizationId, userId, role: invite.role } },
    { upsert: true },
  );
  invite.status = 'accepted';
  await invite.save();
  return { organizationId: String(invite.organizationId) };
}

export async function updateMemberRole(orgId: string, actorRole: Role, memberId: string, role: Role) {
  if (!ASSIGNABLE.includes(role)) throw new ApiError(400, 'That role cannot be assigned');
  const member = await OrganizationMember.findOne({ _id: memberId, organizationId: orgId });
  if (!member) throw new ApiError(404, 'Member not found');
  if (member.role === 'OWNER') throw new ApiError(400, 'The owner role cannot be changed here');
  if (member.role === 'ADMIN' && actorRole !== 'OWNER') {
    throw new ApiError(403, 'Only the owner can change an admin');
  }
  member.role = role;
  await member.save();
  return { id: member.id, role: member.role };
}

export async function removeMember(orgId: string, actorRole: Role, actorId: string, memberId: string) {
  const member = await OrganizationMember.findOne({ _id: memberId, organizationId: orgId });
  if (!member) throw new ApiError(404, 'Member not found');
  if (String(member.userId) === actorId) throw new ApiError(400, 'Use leave organization to remove yourself');
  if (member.role === 'OWNER') throw new ApiError(400, 'The owner cannot be removed');
  if (member.role === 'ADMIN' && actorRole !== 'OWNER') {
    throw new ApiError(403, 'Only the owner can remove an admin');
  }
  await member.deleteOne();
}

export async function leaveOrganization(orgId: string, userId: string, role: Role) {
  if (role === 'OWNER') throw new ApiError(400, 'Transfer ownership before leaving');
  await OrganizationMember.deleteOne({ organizationId: orgId, userId });
}
