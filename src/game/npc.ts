import { GameState, NPC } from './types';
import { chebDist } from './utils';

export function handleNPCInteraction(state: GameState, clickedNpc: NPC) {
  state.interactTarget = clickedNpc;
  state.attackTarget = null;

  const dist = chebDist(state.px, state.py, clickedNpc.x, clickedNpc.y);
  if (dist <= 2) {
    state.shopNpc = clickedNpc;
    state.shopOpen = true;
  } else {
    state.moveTarget = { x: clickedNpc.x, y: clickedNpc.y };
  }
}

export function checkNPCProximity(state: GameState) {
  if (!state.interactTarget) return;

  const dist = chebDist(state.px, state.py, state.interactTarget.x, state.interactTarget.y);
  if (dist <= 2) {
    state.shopNpc = state.interactTarget;
    state.shopOpen = true;
    state.interactTarget = null;
    state.moveTarget = null;
  }
}
