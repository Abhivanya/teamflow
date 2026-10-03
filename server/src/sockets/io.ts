import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { OrganizationMember } from '../models/OrganizationMember';
import { Project } from '../models/Project';
import { ProjectMember } from '../models/ProjectMember';
import { readCookie } from '../utils/tokens';

let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function emitToProject(projectId: string, event: string, payload: unknown) {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function attachSocket(server: HttpServer) {
  const socketServer = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  socketServer.use((socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, 'accessToken');
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
      if (typeof payload === 'string' || !payload.sub) return next(new Error('unauthorized'));
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  socketServer.on('connection', (socket) => {
    const userId = String(socket.data.userId);
    socket.join(`user:${userId}`);

    socket.on('join:project', async (projectId: string, cb?: (result: { ok: boolean }) => void) => {
      const allowed = await canJoinProject(userId, projectId);
      if (!allowed) {
        cb?.({ ok: false });
        return;
      }
      socket.join(`project:${projectId}`);
      cb?.({ ok: true });
    });

    socket.on('leave:project', (projectId: string) => {
      if (typeof projectId === 'string') socket.leave(`project:${projectId}`);
    });
  });

  setIO(socketServer);
  return socketServer;
}

async function canJoinProject(userId: string, projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) return false;
  const project = await Project.findOne({ _id: projectId, deletedAt: null }).select('organizationId');
  if (!project) return false;

  const member = await OrganizationMember.findOne({
    organizationId: project.organizationId,
    userId,
  });
  if (!member) return false;
  if (member.role === 'OWNER' || member.role === 'ADMIN') return true;

  const onProject = await ProjectMember.exists({
    projectId,
    userId,
    organizationId: project.organizationId,
  });
  return Boolean(onProject);
}
