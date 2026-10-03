import type { Request, Response } from 'express';
import { getDashboard } from '../services/dashboard.service';
import { listNotifications, markAllRead, markRead } from '../services/notification.service';
import { searchOrg } from '../services/search.service';
import { routeParam } from '../utils/routeParam';

export async function dashboard(req: Request, res: Response) {
  res.json({ data: await getDashboard(req.orgId!) });
}

export async function notifications(req: Request, res: Response) {
  const result = await listNotifications(req.user!.id, req.query);
  res.json({ data: result.items, meta: { ...result.meta, unread: result.unread } });
}

export async function readOne(req: Request, res: Response) {
  res.json({ data: await markRead(req.user!.id, routeParam(req.params.id)) });
}

export async function readAll(req: Request, res: Response) {
  await markAllRead(req.user!.id);
  res.json({ data: { ok: true } });
}

export async function search(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ data: await searchOrg(req.orgId!, req.user!.id, req.role!, q) });
}
