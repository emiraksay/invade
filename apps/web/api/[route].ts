// Vercel entry: /api/join, /api/me, /api/steps all route through server/routes.ts.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApi } from '../server/routes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.url ?? '/').replace(/\?.*$/, '');
  const { status, json } = await handleApi(req.method ?? 'GET', path, req.body ?? null);
  res.status(status).json(json);
}
