import type { Request, Response } from 'express';
import * as orgs from '../services/organization.service';
import { routeParam } from '../utils/routeParam';

export async function create(req: Request, res: Response) {
  const org = await orgs.createOrganization(req.user!.id, req.body.name);
  res.status(201).json({ data: org });
}

export async function list(req: Request, res: Response) {
  res.json({ data: await orgs.listOrganizations(req.user!.id) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await orgs.updateOrganization(req.orgId!, req.body.name) });
}

export async function members(req: Request, res: Response) {
  res.json({ data: await orgs.listMembers(req.orgId!) });
}

export async function invite(req: Request, res: Response) {
  const result = await orgs.inviteMember(req.orgId!, req.user!.id, req.body.email, req.body.role);
  res.status(201).json({ data: result });
}

export async function accept(req: Request, res: Response) {
  const result = await orgs.acceptInvite(req.user!.id, req.user!.email, routeParam(req.params.token));
  res.json({ data: result });
}

export async function changeRole(req: Request, res: Response) {
  const result = await orgs.updateMemberRole(req.orgId!, req.role!, routeParam(req.params.memberId), req.body.role);
  res.json({ data: result });
}

export async function remove(req: Request, res: Response) {
  await orgs.removeMember(req.orgId!, req.role!, req.user!.id, routeParam(req.params.memberId));
  res.json({ data: { ok: true } });
}

export async function leave(req: Request, res: Response) {
  await orgs.leaveOrganization(req.orgId!, req.user!.id, req.role!);
  res.json({ data: { ok: true } });
}
