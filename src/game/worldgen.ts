import { GameState } from './types';
import { WORLD_SIZE, TERRAIN, OBJECT } from './constants';

function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = (n ^ (n >> 16));
  return (n & 0x7fffffff) / 0x7fffffff;
}

export function generateWorld(state: GameState) {
  state.terrain = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  state.objects = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  state.explored = new Uint8Array(WORLD_SIZE * WORLD_SIZE);

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const i = y * WORLD_SIZE + x;
      state.terrain[i] = getTerrain(x, y);
      state.objects[i] = getObject(x, y, state.terrain[i]);
    }
  }
  placeStructures(state);
  clearSpawnArea(state);
}

function noise2d(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, oct: number): number {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise2d(x * freq, y * freq);
    amp *= 0.5; freq *= 2;
  }
  return v;
}

function getTerrain(x: number, y: number): number {
  const elev = fbm(x * 0.025 + 0.5, y * 0.025 + 0.5, 5);
  const moist = fbm(x * 0.02 + 100.7, y * 0.02 + 100.7, 4);
  const temp = fbm(x * 0.015 + 200.3, y * 0.015 + 200.3, 3);
  if (elev < 0.28) return TERRAIN.WATER;
  if (elev < 0.33) return TERRAIN.SAND;
  if (elev > 0.72) return TERRAIN.STONE;
  if (moist > 0.58 && temp > 0.5) return TERRAIN.SWAMP;
  if (moist > 0.52) return TERRAIN.DARK_GRASS;
  if (temp > 0.6 && moist < 0.35) return TERRAIN.SAND;
  if (elev > 0.6) return TERRAIN.DIRT;
  return TERRAIN.GRASS;
}

function getObject(x: number, y: number, ter: number): number {
  const h = hash(x * 7 + 13, y * 11 + 37);
  if (ter === TERRAIN.DARK_GRASS && h < 0.35) return OBJECT.TREE;
  if (ter === TERRAIN.GRASS && h < 0.06) return OBJECT.TREE;
  if (ter === TERRAIN.GRASS && h > 0.93) return OBJECT.BUSH;
  if (ter === TERRAIN.STONE && h < 0.12) return OBJECT.ROCK;
  if (ter === TERRAIN.SAND && h > 0.96) return OBJECT.CACTUS;
  if (ter === TERRAIN.DIRT && h < 0.04) return OBJECT.ROCK;
  return OBJECT.NONE;
}

function placeStructures(state: GameState) {
  const cx = 128, cy = 128;
  // Village
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    state.terrain[(cy + dy) * WORLD_SIZE + (cx + dx)] = TERRAIN.STONE_FLOOR;
    state.objects[(cy + dy) * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
  }
  // Roads
  for (let dx = -15; dx <= 15; dx++) {
    state.terrain[cy * WORLD_SIZE + (cx + dx)] = TERRAIN.ROAD;
    state.objects[cy * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
    if (Math.abs(dx) > 4) {
      state.terrain[(cy - 1) * WORLD_SIZE + (cx + dx)] = TERRAIN.ROAD;
      state.objects[(cy - 1) * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
    }
  }
  for (let dy = -12; dy <= 12; dy++) {
    state.terrain[(cy + dy) * WORLD_SIZE + cx] = TERRAIN.ROAD;
    state.objects[(cy + dy) * WORLD_SIZE + cx] = OBJECT.NONE;
    if (Math.abs(dy) > 4) {
      state.terrain[(cy + dy) * WORLD_SIZE + (cx + 1)] = TERRAIN.ROAD;
      state.objects[(cy + dy) * WORLD_SIZE + (cx + 1)] = OBJECT.NONE;
    }
  }
  // Walls
  for (const [dx, dy] of [[-4,-4],[-3,-4],[-2,-4],[2,-4],[3,-4],[4,-4],[-4,4],[-3,4],[-2,4],[2,4],[3,4],[4,4],[-4,-3],[-4,-2],[-4,2],[-4,3],[4,-3],[4,-2],[4,2],[4,3]])
    state.objects[(cy + dy) * WORLD_SIZE + (cx + dx)] = OBJECT.WALL;
  state.objects[(cy - 1) * WORLD_SIZE + (cx - 1)] = OBJECT.CAMPFIRE;
  state.objects[(cy + 2) * WORLD_SIZE + (cx + 2)] = OBJECT.CHEST;
  // Ruins
  const rx = cx + 30, ry = cy + 20;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = (ry + dy) * WORLD_SIZE + (rx + dx);
    state.terrain[i] = TERRAIN.STONE_FLOOR;
    state.objects[i] = OBJECT.NONE;
  }
  for (const [dx, dy] of [[-3,-3],[-2,-3],[0,-3],[1,-3],[3,-3],[-3,-2],[-3,0],[-3,1],[3,-1],[3,0],[3,2],[3,3],[-1,3],[0,3],[2,3]])
    state.objects[(ry + dy) * WORLD_SIZE + (rx + dx)] = OBJECT.RUINS;
  state.objects[ry * WORLD_SIZE + rx] = OBJECT.CAMPFIRE;
}

function clearSpawnArea(state: GameState) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = (state.py + dy) * WORLD_SIZE + (state.px + dx);
    if (state.objects[i] === OBJECT.TREE || state.objects[i] === OBJECT.ROCK || state.objects[i] === OBJECT.BUSH)
      state.objects[i] = OBJECT.NONE;
  }
}

export function spawnNPCs(state: GameState) {
  state.npcs = [
    { id: state.nextId++, x: 126, y: 127, name: 'Merchant Hilda', type: 'merchant', color: '#d4a060',
      sells: [
        { name: 'Healing Potion', color: '#c44a4a', value: 15, desc: 'Restores 30 HP' },
        { name: 'Mana Potion', color: '#4a6ac4', value: 20, desc: 'Restores 25 MP' },
        { name: 'Antidote', color: '#4aaa4a', value: 10, desc: 'Cures poison' },
        { name: 'Torch', color: '#d4a430', value: 5, desc: 'Lights dark areas' },
      ], buysFor: 50 },
    { id: state.nextId++, x: 130, y: 127, name: 'Smith Gareth', type: 'blacksmith', color: '#8a6a4a',
      sells: [
        { name: 'Iron Sword', color: '#aab4c4', value: 40, desc: '+2 attack' },
        { name: 'Leather Armor', color: '#6a4a2a', value: 35, desc: '+1 defense' },
        { name: 'Steel Shield', color: '#7a7a7a', value: 50, desc: '+2 defense' },
        { name: 'Arrows (20)', color: '#8a6a3a', value: 12, desc: 'Ammunition' },
      ], buysFor: 40 },
  ];
}
