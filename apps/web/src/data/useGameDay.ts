import { useEffect, useMemo, useState } from 'react';
import {
  gameDayOf,
  type BattleRecord,
  summarizeTeamDay,
  type GameSettings,
  type Player,
  type StepReport,
  type TeamDay,
  type TeamId,
} from '@invade/engine';
import { supabase } from './supabase';
import { toMilestoneEvent, type MilestoneEvent } from './events';
import { toBattleRecord } from './battles';

interface Snapshot {
  settings: GameSettings;
  players: Player[];
  reports: StepReport[];
  events: MilestoneEvent[]; // newest first
  battles: BattleRecord[]; // all battles of the campaign, oldest first (the war is replayed from them)
}

export interface GameDayState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  day?: string;
  settings?: GameSettings;
  teams?: Record<TeamId, TeamDay>;
  players?: Player[];
  /** Today's milestone events, newest first (the LOG bar / feed). */
  events?: MilestoneEvent[];
  /** Every battle so far, oldest first. Pass to walkPhaseMapView(..., { battles, today: day }). */
  battles?: BattleRecord[];
  live: boolean; // Realtime connected
}

async function loadSnapshot(gameId: string): Promise<Snapshot> {
  if (!supabase) throw new Error('Supabase is not configured');
  const game = await supabase.from('games').select('settings').eq('id', gameId).single();
  if (game.error) throw game.error;
  const settings = game.data.settings as GameSettings;
  const day = gameDayOf(new Date(), settings.timezone);
  const [players, reports, events, battles] = await Promise.all([
    supabase.from('players').select('id, name, team').eq('game_id', gameId).order('created_at'),
    supabase.from('step_reports').select('player_id, day, steps, source, updated_at').eq('game_id', gameId).eq('day', day),
    supabase.from('events').select('id, type, payload, created_at').eq('game_id', gameId).eq('type', 'milestone').order('created_at', { ascending: false }).limit(30),
    supabase.from('events').select('id, type, payload, created_at').eq('game_id', gameId).eq('type', 'battle').order('created_at', { ascending: true }).limit(1000),
  ]);
  if (players.error) throw players.error;
  if (reports.error) throw reports.error;
  if (events.error) throw events.error;
  if (battles.error) throw battles.error;
  return {
    settings,
    players: players.data as Player[],
    reports: reports.data.map((r) => ({ playerId: r.player_id, day: r.day, steps: r.steps, source: r.source, reportedAt: r.updated_at })),
    events: events.data.map(toMilestoneEvent).filter((e): e is MilestoneEvent => e !== null),
    battles: battles.data.map(toBattleRecord).filter((b): b is BattleRecord => b !== null),
  };
}

/**
 * Today's state of a game: snapshot first, then live updates via Realtime.
 * Any change (new player, new step report) triggers a fresh snapshot: simple and always consistent,
 * and cheap at hackathon scale (8 players). After a reconnect we refetch too, so nothing is missed.
 */
export function useGameDay(gameId: string | undefined): GameDayState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string>();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!gameId || !supabase) return;
    const client = supabase;
    let cancelled = false;
    const refresh = () =>
      loadSnapshot(gameId).then(
        (s) => { if (!cancelled) { setSnapshot(s); setError(undefined); } },
        (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the game'); },
      );

    refresh();
    const channel = client
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_reports', filter: `game_id=eq.${gameId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, refresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `game_id=eq.${gameId}` }, refresh)
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') refresh(); // (re)connected: catch up on anything missed
      });
    // Coming back to the tab (phone unlocked): refresh, Realtime may have been paused.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void client.removeChannel(channel);
    };
  }, [gameId]);

  return useMemo<GameDayState>(() => {
    if (!supabase) return { status: 'error', error: 'Supabase is not configured', live: false };
    if (error && !snapshot) return { status: 'error', error, live };
    if (!snapshot) return { status: 'loading', live };
    const day = gameDayOf(new Date(), snapshot.settings.timezone);
    const team = (t: TeamId) => summarizeTeamDay(t, snapshot.players, snapshot.reports, day);
    return { status: 'ready', day, settings: snapshot.settings, teams: { white: team('white'), black: team('black') }, players: snapshot.players, events: snapshot.events, battles: snapshot.battles, live };
  }, [snapshot, error, live]);
}
