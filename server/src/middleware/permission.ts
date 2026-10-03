import type { NextFunction, Request, Response } from 'express';
import { can, type Permission } from '../permissions/permissions';
import { ApiError } from '../utils/errors';

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.role || !can(req.role, permission)) {
      return next(new ApiError(403, 'You do not have permission to do that'));
    }
    next();
  };
}
