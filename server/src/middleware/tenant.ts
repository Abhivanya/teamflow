import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { OrganizationMember } from '../models/OrganizationMember';
import type { Role } from '../permissions/permissions';
import { ApiError } from '../utils/errors';

// Every tenant route goes through this. The header says which org the
// caller means, and we only continue if they actually belong to it.
export async function requireOrg(req: Request, _res: Response, next: NextFunction) {
  try {
    const orgId = req.get('x-organization-id');
    if (!orgId || !Types.ObjectId.isValid(orgId)) {
      throw new ApiError(400, 'X-Organization-Id header is required');
    }

    const member = await OrganizationMember.findOne({
      organizationId: orgId,
      userId: req.user!.id,
    });

    if (!member) {
      throw new ApiError(403, 'You are not a member of this organization');
    }

    req.orgId = orgId;
    req.role = member.role as Role;
    next();
  } catch (error) {
    next(error);
  }
}
