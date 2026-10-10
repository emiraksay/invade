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

/** POST /api/join — a player joins the game and receives their private sync token (shown once). */
export interface JoinRequest {
  code: string;
  name: string;
  team: 'white' | 'black';
}
export interface JoinResponse extends MeResponse {
  token: string;
}

/**
 * POST /api/nudge — who on my team is short of their next milestone, with a personal message to send.
 * The engine picks the facts (who, how many steps, whether it unlocks the team bonus); Claude only writes the words.
 */
export interface NudgeRequest {
  token: string;
}
export interface Nudge {
  playerId: string;
  name: string;
  steps: number;
  /** Steps to the next milestone. */
  stepsToGo: number;
  /** Soldiers that milestone adds. */
  gain: number;
  /** True when reaching it also raises the whole team's bonus. */
  unlocksBonus: boolean;
  /** Ready to send as-is (WhatsApp, iMessage…). */
  message: string;
}
export interface NudgeResponse {
  day: GameDay;
  team: 'white' | 'black';
  nudges: Nudge[];
  /** 'claude' when the messages were written by the model, 'template' when the fallback text was used. */
  writer: 'claude' | 'template';
}
