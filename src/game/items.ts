import { GameState } from './types';

export function getItemWeight(name: string): number {
  const l = name.toLowerCase();
  if (l.includes('sword') || l.includes('axe') || l.includes('mace')) return 8;
  if (l.includes('armor') || l.includes('chest')) return 12;
  if (l.includes('helmet') || l.includes('hat')) return 4;
  if (l.includes('shield')) return 6;
  if (l.includes('boots')) return 3;
  if (l.includes('legs') || l.includes('pants')) return 5;
  if (l.includes('ring') || l.includes('amulet') || l.includes('necklace')) return 0.5;
  if (l.includes('bow') || l.includes('wand')) return 4;
  if (l.includes('potion')) return 1;
  if (l.includes('arrows')) return 2;
  if (l.includes('bone') || l.includes('pelt') || l.includes('fur')) return 2;
  if (l.includes('meat') || l.includes('food')) return 1;
  if (l.includes('coin') || l.includes('gem')) return 0.1;
  return 1;
}

export function getItemRarity(name: string): 'common' | 'rare' | 'epic' | 'legendary' {
  const l = name.toLowerCase();
  if (l.includes('legendary') || l.includes('ancient')) return 'legendary';
  if (l.includes('epic') || l.includes('venom sac')) return 'epic';
  if (l.includes('rare') || l.includes('iron') || l.includes('steel')) return 'rare';
  return 'common';
}

export function getItemCategory(name: string): 'weapon' | 'armor' | 'consumable' | 'junk' | 'other' {
  const l = name.toLowerCase();
  if (l.includes('sword') || l.includes('bow') || l.includes('wand') || l.includes('axe') || l.includes('arrow')) return 'weapon';
  if (l.includes('armor') || l.includes('helmet') || l.includes('boots') || l.includes('shield') || l.includes('legs')) return 'armor';
  if (l.includes('potion') || l.includes('antidote') || l.includes('food') || l.includes('meat') || l.includes('torch')) return 'consumable';
  if (l.includes('bone') || l.includes('tail') || l.includes('gel') || l.includes('silk') || l.includes('pelt') || l.includes('fur')) return 'junk';
  return 'other';
}

export function shouldAutoloot(state: GameState, itemName: string): boolean {
  const f = state.autolootFilter;
  if (itemName === 'Gold') return f.pickGold;
  const rarity = getItemRarity(itemName);
  const cat = getItemCategory(itemName);
  if (rarity === 'legendary' && f.pickLegendary) return true;
  if (rarity === 'epic' && f.pickEpic) return true;
  if (rarity === 'rare' && f.pickRare) return true;
  if (cat === 'weapon' && f.pickWeapons) return true;
  if (cat === 'armor' && f.pickArmor) return true;
  if (cat === 'consumable' && f.pickConsumables) return true;
  if (cat === 'junk' && f.pickJunk) return true;
  if (rarity === 'common' && f.pickCommon) return true;
  return false;
}

export function getCurrentWeight(state: GameState): number {
  let w = 0;
  for (const item of state.inventory) w += getItemWeight(item.name) * item.count;
  for (const slot of Object.values(state.equipment)) if (slot) w += getItemWeight(slot.name);
  return Math.round(w * 10) / 10;
}

export function getMovementSpeedMultiplier(state: GameState): number {
  const ratio = getCurrentWeight(state) / state.maxCapacity;
  if (ratio < 0.5) return 1.0;
  if (ratio < 1.0) return 1.0 + (ratio - 0.5) * 2;
  return 2.0 + (ratio - 1.0) * 2;
}

export function addToInventory(state: GameState, name: string, color: string, value: number) {
  const existing = state.inventory.find(item => item.name === name);
  if (existing) existing.count++;
  else state.inventory.push({ name, color, value, count: 1, weight: getItemWeight(name), rarity: getItemRarity(name) });
}
