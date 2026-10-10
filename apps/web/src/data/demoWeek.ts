// The demo week: a whole Invade season (7 days) played in two minutes on the big screen.
// Scripted steps, real rules: soldiers from the engine's milestones, the AI Director's decrees
// applied by the engine (applyDecree), the winner of the night takes the zone of the day,
// and the week is won on land (area share, decision 19). Saturday's twist turns the week around.
import { applyDecree, polygonArea, type BattleRecord, type Decree, type MapDef, type Player, type TeamId } from '@invade/engine';

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Who wins each night. Black runs away with the week; Saturday's rebellion turns it; White wins Sunday. */
const NIGHT_WINNERS: TeamId[] = ['black', 'black', 'white', 'black', 'black', 'white', 'white'];

export interface DemoDay {
  day: number; // 1..7
  zoneId: string;
  zoneName: string;
  /** The rebel zone fought for again (Saturday's twist), if any. */
  extraZoneId: string | null;
  extraZoneName: string | null;
  decree: Decree;
  /** The Director's announcement (scripted for the demo, in the Director's voice). */
  title: string;
  story: string;
  steps: Record<string, number>;
  soldiers: Record<TeamId, number>;
  winner: TeamId;
  notes: string[];
  /** Land share after the night. */
  share: Record<TeamId, number>;
  /** Owner of every zone after the night. */
  owner: Record<string, TeamId>;
}

export interface DemoStake { playerId: string; name: string; team: TeamId; coins: number }

export interface DemoWeek {
  days: DemoDay[];
  /** Fake battle records, one per night (and one for the rebel zone): feed them to walkPhaseMapView to colour the map. */
  battles: BattleRecord[][];
  stakes: DemoStake[];
  winner: TeamId;
  pot: number;
  payouts: Array<DemoStake & { payout: number }>;
}

const STAKES = [20, 10, 30, 15, 25, 10, 20, 15];

