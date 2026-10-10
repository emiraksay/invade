// Vercel entry: /api/join, /api/me, /api/steps all route through routes.ts.
// Bundled by `npm run build:api` into api/[route].js: one self-contained file, because Vercel runs
// functions as plain Node ESM (no TypeScript, no extensionless imports, no workspace TS packages).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleApi } from './routes';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.url ?? '/').replace(/\?.*$/, '');
  const { status, json } = await handleApi(req.method ?? 'GET', path, req.body ?? null);
  res.status(status).json(json);
}
