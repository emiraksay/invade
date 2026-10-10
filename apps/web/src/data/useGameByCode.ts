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
    setGame(null);
    setError(undefined);
    if (!supabase) { setError('Supabase is not configured'); return; }
    let cancelled = false;
    supabase.from('games').select('id, code').eq('code', code).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError('Could not load the game');
      else if (!data) setError(`No game with code ${code}`);
      else setGame(data as GameRef);
    });
    return () => { cancelled = true; };
  }, [code]);
  return { game, error };
}
