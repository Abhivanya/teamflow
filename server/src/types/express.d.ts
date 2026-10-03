import type { Role } from '../permissions/permissions';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string };
      orgId?: string;
      role?: Role;
      requestId?: string;
    }
  }
}

export {};
