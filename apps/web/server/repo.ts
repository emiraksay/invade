// Supabase implementation of `Repo`, using the service role (server only, bypasses RLS).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { toBattleRecord, type BattleRecord, type Player, type StepReport, type StepSource, type TeamId } from '@invade/engine';
import type { GameRow, Repo } from './handlers';

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  // Trim: values pasted into dashboards often carry stray spaces/newlines.
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const toPlayer = (row: { id: string; name: string; team: string }): Player => ({
  id: row.id, name: row.name, team: row.team as TeamId,
});

export const supabaseRepo: Repo = {
  async findGameByCode(code) {
    const { data, error } = await db().from('games').select('id, code, settings').eq('code', code).maybeSingle();
    if (error) throw error;
    return data as GameRow | null;
  },

  async createPlayer(gameId, name, team, tokenHash) {
    const { data, error } = await db().rpc('create_player', {
      p_game: gameId, p_name: name, p_team: team, p_token_hash: tokenHash,
    });
    if (error) throw new Error(error.message);
    return toPlayer(data);
  },

  async findByTokenHash(tokenHash) {
    const { data, error } = await db()
      .from('player_secrets')
      .select('players!inner(id, name, team, games!inner(id, code, settings))')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const p = (data as unknown as { players: { id: string; name: string; team: string; games: GameRow } }).players;
    return { player: toPlayer(p), game: p.games };
  },

  async reportSteps(playerId, day, steps, source) {
    const { data, error } = await db().rpc('report_steps', {
      p_player: playerId, p_day: day, p_steps: steps, p_source: source,
    });
    if (error) throw error;
    const row = (data as { before_steps: number; after_steps: number }[])[0]!;
    return { before: row.before_steps, after: row.after_steps };
  },

  async insertEvent(gameId, type, payload) {
    const { error } = await db().from('events').insert({ game_id: gameId, type, payload });
    if (error) throw error;
  },

  async listPlayers(gameId) {
    const { data, error } = await db().from('players').select('id, name, team').eq('game_id', gameId).order('created_at');
    if (error) throw error;
    return (data as { id: string; name: string; team: string }[]).map(toPlayer);
  },

  async listStepReports(gameId, day) {
    const { data, error } = await db()
      .from('step_reports')
      .select('player_id, day, steps, source, updated_at')
      .eq('game_id', gameId)
      .eq('day', day);
    if (error) throw error;
    return (data as { player_id: string; day: string; steps: number; source: string; updated_at: string }[]).map(
      (r): StepReport => ({ playerId: r.player_id, day: r.day, steps: r.steps, source: r.source as StepSource, reportedAt: r.updated_at }),
    );
  },

  async listBattles(gameId) {
    const { data, error } = await db()
      .from('events')
      .select('id, type, payload, created_at')
      .eq('game_id', gameId)
      .eq('type', 'battle')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as { id: number; type: string; payload: unknown; created_at: string }[])
      .map(toBattleRecord)
      .filter((b): b is BattleRecord => b !== null);
  },
};
