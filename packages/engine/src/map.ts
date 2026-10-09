import type { MapDef, Territory } from './types';

// 16 Barcelona neighbourhoods on a 4x4 grid, 4 regions. Neighbours = grid up/down/left/right.
// The web app draws its own shapes; it only needs these ids and `grid` positions.
const GRID: [id: string, name: string, regionId: string][][] = [
  [['pedralbes', 'Pedralbes', 'hills'], ['sarria', 'Sarrià', 'hills'], ['vallcarca', 'Vallcarca', 'hills'], ['horta', 'Horta', 'hills']],
  [['sants', 'Sants', 'center'], ['gracia', 'Gràcia', 'center'], ['sagrada', 'Sagrada Família', 'east'], ['clot', 'Clot', 'east']],
  [['sant-antoni', 'Sant Antoni', 'center'], ['eixample', 'Eixample', 'center'], ['poblenou', 'Poblenou', 'east'], ['sant-marti', 'Sant Martí', 'east']],
  [['raval', 'Raval', 'old-town'], ['gotic', 'Gòtic', 'old-town'], ['born', 'Born', 'old-town'], ['barceloneta', 'Barceloneta', 'old-town']],
];

export const GRID_POSITIONS: Record<string, { row: number; col: number }> = {};

const territories: Territory[] = GRID.flatMap((row, r) =>
  row.map(([id, name, regionId], c) => {
    GRID_POSITIONS[id] = { row: r, col: c };
    const neighbors = [
      GRID[r - 1]?.[c],
      GRID[r + 1]?.[c],
      row[c - 1],
      row[c + 1],
    ]
      .filter((n): n is [string, string, string] => Boolean(n))
      .map(([nid]) => nid);
    return { id, name, regionId, neighbors };
  }),
);

export const DEFAULT_MAP: MapDef = {
  id: 'barcelona-16',
  regions: [
    { id: 'hills', name: 'The Hills', bonus: 2 },
    { id: 'center', name: 'Center', bonus: 3 },
    { id: 'east', name: 'East Side', bonus: 3 },
    { id: 'old-town', name: 'Old Town', bonus: 2 },
  ],
  territories,
};
