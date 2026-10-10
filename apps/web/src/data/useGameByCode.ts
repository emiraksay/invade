import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface GameRef { id: string; code: string }

/**
 * Looks a game up by its join code (reads are public under RLS). Used by screens that have no
 * player session, such as the Table view on the projector.
 */
export function useGameByCode(code: string): { game: GameRef | null; error?: string } {
  const [game, setGame] = useState<GameRef | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!supabase) { setError('Supabase is not configured'); return; }
    let cancelled = false;
    supabase.from('games').select('id, code').eq('code', code).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) setError(error?.message ?? `No game with code ${code}`);
      else setGame(data as GameRef);
    });
    return () => { cancelled = true; };
  }, [code]);
  return { game, error };
}
