// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

import { WORLD_SIZE as SHARED_WORLD_SIZE, TERRAIN as SHARED_TERRAIN, OBJECT as SHARED_OBJECT } from '../../shared/world.js';

export const WORLD_SIZE = SHARED_WORLD_SIZE;
export const VIEW_RADIUS = 10;
export const VIEW_TILES = VIEW_RADIUS * 2 + 1;

export const STEP_DELAY = 240;
export const STEP_DELAY_DIAGONAL = 360;
export const MONSTER_ATTACK_DELAY = 1200;
export const PLAYER_ATTACK_DELAY = 1000;
export const HP_REGEN_DELAY = 3000;
export const COMBAT_TIMEOUT = 5000;
export const HUD_FADE_TIME = 5000;
export const HUD_FADE_DUR = 2000;

export const TERRAIN = SHARED_TERRAIN;
export const OBJECT = SHARED_OBJECT;

export const TERRAIN_COLORS: Record<number, [string, string, string]> = {
  [TERRAIN.WATER]:       ['#2a5070', '#1e4060', '#3a6888'],
  [TERRAIN.SAND]:        ['#c4a860', '#b89850', '#d4b870'],
  [TERRAIN.GRASS]:       ['#4a7a3a', '#3e6e30', '#56864a'],
  [TERRAIN.DARK_GRASS]:  ['#2d5422', '#234418', '#376630'],
  [TERRAIN.DIRT]:        ['#7a6244', '#6e563a', '#886e50'],
  [TERRAIN.STONE]:       ['#6a6a6a', '#5e5e5e', '#787878'],
  [TERRAIN.SWAMP]:       ['#3a5a3a', '#2e4e2e', '#466646'],
  [TERRAIN.STONE_FLOOR]: ['#7a7872', '#706e68', '#848280'],
  [TERRAIN.ROAD]:        ['#8a8478', '#7e786e', '#969084'],
};
