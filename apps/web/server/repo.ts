// Supabase implementation of `Repo`, using the service role (server only, bypasses RLS).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Player, TeamId } from '@invade/engine';
import type { GameRow, Repo } from './handlers';

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
};
