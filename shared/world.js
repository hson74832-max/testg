export const WORLD_SIZE = 256;

export const TERRAIN = Object.freeze({
  WATER: 0, SAND: 1, GRASS: 2, DARK_GRASS: 3, DIRT: 4,
  STONE: 5, SWAMP: 6, STONE_FLOOR: 7, ROAD: 8,
});

export const OBJECT = Object.freeze({
  NONE: 0, TREE: 1, ROCK: 2, BUSH: 3, CACTUS: 4,
  WALL: 5, CAMPFIRE: 6, CHEST: 7, STAIR_DOWN: 8, RUINS: 9,
});

export function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = n ^ (n >> 16);
  return (n & 0x7fffffff) / 0x7fffffff;
}

function noise2d(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, oct) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise2d(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return v;
}

export function getTerrain(x, y) {
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

export function getObject(x, y, terrain) {
  const h = hash(x * 7 + 13, y * 11 + 37);
  if (terrain === TERRAIN.DARK_GRASS && h < 0.35) return OBJECT.TREE;
  if (terrain === TERRAIN.GRASS && h < 0.06) return OBJECT.TREE;
  if (terrain === TERRAIN.GRASS && h > 0.93) return OBJECT.BUSH;
  if (terrain === TERRAIN.STONE && h < 0.12) return OBJECT.ROCK;
  if (terrain === TERRAIN.SAND && h > 0.96) return OBJECT.CACTUS;
  if (terrain === TERRAIN.DIRT && h < 0.04) return OBJECT.ROCK;
  return OBJECT.NONE;
}

export function createWorld() {
  const terrain = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  const objects = new Uint8Array(WORLD_SIZE * WORLD_SIZE);
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const i = y * WORLD_SIZE + x;
      terrain[i] = getTerrain(x, y);
      objects[i] = getObject(x, y, terrain[i]);
    }
  }

  const cx = 128, cy = 128;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    terrain[(cy + dy) * WORLD_SIZE + (cx + dx)] = TERRAIN.STONE_FLOOR;
    objects[(cy + dy) * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
  }
  for (let dx = -15; dx <= 15; dx++) {
    terrain[cy * WORLD_SIZE + (cx + dx)] = TERRAIN.ROAD;
    objects[cy * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
    if (Math.abs(dx) > 4) {
      terrain[(cy - 1) * WORLD_SIZE + (cx + dx)] = TERRAIN.ROAD;
      objects[(cy - 1) * WORLD_SIZE + (cx + dx)] = OBJECT.NONE;
    }
  }
  for (let dy = -12; dy <= 12; dy++) {
    terrain[(cy + dy) * WORLD_SIZE + cx] = TERRAIN.ROAD;
    objects[(cy + dy) * WORLD_SIZE + cx] = OBJECT.NONE;
    if (Math.abs(dy) > 4) {
      terrain[(cy + dy) * WORLD_SIZE + (cx + 1)] = TERRAIN.ROAD;
      objects[(cy + dy) * WORLD_SIZE + (cx + 1)] = OBJECT.NONE;
    }
  }
  for (const [dx, dy] of [[-4,-4],[-3,-4],[-2,-4],[2,-4],[3,-4],[4,-4],[-4,4],[-3,4],[-2,4],[2,4],[3,4],[4,4],[-4,-3],[-4,-2],[-4,2],[-4,3],[4,-3],[4,-2],[4,2],[4,3]])
    objects[(cy + dy) * WORLD_SIZE + (cx + dx)] = OBJECT.WALL;
  objects[(cy - 1) * WORLD_SIZE + (cx - 1)] = OBJECT.CAMPFIRE;
  objects[(cy + 2) * WORLD_SIZE + (cx + 2)] = OBJECT.CHEST;

  const rx = cx + 30, ry = cy + 20;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const i = (ry + dy) * WORLD_SIZE + (rx + dx);
    terrain[i] = TERRAIN.STONE_FLOOR;
    objects[i] = OBJECT.NONE;
  }
  for (const [dx, dy] of [[-3,-3],[-2,-3],[0,-3],[1,-3],[3,-3],[-3,-2],[-3,0],[-3,1],[3,-1],[3,0],[3,2],[3,3],[-1,3],[0,3],[2,3]])
    objects[(ry + dy) * WORLD_SIZE + (rx + dx)] = OBJECT.RUINS;
  objects[ry * WORLD_SIZE + rx] = OBJECT.CAMPFIRE;

  return { terrain, objects };
}

export function isWalkableTile(terrain, objects, x, y) {
  if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) return false;
  const i = y * WORLD_SIZE + x;
  if (terrain[i] === TERRAIN.WATER) return false;
  const obj = objects[i];
  return obj !== OBJECT.TREE && obj !== OBJECT.ROCK && obj !== OBJECT.WALL && obj !== OBJECT.RUINS && obj !== OBJECT.CACTUS;
}
