import type { Request, Response } from 'express';
import * as projects from '../services/project.service';
import { routeParam } from '../utils/routeParam';

function actor(req: Request) {
  return { id: req.user!.id, name: req.user!.name, role: req.role! };
}

export async function create(req: Request, res: Response) {
  const project = await projects.createProject(req.orgId!, actor(req), req.body);
  res.status(201).json({ data: project });
}

export async function list(req: Request, res: Response) {
  const result = await projects.listProjects(req.orgId!, req.user!.id, req.role!, {
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    page: req.query.page,
    limit: req.query.limit,
  });
  res.json({ data: result.items, meta: result.meta });
}

export async function getOne(req: Request, res: Response) {
  const project = await projects.getProject(req.orgId!, routeParam(req.params.projectId), req.user!.id, req.role!);
  res.json({ data: project });
}

export async function update(req: Request, res: Response) {
  const project = await projects.updateProject(
    req.orgId!,
    routeParam(req.params.projectId),
    req.user!.id,
    req.role!,
    req.user!.name,
    req.body,
  );
  res.json({ data: project });
}

export async function remove(req: Request, res: Response) {
  await projects.deleteProject(req.orgId!, routeParam(req.params.projectId), req.user!.id, req.role!);
  res.json({ data: { ok: true } });
}

export async function addMember(req: Request, res: Response) {
  const member = await projects.addProjectMember(req.orgId!, routeParam(req.params.projectId), actor(req), req.body.email);
  res.status(201).json({ data: member });
}

export async function removeMember(req: Request, res: Response) {
  await projects.removeProjectMember(
    req.orgId!,
    routeParam(req.params.projectId),
    actor(req),
    routeParam(req.params.userId),
  );
  res.json({ data: { ok: true } });
}

export async function addLabel(req: Request, res: Response) {
  const label = await projects.addLabel(req.orgId!, routeParam(req.params.projectId), req.user!.id, req.role!, req.body);
  res.status(201).json({ data: label });
}
