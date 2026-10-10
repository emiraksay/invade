import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP, type Player } from '@invade/engine';
import { simulateWeek } from './demoWeek';

const players: Player[] = [
  { id: 'w1', name: 'Kateryna', team: 'white' }, { id: 'w2', name: 'Varya', team: 'white' }, { id: 'w3', name: 'Costi', team: 'white' },
  { id: 'b1', name: 'Emir', team: 'black' }, { id: 'b2', name: 'Hasan', team: 'black' }, { id: 'b3', name: 'Selin', team: 'black' },
];

describe('simulateWeek', () => {
  const week = simulateWeek(DEFAULT_MAP, players);
  it('plays 7 days, each a battle for a different zone, decided by soldiers', () => {
    expect(week.days).toHaveLength(7);
    expect(new Set(week.days.map((d) => d.zoneId)).size).toBe(7);
    for (const d of week.days) expect(d.soldiers[d.winner]).toBeGreaterThanOrEqual(d.soldiers[d.winner === 'white' ? 'black' : 'white']);
    console.log(week.days.map((d) => `D${d.day} ${d.title.padEnd(15)} ${d.zoneName}${d.extraZoneName ? '+' + d.extraZoneName : ''} W${d.soldiers.white}/B${d.soldiers.black} → ${d.winner}  white ${Math.round(d.share.white * 100)}%`).join('\n'));
  });
  it('Black leads on Friday, the Saturday rebellion turns it, White wins the week', () => {
    expect(week.days[4]!.share.black).toBeGreaterThan(0.5);
    expect(week.days[5]!.decree.kind).toBe('rebellion');
    expect(week.winner).toBe('white');
  });
  it('the winners split the whole pot by their stake', () => {
    const paid = week.payouts.reduce((a, p) => a + p.payout, 0);
    expect(Math.abs(paid - week.pot)).toBeLessThanOrEqual(2);
    expect(week.payouts.filter((p) => p.team === 'black').every((p) => p.payout === 0)).toBe(true);
  });
});
