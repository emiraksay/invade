// Public API of the engine: pure rules shared by the server (source of truth) and the app (preview).
export * from './types';
export * from './api';
export * from './steps';
export { DEFAULT_MAP, generateMap, seededRng } from './map';
export { gameDayOf, secondsUntilDayEnd } from './time';
export { STARTING_GARRISON, depthsFromHq, startingPositions } from './pieces';
export { attackOdds, attackOptions, resolveBattle, territoryShare, toBattleRecord, warState } from './war';
export type { AttackOption, BattleRecord, PieceState, WarState } from './war';
export { applyDecree, duelPairs, eligibleDecrees, fallbackDecree, isDecided, leader, validateDecree } from './director';
export type { DayFacts, Decree, DecreeEffect, DecreeKind, DecreeOption, DecreeRecord, DirectorPlayer, DirectorState, DirectorZone } from './director';
