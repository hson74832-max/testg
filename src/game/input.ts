import { GameState } from './types';

export function handleKeyDown(state: GameState, key: string, now: number) {
  if (!state.gameStarted && state.charCreationOpen) {
    if (key === 'Backspace') { state.charCreationName = state.charCreationName.slice(0, -1); return; }
    if (key === 'Enter') { state.charCreationOpen = false; return; }
    if (key.length === 1 && state.charCreationName.length < 14) { state.charCreationName += key; }
    return;
  }
  if (!state.gameStarted) return;

  const lk = key.toLowerCase();

  if (key === 'Alt') { state.altKeyDown = true; return; }
  if (lk === 'escape' && state.shopOpen) { state.shopOpen = false; state.shopNpc = null; state.hudActivity = now; return; }
  if (state.shopOpen) return;
  if (lk === 'o' || (lk === 'escape' && state.outfitMenuOpen)) { state.outfitMenuOpen = !state.outfitMenuOpen; state.hudActivity = now; return; }
  if (state.outfitMenuOpen) return;
  if (lk === 'escape' && state.skillTreeOpen) { state.skillTreeOpen = false; state.hudActivity = now; return; }
  if (state.skillTreeOpen) return;
  if (lk === 'escape' && state.autolootSettingsOpen) { state.autolootSettingsOpen = false; state.hudActivity = now; return; }
  if (state.autolootSettingsOpen) return;
  if (lk === 'i' || (lk === 'escape' && state.inventoryOpen)) { state.inventoryOpen = !state.inventoryOpen; state.hudActivity = now; return; }
  if (state.inventoryOpen) return;
  if (lk === 'escape' && state.friendListOpen) { state.friendListOpen = false; return; }
  if (lk === 'escape' && state.partyOpen) { state.partyOpen = false; return; }

  if (lk === 'f') { state.friendListOpen = !state.friendListOpen; state.partyOpen = false; return; }
  if (lk === 'p') { state.partyOpen = !state.partyOpen; state.friendListOpen = false; return; }
  if (lk === 't') { state.skillTreeOpen = !state.skillTreeOpen; state.hudActivity = now; return; }
  if (lk === 'e') { state.inventoryOpen = !state.inventoryOpen; state.hudActivity = now; return; }

  if (lk >= '1' && lk <= '9') {
    const idx = parseInt(lk) - 1;
    if (idx < state.skills.length) {
      activateSkill(state, idx, now);
    }
    return;
  }

  state.keysDown.add(lk);
  state.hudActivity = now;
  state.minimapActivity = now;
  state.moveTarget = null;
}

export function handleKeyUp(state: GameState, key: string) {
  state.keysDown.delete(key.toLowerCase());
  if (key === 'Alt') {
    state.altKeyDown = false;
    if (state.pushHeld) { state.pushHeld = false; state.pushTargetId = null; }
  }
}

function activateSkill(state: GameState, idx: number, now: number) {
  if (idx < 0 || idx >= state.skills.length) return;
  const skill = state.skills[idx];
  if (now - skill.lastUsed < skill.cooldown) return;
  skill.lastUsed = now;
  state.hudActivity = now;
  state.activeSkillIdx = idx;
}
