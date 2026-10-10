// One router for both runtimes: Vercel functions (api/[route].ts) and the Vite dev server.
import type { ApiResult } from '@invade/engine';
import { join, me, submitSteps, type Repo } from './handlers';

type Handler = (repo: Repo, body: unknown) => Promise<ApiResult<unknown>>;

const ROUTES: Record<string, Handler> = {
  'POST /api/join': join,
  'POST /api/me': me,
  'POST /api/steps': (repo, body) => submitSteps(repo, body, new Date()),
};

export async function handleApi(
  method: string,
  path: string,
  body: unknown,
  repo?: Repo,
): Promise<{ status: number; json: ApiResult<unknown> }> {
  const handler = ROUTES[`${method.toUpperCase()} ${path.replace(/\/$/, '')}`];
  if (!handler) return { status: 404, json: { ok: false, error: 'Not found' } };
  try {
    const r = repo ?? (await import('./repo')).supabaseRepo;
    const json = await handler(r, body);
    return { status: json.ok ? 200 : 400, json };
  } catch (e) {
    // Never leak internals to clients; log for us.
    // Supabase errors are plain objects ({ message, code, hint }); log them readably.
    const detail = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(`[api] ${method} ${path} failed: ${detail}`);
    return { status: 500, json: { ok: false, error: 'Something went wrong, try again' } };
  }
}
