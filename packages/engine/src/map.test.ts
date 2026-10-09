import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP } from './map';

describe('DEFAULT_MAP', () => {
  it('has 16 territories in 4 regions', () => {
    expect(DEFAULT_MAP.territories).toHaveLength(16);
    expect(DEFAULT_MAP.regions).toHaveLength(4);
  });

  it('has symmetric neighbours', () => {
    const byId = new Map(DEFAULT_MAP.territories.map((t) => [t.id, t]));
    for (const t of DEFAULT_MAP.territories) {
      for (const n of t.neighbors) expect(byId.get(n)?.neighbors).toContain(t.id);
    }
  });
});
