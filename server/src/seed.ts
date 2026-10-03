import bcrypt from 'bcryptjs';
import { connectDb } from './config/db';
import { Organization } from './models/Organization';
import { OrganizationMember } from './models/OrganizationMember';
import { Project } from './models/Project';
import { ProjectMember } from './models/ProjectMember';
import { Task } from './models/Task';
import { User } from './models/User';
import { slugify } from './utils/tokens';

async function user(name: string, email: string) {
  const existing = await User.findOne({ email });
  if (existing) return existing;
  return User.create({
    name,
    email,
    passwordHash: await bcrypt.hash('password123', 12),
    emailVerifiedAt: new Date(),
  });
}

async function main() {
  await connectDb();

  const asha = await user('Asha Menon', 'asha@teamflow.dev');
  const ravi = await user('Ravi Shah', 'ravi@teamflow.dev');
  const nia = await user('Nia Kapoor', 'nia@teamflow.dev');

  let org = await Organization.findOne({ name: 'Northwind Studio' });
  if (!org) {
    org = await Organization.create({ name: 'Northwind Studio', slug: slugify('Northwind Studio'), ownerId: asha._id });
  }

  const members = [
    { user: asha, role: 'OWNER' as const },
    { user: ravi, role: 'MEMBER' as const },
    { user: nia, role: 'MANAGER' as const },
  ];

  for (const member of members) {
    await OrganizationMember.updateOne(
      { organizationId: org._id, userId: member.user._id },
      { $setOnInsert: { role: member.role } },
      { upsert: true },
    );
  }

  let project = await Project.findOne({ organizationId: org._id, name: 'Website relaunch', deletedAt: null });
  if (!project) {
    project = await Project.create({
      organizationId: org._id,
      name: 'Website relaunch',
      description: 'New marketing site, without the old homepage nobody liked.',
      status: 'active',
      createdBy: asha._id,
      startDate: new Date(),
    });
  }

  for (const member of members) {
    await ProjectMember.updateOne(
      { projectId: project._id, userId: member.user._id },
      { $setOnInsert: { organizationId: org._id } },
      { upsert: true },
    );
  }

  const samples = [
    { title: 'Rewrite the homepage hero', status: 'TODO', priority: 'HIGH', assignee: asha, position: 1024 },
    { title: 'Collect copy from the sales team', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: ravi, position: 1024 },
    { title: 'Review mobile nav', status: 'IN_REVIEW', priority: 'URGENT', assignee: nia, position: 1024 },
    { title: 'Set up the staging domain', status: 'DONE', priority: 'LOW', assignee: asha, position: 1024 },
  ] as const;

  for (const sample of samples) {
    const exists = await Task.findOne({ projectId: project._id, title: sample.title, deletedAt: null });
    if (exists) continue;
    await Task.create({
      organizationId: org._id,
      projectId: project._id,
      title: sample.title,
      description: '',
      status: sample.status,
      priority: sample.priority,
      assigneeId: sample.assignee._id,
      reporterId: asha._id,
      labels: sample.priority === 'URGENT' ? ['launch'] : [],
      position: sample.position,
    });
  }

  console.log('Seeded Northwind Studio');
  console.log('asha@teamflow.dev / password123');
  console.log('ravi@teamflow.dev / password123');
  console.log('nia@teamflow.dev / password123');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
