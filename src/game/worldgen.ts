import { GameState } from './types';
import { WORLD_SIZE, OBJECT } from './constants';
import { createWorld } from '../../shared/world.js';

export function generateWorld(state: GameState) {
  const world = createWorld();
  state.terrain = world.terrain;
  state.objects = world.objects;
  state.explored = new Uint8Array(WORLD_SIZE * WORLD_SIZE);

  // Keep the existing spawn-area guarantee: clear only random blocking objects.
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
