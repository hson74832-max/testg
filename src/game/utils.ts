import { GameState } from './types';
import { WORLD_SIZE } from './constants';

export function chebDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function isMonsterWalkable(state: GameState, x: number, y: number, selfId: number): boolean {
  if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) return false;
  const i = y * WORLD_SIZE + x;
  if (state.terrain[i] === 0) return false; // WATER

  const obj = state.objects[i];
  if (obj === 1 || obj === 2 || obj === 5 || obj === 9 || obj === 4) return false;

  if (x === state.px && y === state.py) return false;

  if (state.monsters.some(m => !m.dead && m.id !== selfId && m.x === x && m.y === y)) return false;

  return true;
}