/** Deterministic 0..1 noise per player and day. */
function noise(id: string, day: number): number {
  let h = 2166136261 ^ day;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function shareOf(map: MapDef, owner: Record<string, TeamId>): Record<TeamId, number> {
  let white = 0, all = 0;
  for (const t of map.territories) {
    const a = polygonArea(t.polygon);
    all += a;
    if (owner[t.id] === 'white') white += a;
  }
  const w = all ? white / all : 0;
  return { white: w, black: 1 - w };
}

export function simulateWeek(map: MapDef, players: readonly Player[]): DemoWeek {
  const zones = map.territories;
  const byId = new Map(zones.map((t) => [t.id, t]));
  const owner: Record<string, TeamId> = Object.fromEntries(zones.map((t) => [t.id, t.team]));
  const whites = players.filter((p) => p.team === 'white');
  const blacks = players.filter((p) => p.team === 'black');
  const fought = new Set<string>();
  const days: DemoDay[] = [];
  const battles: BattleRecord[][] = [];
  let id = 1;

  for (let d = 1; d <= 7; d++) {
    const winner = NIGHT_WINNERS[d - 1]!;
    const loser: TeamId = winner === 'white' ? 'black' : 'white';
    // The AI picks the zone of the day: one the night's loser holds (so something is at stake),
    // on the front line, biggest first; any unfought zone otherwise.
    const front = (t: (typeof zones)[number]) => t.neighbors.some((n) => owner[n] !== owner[t.id]);
    const open = zones.filter((t) => !fought.has(t.id));
    const pick = [...open].sort((a, b) =>
      Number(owner[b.id] === loser) - Number(owner[a.id] === loser)
      || Number(front(b)) - Number(front(a))
      || Number(a.isHq) - Number(b.isHq)
      || polygonArea(b.polygon) - polygonArea(a.polygon))[0] ?? zones[0]!;
    fought.add(pick.id);

    // Saturday's twist: the biggest zone Black holds (not today's) revolts.
    let extra: (typeof zones)[number] | null = null;
    let decree: Decree;
    let title: string, story: string;
    const zoneName = pick.name;
    switch (d) {
      case 1:
        decree = { kind: 'quiet' };
        title = 'Day One';
        story = `No tricks today. Just walk. The first zone up for grabs: ${zoneName}.`;
        break;
      case 2:
        decree = { kind: 'night_march', fromHour: 20 };
        title = 'Night March';
        story = `Every step after 20:00 counts double. Save your legs for the evening: ${zoneName} falls at midnight.`;
        break;
      case 3: {
        const a = whites[0], b = blacks[0];
        decree = a && b ? { kind: 'duel', a: a.id, b: b.id, prize: 4 } : { kind: 'quiet' };
        title = 'Duel at Dawn';
        story = a && b ? `${a.name} against ${b.name}. Whoever walks more today wins 4 soldiers for their team.` : 'A quiet day.';
        break;
      }
      case 4:
        decree = { kind: 'all_hands', minSteps: 6_000, prize: 4 };
        title = 'All Hands';
        story = 'A team where every single player walks 6,000 steps gets +4 soldiers. Nobody gets left behind.';
        break;
      case 5:
        decree = { kind: 'reinforcements', team: 'white', percent: 50 };
        title = 'Reinforcements';
        story = 'White is falling behind. Reinforcements arrive: their soldiers count 50% more today.';
        break;
      case 6: {
        extra = zones.filter((t) => owner[t.id] === 'black' && t.id !== pick.id).sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon))[0] ?? null;
        decree = extra ? { kind: 'rebellion', zoneId: extra.id } : { kind: 'quiet' };
        title = 'The Rebellion';
        story = extra
          ? `Black thought the week was over. ${extra.name} has had enough of Black's rule and rises up. Tonight it is fought for again, together with ${zoneName}. Everything is back on the table.`
          : 'A quiet day.';
        break;
      }
      default:
        decree = { kind: 'all_hands', minSteps: 4_000, prize: 4 };
        title = 'The Final';
        story = `Sunday. Everything comes down to ${zoneName}. Every player on a team walks 4,000 steps, the team gets +4. Go.`;
    }

    // Scripted steps: the night's winner walks more. Base 5k-12k per player, with some noise.
    const steps: Record<string, number> = {};
    const stepsAfterHour: Record<string, number> = {};
    players.forEach((p, i) => {
      const base = 5_000 + ((i * 2_300) % 7_000) + Math.round(noise(p.id, d) * 1_500);
      const form = p.team === winner ? 1.25 : 0.85;
      steps[p.id] = Math.round((base * form) / 10) * 10;
      stepsAfterHour[p.id] = Math.round(steps[p.id]! * 0.25);
    });
    let effect = applyDecree(decree, { steps, stepsAfterHour, players }, 1);
    // Make sure the scripted winner really has more soldiers (the rules, not the script, decide the battle).
    for (let guard = 0; effect.soldiers[winner] <= effect.soldiers[loser] && guard < 10; guard++) {
      for (const p of players) if (p.team === winner) steps[p.id] = Math.min(15_000, steps[p.id]! + 2_500);
      effect = applyDecree(decree, { steps, stepsAfterHour, players }, 1);
    }
    const won: TeamId = effect.soldiers.white > effect.soldiers.black ? 'white' : effect.soldiers.black > effect.soldiers.white ? 'black' : winner;

    const night: BattleRecord[] = [];
    for (const z of [pick, extra].filter(Boolean) as Array<(typeof zones)[number]>) {
      owner[z.id] = won;
      night.push({
        id: id++, at: `2026-10-${String(5 + d).padStart(2, '0')}T23:59:00Z`, playerId: `demo-${won}`, team: won, from: z.id, to: z.id,
        attackers: effect.soldiers[won], defenders: effect.soldiers[won === 'white' ? 'black' : 'white'], p: 1, roll: 0, won: true,
        attackersLeft: effect.soldiers[won], defendersLeft: 0, day: `demo-${d}`,
      });
    }
    battles.push(night);
    days.push({
      day: d, zoneId: pick.id, zoneName, extraZoneId: extra?.id ?? null, extraZoneName: extra ? byId.get(extra.id)!.name : null,
      decree, title, story, steps, soldiers: effect.soldiers, winner: won, notes: effect.notes,
      share: shareOf(map, owner), owner: { ...owner },
    });
  }

  const final = days[days.length - 1]!.share;
  const winner: TeamId = final.white >= final.black ? 'white' : 'black';
  const stakes: DemoStake[] = players.map((p, i) => ({ playerId: p.id, name: p.name, team: p.team, coins: STAKES[i % STAKES.length]! }));
  const pot = stakes.reduce((a, s) => a + s.coins, 0);
  const winnersIn = stakes.filter((s) => s.team === winner).reduce((a, s) => a + s.coins, 0);
  const payouts = stakes.map((s) => ({ ...s, payout: s.team === winner && winnersIn ? Math.round((pot * s.coins) / winnersIn) : 0 }));
  return { days, battles, stakes, winner, pot, payouts };
}
