// HTTP contract between clients (web app, iOS Shortcut) and the server (Vercel functions in apps/web/api).
// Reads go straight to Supabase (RLS read-only + Realtime). Every write goes through these endpoints.
import type { GameDay, Player } from './types';

/** Every endpoint returns this shape. `error` is safe to show; internals never leak. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * POST /api/steps — called by the "Invade Sync" iOS Shortcut (and the in-app sync button).
 * `token` is the player's private sync token (from their personal setup link).
 * `steps` is today's cumulative total from Apple Health. Safe to resend: the server keeps the max.
 */
export interface SubmitStepsRequest {
  token: string;
  steps: number;
  day: GameDay;
}
export interface SubmitStepsResponse {
  day: GameDay;
  /** Stored total after the max-merge (may be higher than what was sent). */
  steps: number;
  soldiers: number;
  /** Soldiers gained by this report (0 if no milestone was crossed). */
  gained: number;
}

/** POST /api/me — the web app exchanges the sync token (from the setup link) for who you are. */
export interface MeRequest {
  token: string;
}
export interface MeResponse {
  player: Player;
  game: { id: string; code: string };
}
