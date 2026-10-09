// HTTP contract between the web app and the server (Vercel functions in apps/web/api).
// Every request carries `Authorization: Bearer <supabase access token>` (anonymous sign-in).
// Reads go straight to Supabase (RLS + Realtime); every write goes through these endpoints.
import type { GameAction, GameEvent, GameSettings, GameState, StepReport, TeamId } from './types';

export interface ApiError {
  error: string;
  /** 'conflict' = state changed since expectedVersion: refetch and retry. */
  code?: 'unauthorized' | 'not_found' | 'forbidden' | 'invalid' | 'conflict';
}

/** POST /api/games: host creates a game. */
export interface CreateGameRequest { hostName: string; color: string; settings?: Partial<GameSettings> }
export interface CreateGameResponse { gameId: string; code: string; playerId: string }

/** POST /api/games/join */
export interface JoinGameRequest { code: string; name: string; color: string }
export interface JoinGameResponse { gameId: string; playerId: string; teamId: TeamId }

/** POST /api/games/lobby: host only. */
export type LobbyRequest =
  | { gameId: string; op: 'switch_team'; playerId: string }
  | { gameId: string; op: 'kick'; playerId: string }
  | { gameId: string; op: 'ban'; playerId: string }
  | { gameId: string; op: 'update_settings'; settings: Partial<GameSettings> };
export interface LobbyResponse { ok: true }

/** POST /api/games/action: the server runs engine.applyAction and stores the result. */
export interface GameActionRequest { gameId: string; action: GameAction; expectedVersion: number }
export interface GameActionResponse { state: GameState; events: GameEvent[] }

/** POST /api/steps: a player submits steps for the current Walk Phase (runs anti-cheat). */
export interface SubmitStepsRequest { gameId: string; report: Omit<StepReport, 'playerId'> }
export interface SubmitStepsResponse { acceptedSteps: number; flagged: boolean; reasons: string[] }

/** POST /api/demo/steps: demo mode only. Adds simulated steps for a player or a whole team. */
export interface DemoStepsRequest { gameId: string; playerId?: string; teamId?: TeamId; steps: number }

/** POST /api/dealer: Claude writes a casino-host line; also stored as a `dealer_line` event. */
export interface DealerRequest { gameId: string; kind: 'battle' | 'taunt' | 'recap'; eventId?: number }
export interface DealerResponse { text: string }
