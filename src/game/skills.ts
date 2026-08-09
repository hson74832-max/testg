import { GameState } from './types';

export function activateSkill(state: GameState, idx: number, now: number) {
  if (idx < 0 || idx >= state.skills.length) return;
  const skill = state.skills[idx];
  if (now - skill.lastUsed < skill.cooldown) return;

  skill.lastUsed = now;
  skill.active = true;
  state.hudActivity = now;
  state.activeSkillIdx = idx;

  const sn = skill.name;

  if (sn === 'Heal') {
    const amt = Math.floor(state.maxHp * 0.25 + state.level * 5);
    if (state.hp < state.maxHp) {
      state.hp = Math.min(state.maxHp, state.hp + amt);
    }
  } else if (sn === 'Fish') {
    // Fish logic (simplified)
    const hasWater = true; // placeholder
    if (hasWater) {
      const v = 4 + Math.floor(Math.random() * 5);
      state.gold += v;
    }
  } else if (sn === 'Inventory') {
    state.inventoryOpen = !state.inventoryOpen;
  } else if (sn === 'Outfit') {
    state.outfitMenuOpen = !state.outfitMenuOpen;
  }

  setTimeout(() => { skill.active = false; }, 200);
}
