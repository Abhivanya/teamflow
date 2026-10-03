import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { EmailToken } from '../models/EmailToken';
import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import { ApiError } from '../utils/errors';
import { hashToken, newToken } from '../utils/tokens';
import { enqueueEmail } from '../jobs/queues';

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function publicUser(user: { id: string; name: string; email: string; emailVerifiedAt?: Date | null }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
  };
}

async function issueTokens(userId: string, userAgent: string) {
  const accessToken = jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = newToken();
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    userAgent: userAgent.slice(0, 240),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken };
}

async function saveEmailToken(userId: string, type: 'verify' | 'reset', hours: number) {
  const token = newToken();
  await EmailToken.deleteMany({ userId, type });
  await EmailToken.create({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  });
  return token;
}

export async function register(input: { name: string; email: string; password: string }, userAgent: string) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email is already registered');

  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
  });

  const token = await saveEmailToken(user.id, 'verify', 24);
  await enqueueEmail({
    to: user.email,
    subject: 'Verify your TeamFlow email',
    text: `Hi ${user.name},\n\nConfirm your email: ${env.CLIENT_URL}/verify-email?token=${token}\n`,
  });

  return { user: publicUser(user), tokens: await issueTokens(user.id, userAgent) };
}

export async function login(email: string, password: string, userAgent: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  const matches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !matches) throw new ApiError(401, 'Invalid email or password');
  return { user: publicUser(user), tokens: await issueTokens(user.id, userAgent) };
}

export async function refreshSession(rawToken: string, userAgent: string) {
  const existing = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!existing || existing.expiresAt < new Date()) {
    throw new ApiError(401, 'Session expired. Log in again.');
  }

  await RefreshToken.deleteOne({ _id: existing._id });
  const user = await User.findById(existing.userId);
  if (!user) throw new ApiError(401, 'Session expired. Log in again.');
  return { user: publicUser(user), tokens: await issueTokens(user.id, userAgent) };
}

export async function logout(rawToken?: string) {
  if (!rawToken) return;
  await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) });
}

export async function logoutAll(userId: string) {
  await RefreshToken.deleteMany({ userId });
}

export async function listSessions(userId: string) {
  const rows = await RefreshToken.find({ userId }).sort({ createdAt: -1 }).limit(20);
  return rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  }));
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'Login required');
  return publicUser(user);
}

export async function updateProfile(userId: string, name: string) {
  const user = await User.findByIdAndUpdate(userId, { name: name.trim() }, { new: true });
  if (!user) throw new ApiError(404, 'User not found');
  return publicUser(user);
}

export async function resendVerification(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'Login required');
  if (user.emailVerifiedAt) return;
  const token = await saveEmailToken(user.id, 'verify', 24);
  await enqueueEmail({
    to: user.email,
    subject: 'Verify your TeamFlow email',
    text: `Confirm your email: ${env.CLIENT_URL}/verify-email?token=${token}\n`,
  });
}

export async function verifyEmail(rawToken: string) {
  const row = await EmailToken.findOne({ tokenHash: hashToken(rawToken), type: 'verify' });
  if (!row || row.expiresAt < new Date()) throw new ApiError(400, 'Verification link is invalid or expired');
  await User.updateOne({ _id: row.userId }, { emailVerifiedAt: new Date() });
  await EmailToken.deleteOne({ _id: row._id });
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Same response either way, so this route cannot be used to look up accounts.
  if (!user) return;
  const token = await saveEmailToken(user.id, 'reset', 1);
  await enqueueEmail({
    to: user.email,
    subject: 'Reset your TeamFlow password',
    text: `Reset your password: ${env.CLIENT_URL}/reset-password?token=${token}\nThis link expires in one hour.`,
  });
}

export async function resetPassword(rawToken: string, password: string) {
  const row = await EmailToken.findOne({ tokenHash: hashToken(rawToken), type: 'reset' });
  if (!row || row.expiresAt < new Date()) throw new ApiError(400, 'Reset link is invalid or expired');
  await User.updateOne({ _id: row.userId }, { passwordHash: await bcrypt.hash(password, 12) });
  await EmailToken.deleteOne({ _id: row._id });
  await RefreshToken.deleteMany({ userId: row.userId });
}
