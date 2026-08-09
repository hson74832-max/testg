export const WORLD_SIZE: number;
export const TERRAIN: {
  readonly WATER: 0; readonly SAND: 1; readonly GRASS: 2; readonly DARK_GRASS: 3;
  readonly DIRT: 4; readonly STONE: 5; readonly SWAMP: 6; readonly STONE_FLOOR: 7; readonly ROAD: 8;
};
export const OBJECT: {
  readonly NONE: 0; readonly TREE: 1; readonly ROCK: 2; readonly BUSH: 3; readonly CACTUS: 4;
  readonly WALL: 5; readonly CAMPFIRE: 6; readonly CHEST: 7; readonly STAIR_DOWN: 8; readonly RUINS: 9;
};
export function createWorld(): { terrain: Uint8Array; objects: Uint8Array };
export function isWalkableTile(terrain: Uint8Array, objects: Uint8Array, x: number, y: number): boolean;
