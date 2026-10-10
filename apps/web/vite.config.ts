import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Local dev only: serves `/api/*` with the same handlers Vercel runs in production
 * (`server/routes.ts`), so `npm run dev` gives the full app with no extra tooling.
 */
function devApi(): Plugin {
  return {
    name: 'invade-dev-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const { handleApi } = (await server.ssrLoadModule('/server/routes.ts')) as typeof import('./server/routes');
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown = null;
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null; } catch { body = null; }
        // Mounted at /api, so req.url has the prefix stripped; originalUrl keeps the full path.
        const url = (req as typeof req & { originalUrl?: string }).originalUrl ?? req.url ?? '/';
        const { status, json } = await handleApi(req.method ?? 'GET', url.replace(/\?.*$/, ''), body);
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(json));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-side secrets from .env.local visible to the dev API (never bundled into the client).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), devApi()],
    server: { host: true },
  };
});
