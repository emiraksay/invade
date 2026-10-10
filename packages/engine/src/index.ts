// Public API of the engine: pure rules shared by the server (source of truth) and the app (preview).
export * from './types';
export * from './api';
export * from './steps';
export { DEFAULT_MAP, MAP_SEED, ZONE_NAMES, generateMap, polygonArea, seededRng } from './map';
export { gameDayOf, secondsUntilDayEnd } from './time';
export { STARTING_GARRISON, depthsFromHq, startingPositions } from './pieces';
export { attackOdds, attackOptions, resolveBattle, territoryShare, toBattleRecord, warState } from './war';
export type { AttackOption, BattleRecord, PieceState, WarState } from './war';
