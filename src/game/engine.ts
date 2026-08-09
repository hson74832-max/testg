// ═══════════════════════════════════════════════════════════
// REMNANTS — Engine (Orchestrator)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// REMNANTS — Engine (Orchestrator)
// ═══════════════════════════════════════════════════════════

import { GameState, Monster, PlayerClass, PlayerOutfit, Skill, OUTFIT_PRESETS, WorldItem } from './types';
export type { GameState, Monster, WorldItem } from './types';
import { updateMonsters } from './monster';
import { handleOptionsClick, renderOptions } from './options';
export { renderOptions };

// Re-export constants with old names for backward compat
export const WORLD_SIZE = 256;
export const VIEW_MIN_RADIUS = 10;
export const STEP_DELAY = 240;
export const STEP_DELAY_DIAGONAL = 360;
export const MONSTER_ATTACK_DELAY = 1200;
export const PLAYER_ATTACK_DELAY = 1000;
export const HP_REGEN_DELAY = 3000;
export const COMBAT_TIMEOUT = 5000;
export const HUD_FADE_TIME = 5000;
export const HUD_FADE_DUR = 2000;

export const T = { WATER: 0, SAND: 1, GRASS: 2, DARK_GRASS: 3, DIRT: 4, STONE: 5, SWAMP: 6, STONE_FLOOR: 7, ROAD: 8 } as const;
export const OBJ = { NONE: 0, TREE: 1, ROCK: 2, BUSH: 3, CACTUS: 4, WALL: 5, CAMPFIRE: 6, CHEST: 7, STAIR_DOWN: 8, RUINS: 9 } as const;

import { generateWorld as worldGenGenerateWorld } from './worldgen';

export function generateWorld(state: GameState) {
  worldGenGenerateWorld(state);
}

function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  n = (n ^ (n >> 16));
  return (n & 0x7fffffff) / 0x7fffffff;
}

function noise2d(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// === MONSTER TEMPLATES ===
interface MonsterTemplate {
  type: string; hp: number; damage: number; defense: number;
  xp: number; color: string; bodyColor: string;
  aggroRange: number; moveDelay: number;
  drops: { name: string; color: string; value: number }[];
  biomes: number[];
}

const MONSTER_TEMPLATES: MonsterTemplate[] = [
  { type: 'Rat',      hp: 10,  damage: 1,  defense: 0, xp: 6,  color: '#8a6a4a', bodyColor: '#7a5a3a',
    aggroRange: 8, moveDelay: 500,
    drops: [{ name: 'Rat Tail', color: '#a08060', value: 2 }],
    biomes: [T.GRASS, T.DIRT, T.STONE_FLOOR] },
  { type: 'Wolf',     hp: 26,  damage: 4,  defense: 0, xp: 14, color: '#7a7a7a', bodyColor: '#6a6a6a',
    aggroRange: 8, moveDelay: 550,
    drops: [{ name: 'Wolf Pelt', color: '#606060', value: 6 }, { name: 'Meat', color: '#c46a5a', value: 4 }],
    biomes: [T.GRASS, T.DARK_GRASS, T.DIRT] },
  { type: 'Spider',   hp: 18,  damage: 3,  defense: 0, xp: 10, color: '#3a3a3a', bodyColor: '#2a2a2a',
    aggroRange: 8, moveDelay: 420,
    drops: [{ name: 'Silk', color: '#d0d0d0', value: 5 }, { name: 'Venom Sac', color: '#6a9a3a', value: 7 }],
    biomes: [T.DARK_GRASS, T.SWAMP] },
  { type: 'Skeleton', hp: 38,  damage: 6,  defense: 1, xp: 22, color: '#d4d4c4', bodyColor: '#c0c0b0',
    aggroRange: 8, moveDelay: 650,
    drops: [{ name: 'Bone', color: '#d0d0c0', value: 3 }, { name: 'Ancient Coin', color: '#d4a430', value: 12 }],
    biomes: [T.STONE_FLOOR, T.STONE] },
  { type: 'Bear',     hp: 55,  damage: 9,  defense: 2, xp: 32, color: '#5a3a1a', bodyColor: '#4a2a0a',
    aggroRange: 8, moveDelay: 750,
    drops: [{ name: 'Bear Fur', color: '#5a4a3a', value: 10 }, { name: 'Meat', color: '#c46a5a', value: 4 }],
    biomes: [T.DARK_GRASS, T.GRASS] },
  { type: 'Slime',    hp: 14,  damage: 2,  defense: 0, xp: 7,  color: '#4aaa4a', bodyColor: '#3a8a3a',
    aggroRange: 8, moveDelay: 850,
    drops: [{ name: 'Slime Gel', color: '#5aba5a', value: 2 }],
    biomes: [T.SWAMP] },
];

function makeMonster(state: GameState, tmpl: MonsterTemplate, x: number, y: number): Monster {
  return {
    id: state.nextId++, type: tmpl.type, x, y,
    hp: tmpl.hp, maxHp: tmpl.hp,
    damage: tmpl.damage, defense: tmpl.defense, xp: tmpl.xp,
    color: tmpl.color, bodyColor: tmpl.bodyColor,
    aggroRange: tmpl.aggroRange, moveDelay: tmpl.moveDelay,
    lastMove: 0, lastAttack: 0,
    dead: false, deathTime: 0,
    drops: tmpl.drops.map(d => ({ ...d })),
    attackedByPlayer: false, attackingPlayer: false,
    pushable: tmpl.type !== 'Bear' && tmpl.type !== 'Slime',
    pushedUntil: 0,
  };
}

export function spawnInitialMonsters(state: GameState) {
  let placed = 0, attempts = 0;
  while (placed < 120 && attempts < 5000) {
    attempts++;
    const x = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
    const y = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
    if (Math.abs(x - state.px) + Math.abs(y - state.py) < 8) continue;
    const i = y * WORLD_SIZE + x;
    if (state.terrain[i] === T.WATER || state.objects[i] !== OBJ.NONE) continue;
    if (state.monsters.some(m => m.x === x && m.y === y)) continue;
    const candidates = MONSTER_TEMPLATES.filter(t => t.biomes.includes(state.terrain[i]));
    if (candidates.length === 0) continue;
    state.monsters.push(makeMonster(state, candidates[Math.floor(Math.random() * candidates.length)], x, y));
    placed++;
  }
}

// === HELPERS ===
export function isWalkable(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) return false;
  const i = y * WORLD_SIZE + x;
  if (state.terrain[i] === T.WATER) return false;
  const obj = state.objects[i];
  if (obj === OBJ.TREE || obj === OBJ.ROCK || obj === OBJ.WALL || obj === OBJ.RUINS || obj === OBJ.CACTUS) return false;
  if (state.monsters.some(m => !m.dead && m.x === x && m.y === y)) return false;
  return true;
}

function chebDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function addLog(state: GameState, text: string, color: string) {
  state.log.push({ text, color, time: performance.now() });
  if (state.log.length > 50) state.log.shift();
}

export function addFloat(state: GameState, x: number, y: number, text: string, color: string) {
  state.floatTexts.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
}

export function addParticles(state: GameState, x: number, y: number, count: number, color: string, spread: number) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread,
      vy: (Math.random() - 0.5) * spread - 0.5,
      life: 0.5 + Math.random() * 0.5, maxLife: 1.0,
      color, size: 2 + Math.random() * 3,
    });
  }
}

function getItemWeight(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('sword') || lower.includes('axe') || lower.includes('mace')) return 8;
  if (lower.includes('armor') || lower.includes('chest')) return 12;
  if (lower.includes('helmet') || lower.includes('hat')) return 4;
  if (lower.includes('shield')) return 6;
  if (lower.includes('boots')) return 3;
  if (lower.includes('legs') || lower.includes('pants')) return 5;
  if (lower.includes('ring') || lower.includes('amulet') || lower.includes('necklace')) return 0.5;
  if (lower.includes('bow') || lower.includes('wand')) return 4;
  if (lower.includes('potion')) return 1;
  if (lower.includes('arrows')) return 2;
  if (lower.includes('bone') || lower.includes('pelt') || lower.includes('fur')) return 2;
  if (lower.includes('meat') || lower.includes('food')) return 1;
  if (lower.includes('coin') || lower.includes('gem')) return 0.1;
  return 1;
}

function getItemRarity(name: string): 'common' | 'rare' | 'epic' | 'legendary' {
  const lower = name.toLowerCase();
  if (lower.includes('legendary') || lower.includes('ancient')) return 'legendary';
  if (lower.includes('epic') || lower.includes('venom sac')) return 'epic';
  if (lower.includes('rare') || lower.includes('iron') || lower.includes('steel')) return 'rare';
  return 'common';
}

function getItemCategory(name: string): 'weapon' | 'armor' | 'consumable' | 'junk' | 'other' {
  const lower = name.toLowerCase();
  if (lower.includes('sword') || lower.includes('bow') || lower.includes('wand') || lower.includes('axe') || lower.includes('arrow')) return 'weapon';
  if (lower.includes('armor') || lower.includes('helmet') || lower.includes('boots') || lower.includes('shield') || lower.includes('legs')) return 'armor';
  if (lower.includes('potion') || lower.includes('antidote') || lower.includes('food') || lower.includes('meat') || lower.includes('torch')) return 'consumable';
  if (lower.includes('bone') || lower.includes('tail') || lower.includes('gel') || lower.includes('silk') || lower.includes('pelt') || lower.includes('fur')) return 'junk';
  return 'other';
}

function shouldAutoloot(state: GameState, itemName: string): boolean {
  const f = state.autolootFilter;
  if (itemName === 'Gold') return f.pickGold;

  const rarity = getItemRarity(itemName);
  const category = getItemCategory(itemName);

  // Rarity filter
  if (rarity === 'legendary' && f.pickLegendary) return true;
  if (rarity === 'epic' && f.pickEpic) return true;
  if (rarity === 'rare' && f.pickRare) return true;

  // Category filter
  if (category === 'weapon' && f.pickWeapons) return true;
  if (category === 'armor' && f.pickArmor) return true;
  if (category === 'consumable' && f.pickConsumables) return true;
  if (category === 'junk' && f.pickJunk) return true;

  // Default: pick common items only if explicitly enabled
  if (rarity === 'common' && f.pickCommon) return true;

  return false;
}

export function getCurrentWeight(state: GameState): number {
  let weight = 0;
  for (const item of state.inventory) {
    weight += getItemWeight(item.name) * item.count;
  }
  for (const slot of Object.values(state.equipment)) {
    if (slot) weight += getItemWeight(slot.name);
  }
  return Math.round(weight * 10) / 10;
}

function getMovementSpeedMultiplier(state: GameState): number {
  const w = getCurrentWeight(state);
  const ratio = w / state.maxCapacity;
  // No penalty under 50% capacity
  if (ratio < 0.5) return 1.0;
  // Linear slowdown from 50% to 100% (1.0 -> 2.0 delay multiplier)
  if (ratio < 1.0) return 1.0 + (ratio - 0.5) * 2;
  // Over capacity: heavily penalized
  return 2.0 + (ratio - 1.0) * 2;
}

function addToInventory(state: GameState, name: string, color: string, value: number) {
  const existing = state.inventory.find(item => item.name === name);
  if (existing) existing.count++;
  else state.inventory.push({ name, color, value, count: 1, weight: getItemWeight(name), rarity: getItemRarity(name) });
}

// === COMBAT ===
function playerAttackMonster(state: GameState, monster: Monster, now: number) {
  if (now - state.lastAttack < PLAYER_ATTACK_DELAY) return;
  state.lastAttack = now;
  state.lastCombat = now;
  state.hudActivity = now;
  const rawDmg = state.playerDamage + Math.floor(Math.random() * 3);
  const dmg = Math.max(1, rawDmg - monster.defense);
  monster.hp -= dmg;
  monster.attackedByPlayer = true;
  addFloat(state, monster.x, monster.y, `-${dmg}`, '#ff4444');
  addParticles(state, monster.x, monster.y, 5, '#8a2222', 2);
  state.screenShake = 0.15;
  addLog(state, `You hit ${monster.type} for ${dmg} damage.`, '#ffaa44');

  if (monster.hp <= 0) {
    monster.dead = true;
    monster.deathTime = now;
    monster.attackedByPlayer = false;
    monster.attackingPlayer = false;
    state.xp += monster.xp;
    state.monstersKilled++;
    addFloat(state, monster.x, monster.y, `+${monster.xp} XP`, '#44ff44');
    addLog(state, `${monster.type} defeated! +${monster.xp} XP`, '#44ff44');
    for (const drop of monster.drops) {
      if (Math.random() < 0.6)
        state.items.push({ id: state.nextId++, x: monster.x, y: monster.y, name: drop.name, color: drop.color, value: drop.value, spawnTime: now });
    }
    state.items.push({ id: state.nextId++, x: monster.x, y: monster.y, name: 'Gold', color: '#d4a430', value: Math.floor(Math.random() * monster.xp) + 1, spawnTime: now });
    checkLevelUp(state);
    state.attackTarget = null;
  }
}



export function checkLevelUp(state: GameState) {
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level++;
    state.xpToNext = Math.floor(state.xpToNext * 1.6);
    state.maxHp += 12; state.hp = state.maxHp;
    state.maxMana += 6; state.mana = state.maxMana;
    state.playerDamage++; state.playerDefense++;
    state.skillPoints++;
    addFloat(state, state.px, state.py, `LEVEL ${state.level}!`, '#ffdd44');
    addLog(state, `Level up! You are now level ${state.level}. (+1 Skill Point)`, '#ffdd44');
    addParticles(state, state.px, state.py, 20, '#ffdd44', 4);
  }
}

function recalculateStats(state: GameState) {
  // Base stats from class + level
  let baseDamage = 5 + (state.level - 1);
  let baseDefense = 1 + Math.floor((state.level - 1) / 2);
  let hpBonus = 0;
  let manaBonus = 0;

  // Apply equipment bonuses
  const slots = Object.values(state.equipment).filter(Boolean);
  for (const item of slots) {
    if (item.bonuses) {
      baseDamage += item.bonuses.damage || 0;
      baseDefense += item.bonuses.defense || 0;
      hpBonus += item.bonuses.hp || 0;
      manaBonus += item.bonuses.mana || 0;
    }
  }

  // Apply skill bonuses
  if (state.unlockedSkills.includes('combat1')) baseDamage += 2;
  if (state.unlockedSkills.includes('combat2')) baseDefense += 3;
  if (state.unlockedSkills.includes('surv1')) hpBonus += 15;
  if (state.unlockedSkills.includes('surv2')) { /* movement speed handled elsewhere */ }
  if (state.unlockedSkills.includes('magic1')) manaBonus += 10;

  state.playerDamage = baseDamage;
  state.playerDefense = baseDefense;

  const targetMaxHp = 100 + (state.level - 1) * 12 + hpBonus;
  const targetMaxMana = 50 + (state.level - 1) * 6 + manaBonus;

  if (state.maxHp < targetMaxHp) state.maxHp = targetMaxHp;
  if (state.maxMana < targetMaxMana) state.maxMana = targetMaxMana;

  state.hp = Math.min(state.hp, state.maxHp);
  state.mana = Math.min(state.mana, state.maxMana);
}

// === SKILL ACTIVATION ===
function activateSkill(state: GameState, idx: number, now: number) {
  if (idx < 0 || idx >= state.skills.length) return;
  const skill = state.skills[idx];
  if (now - skill.lastUsed < skill.cooldown) return;

  const sn = skill.name;
  skill.lastUsed = now;
  skill.active = true;
  state.hudActivity = now;
  state.activeSkillIdx = idx;

  const hitTarget = (bonus: number, color: string, label: string) => {
    if (!state.attackTarget || state.attackTarget.dead) { addLog(state, `${label} — target a monster first.`, '#888'); return; }
    const m = state.attackTarget;
    if (chebDist(state.px, state.py, m.x, m.y) > state.attackRange) { addLog(state, 'Target out of range.', '#888'); return; }
    const dmg = Math.max(1, state.playerDamage + bonus - m.defense);
    m.hp -= dmg; m.attackedByPlayer = true;
    state.lastAttack = now; state.lastCombat = now;
    addFloat(state, m.x, m.y, `-${dmg}`, color);
    addParticles(state, m.x, m.y, 10, color, 3);
    state.screenShake = 0.2;
    addLog(state, `${label}! ${dmg} damage to ${m.type}.`, color);
    if (m.hp <= 0) { m.dead = true; m.deathTime = now; state.xp += m.xp; state.monstersKilled++; checkLevelUp(state); state.attackTarget = null; }
  };

  if (sn === 'Power Strike' || sn === 'Power Shot' || sn === 'Arcane Bolt') {
    const bonus = sn === 'Power Strike' ? 8 : sn === 'Power Shot' ? 6 : Math.floor(state.level * 2);
    hitTarget(bonus, sn === 'Arcane Bolt' ? '#cc88ff' : '#ff8800', sn);
  } else if (sn === 'Shield Bash') {
    state.playerDefense += 2; state.hp = Math.min(state.maxHp, state.hp + 15);
    addFloat(state, state.px, state.py, 'DEFENDED!', '#4a8aff');
    addParticles(state, state.px, state.py, 8, '#4a6aff', 2);
    addLog(state, 'Shield raised! +2 DEF, +15 HP.', '#4a8aff');
    setTimeout(() => { state.playerDefense -= 2; }, skill.cooldown);
  } else if (sn === 'Heal') {
    const amt = Math.floor(state.maxHp * 0.25 + state.level * 5);
    const actual = Math.min(amt, state.maxHp - state.hp);
    if (state.hp < state.maxHp) {
      state.hp = Math.min(state.maxHp, state.hp + amt);
      addFloat(state, state.px, state.py, `+${actual} HP`, '#44ff88');
      addParticles(state, state.px, state.py, 12, '#44ff88', 3);
      addLog(state, `Healed for ${actual} HP!`, '#44ff88');
    } else { addLog(state, 'Already at full health.', '#888'); }
  } else if (sn === 'Whirlwind' || sn === 'Multi Shot' || sn === 'Wildfire') {
    const range = sn === 'Multi Shot' ? 3 : 2;
    const cost = sn === 'Wildfire' ? 20 : 0;
    if (cost > 0 && state.mana < cost) { addLog(state, `Not enough mana.`, '#888'); return; }
    if (cost > 0) state.mana -= cost;
    let hits = 0;
    for (const m of state.monsters) {
      if (m.dead) continue;
      if (chebDist(state.px, state.py, m.x, m.y) <= range) {
        const dmg = Math.floor(state.playerDamage * 1.2 + 3);
        m.hp -= dmg; m.attackedByPlayer = true;
        addFloat(state, m.x, m.y, `-${dmg}`, '#ff6600');
        addParticles(state, m.x, m.y, 6, '#ff4400', 3);
        if (m.hp <= 0) { m.dead = true; m.deathTime = now; state.xp += m.xp; state.monstersKilled++; checkLevelUp(state); }
        hits++;
      }
    }
    addParticles(state, state.px, state.py, 15, '#ff6600', 5);
    state.screenShake = 0.3; state.lastCombat = now;
    addLog(state, `${sn}! Hit ${hits} enemies.`, '#ff6600');
  } else if (sn === 'Evasion') {
    state.playerDefense += 3;
    addFloat(state, state.px, state.py, 'EVADING!', '#6a9a6a');
    addParticles(state, state.px, state.py, 8, '#6a9a6a', 2);
    addLog(state, 'Evasion! +3 defense for 8s.', '#6a9a6a');
    setTimeout(() => { state.playerDefense -= 3; }, 8000);
  } else if (sn === 'Barrier') {
    state.playerDefense += 4;
    addFloat(state, state.px, state.py, 'BARRIER!', '#6a6aff');
    addParticles(state, state.px, state.py, 10, '#6a6aff', 3);
    addLog(state, 'Magic barrier! +4 defense for 10s.', '#6a6aff');
    setTimeout(() => { state.playerDefense -= 4; }, 10000);
  } else if (sn === 'Fish') {
    const hasWater = [-1,0,1].some(dy => [-1,0,1].some(dx => {
      const wx = state.px + dx, wy = state.py + dy;
      return wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE && state.terrain[wy * WORLD_SIZE + wx] === T.WATER;
    }));
    if (hasWater) {
      const v = 4 + Math.floor(Math.random() * 5);
      state.gold += v;
      addFloat(state, state.px, state.py, `+${v}g (fish)`, '#4a9ac4');
      addParticles(state, state.px, state.py, 6, '#4a9ac4', 2);
      addLog(state, `Caught a fish! +${v} gold.`, '#4a9ac4');
    } else { addLog(state, 'Need to be next to water to fish.', '#888'); }
  } else if (sn === 'Inventory') {
    state.inventoryOpen = !state.inventoryOpen;
  } else if (sn === 'Outfit') {
    state.outfitMenuOpen = !state.outfitMenuOpen;
  } else if (sn === 'Skill Tree') {
    state.skillTreeOpen = !state.skillTreeOpen;
  } else if (sn === 'Options') {
    state.optionsOpen = !state.optionsOpen;
  }

  setTimeout(() => { skill.active = false; }, 200);
}

// === UPDATE ===
export function update(state: GameState, now: number) {
  if (!state.gameStarted || state.inventoryOpen || state.shopOpen) return;

  // Auto-open shop when reaching interactTarget
  if (state.interactTarget) {
    const dist = chebDist(state.px, state.py, state.interactTarget.x, state.interactTarget.y);
    if (dist <= 2) {
      state.shopNpc = state.interactTarget;
      state.shopOpen = true;
      state.interactTarget = null;
      state.moveTarget = null;
      addLog(state, `${state.shopNpc.name}: "Welcome! Browse my wares."`, '#d4a060');
    }
  }

  // Respawn
  if (state.dead) {
    if (now - state.deathTime > 3000) {
      state.dead = false;
      state.hp = Math.floor(state.maxHp * 0.5);
      state.mana = Math.floor(state.maxMana * 0.5);
      state.px = state.respawnX; state.py = state.respawnY;
      state.camX = state.px; state.camY = state.py;
      state.moveTarget = null; state.attackTarget = null;
      state.playerUnderAttack = false;
      addLog(state, 'You respawn at the village.', '#aaaaaa');
    }
    return;
  }

  // Clear under-attack indicator after 600ms
  if (state.playerUnderAttack && now - state.playerUnderAttackTime > 600) {
    state.playerUnderAttack = false;
  }

  // Unified step delay for consistent keyboard + mouse movement
  const keys = state.keysDown;
  const wantUp    = keys.has('w') || keys.has('arrowup');
  const wantDown  = keys.has('s') || keys.has('arrowdown');
  const wantLeft  = keys.has('a') || keys.has('arrowleft');
  const wantRight = keys.has('d') || keys.has('arrowright');

  // Diagonal movement = slower; cardinal (left/right/up/down) = 240ms
  const hasHorizontal = wantLeft || wantRight;
  const hasVertical = wantUp || wantDown;
  const isDiagonal = hasHorizontal && hasVertical;
  const baseDelay = isDiagonal ? STEP_DELAY_DIAGONAL : STEP_DELAY;
  // Apply weight-based slowdown
  const stepDelay = baseDelay * getMovementSpeedMultiplier(state);

  if (now - state.lastStep >= stepDelay) {
    let dx = 0, dy = 0;

    if (wantUp)    dy = -1;
    if (wantDown)  dy =  1;
    if (wantLeft)  dx = -1;
    if (wantRight) dx =  1;

    // Click-to-move
    if (dx === 0 && dy === 0 && state.moveTarget) {
      const tx = state.moveTarget.x, ty = state.moveTarget.y;
      if (tx === state.px && ty === state.py) {
        state.moveTarget = null;
      } else {
        dx = Math.sign(tx - state.px);
        dy = Math.sign(ty - state.py);
        if (dx !== 0 && dy !== 0 && !isWalkable(state, state.px + dx, state.py + dy)) {
          if (isWalkable(state, state.px + dx, state.py)) dy = 0;
          else if (isWalkable(state, state.px, state.py + dy)) dx = 0;
          else { state.moveTarget = null; dx = 0; dy = 0; }
        }
        // Diagonal click-to-move = slower
        if (dx !== 0 && dy !== 0) {
          if (now - state.lastStep < STEP_DELAY_DIAGONAL) { dx = 0; dy = 0; }
        }
      }
    }

    // Only attack if in range — do not auto-chase the target
    if (dx === 0 && dy === 0 && state.attackTarget && !state.attackTarget.dead) {
      const m = state.attackTarget;
      if (chebDist(state.px, state.py, m.x, m.y) <= state.attackRange) {
        playerAttackMonster(state, m, now);
      }
    }

    if ((dx !== 0 || dy !== 0) && isWalkable(state, state.px + dx, state.py + dy)) {
      state.prevPx = state.px; state.prevPy = state.py;
      state.px += dx; state.py += dy;
      state.moveProgress = 0;
      state.lastStep = now;
      state.hudActivity = now;
      state.tilesWalked++;
      state.lastMovedSideways = (dx !== 0 && dy === 0);
      if      (dx > 0) state.facing = 1;
      else if (dx < 0) state.facing = 3;
      else if (dy > 0) state.facing = 2;
      else if (dy < 0) state.facing = 0;
      state.walkFrame++;

      // Explore
      for (let ey = -VIEW_MIN_RADIUS; ey <= VIEW_MIN_RADIUS; ey++)
        for (let ex = -VIEW_MIN_RADIUS; ex <= VIEW_MIN_RADIUS; ex++) {
          const wx = state.px + ex, wy = state.py + ey;
          if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE)
            state.explored[wy * WORLD_SIZE + wx] = 1;
        }

      // Auto-pickup items (filtered)
      const pickup = state.items.filter(it => it.x === state.px && it.y === state.py);
      const pickedIds: number[] = [];
      for (const item of pickup) {
        if (!shouldAutoloot(state, item.name)) continue;
        // Check capacity for non-gold items
        if (item.name !== 'Gold') {
          const newWeight = getCurrentWeight(state) + getItemWeight(item.name);
          if (newWeight > state.maxCapacity) {
            addFloat(state, state.px, state.py, 'Too heavy!', '#aa4444');
            continue;
          }
        }
        if (item.name === 'Gold') {
          state.gold += item.value;
          addFloat(state, state.px, state.py, `+${item.value}g`, '#d4a430');
        } else {
          addToInventory(state, item.name, item.color, item.value);
          addFloat(state, state.px, state.py, `+${item.name}`, '#aaddaa');
        }
        pickedIds.push(item.id);
        state.hudActivity = now;
      }
      state.items = state.items.filter(it => !pickedIds.includes(it.id));

      // Campfire regen
      if (isNearCampfire(state)) {
        state.hp   = Math.min(state.maxHp,   state.hp   + 3);
        state.mana = Math.min(state.maxMana, state.mana + 2);
      }
    }
  }

  // Move progress interpolation
  state.moveProgress = Math.min(1, (now - state.lastStep) / STEP_DELAY);

  // In-range continuous attack
  if (state.attackTarget && !state.attackTarget.dead) {
    const m = state.attackTarget;
    if (chebDist(state.px, state.py, m.x, m.y) <= state.attackRange) {
      playerAttackMonster(state, m, now);
    }
  }

  // Camera smooth follow
  state.camX += (state.px - state.camX) * 0.18;
  state.camY += (state.py - state.camY) * 0.18;
  if (Math.abs(state.camX - state.px) < 0.01) state.camX = state.px;
  if (Math.abs(state.camY - state.py) < 0.01) state.camY = state.py;

  // HP regen out of combat
  if (now - state.lastCombat > COMBAT_TIMEOUT && now - state.lastHpRegen > HP_REGEN_DELAY) {
    if (state.hp   < state.maxHp)   state.hp   = Math.min(state.maxHp,   state.hp   + 1);
    if (state.mana < state.maxMana) state.mana = Math.min(state.maxMana, state.mana + 1);
    state.lastHpRegen = now;
  }

  // Monster AI (delegated to monster.ts)
  updateMonsters(state, now);

  // Cull dead monsters
  state.monsters = state.monsters.filter(m => !(m.dead && now - m.deathTime > 5000));

  // Respawn monsters
  if (state.monsters.filter(m => !m.dead).length < 80) {
    const x = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
    const y = Math.floor(Math.random() * (WORLD_SIZE - 20)) + 10;
    if (chebDist(x, y, state.px, state.py) > 15) {
      const i = y * WORLD_SIZE + x;
      if (state.terrain[i] !== T.WATER && state.objects[i] === OBJ.NONE) {
        const candidates = MONSTER_TEMPLATES.filter(t => t.biomes.includes(state.terrain[i]));
        if (candidates.length > 0)
          state.monsters.push(makeMonster(state, candidates[Math.floor(Math.random() * candidates.length)], x, y));
      }
    }
  }

  // Item decay
  state.items = state.items.filter(it => now - it.spawnTime < 300000);

  // Particles
  for (const p of state.particles) {
    p.x += p.vx * 0.016; p.y += p.vy * 0.016;
    p.vy += 2 * 0.016;
    p.life -= 0.016;
  }
  state.particles = state.particles.filter(p => p.life > 0);

  // Float texts
  for (const ft of state.floatTexts) { ft.y -= 0.8 * 0.016; ft.life -= 0.016; }
  state.floatTexts = state.floatTexts.filter(ft => ft.life > 0);

  // Screen shake
  state.screenShake *= 0.85;
  if (state.screenShake < 0.005) state.screenShake = 0;

  // World time (slower day/night cycle)
  state.worldTime += 0.000025; // ~10-12 minutes per full day/night cycle at 60 FPS
}

function isNearCampfire(state: GameState): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const wx = state.px + dx, wy = state.py + dy;
      if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE)
        if (state.objects[wy * WORLD_SIZE + wx] === OBJ.CAMPFIRE) return true;
    }
  return false;
}



// === TERRAIN COLORS ===
const TERRAIN_COLORS: Record<number, [string, string, string]> = {
  [T.WATER]:       ['#2a5070', '#1e4060', '#3a6888'],
  [T.SAND]:        ['#c4a860', '#b89850', '#d4b870'],
  [T.GRASS]:       ['#4a7a3a', '#3e6e30', '#56864a'],
  [T.DARK_GRASS]:  ['#2d5422', '#234418', '#376630'],
  [T.DIRT]:        ['#7a6244', '#6e563a', '#886e50'],
  [T.STONE]:       ['#6a6a6a', '#5e5e5e', '#787878'],
  [T.SWAMP]:       ['#3a5a3a', '#2e4e2e', '#466646'],
  [T.STONE_FLOOR]: ['#7a7872', '#706e68', '#848280'],
  [T.ROAD]:        ['#8a8478', '#7e786e', '#969084'],
};

// === RENDER ===
export function render(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  if (!state.gameStarted) {
    if (state.charCreationOpen) { renderCharCreation(ctx, state, w, h); return; }
    renderTitleScreen(ctx, w, h);
    return;
  }

  // Strict view: player always sees exactly 10 sqm in every direction (21×21 tiles).
  // We scale the tile size to fill the entire screen (no black bars).
  const VIEW_RADIUS = 10;
  const VIEW_TILES = VIEW_RADIUS * 2 + 1; // 21

  // Use the LARGER dimension to scale up — guarantees the screen is fully filled.
  let tileSize = Math.ceil(Math.max(w, h) / VIEW_TILES);
  if (tileSize < 18) tileSize = 18;

  // Render enough tiles to cover the entire screen.
  const halfX = Math.ceil(w / tileSize / 2) + 1;
  const halfY = Math.ceil(h / tileSize / 2) + 1;

  const shakeX = state.screenShakeEnabled ? state.screenShake * (Math.random() - 0.5) * tileSize : 0;
  const shakeY = state.screenShakeEnabled ? state.screenShake * (Math.random() - 0.5) * tileSize : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  const camOffX = state.camX - Math.floor(state.camX);
  const camOffY = state.camY - Math.floor(state.camY);
  const camTileX = Math.floor(state.camX);
  const camTileY = Math.floor(state.camY);
  const baseX = w / 2 - camOffX * tileSize;
  const baseY = h / 2 - camOffY * tileSize;

  const now = performance.now();
  const dayPhase = (Math.sin(state.worldTime * Math.PI * 2) + 1) / 2;

  // === TERRAIN ===
  for (let vy = -halfY; vy <= halfY; vy++) {
    for (let vx = -halfX; vx <= halfX; vx++) {
      const wx = camTileX + vx, wy = camTileY + vy;
      if (wx < 0 || wx >= WORLD_SIZE || wy < 0 || wy >= WORLD_SIZE) continue;
      const sx = baseX + vx * tileSize, sy = baseY + vy * tileSize;
      if (sx + tileSize < 0 || sx > w || sy + tileSize < 0 || sy > h) continue;

      const idx = wy * WORLD_SIZE + wx;
      const ter = state.terrain[idx];
      const obj = state.objects[idx];
      const colors = TERRAIN_COLORS[ter] || TERRAIN_COLORS[T.GRASS];

      ctx.fillStyle = colors[0];
      ctx.fillRect(sx, sy, tileSize, tileSize);

      const h1 = hash(wx * 3 + 1, wy * 5 + 2);
      const h2 = hash(wx * 7 + 3, wy * 11 + 5);
      const ps = Math.max(2, tileSize / 8);
      ctx.fillStyle = colors[1];
      ctx.fillRect(sx + h1 * tileSize * 0.7, sy + h2 * tileSize * 0.6, ps, ps);
      ctx.fillStyle = colors[2];
      ctx.fillRect(sx + h2 * tileSize * 0.5, sy + h1 * tileSize * 0.8, ps, ps);

      if (ter === T.GRASS || ter === T.DARK_GRASS) {
        const gx = hash(wx * 13, wy * 17);
        ctx.fillStyle = colors[2];
        ctx.fillRect(sx + gx * tileSize * 0.8, sy + tileSize * 0.3, ps * 0.7, ps * 2);
        ctx.fillRect(sx + gx * tileSize * 0.4, sy + tileSize * 0.7, ps * 0.7, ps * 2);
      }
      if (ter === T.WATER) {
        const wave = Math.sin(now * 0.002 + wx * 0.8 + wy * 0.6) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(100,180,220,${0.15 + wave * 0.1})`;
        ctx.fillRect(sx + wave * tileSize * 0.3, sy + tileSize * 0.3, tileSize * 0.4, ps);
      }

      drawObject(ctx, obj, sx, sy, tileSize, now);
    }
  }

  // === ITEMS ===
  for (const item of state.items) {
    const sx = baseX + (item.x - camTileX) * tileSize;
    const sy = baseY + (item.y - camTileY) * tileSize;
    if (sx + tileSize < 0 || sx > w || sy + tileSize < 0 || sy > h) continue;
    const bob = Math.sin(now * 0.003 + item.id) * 2;
    const is = tileSize * 0.25;
    ctx.fillStyle = item.color;
    ctx.fillRect(sx + tileSize / 2 - is / 2, sy + tileSize / 2 - is / 2 + bob, is, is);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + tileSize / 2 - is / 2, sy + tileSize / 2 - is / 2 + bob, is, is);
  }

  // === MONSTERS ===
  for (const m of state.monsters) {
    if (m.dead) continue;
    const sx = baseX + (m.x - camTileX) * tileSize;
    const sy = baseY + (m.y - camTileY) * tileSize;
    if (sx + tileSize < -tileSize || sx > w + tileSize || sy + tileSize < -tileSize || sy > h + tileSize) continue;

    const distToPlayer = chebDist(state.px, state.py, m.x, m.y);

    // ── Attack ring indicator (only orange target ring on monsters) ──
    const isTarget = state.attackTarget?.id === m.id;
    if (isTarget) {
      drawTargetRing(ctx, sx + tileSize / 2, sy + tileSize / 2, tileSize * 0.55, now);
    }

    drawMonster(ctx, m, sx, sy, tileSize);

    // Monster name & health bar (visible within 3 sqm)
    if (distToPlayer <= 3) {
      const barW = tileSize * 0.85;
      const barH = 4;
      const barX = sx + (tileSize - barW) / 2;
      const barY = sy - 8;

      // Bar background
      ctx.fillStyle = '#111';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      // Bar fill — color based on HP percentage
      const pct = Math.max(0, m.hp / m.maxHp);
      const barColor = pct > 0.6 ? '#44cc44' : pct > 0.3 ? '#cccc44' : '#cc4444';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * pct, barH);

      // Name (centered below bar)
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.font = `bold ${Math.max(8, tileSize * 0.18)}px monospace`;
      ctx.fillStyle = '#000';
      ctx.fillText(m.type, sx + tileSize / 2 + 1, barY - 1 + 1);
      ctx.fillStyle = '#e0d8c0';
      ctx.fillText(m.type, sx + tileSize / 2, barY - 1);
    }
  }

  // === NPCs ===
  for (const npc of state.npcs) {
    const sx = baseX + (npc.x - camTileX) * tileSize;
    const sy = baseY + (npc.y - camTileY) * tileSize;
    if (sx + tileSize < -tileSize || sx > w + tileSize || sy + tileSize < -tileSize || sy > h + tileSize) continue;
    const p = tileSize / 16;
    const bob = Math.sin(now * 0.002 + npc.id * 2.3) * p * 0.3;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(sx + 8*p, sy + 15*p, 3.5*p, 1.2*p, 0, 0, Math.PI*2); ctx.fill();
    // Legs
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(sx+6*p,sy+12*p+bob,2*p,3*p); ctx.fillRect(sx+8.5*p,sy+12*p+bob,2*p,3*p);
    // Body — robe
    ctx.fillStyle = npc.color; ctx.fillRect(sx+4.5*p,sy+5*p+bob,7*p,8*p);
    ctx.fillStyle = '#fff'; ctx.fillRect(sx+7*p,sy+6*p+bob,2*p,2*p); // apron/badge
    // Head
    ctx.fillStyle = '#d4a574'; ctx.fillRect(sx+5.5*p,sy+1*p+bob,5*p,5*p);
    // Hat
    ctx.fillStyle = npc.type === 'merchant' ? '#8a3a3a' : '#5a5a5a';
    ctx.fillRect(sx+4.5*p,sy+0*p+bob,7*p,2.5*p);
    ctx.fillRect(sx+6*p,sy-1*p+bob,4*p,2*p);
    // Eyes
    ctx.fillStyle = '#222'; ctx.fillRect(sx+6.5*p,sy+3*p+bob,p*0.7,p*0.7); ctx.fillRect(sx+9*p,sy+3*p+bob,p*0.7,p*0.7);
    // Name
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = `bold ${Math.max(8,tileSize*0.2)}px monospace`;
    ctx.fillStyle = '#000'; ctx.fillText(npc.name, sx+8*p+1, sy-2*p+1);
    ctx.fillStyle = '#ffd700'; ctx.fillText(npc.name, sx+8*p, sy-2*p);
    // Interaction indicator when near
    if (chebDist(state.px, state.py, npc.x, npc.y) <= 2) {
      ctx.font = `${Math.max(10,tileSize*0.3)}px monospace`;
      ctx.fillStyle = '#ffd700';
      const blink = Math.sin(now*0.005)*0.3+0.7;
      ctx.globalAlpha = blink;
      ctx.fillText('💬', sx+8*p, sy-3.5*p);
      ctx.globalAlpha = 1;
    }
  }

  // === PLAYER ATTACK TICKER ===
  {
    const sx = baseX + (state.px - camTileX) * tileSize;
    const sy = baseY + (state.py - camTileY) * tileSize;
    const cx2 = sx + tileSize / 2, cy2 = sy + tileSize / 2;
    const r = tileSize * 0.62;

    if (state.attackTarget && !state.attackTarget.dead && !state.dead) {
      const elapsed = now - state.lastAttack;
      const progress = Math.min(1, elapsed / PLAYER_ATTACK_DELAY);
      drawPlayerAttackTicker(ctx, cx2, cy2, r, progress, now);
    }

    // Player under attack ring (red, smaller)
    if (state.playerUnderAttack && !state.dead) {
      drawUnderAttackRing(ctx, cx2, cy2, tileSize * 0.45, now);
    }
  }

  // === PLAYER ===
  {
    const sx = baseX + (state.px - camTileX) * tileSize;
    const sy = baseY + (state.py - camTileY) * tileSize;
    if (!state.dead) {
      drawPlayer(ctx, sx, sy, tileSize, state.facing, state.walkFrame, now);
    } else {
      ctx.fillStyle = '#888';
      const p = tileSize / 16;
      ctx.fillRect(sx + tileSize * 0.15, sy + tileSize * 0.6, tileSize * 0.7, tileSize * 0.15);
      ctx.fillStyle = '#d4a574';
      ctx.beginPath();
      ctx.arc(sx + 3 * p, sy + tileSize * 0.65, tileSize * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === PARTICLES ===
  for (const p of state.particles) {
    const sx = baseX + (p.x - camTileX) * tileSize;
    const sy = baseY + (p.y - camTileY) * tileSize;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, sy, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // === FLOAT TEXTS ===
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const ft of state.floatTexts) {
    const sx = baseX + (ft.x - camTileX) * tileSize + tileSize / 2;
    const sy = baseY + (ft.y - camTileY) * tileSize;
    ctx.globalAlpha = Math.min(1, ft.life / ft.maxLife);
    ctx.font = `bold ${Math.max(11, tileSize * 0.35)}px monospace`;
    ctx.fillStyle = '#000';
    ctx.fillText(ft.text, sx + 1, sy + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, sx, sy);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // Day/night overlay (darker nights)
  const nightAlpha = Math.max(0, 0.65 - dayPhase * 0.55);
  if (nightAlpha > 0) {
    // Distance-based darkness: brighter near player, darker at the edges of view
    // Creates a "torch" effect during night
    const playerScreenX = w / 2;
    const playerScreenY = h / 2;
    // Light radius shrinks as night gets darker
    const lightRadius = tileSize * (3 + (1 - nightAlpha) * 4);
    const maxDarkRadius = Math.max(w, h);

    const nightGradient = ctx.createRadialGradient(
      playerScreenX, playerScreenY, lightRadius * 0.3,
      playerScreenX, playerScreenY, maxDarkRadius
    );
    // Near player: light night tint
    nightGradient.addColorStop(0, `rgba(5,5,20,${nightAlpha * 0.3})`);
    // Mid range: regular night
    nightGradient.addColorStop(0.4, `rgba(5,5,20,${nightAlpha})`);
    // Far away: very dark
    nightGradient.addColorStop(1, `rgba(2,2,8,${Math.min(0.95, nightAlpha + 0.3)})`);

    ctx.fillStyle = nightGradient;
    ctx.fillRect(0, 0, w, h);
  }
  // Vignette (always present)
  const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  renderHUD(ctx, state, w, h, now);
}

// === TARGET RING (orange, on monsters being targeted by player) ===
function drawTargetRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  now: number
) {
  const pulse = (Math.sin(now * 0.006) * 0.5 + 0.5);
  const alpha = 0.55 + pulse * 0.35;
  const r = radius + pulse * 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.lineDashOffset = -(now * 0.04) % 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// === UNDER ATTACK RING (red, smaller, on player when hit by monster) ===
function drawUnderAttackRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  now: number
) {
  const pulse = (Math.sin(now * 0.012) * 0.5 + 0.5);
  const alpha = 0.6 + pulse * 0.4;
  const r = radius + pulse * 1.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ff2222';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([3, 2]);
  ctx.lineDashOffset = (now * 0.08) % 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// === ATTACK TICKER (player) ===
// Sweeping arc that fills clockwise from top, showing cooldown to next attack
function drawPlayerAttackTicker(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  progress: number,    // 0 = just attacked, 1 = ready
  _now: number
) {
  ctx.save();
  const ready = progress >= 1;

  if (ready) {
    // Fully charged — bright solid ring
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Background track
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Fill arc (clockwise from top = -π/2)
    const endAngle = -Math.PI / 2 + progress * Math.PI * 2;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
    ctx.stroke();
  }

  ctx.restore();
}

// === DRAW OBJECT ===
function drawObject(ctx: CanvasRenderingContext2D, obj: number, sx: number, sy: number, ts: number, now: number) {
  if (obj === OBJ.NONE) return;
  const p = ts / 16;
  if (obj === OBJ.TREE) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx + 6 * p, sy + 9 * p, 4 * p, 7 * p);
    ctx.fillStyle = '#1a3a0a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 6 * p, 5.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a5a1a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 5 * p, 5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a6a2a';
    ctx.beginPath(); ctx.arc(sx + 7 * p, sy + 4 * p, 3 * p, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJ.ROCK) {
    ctx.fillStyle = '#5e5e5e';
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p, 5 * p, 4 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath(); ctx.ellipse(sx + 7.5 * p, sy + 9 * p, 4 * p, 3 * p, -0.2, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJ.BUSH) {
    ctx.fillStyle = '#3a6a2a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 11 * p, 4 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7a3a';
    ctx.beginPath(); ctx.arc(sx + 7 * p, sy + 10 * p, 3 * p, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJ.CACTUS) {
    ctx.fillStyle = '#3a7a3a';
    ctx.fillRect(sx + 6.5 * p, sy + 3 * p, 3 * p, 12 * p);
    ctx.fillRect(sx + 3 * p, sy + 5 * p, 3.5 * p, 3 * p);
    ctx.fillRect(sx + 9.5 * p, sy + 7 * p, 3.5 * p, 3 * p);
    ctx.fillRect(sx + 3 * p, sy + 3 * p, 3 * p, 3 * p);
    ctx.fillRect(sx + 9.5 * p, sy + 5 * p, 3 * p, 3 * p);
  } else if (obj === OBJ.WALL || obj === OBJ.RUINS) {
    ctx.fillStyle = obj === OBJ.WALL ? '#6a6862' : '#5a5852';
    ctx.fillRect(sx + 1 * p, sy + 2 * p, 14 * p, 12 * p);
    ctx.fillStyle = obj === OBJ.WALL ? '#7a7872' : '#6a6862';
    ctx.fillRect(sx + 2 * p, sy + 3 * p, 12 * p, 10 * p);
    ctx.fillStyle = '#4a4842';
    ctx.fillRect(sx + 8 * p, sy + 3 * p, p * 0.5, 10 * p);
    ctx.fillRect(sx + 2 * p, sy + 7 * p, 12 * p, p * 0.5);
    if (obj === OBJ.RUINS) {
      ctx.fillStyle = '#3a3832';
      ctx.fillRect(sx + 4 * p, sy + 2 * p, 2 * p, 2 * p);
      ctx.fillRect(sx + 11 * p, sy + 9 * p, 3 * p, 5 * p);
    }
  } else if (obj === OBJ.CAMPFIRE) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx + 4 * p, sy + 11 * p, 8 * p, 2 * p);
    ctx.fillRect(sx + 5 * p, sy + 10 * p, 6 * p, 2 * p);
    const flicker = Math.sin(now * 0.01) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(220,100,20,${0.7 + flicker * 0.3})`;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 8 * p, (2.5 + flicker) * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,200,50,${0.5 + flicker * 0.3})`;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 7 * p, (1.5 + flicker * 0.5) * p, 0, Math.PI * 2); ctx.fill();
    const glow = ctx.createRadialGradient(sx + 8 * p, sy + 8 * p, 0, sx + 8 * p, sy + 8 * p, ts * 1.5);
    glow.addColorStop(0, `rgba(255,150,50,${0.08 + flicker * 0.04})`);
    glow.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - ts, sy - ts, ts * 3, ts * 3);
  } else if (obj === OBJ.CHEST) {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx + 3 * p, sy + 7 * p, 10 * p, 7 * p);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(sx + 4 * p, sy + 8 * p, 8 * p, 5 * p);
    ctx.fillStyle = '#d4a430'; ctx.fillRect(sx + 7 * p, sy + 9 * p, 2 * p, 2 * p);
  }
}

// === DRAW MONSTER ===
// (state_ref for aggro dot)
let _playerName = 'Wanderer';
let _playerOutfit: PlayerOutfit = OUTFIT_PRESETS[0].outfit;
let _playerClass: PlayerClass = 'warrior';

function drawMonster(ctx: CanvasRenderingContext2D, m: Monster, sx: number, sy: number, ts: number) {
  const p = ts / 16;
  const bob = Math.sin(performance.now() * 0.004 + m.id * 1.7) * p;
  const now = performance.now();

  if (m.type === 'Rat') {
    ctx.fillStyle = m.bodyColor;
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p + bob, 4 * p, 2.5 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(sx + 5 * p, sy + 9 * p + bob, 2 * p, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a08060'; ctx.lineWidth = p * 0.7;
    ctx.beginPath(); ctx.moveTo(sx + 12 * p, sy + 10 * p + bob);
    ctx.quadraticCurveTo(sx + 14 * p, sy + 8 * p + bob, sx + 13 * p, sy + 6 * p + bob); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(sx + 4 * p, sy + 8.5 * p + bob, p, p);
  } else if (m.type === 'Wolf') {
    ctx.fillStyle = m.bodyColor;
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p + bob, 5 * p, 3 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(sx + 4 * p, sy + 8 * p + bob, 2.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.bodyColor;
    ctx.fillRect(sx + 2 * p, sy + 5.5 * p + bob, 1.5 * p, 2 * p);
    ctx.fillRect(sx + 5 * p, sy + 5.5 * p + bob, 1.5 * p, 2 * p);
    ctx.fillStyle = '#dd4'; ctx.fillRect(sx + 3.5 * p, sy + 7.5 * p + bob, p, p);
    ctx.fillStyle = '#555'; ctx.fillRect(sx + 1.5 * p, sy + 9 * p + bob, 1.5 * p, p);
  } else if (m.type === 'Spider') {
    ctx.fillStyle = m.bodyColor;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 9 * p + bob, 3.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = m.color; ctx.lineWidth = p * 0.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(sx + 8 * p, sy + 9 * p + bob);
      ctx.lineTo(sx + (3 - i * 0.3) * p, sy + (6 + i * 2) * p + bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 8 * p, sy + 9 * p + bob);
      ctx.lineTo(sx + (13 + i * 0.3) * p, sy + (6 + i * 2) * p + bob); ctx.stroke();
    }
    ctx.fillStyle = '#f44';
    ctx.fillRect(sx + 6.5 * p, sy + 7.5 * p + bob, p, p);
    ctx.fillRect(sx + 9 * p,   sy + 7.5 * p + bob, p, p);
  } else if (m.type === 'Skeleton') {
    ctx.fillStyle = m.bodyColor;
    ctx.fillRect(sx + 6 * p, sy + 6 * p + bob, 4 * p, 6 * p);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(sx + 6.5 * p, sy + 7 * p + bob, 3 * p, p * 0.5);
    ctx.fillRect(sx + 6.5 * p, sy + 8.5 * p + bob, 3 * p, p * 0.5);
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 4.5 * p + bob, 2.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + 6.5 * p, sy + 4 * p + bob, p * 1.2, p * 1.2);
    ctx.fillRect(sx + 8.5 * p, sy + 4 * p + bob, p * 1.2, p * 1.2);
    ctx.fillStyle = m.bodyColor;
    ctx.fillRect(sx + 6.5 * p, sy + 12 * p + bob, 1.5 * p, 3 * p);
    ctx.fillRect(sx + 8.5 * p, sy + 12 * p + bob, 1.5 * p, 3 * p);
    ctx.fillRect(sx + 4 * p,   sy + 7 * p + bob, 2 * p, 1.5 * p);
    ctx.fillRect(sx + 10 * p,  sy + 7 * p + bob, 2 * p, 1.5 * p);
  } else if (m.type === 'Bear') {
    ctx.fillStyle = m.bodyColor;
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p + bob, 5.5 * p, 4 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(sx + 4 * p, sy + 7 * p + bob, 3 * p, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 2 * p, sy + 5 * p + bob, 1.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 6 * p, sy + 5 * p + bob, 1.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(sx + 3 * p, sy + 6.5 * p + bob, p, p);
    ctx.fillStyle = '#333'; ctx.fillRect(sx + 3.5 * p, sy + 8 * p + bob, p * 1.5, p);
  } else if (m.type === 'Slime') {
    const pulse = Math.sin(now * 0.005 + m.id) * p;
    ctx.fillStyle = m.bodyColor;
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p + bob, (4 + pulse * 0.3) * p, (3 - pulse * 0.2) * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 9 * p + bob, (3 + pulse * 0.2) * p, (2.5 - pulse * 0.15) * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx + 7 * p, sy + 8.5 * p + bob, p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(sx + 6.7 * p, sy + 8.5 * p + bob, p * 0.6, p * 0.6);
  }
}

// === DRAW PLAYER ===
function drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number, facing: number, frame: number, now: number) {
  const p = ts / 16;
  const walkBob = Math.sin(now * 0.012) * p * 0.5;
  const legPhase = frame % 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 15 * p, 4 * p, 1.5 * p, 0, 0, Math.PI * 2); ctx.fill();

  const o = _playerOutfit;
  // Legs
  ctx.fillStyle = o.legColor;
  if (legPhase === 0) {
    ctx.fillRect(sx + 5.5 * p, sy + 12 * p + walkBob, 2 * p, 3.5 * p);
    ctx.fillRect(sx + 8.5 * p, sy + 11.5 * p + walkBob, 2 * p, 4 * p);
  } else {
    ctx.fillRect(sx + 5.5 * p, sy + 11.5 * p + walkBob, 2 * p, 4 * p);
    ctx.fillRect(sx + 8.5 * p, sy + 12 * p + walkBob, 2 * p, 3.5 * p);
  }
  // Body
  ctx.fillStyle = o.armorColor; ctx.fillRect(sx + 4.5 * p, sy + 5.5 * p + walkBob, 7 * p, 7 * p);
  ctx.fillStyle = o.armorHighlight; ctx.fillRect(sx + 5 * p, sy + 6 * p + walkBob, 6 * p, 6 * p);
  ctx.fillStyle = '#6a5030'; ctx.fillRect(sx + 4.5 * p, sy + 11 * p + walkBob, 7 * p, 1.2 * p);
  ctx.fillStyle = '#d4a430'; ctx.fillRect(sx + 7.5 * p, sy + 11 * p + walkBob, 1.5 * p, 1.2 * p);
  // Arms
  ctx.fillStyle = o.armorColor;
  ctx.fillRect(sx + 2.5 * p, sy + 6 * p + walkBob, 2 * p, 5 * p);
  ctx.fillRect(sx + 11.5 * p, sy + 6 * p + walkBob, 2 * p, 5 * p);
  ctx.fillStyle = o.skinColor;
  ctx.fillRect(sx + 2.5 * p, sy + 10.5 * p + walkBob, 2 * p, 1.5 * p);
  ctx.fillRect(sx + 11.5 * p, sy + 10.5 * p + walkBob, 2 * p, 1.5 * p);
  // Weapon
  if (_playerClass === 'warrior') {
    ctx.fillStyle = '#aab4c4'; ctx.fillRect(sx + 12.5 * p, sy + 3 * p + walkBob, 1 * p, 8 * p);
    ctx.fillStyle = '#6a5030'; ctx.fillRect(sx + 11.5 * p, sy + 10 * p + walkBob, 3 * p, 1.2 * p);
  } else if (_playerClass === 'archer') {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx + 13 * p, sy + 3 * p + walkBob, 0.8 * p, 9 * p);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = p * 0.4;
    ctx.beginPath(); ctx.moveTo(sx + 13.4 * p, sy + 3.5 * p + walkBob);
    ctx.quadraticCurveTo(sx + 15 * p, sy + 7.5 * p + walkBob, sx + 13.4 * p, sy + 11.5 * p + walkBob); ctx.stroke();
  } else {
    ctx.fillStyle = '#6a4a3a'; ctx.fillRect(sx + 12.5 * p, sy + 2 * p + walkBob, 0.8 * p, 9 * p);
    ctx.fillStyle = '#aa66ff'; ctx.beginPath(); ctx.arc(sx + 12.9 * p, sy + 1.5 * p + walkBob, 1.5 * p, 0, Math.PI * 2); ctx.fill();
  }
  // Head
  ctx.fillStyle = o.skinColor; ctx.fillRect(sx + 5.5 * p, sy + 1 * p + walkBob, 5 * p, 5 * p);
  ctx.fillStyle = o.hairColor; ctx.fillRect(sx + 5 * p, sy + 0.5 * p + walkBob, 6 * p, 2.5 * p);
  // Eyes
  if (facing === 2) {
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + 6.5 * p, sy + 3 * p + walkBob, p * 0.8, p * 0.8);
    ctx.fillRect(sx + 9 * p,   sy + 3 * p + walkBob, p * 0.8, p * 0.8);
  } else if (facing !== 0) {
    const ex = facing === 1 ? 9 : 6;
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + ex * p, sy + 3 * p + walkBob, p * 0.8, p * 0.8);
  }
  // Name
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.font = `bold ${Math.max(9, ts * 0.22)}px monospace`;
  ctx.fillStyle = '#000'; ctx.fillText(_playerName, sx + 8 * p + 1, sy - p + 1);
  ctx.fillStyle = '#e0d8c0'; ctx.fillText(_playerName, sx + 8 * p, sy - p);
}

// === HUD ===
function renderHUD(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, now: number) {
  const sinceActivity = now - state.hudActivity;
  let hudAlpha = 1;
  if (sinceActivity > HUD_FADE_TIME) {
    hudAlpha = Math.max(0, 1 - (sinceActivity - HUD_FADE_TIME) / HUD_FADE_DUR);
  }

  // ── HP / Mana / XP bars — top center, bigger, fades after 5s ──
  if (hudAlpha > 0) {
    ctx.globalAlpha = hudAlpha;
    const barW = Math.min(320, w * 0.5);
    const barH = 14;
    const barX = (w - barW) / 2;
    const barY = 12;

    // HP bg
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#2a1515'; ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#c44a4a'; ctx.fillRect(barX, barY, barW * (state.hp / state.maxHp), barH);
    // HP glow edge
    ctx.fillStyle = '#e45555'; ctx.fillRect(barX, barY, barW * (state.hp / state.maxHp), 2);
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(`HP  ${state.hp} / ${state.maxHp}`, barX + barW / 2, barY + barH / 2);

    // Mana bg
    const mBarY = barY + barH + 4;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(barX - 2, mBarY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#15152a'; ctx.fillRect(barX, mBarY, barW, barH);
    ctx.fillStyle = '#4a6ac4'; ctx.fillRect(barX, mBarY, barW * (state.mana / state.maxMana), barH);
    ctx.fillStyle = '#5a8ae4'; ctx.fillRect(barX, mBarY, barW * (state.mana / state.maxMana), 2);
    ctx.fillStyle = '#fff'; ctx.fillText(`MP  ${state.mana} / ${state.maxMana}`, barX + barW / 2, mBarY + barH / 2);

    // XP bar (thin, below mana)
    const xBarY = mBarY + barH + 3;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(barX - 1, xBarY - 1, barW + 2, 7);
    ctx.fillStyle = '#1a1a15'; ctx.fillRect(barX, xBarY, barW, 5);
    ctx.fillStyle = '#8a8a2a'; ctx.fillRect(barX, xBarY, barW * (state.xp / state.xpToNext), 5);
    ctx.font = '8px monospace'; ctx.fillStyle = '#aaa';
    ctx.fillText(`Lv.${state.level}  XP ${state.xp}/${state.xpToNext}`, barX + barW / 2, xBarY + 3);
    ctx.globalAlpha = 1;
  }

  // ── Skill bar ── fades with HUD
  if (hudAlpha > 0) {
    ctx.globalAlpha = hudAlpha;
    const slotSize = Math.min(42, w * 0.065);
    const gap = 4;
    const totalW = 7 * slotSize + 6 * gap;
    const slotX = (w - totalW) / 2;
    const slotY = h - slotSize - 10;

    for (let i = 0; i < state.skills.length; i++) {
      const skill = state.skills[i];
      const x = slotX + i * (slotSize + gap);
      const isActive = state.activeSkillIdx === i;
      const elapsed = now - skill.lastUsed;
      const cdFrac = Math.min(1, elapsed / skill.cooldown); // 0=on CD, 1=ready
      const onCD = cdFrac < 1;

      // Slot BG
      ctx.fillStyle = isActive ? '#3a3a2a' : '#1a1a1a';
      ctx.fillRect(x - 1, slotY - 1, slotSize + 2, slotSize + 2);
      ctx.fillStyle = isActive ? '#2e2e1e' : '#252525';
      ctx.fillRect(x, slotY, slotSize, slotSize);

      // Border
      ctx.strokeStyle = isActive ? '#d4a430' : skill.color;
      ctx.lineWidth = isActive ? 2 : 1.5;
      ctx.strokeRect(x + 1, slotY + 1, slotSize - 2, slotSize - 2);

      // Cooldown overlay (dark sweep from top)
      if (onCD) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const coverH = slotSize * (1 - cdFrac);
        ctx.fillRect(x, slotY, slotSize, coverH);
        // CD text
        const remaining = Math.ceil((skill.cooldown - elapsed) / 1000);
        ctx.font = `bold ${slotSize * 0.3}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${remaining}s`, x + slotSize / 2, slotY + slotSize / 2);
      }

      // Icon
      ctx.font = `${slotSize * 0.42}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = onCD ? hudAlpha * 0.4 : hudAlpha;
      ctx.fillText(skill.icon, x + slotSize / 2, slotY + slotSize / 2 - (onCD ? 0 : 0));

      ctx.globalAlpha = hudAlpha;
      // Key hint
      ctx.font = '8px monospace';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${i + 1}`, x + slotSize - 3, slotY + slotSize - 2);

      // Skill name tooltip under active
      if (isActive) {
        ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#c4a860';
        ctx.fillText(skill.name, x + slotSize / 2, slotY - 14);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Stats panel (top-left) — fades after 10s ──
  const statsElapsed = now - state.hudActivity;
  let statsAlpha = 1;
  if (statsElapsed > 10000) statsAlpha = Math.max(0, 1 - (statsElapsed - 10000) / HUD_FADE_DUR);
  if (statsAlpha <= 0) { /* skip drawing */ } else {
  ctx.globalAlpha = statsAlpha;
  ctx.fillStyle = '#000'; ctx.fillRect(8, 8, 148, 54);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(9, 9, 146, 52);
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#e0d8c0'; ctx.fillText(state.playerName, 14, 14);
  ctx.font = '9px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText(`Lv.${state.level}  ⚔${state.playerDamage}  🛡${state.playerDefense}`, 14, 28);
  ctx.fillStyle = '#d4a430'; ctx.fillText(`💰 ${state.gold}`, 14, 40);
  ctx.fillStyle = '#888'; ctx.fillText(`Kills: ${state.monstersKilled}`, 84, 40);
  ctx.globalAlpha = 1;
  } // end stats panel alpha check

  // ── Minimap (top-right) — uses its own fade timer ──
  const sinceMap = now - state.minimapActivity;
  let mmAlpha = 1;
  if (sinceMap > HUD_FADE_TIME) {
    mmAlpha = Math.max(0, 1 - (sinceMap - HUD_FADE_TIME) / HUD_FADE_DUR);
  }
  if (mmAlpha > 0) {
    ctx.globalAlpha = mmAlpha;
    const mmSize = Math.min(96, w * 0.18);
    const mmX = w - mmSize - 12, mmY = 12;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
    const mmScale = mmSize / 80;
    for (let my = -40; my < 40; my++) {
      for (let mx = -40; mx < 40; mx++) {
        const wx = state.px + mx, wy = state.py + my;
        if (wx < 0 || wx >= WORLD_SIZE || wy < 0 || wy >= WORLD_SIZE) continue;
        const ei = wy * WORLD_SIZE + wx;
        if (!state.explored[ei]) continue;
        const ter = state.terrain[ei];
        const obj = state.objects[ei];
        let c = '#2a3a1a';
        if (ter === T.WATER) c = '#1a3050';
        else if (ter === T.SAND) c = '#8a7840';
        else if (ter === T.STONE) c = '#4a4a4a';
        else if (ter === T.DARK_GRASS) c = '#1a2a10';
        else if (ter === T.STONE_FLOOR || ter === T.ROAD) c = '#5a5a50';
        else if (ter === T.SWAMP) c = '#2a3a2a';
        else if (ter === T.DIRT) c = '#5a4a30';
        if (obj === OBJ.WALL || obj === OBJ.RUINS) c = '#6a6a60';
        ctx.fillStyle = c;
        ctx.fillRect(mmX + (mx + 40) * mmScale, mmY + (my + 40) * mmScale, Math.ceil(mmScale), Math.ceil(mmScale));
      }
    }
    // Monster dots
    for (const m of state.monsters) {
      if (m.dead) continue;
      const mx2 = m.x - state.px + 40, my2 = m.y - state.py + 40;
      if (mx2 < 0 || mx2 >= 80 || my2 < 0 || my2 >= 80) continue;
      ctx.fillStyle = '#c44';
      ctx.fillRect(mmX + mx2 * mmScale, mmY + my2 * mmScale, Math.ceil(mmScale * 1.5), Math.ceil(mmScale * 1.5));
    }
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(mmX + 40 * mmScale - 2, mmY + 40 * mmScale - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // ── Combat log ──
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.font = '10px monospace';
  const logMaxW = Math.min(240, w * 0.38);
  const logX = w - 12;
  const logY = h - 175;
  const recent = state.log.filter(l => now - l.time < 6000).slice(-6);
  for (let i = 0; i < recent.length; i++) {
    const l = recent[i];
    const age = now - l.time;
    const a = age > 4000 ? Math.max(0, 1 - (age - 4000) / 2000) : 1;
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = '#000'; ctx.fillText(l.text, logX + 1, logY + i * 14 + 1);
    ctx.fillStyle = l.color; ctx.fillText(l.text, logX, logY + i * 14);
    void logMaxW;
  }
  ctx.globalAlpha = 1;

  // ── Controls hint ──
  if (now < 14000 && state.gameStarted) {
    const a = now < 9000 ? 0.65 : Math.max(0, 0.65 - (now - 9000) / 5000);
    ctx.globalAlpha = a;
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.fillText('WASD/Arrows — move  •  Click — walk/attack  •  1-7 — skills  •  I — inventory', w / 2, h - 6);
    ctx.globalAlpha = 1;
  }

  // ── Death overlay ──
  if (state.dead) {
    ctx.fillStyle = 'rgba(80,10,10,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.font = `bold ${Math.min(48, w * 0.08)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff2222'; ctx.fillText('YOU HAVE DIED', w / 2, h / 2 - 20);
    ctx.font = '14px monospace'; ctx.fillStyle = '#cc8888';
    ctx.fillText('Respawning at village...', w / 2, h / 2 + 20);
  }
}

// === TITLE SCREEN ===
function renderTitleScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const now = performance.now();
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const n = noise2d(x * 0.008 + now * 0.0001, y * 0.008);
      const v = Math.floor(n * 20 + 8);
      ctx.fillStyle = `rgb(${v},${v + 4},${v - 2})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w/2,h/2,w*0.15,w/2,h/2,w*0.6);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.7)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const glow = ctx.createRadialGradient(w/2,h*0.35,0,w/2,h*0.35,200);
  glow.addColorStop(0,'rgba(180,140,60,0.08)'); glow.addColorStop(1,'rgba(180,140,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  const titleSize = Math.min(60, w * 0.1);
  ctx.font = `bold ${titleSize}px monospace`;
  ctx.fillStyle = '#1a1510'; ctx.fillText('REMNANTS', w/2+2, h*0.33+2);
  ctx.fillStyle = '#d4b870'; ctx.fillText('REMNANTS', w/2, h*0.33);

  const ulW = Math.min(300, w*0.5);
  ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w/2-ulW/2, h*0.33+titleSize*0.6); ctx.lineTo(w/2+ulW/2, h*0.33+titleSize*0.6); ctx.stroke();

  ctx.font = `${Math.min(16, w*0.028)}px monospace`;
  ctx.fillStyle = '#8a8070'; ctx.fillText('A  W O R L D  T H A T  R E M E M B E R S', w/2, h*0.33+titleSize*0.6+24);
  ctx.font = `italic ${Math.min(13, w*0.022)}px monospace`;
  ctx.fillStyle = '#6a6050';
  ctx.fillText('"One realm. No seasons of content. Just a living world shaped', w/2, h*0.55);
  ctx.fillText('by those who walk through it — and those who do not return."', w/2, h*0.55+18);

  const blink = Math.sin(now*0.003)*0.3+0.7;
  ctx.globalAlpha = blink;
  ctx.font = `bold ${Math.min(15, w*0.025)}px monospace`;
  ctx.fillStyle = '#c4a860';
  ctx.fillText('[ Click or press any key to enter the world ]', w/2, h*0.72);
  ctx.globalAlpha = 1;
  ctx.font = '10px monospace'; ctx.fillStyle = '#4a4a40';
  ctx.fillText('A tile-based open-world RPG', w/2, h-30);
}

// === CHARACTER CREATION ===
function renderCharCreation(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const now = performance.now();
  // BG
  for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) {
    const n = noise2d(x * 0.006 + now * 0.00005, y * 0.006);
    const v = Math.floor(n * 18 + 10);
    ctx.fillStyle = `rgb(${v},${v+3},${v-1})`; ctx.fillRect(x, y, 6, 6);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, w, h);

  const pw = Math.min(520, w - 30), ph = Math.min(480, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;
  ctx.fillStyle = '#141412'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('CREATE YOUR CHARACTER', px + pw / 2, py + 16);

  // Name
  ctx.font = '11px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText('NAME', px + pw / 2, py + 52);
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#e0d8c0';
  ctx.fillText(state.charCreationName || '(click to type)', px + pw / 2, py + 68);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(px + pw / 2 - 100, py + 64, 200, 24);

  // Class selection
  ctx.font = '11px monospace'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'center';
  ctx.fillText('CLASS', px + pw / 2, py + 100);

  const classes: { cls: PlayerClass; label: string; desc: string; color: string }[] = [
    { cls: 'warrior', label: '⚔ WARRIOR', desc: 'Melee, high HP & defense.\nAttack range: 1 tile.', color: '#c44a4a' },
    { cls: 'archer',  label: '🏹 ARCHER',  desc: 'Ranged bow attacks.\nAttack range: 3 tiles.', color: '#8a6a3a' },
    { cls: 'mage',    label: '✦ MAGE',    desc: 'Magic attacks & spells.\nAttack range: 2 tiles.', color: '#9a6ac4' },
  ];
  const bw = Math.min(140, (pw - 40) / 3 - 8), bh = 70;
  const bx0 = px + (pw - (bw * 3 + 16)) / 2;
  for (let i = 0; i < 3; i++) {
    const c = classes[i];
    const x = bx0 + i * (bw + 8), y2 = py + 120;
    const selected = state.charCreationClass === c.cls;
    ctx.fillStyle = selected ? '#2a2a20' : '#1a1a18'; ctx.fillRect(x, y2, bw, bh);
    ctx.strokeStyle = selected ? c.color : '#3a3a30'; ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeRect(x, y2, bw, bh);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = selected ? c.color : '#888';
    ctx.fillText(c.label, x + bw / 2, y2 + 12);
    ctx.font = '9px monospace'; ctx.fillStyle = '#777';
    const lines = c.desc.split('\n');
    for (let li = 0; li < lines.length; li++)
      ctx.fillText(lines[li], x + bw / 2, y2 + 34 + li * 12);
  }

  // Outfit selection
  ctx.font = '11px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText('OUTFIT', px + pw / 2, py + 205);
  const ow = 60, oh = 60;
  const ox0 = px + (pw - (ow * OUTFIT_PRESETS.length + (OUTFIT_PRESETS.length - 1) * 6)) / 2;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) {
    const preset = OUTFIT_PRESETS[i];
    const x = ox0 + i * (ow + 6), y2 = py + 224;
    const selected = state.charCreationOutfit === i;
    ctx.fillStyle = selected ? '#2a2a20' : '#1a1a18'; ctx.fillRect(x, y2, ow, oh);
    ctx.strokeStyle = selected ? '#d4a430' : '#3a3a30'; ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x, y2, ow, oh);
    // Mini preview
    const pp = ow / 16;
    ctx.fillStyle = preset.outfit.legColor; ctx.fillRect(x + 5*pp, y2 + 11*pp, 2*pp, 4*pp); ctx.fillRect(x + 9*pp, y2 + 11*pp, 2*pp, 4*pp);
    ctx.fillStyle = preset.outfit.armorColor; ctx.fillRect(x + 4*pp, y2 + 5*pp, 8*pp, 7*pp);
    ctx.fillStyle = preset.outfit.armorHighlight; ctx.fillRect(x + 5*pp, y2 + 6*pp, 6*pp, 5*pp);
    ctx.fillStyle = preset.outfit.skinColor; ctx.fillRect(x + 5*pp, y2 + 1*pp, 6*pp, 5*pp);
    ctx.fillStyle = preset.outfit.hairColor; ctx.fillRect(x + 5*pp, y2 + 0.5*pp, 6*pp, 2.5*pp);
    ctx.font = '8px monospace'; ctx.fillStyle = '#888';
    ctx.fillText(preset.name, x + ow / 2, y2 + oh + 2);
  }

  // Start button
  const sbw = 200, sbh = 40;
  const sbx = px + (pw - sbw) / 2, sby = py + ph - 70;
  const pulse = Math.sin(now * 0.003) * 0.15 + 0.85;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#2a3a1a'; ctx.fillRect(sbx, sby, sbw, sbh);
  ctx.strokeStyle = '#6a8a3a'; ctx.lineWidth = 2; ctx.strokeRect(sbx, sby, sbw, sbh);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#aad47a';
  ctx.fillText('▶  ENTER THE WORLD', sbx + sbw / 2, sby + 12);
  ctx.globalAlpha = 1;

  ctx.font = '9px monospace'; ctx.fillStyle = '#555';
  ctx.fillText('Click class/outfit to select, then enter the world', px + pw / 2, py + ph - 20);
}

// === OUTFIT MENU ===
export function renderOutfitMenu(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.outfitMenuOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(420, w - 30), ph = 200;
  const px = (w - pw) / 2, py = (h - ph) / 2;
  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('CHANGE OUTFIT', px + pw / 2, py + 12);

  const ow = 56, oh = 56;
  const ox0 = px + (pw - (ow * OUTFIT_PRESETS.length + (OUTFIT_PRESETS.length - 1) * 6)) / 2;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) {
    const preset = OUTFIT_PRESETS[i];
    const x = ox0 + i * (ow + 6), y2 = py + 42;
    const selected = state.outfit.armorColor === preset.outfit.armorColor && state.outfit.hairColor === preset.outfit.hairColor;
    ctx.fillStyle = selected ? '#2a2a20' : '#1a1a18'; ctx.fillRect(x, y2, ow, oh);
    ctx.strokeStyle = selected ? '#d4a430' : '#3a3a30'; ctx.lineWidth = selected ? 2 : 1; ctx.strokeRect(x, y2, ow, oh);
    const pp = ow / 16;
    ctx.fillStyle = preset.outfit.legColor; ctx.fillRect(x+5*pp,y2+11*pp,2*pp,4*pp); ctx.fillRect(x+9*pp,y2+11*pp,2*pp,4*pp);
    ctx.fillStyle = preset.outfit.armorColor; ctx.fillRect(x+4*pp,y2+5*pp,8*pp,7*pp);
    ctx.fillStyle = preset.outfit.armorHighlight; ctx.fillRect(x+5*pp,y2+6*pp,6*pp,5*pp);
    ctx.fillStyle = preset.outfit.skinColor; ctx.fillRect(x+5*pp,y2+1*pp,6*pp,5*pp);
    ctx.fillStyle = preset.outfit.hairColor; ctx.fillRect(x+5*pp,y2+0.5*pp,6*pp,2.5*pp);
    ctx.font = '8px monospace'; ctx.fillStyle = '#888';
    ctx.fillText(preset.name, x + ow / 2, y2 + oh + 2);
  }
  ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click outfit to apply  •  Press O or ESC to close', px + pw / 2, py + ph - 18);
}

// === SHOP UI ===
export function renderShop(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.shopOpen || !state.shopNpc) return;
  const npc = state.shopNpc;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(440, w - 20), ph = Math.min(420, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;
  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#d4a060';
  ctx.fillText(npc.name, px + pw / 2, py + 12);
  ctx.font = '10px monospace'; ctx.fillStyle = '#888';
  ctx.fillText(npc.type === 'merchant' ? 'General Goods' : 'Weapons & Armor', px + pw / 2, py + 32);
  ctx.fillStyle = '#d4a430'; ctx.fillText(`Your gold: ${state.gold}`, px + pw / 2, py + 46);

  // Buy section
  ctx.textAlign = 'left'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText('BUY', px + 16, py + 68);
  const lineH = 30;
  for (let i = 0; i < npc.sells.length; i++) {
    const item = npc.sells[i];
    const iy = py + 86 + i * lineH;
    ctx.fillStyle = '#222'; ctx.fillRect(px + 14, iy, pw - 28, lineH - 4);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px + 14, iy, pw - 28, lineH - 4);
    ctx.fillStyle = item.color; ctx.fillRect(px + 20, iy + 5, 14, 14);
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'left';
    ctx.fillText(item.name, px + 40, iy + 8);
    ctx.font = '9px monospace'; ctx.fillStyle = '#777';
    ctx.fillText(item.desc, px + 40 + item.name.length * 7 + 8, iy + 9);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px monospace';
    ctx.fillStyle = state.gold >= item.value ? '#d4a430' : '#664422';
    ctx.fillText(`${item.value}g`, px + pw - 22, iy + 8);
    ctx.textAlign = 'left';
  }

  // Sell section
  const sellY = py + 86 + npc.sells.length * lineH + 14;
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#aaa';
  ctx.fillText(`SELL (${npc.buysFor}% value)`, px + 16, sellY);
  if (state.inventory.length === 0) {
    ctx.font = '10px monospace'; ctx.fillStyle = '#555';
    ctx.fillText('Nothing to sell.', px + 16, sellY + 18);
  }
  for (let i = 0; i < Math.min(state.inventory.length, 5); i++) {
    const item = state.inventory[i];
    const iy = sellY + 18 + i * lineH;
    const sellPrice = Math.max(1, Math.floor(item.value * npc.buysFor / 100));
    ctx.fillStyle = '#222'; ctx.fillRect(px + 14, iy, pw - 28, lineH - 4);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px + 14, iy, pw - 28, lineH - 4);
    ctx.fillStyle = item.color; ctx.fillRect(px + 20, iy + 5, 14, 14);
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'left';
    ctx.fillText(`${item.name} ×${item.count}`, px + 40, iy + 8);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#8a8a2a';
    ctx.fillText(`+${sellPrice}g`, px + pw - 22, iy + 8);
    ctx.textAlign = 'left';
  }

  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click item to buy/sell  •  Press ESC to close', px + pw / 2, py + ph - 18);
}

function handleSkillTreeClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  const pw = Math.min(560, w - 40), ph = Math.min(480, h - 60);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  const nodes = [
    { id: 'core', x: px + pw/2, y: py + 110, cost: 0 },
    { id: 'combat1', x: px + pw/2 - 110, y: py + 180, cost: 1 },
    { id: 'combat2', x: px + pw/2 + 110, y: py + 180, cost: 1 },
    { id: 'surv1', x: px + pw/2 - 70, y: py + 260, cost: 1 },
    { id: 'surv2', x: px + pw/2 + 70, y: py + 260, cost: 1 },
    { id: 'magic1', x: px + pw/2, y: py + 340, cost: 1 },
    { id: 'mastery', x: px + pw/2, y: py + 420, cost: 3 },
  ];

  for (const node of nodes) {
    const dist = Math.hypot(cx - node.x, cy - node.y);
    if (dist < 22) {
      if (!state.unlockedSkills.includes(node.id) && state.skillPoints >= node.cost && node.id !== 'core') {
        state.skillPoints -= node.cost;
        state.unlockedSkills.push(node.id);
        recalculateStats(state);
        addLog(state, `Unlocked ${node.id}!`, '#aadd77');
      }
      return;
    }
  }
  state.skillTreeOpen = false;
}

function handleShopClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  if (!state.shopNpc) { state.shopOpen = false; return; }
  const npc = state.shopNpc;
  const pw = Math.min(440, w - 20), ph = Math.min(420, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  // Check if click is outside panel -> close
  if (cx < px || cx > px + pw || cy < py || cy > py + ph) { state.shopOpen = false; return; }

  const lineH = 30;
  // Buy items
  for (let i = 0; i < npc.sells.length; i++) {
    const iy = py + 86 + i * lineH;
    if (cy >= iy && cy <= iy + lineH - 4 && cx >= px + 14 && cx <= px + pw - 14) {
      const item = npc.sells[i];
      if (state.gold >= item.value) {
        state.gold -= item.value;
        addToInventory(state, item.name, item.color, item.value);
        addFloat(state, state.px, state.py, `Bought ${item.name}`, '#aaddaa');
        addLog(state, `Bought ${item.name} for ${item.value}g.`, '#d4a060');
      } else {
        addLog(state, 'Not enough gold!', '#aa4444');
      }
      return;
    }
  }
  // Sell items
  const sellY = py + 86 + npc.sells.length * lineH + 14;
  for (let i = 0; i < Math.min(state.inventory.length, 5); i++) {
    const iy = sellY + 18 + i * lineH;
    if (cy >= iy && cy <= iy + lineH - 4 && cx >= px + 14 && cx <= px + pw - 14) {
      const item = state.inventory[i];
      const sellPrice = Math.max(1, Math.floor(item.value * npc.buysFor / 100));
      state.gold += sellPrice;
      if (item.count > 1) item.count--;
      else state.inventory.splice(i, 1);
      addFloat(state, state.px, state.py, `+${sellPrice}g`, '#d4a430');
      addLog(state, `Sold ${item.name} for ${sellPrice}g.`, '#8a8a2a');
      return;
    }
  }
}

// === EQUIPMENT PANEL ===
export function renderEquipment(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.inventoryOpen && !state.skillTreeOpen) return; // reuse inventory open for now? No — we'll add a separate flag

  // For simplicity, we'll show equipment when inventory is open (side by side)
  // But to keep it clean, let's make a separate hotkey 'E' open equipment.
  // For now, render it when inventory is open as an extension.
  if (!state.inventoryOpen) return;

  const pw = Math.min(420, w - 40);
  const px = (w - pw) / 2 + pw + 10;
  if (px + 200 > w) return; // not enough space on small screens

  const ph = 280;
  const py = (h - ph) / 2;

  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, 200, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, 200, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('EQUIPMENT', px + 100, py + 10);

  const slots = [
    { key: 'helmet', label: 'Helmet' },
    { key: 'body', label: 'Body' },
    { key: 'legs', label: 'Legs' },
    { key: 'boots', label: 'Boots' },
    { key: 'ring', label: 'Ring' },
    { key: 'amulet', label: 'Amulet' },
  ] as const;

  ctx.textAlign = 'left';
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const iy = py + 38 + i * 38;
    ctx.fillStyle = '#222'; ctx.fillRect(px + 10, iy, 180, 32);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px + 10, iy, 180, 32);

    ctx.font = '10px monospace'; ctx.fillStyle = '#888';
    ctx.fillText(s.label, px + 16, iy + 6);

    const item = (state.equipment as any)[s.key];
    if (item) {
      ctx.fillStyle = item.color || '#aaa';
      ctx.fillRect(px + 16, iy + 14, 14, 14);
      ctx.fillStyle = '#ccc'; ctx.font = '9px monospace';
      ctx.fillText(item.name, px + 34, iy + 18);
    } else {
      ctx.fillStyle = '#555'; ctx.font = '9px monospace';
      ctx.fillText('— Empty —', px + 34, iy + 18);
    }
  }
}

// === SKILL TREE ===
export function renderSkillTree(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.skillTreeOpen) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h);

  const pw = Math.min(560, w - 40), ph = Math.min(480, h - 60);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  // Sharp panel
  drawRect(ctx, px, py, pw, ph, '#141412', '#4a4a40', 2);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('SKILL WEB', px + pw / 2, py + 18);
  ctx.font = '12px monospace'; ctx.fillStyle = '#8a8a2a';
  ctx.fillText(`Available Points: ${state.skillPoints}`, px + pw / 2, py + 42);

  // Skill Web Nodes (simple constellation layout)
  const nodes = [
    { id: 'core', x: px + pw/2, y: py + 110, label: 'Core', desc: 'Base Stats', cost: 0 },
    { id: 'combat1', x: px + pw/2 - 110, y: py + 180, label: 'Brutal Strike', desc: '+2 Damage', cost: 1 },
    { id: 'combat2', x: px + pw/2 + 110, y: py + 180, label: 'Iron Will', desc: '+3 Defense', cost: 1 },
    { id: 'surv1', x: px + pw/2 - 70, y: py + 260, label: 'Tough Skin', desc: '+15 Max HP', cost: 1 },
    { id: 'surv2', x: px + pw/2 + 70, y: py + 260, label: 'Quick Feet', desc: 'Faster Move', cost: 1 },
    { id: 'magic1', x: px + pw/2, y: py + 340, label: 'Mana Flow', desc: '+10 Max MP', cost: 1 },
    { id: 'mastery', x: px + pw/2, y: py + 420, label: 'Mastery', desc: 'Unlock Tier 2', cost: 3 },
  ];

  const connections = [
    ['core', 'combat1'],
    ['core', 'combat2'],
    ['combat1', 'surv1'],
    ['combat2', 'surv2'],
    ['surv1', 'magic1'],
    ['surv2', 'magic1'],
    ['magic1', 'mastery'],
  ];

  // Draw connections
  ctx.lineWidth = 2;
  for (const [a, b] of connections) {
    const nodeA = nodes.find(n => n.id === a)!;
    const nodeB = nodes.find(n => n.id === b)!;
    const unlockedA = state.unlockedSkills.includes(a) || a === 'core';
    const unlockedB = state.unlockedSkills.includes(b) || b === 'core';

    ctx.strokeStyle = unlockedA && unlockedB ? '#6a8a4a' : '#3a3a30';
    ctx.beginPath();
    ctx.moveTo(nodeA.x, nodeA.y);
    ctx.lineTo(nodeB.x, nodeB.y);
    ctx.stroke();
  }

  // Draw nodes
  for (const node of nodes) {
    const unlocked = state.unlockedSkills.includes(node.id) || node.id === 'core';
    const canUnlock = state.skillPoints >= node.cost && !unlocked && node.id !== 'core';

    const size = node.id === 'core' || node.id === 'mastery' ? 18 : 14;

    // Glow for unlocked
    if (unlocked) {
      ctx.fillStyle = 'rgba(170, 221, 119, 0.2)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Node
    ctx.fillStyle = unlocked ? '#3a5a2a' : canUnlock ? '#2a3a1a' : '#1a1a18';
    ctx.strokeStyle = unlocked ? '#aadd77' : canUnlock ? '#d4a430' : '#4a4a40';
    ctx.lineWidth = unlocked || canUnlock ? 2.5 : 1.5;

    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = unlocked ? '#d4ffaa' : '#aaa';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(node.label, node.x, node.y + size + 16);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#777';
    ctx.fillText(node.desc, node.x, node.y + size + 28);

    if (!unlocked && node.cost > 0) {
      ctx.fillStyle = canUnlock ? '#d4a430' : '#666';
      ctx.fillText(`${node.cost} SP`, node.x, node.y - size - 8);
    }
  }

  ctx.textAlign = 'center';
  ctx.font = '10px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('Click node to unlock  •  Press T or ESC to close', px + pw / 2, py + ph - 22);
}

// === INVENTORY ===
export function renderInventory(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.inventoryOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const panelW = Math.min(400, w-40), panelH = Math.min(500, h-80);
  const px = (w-panelW)/2, py = (h-panelH)/2;

  // Sharp modern panel
  drawRect(ctx, px, py, panelW, panelH, '#1a1a18', '#4a4a40', 2);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('INVENTORY', px+panelW/2, py+12);

  const weight = getCurrentWeight(state);
  const cap = state.maxCapacity;
  const ratio = weight / cap;
  const weightColor = ratio < 0.5 ? '#8aaa6a' : ratio < 1.0 ? '#d4a430' : '#c44a4a';

  ctx.font = '11px monospace'; ctx.fillStyle = '#888';
  ctx.fillText(`Gold: ${state.gold}`, px+80, py+34);
  ctx.fillStyle = weightColor;
  ctx.fillText(`Cap: ${weight.toFixed(1)}/${cap}`, px+panelW-80, py+34);

  // Capacity bar
  ctx.fillStyle = '#222'; ctx.fillRect(px+20, py+48, panelW-40, 4);
  ctx.fillStyle = weightColor; ctx.fillRect(px+20, py+48, (panelW-40) * Math.min(1, ratio), 4);

  // Autoloot button
  const btnX = px+panelW-92, btnY = py+58, btnW = 80, btnH = 18;
  ctx.fillStyle = '#2a3a2a'; ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#5a7a4a'; ctx.lineWidth = 1; ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.font = '9px monospace'; ctx.fillStyle = '#aadd77';
  ctx.fillText('🎯 AUTOLOOT', btnX + btnW/2, btnY + 5);

  ctx.strokeStyle = '#3a3a30'; ctx.beginPath();
  ctx.moveTo(px+20, py+82); ctx.lineTo(px+panelW-20, py+82); ctx.stroke();

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const itemY = py+92, lineH = 28;
  if (state.inventory.length === 0) {
    ctx.font = '12px monospace'; ctx.fillStyle = '#555';
    ctx.fillText('Your backpack is empty.', px+20, itemY+10);
  }
  for (let i = 0; i < state.inventory.length; i++) {
    const item = state.inventory[i];
    const iy = itemY + i * lineH;
    if (iy + lineH > py + panelH - 20) break;
    ctx.fillStyle = item.color; ctx.fillRect(px+20, iy+4, 16, 16);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(px+20, iy+4, 16, 16);
    ctx.font = '12px monospace'; ctx.fillStyle = '#ccc';
    ctx.fillText(item.name, px+44, iy+6);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888'; ctx.fillText(`×${item.count}`, px+panelW-60, iy+6);
    ctx.fillStyle = '#8a7a30'; ctx.fillText(`${item.value}g`, px+panelW-20, iy+6);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click item to equip  •  Press I or ESC to close', px+panelW/2, py+panelH-20);
}

// === INITIAL STATE ===
function makeSkills(cls: PlayerClass): Skill[] {
  const heal: Skill = { name: 'Heal', icon: '💚', color: '#4aaa6a', cooldown: 6000, lastUsed: -9999, active: false, description: 'Restore health instantly.' };
  const fish: Skill = { name: 'Fish', icon: '🎣', color: '#4a9ac4', cooldown: 3500, lastUsed: -9999, active: false, description: 'Fish in nearby water.' };
  const bag:  Skill = { name: 'Inventory', icon: '🎒', color: '#7a6a5a', cooldown: 300, lastUsed: -9999, active: false, description: 'Open your backpack.' };
  const outfit: Skill = { name: 'Outfit', icon: '👤', color: '#8a7a6a', cooldown: 300, lastUsed: -9999, active: false, description: 'Change outfit.' };
  const skillTree: Skill = { name: 'Skill Tree', icon: '🌳', color: '#6a8a3a', cooldown: 300, lastUsed: -9999, active: false, description: 'Open skill tree.' };
  const options: Skill = { name: 'Options', icon: '⚙', color: '#555555', cooldown: 300, lastUsed: -9999, active: false, description: 'Open game settings.' };

  if (cls === 'warrior') return [
    { name: 'Power Strike', icon: '⚔', color: '#c44a4a', cooldown: 4000, lastUsed: -9999, active: false, description: 'Heavy melee blow.' },
    { name: 'Shield Bash',  icon: '🛡', color: '#4a6ac4', cooldown: 8000, lastUsed: -9999, active: false, description: '+defense, recover HP.' },
    heal,
    { name: 'Whirlwind',    icon: '🌀', color: '#c47a2a', cooldown: 10000, lastUsed: -9999, active: false, description: 'AoE melee spin.' },
    fish, outfit, skillTree, options, bag,
  ];
  if (cls === 'archer') return [
    { name: 'Power Shot',   icon: '🏹', color: '#8a6a3a', cooldown: 3000, lastUsed: -9999, active: false, description: 'Strong ranged shot.' },
    { name: 'Multi Shot',   icon: '⇶',  color: '#aa7a3a', cooldown: 8000, lastUsed: -9999, active: false, description: 'Hit all in range 3.' },
    heal,
    { name: 'Evasion',      icon: '💨', color: '#6a9a6a', cooldown: 12000, lastUsed: -9999, active: false, description: '+3 defense for 8s.' },
    fish, outfit, skillTree, options, bag,
  ];
  // mage
  return [
    { name: 'Arcane Bolt',  icon: '✦',  color: '#9a6ac4', cooldown: 3000, lastUsed: -9999, active: false, description: 'Magic bolt, range 2.' },
    { name: 'Wildfire',     icon: '🔥', color: '#c47a2a', cooldown: 10000, lastUsed: -9999, active: false, description: 'AoE fire. 20 mana.' },
    heal,
    { name: 'Barrier',      icon: '🔮', color: '#6a6ac4', cooldown: 15000, lastUsed: -9999, active: false, description: 'Magic shield for 10s.' },
    fish, outfit, skillTree, options, bag,
  ];
}

export function createGameState(): GameState {
  return {
    terrain: new Uint8Array(0), objects: new Uint8Array(0), explored: new Uint8Array(0),
    px: 128, py: 128, prevPx: 128, prevPy: 128, moveProgress: 1,
    facing: 2, walkFrame: 0, lastMovedSideways: false,
    hp: 100, maxHp: 100, mana: 50, maxMana: 50, stamina: 100, maxStamina: 100,
    xp: 0, level: 1, xpToNext: 100,
    playerDamage: 5, playerDefense: 1, attackRange: 1,
    gold: 0, skullLevel: 0,
    lastStep: 0, lastAttack: -9999, lastCombat: 0, lastHpRegen: 0,
    playerUnderAttack: false, playerUnderAttackTime: 0,
    dead: false, deathTime: 0, respawnX: 128, respawnY: 128,
    playerClass: 'warrior', playerName: 'Wanderer',
    outfit: { ...OUTFIT_PRESETS[0].outfit },
    camX: 128, camY: 128,
    monsters: [], items: [], particles: [], floatTexts: [],
    screenShake: 0,
    keysDown: new Set(), moveTarget: null, attackTarget: null,
    hudActivity: 0, minimapActivity: 0,
    log: [],
    skills: makeSkills('warrior'), activeSkillIdx: -1,
    worldTime: 0.25, gameStarted: false,
    charCreationOpen: true, charCreationClass: 'warrior', charCreationOutfit: 0, charCreationName: 'Wanderer',
    outfitMenuOpen: false,
    equipment: { helmet: null, body: null, legs: null, boots: null, ring: null, amulet: null },
    skillPoints: 0,
    unlockedSkills: [],
    skillTreeOpen: false,
    npcs: [], shopOpen: false, shopNpc: null, interactTarget: null,
    nextId: 1,
    inventory: [], inventoryOpen: false,
    monstersKilled: 0, tilesWalked: 0,
    resistances: { fire: 0, ice: 0, energy: 0, earth: 0 },
    chatMessages: [], chatOpen: false, chatInput: '', chatTab: 'global', chatActivity: 0,
    friends: [
      { id: 'f1', name: 'Aldric', online: true },
      { id: 'f2', name: 'Elara', online: true },
      { id: 'f3', name: 'Kael', online: false },
    ],
    friendListOpen: false,
    party: [], partyOpen: false,
    pushHeld: false, pushStartTime: 0, pushStartX: 0, pushStartY: 0, pushTargetId: null,
    pushTargetType: null, pushOriginX: 0, pushOriginY: 0,
    altKeyDown: false,
    maxCapacity: 100,
    autolootFilter: {
      pickGold: true,
      pickCommon: false,
      pickRare: true,
      pickEpic: true,
      pickLegendary: true,
      pickWeapons: true,
      pickArmor: true,
      pickConsumables: true,
      pickJunk: false,
    },
    autolootSettingsOpen: false,
    optionsOpen: false,
    showFps: true,
    screenShakeEnabled: true,
    minimapEnabled: true,
  };
}

// === INPUT ===
export function handleKeyDown(state: GameState, key: string, now: number) {
  if (!state.gameStarted && state.charCreationOpen) {
    // Typing name
    if (key === 'Backspace') { state.charCreationName = state.charCreationName.slice(0, -1); return; }
    if (key === 'Enter') { applyCharCreation(state); startGame(state); return; }
    if (key.length === 1 && state.charCreationName.length < 14) { state.charCreationName += key; return; }
    return;
  }
  if (!state.gameStarted) { startGame(state); return; }

  const lk = key.toLowerCase();

  // Alt key for push mode
  if (key === 'Alt') {
    state.altKeyDown = true;
    return;
  }

  // Chat input takes priority when chat is open
  if (state.chatOpen || key === 'Enter') { handleChatInput(state, key, now); return; }

  // Close social panels
  if (lk === 'escape') {
    if (state.friendListOpen) { state.friendListOpen = false; return; }
    if (state.partyOpen) { state.partyOpen = false; return; }
  }

  // Shop close
  if (lk === 'escape' && state.shopOpen) { state.shopOpen = false; state.shopNpc = null; state.hudActivity = now; return; }
  if (state.shopOpen) return;

  // Outfit menu
  if (lk === 'o' || (lk === 'escape' && state.outfitMenuOpen)) {
    state.outfitMenuOpen = !state.outfitMenuOpen;
    state.hudActivity = now;
    return;
  }
  if (state.outfitMenuOpen) return;

  // Equipment
  if (lk === 'e' || (lk === 'escape' && state.inventoryOpen)) {
    // Toggle inventory which now shows equipment too
    state.inventoryOpen = !state.inventoryOpen;
    state.hudActivity = now;
    return;
  }

  // Social (Friends/Party)
  if (lk === 'f') { state.friendListOpen = !state.friendListOpen; state.hudActivity = now; return; }
  if (lk === 'p') { state.partyOpen = !state.partyOpen; state.hudActivity = now; return; }

  // Chat
  state.chatActivity = now;

  // Skill Tree
  if (lk === 't' || (lk === 'escape' && state.skillTreeOpen)) {
    state.skillTreeOpen = !state.skillTreeOpen;
    state.hudActivity = now;
    return;
  }
  // Options settings
  if (lk === 'escape' && state.optionsOpen) {
    state.optionsOpen = false;
    state.hudActivity = now;
    return;
  }
  if (state.optionsOpen) return;

  // Autoloot settings
  if (lk === 'escape' && state.autolootSettingsOpen) {
    state.autolootSettingsOpen = false;
    state.hudActivity = now;
    return;
  }
  if (state.autolootSettingsOpen) return;

  // Inventory / escape
  if (lk === 'i' || (lk === 'escape' && state.inventoryOpen)) {
    state.inventoryOpen = !state.inventoryOpen;
    state.hudActivity = now;
    return;
  }
  if (state.inventoryOpen) return;

  // Skill hotkeys 1-7
  if (lk >= '1' && lk <= '7') {
    const idx = parseInt(lk) - 1;
    activateSkill(state, idx, now);
    state.hudActivity = now;
    return;
  }

  state.keysDown.add(lk);
  state.hudActivity = now;
  state.minimapActivity = now;
  state.moveTarget = null; // keyboard overrides click-move
}

export function handleKeyUp(state: GameState, key: string) {
  const lk = key.toLowerCase();
  state.keysDown.delete(lk);

  if (key === 'Alt') {
    state.altKeyDown = false;
    // Cancel any pending push
    if (state.pushHeld) {
      state.pushHeld = false;
      state.pushTargetId = null;
    }
  }
}

export function handleClick(state: GameState, canvasX: number, canvasY: number, canvasW: number, canvasH: number, now: number) {
  if (!state.gameStarted && state.charCreationOpen) {
    handleCharCreationClick(state, canvasX, canvasY, canvasW, canvasH);
    return;
  }
  if (!state.gameStarted) { startGame(state); return; }
  if (state.outfitMenuOpen) { handleOutfitClick(state, canvasX, canvasY, canvasW, canvasH); return; }
  if (state.shopOpen) { handleShopClick(state, canvasX, canvasY, canvasW, canvasH); return; }
  if (state.skillTreeOpen) { handleSkillTreeClick(state, canvasX, canvasY, canvasW, canvasH); return; }
  if (state.optionsOpen) {
    handleOptionsClick(state, canvasX, canvasY, canvasW, canvasH);
    return;
  }
  if (state.autolootSettingsOpen) {
    handleAutolootClick(state, canvasX, canvasY, canvasW, canvasH);
    return;
  }
  if (state.inventoryOpen) {
    // Handle inventory clicks for equipping
    handleInventoryClick(state, canvasX, canvasY, canvasW, canvasH);
    return;
  }
  if (state.dead) return;

  // Calculate HUD visibility BEFORE updating hudActivity
  const sinceAct = now - state.hudActivity;
  const hudVisible = sinceAct < (HUD_FADE_TIME + HUD_FADE_DUR);

  state.hudActivity = now;
  state.minimapActivity = now;

  const tileSize = getTileSize(canvasW, canvasH);
  const camOffX = state.camX - Math.floor(state.camX);
  const camOffY = state.camY - Math.floor(state.camY);
  const baseX = canvasW / 2 - camOffX * tileSize;
  const baseY = canvasH / 2 - camOffY * tileSize;
  const camTileX = Math.floor(state.camX);
  const camTileY = Math.floor(state.camY);

  const tileX = camTileX + Math.floor((canvasX - baseX) / tileSize);
  const tileY = camTileY + Math.floor((canvasY - baseY) / tileSize);

  // Only allow skill bar clicks when HUD is visible
  if (hudVisible) {
    const slotSize = Math.min(42, canvasW * 0.065);
    const gap = 4;
    const totalW = 7 * slotSize + 6 * gap;
    const slotX = (canvasW - totalW) / 2;
    const slotY = canvasH - slotSize - 10;
    if (canvasY >= slotY && canvasY <= slotY + slotSize) {
      for (let i = 0; i < state.skills.length; i++) {
        const sx = slotX + i * (slotSize + gap);
        if (canvasX >= sx && canvasX <= sx + slotSize) {
          activateSkill(state, i, now);
          return;
        }
      }
    }
  }

  // NPC click (exact tile only)
  const clickedNpc = state.npcs.find(n => n.x === tileX && n.y === tileY);
  if (clickedNpc) {
    state.interactTarget = clickedNpc;
    state.attackTarget = null;

    const dist = chebDist(state.px, state.py, clickedNpc.x, clickedNpc.y);
    if (dist <= 2) {
      // Close enough → open shop immediately
      state.shopNpc = clickedNpc;
      state.shopOpen = true;
      addLog(state, `${clickedNpc.name}: "Welcome! Browse my wares."`, '#d4a060');
    } else {
      // Too far → walk towards the NPC
      state.moveTarget = { x: clickedNpc.x, y: clickedNpc.y };
    }
    return;
  }

  // Monster targeting (exact tile only — toggleable)
  const exactMonster = state.monsters.find(m => !m.dead && m.x === tileX && m.y === tileY);
  if (exactMonster) {
    if (state.attackTarget?.id === exactMonster.id) {
      state.attackTarget = null; // Toggle off
    } else {
      state.attackTarget = exactMonster;
      state.moveTarget = null;
      state.interactTarget = null;
      if (chebDist(state.px, state.py, exactMonster.x, exactMonster.y) <= state.attackRange) {
        playerAttackMonster(state, exactMonster, now);
      }
    }
    return;
  }

  // Ground item click
  const clickedItem = state.items.find(it => it.x === tileX && it.y === tileY && it.x === state.px && it.y === state.py);
  if (clickedItem) {
    if (clickedItem.name === 'Gold') { state.gold += clickedItem.value; addFloat(state, state.px, state.py, `+${clickedItem.value}g`, '#d4a430'); }
    else { addToInventory(state, clickedItem.name, clickedItem.color, clickedItem.value); addFloat(state, state.px, state.py, `+${clickedItem.name}`, '#aaddaa'); }
    state.items = state.items.filter(i => i.id !== clickedItem.id);
    return;
  }

  // Walk to tile (clear any active target when moving)
  state.moveTarget = { x: tileX, y: tileY };
  state.attackTarget = null;
  state.interactTarget = null;
}

// Equip item from inventory
function handleInventoryClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  const panelW = Math.min(400, w-40), panelH = Math.min(500, h-80);
  const px = (w-panelW)/2, py = (h-panelH)/2;

  // Autoloot button
  const btnX = px+panelW-92, btnY = py+58, btnW = 80, btnH = 18;
  if (cx >= btnX && cx <= btnX + btnW && cy >= btnY && cy <= btnY + btnH) {
    state.autolootSettingsOpen = !state.autolootSettingsOpen;
    return;
  }

  const itemY = py+92, lineH = 28;
  for (let i = 0; i < state.inventory.length; i++) {
    const iy = itemY + i * lineH;
    if (iy + lineH > py + panelH - 20) break;
    if (cy >= iy && cy <= iy + lineH - 4 && cx >= px + 14 && cx <= px + panelW - 14) {
      tryEquip(state, i);
      return;
    }
  }
  state.inventoryOpen = false;
}

export function renderAutolootSettings(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.autolootSettingsOpen) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(360, w - 40), ph = Math.min(440, h - 60);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#5a7a4a'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#aadd77';
  ctx.fillText('🎯 AUTOLOOT FILTER', px + pw / 2, py + 14);
  ctx.font = '10px monospace'; ctx.fillStyle = '#888';
  ctx.fillText('Toggle which items are auto-collected', px + pw / 2, py + 36);

  const filters: { key: keyof typeof state.autolootFilter; label: string; group: string }[] = [
    { key: 'pickGold', label: '💰 Gold', group: 'Currency' },
    { key: 'pickCommon', label: '⚪ Common items', group: 'Rarity' },
    { key: 'pickRare', label: '🔵 Rare items', group: 'Rarity' },
    { key: 'pickEpic', label: '🟣 Epic items', group: 'Rarity' },
    { key: 'pickLegendary', label: '🟡 Legendary items', group: 'Rarity' },
    { key: 'pickWeapons', label: '⚔ Weapons', group: 'Type' },
    { key: 'pickArmor', label: '🛡 Armor', group: 'Type' },
    { key: 'pickConsumables', label: '🧪 Consumables (potions, food)', group: 'Type' },
    { key: 'pickJunk', label: '🦴 Junk (bones, tails, gels)', group: 'Type' },
  ];

  ctx.textAlign = 'left';
  let yOff = py + 56;
  let lastGroup = '';
  for (const f of filters) {
    if (f.group !== lastGroup) {
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#888';
      ctx.fillText(f.group.toUpperCase(), px + 16, yOff);
      yOff += 16;
      lastGroup = f.group;
    }
    const enabled = state.autolootFilter[f.key];
    ctx.fillStyle = enabled ? '#2a3a2a' : '#1a1a18';
    ctx.fillRect(px + 14, yOff, pw - 28, 22);
    ctx.strokeStyle = enabled ? '#5a7a4a' : '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 14, yOff, pw - 28, 22);

    // Checkbox
    ctx.fillStyle = enabled ? '#aadd77' : '#444';
    ctx.fillRect(px + 20, yOff + 6, 10, 10);
    if (enabled) {
      ctx.fillStyle = '#1a1a18';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✓', px + 25, yOff + 7);
      ctx.textAlign = 'left';
    }

    ctx.font = '11px monospace'; ctx.fillStyle = enabled ? '#ddd' : '#888';
    ctx.fillText(f.label, px + 36, yOff + 7);
    yOff += 26;
  }

  ctx.textAlign = 'center'; ctx.font = '9px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click row to toggle  •  ESC or click outside to close', px + pw / 2, py + ph - 18);
}

function handleAutolootClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  const pw = Math.min(360, w - 40), ph = Math.min(440, h - 60);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  // Click outside closes
  if (cx < px || cx > px + pw || cy < py || cy > py + ph) {
    state.autolootSettingsOpen = false;
    return;
  }

  const filters: { key: keyof typeof state.autolootFilter; group: string }[] = [
    { key: 'pickGold', group: 'Currency' },
    { key: 'pickCommon', group: 'Rarity' },
    { key: 'pickRare', group: 'Rarity' },
    { key: 'pickEpic', group: 'Rarity' },
    { key: 'pickLegendary', group: 'Rarity' },
    { key: 'pickWeapons', group: 'Type' },
    { key: 'pickArmor', group: 'Type' },
    { key: 'pickConsumables', group: 'Type' },
    { key: 'pickJunk', group: 'Type' },
  ];

  let yOff = py + 56;
  let lastGroup = '';
  for (const f of filters) {
    if (f.group !== lastGroup) {
      yOff += 16;
      lastGroup = f.group;
    }
    if (cx >= px + 14 && cx <= px + pw - 14 && cy >= yOff && cy <= yOff + 22) {
      state.autolootFilter[f.key] = !state.autolootFilter[f.key];
      return;
    }
    yOff += 26;
  }
}

function tryEquip(state: GameState, itemIndex: number) {
  const item = state.inventory[itemIndex];
  if (!item) return;

  let slot: keyof typeof state.equipment | null = null;
  const lower = item.name.toLowerCase();
  if (lower.includes('helmet') || lower.includes('hat')) slot = 'helmet';
  else if (lower.includes('armor') || lower.includes('robe')) slot = 'body';
  else if (lower.includes('legs') || lower.includes('pants')) slot = 'legs';
  else if (lower.includes('boots')) slot = 'boots';
  else if (lower.includes('ring')) slot = 'ring';
  else if (lower.includes('amulet') || lower.includes('necklace')) slot = 'amulet';
  else if (lower.includes('sword') || lower.includes('bow') || lower.includes('wand')) slot = 'body';

  if (!slot) {
    addLog(state, `${item.name} cannot be equipped.`, '#888');
    return;
  }

  const current = state.equipment[slot];
  if (current) {
    addToInventory(state, current.name, current.color, current.value);
  }

  (state.equipment as any)[slot] = { ...item, count: 1 };
  if (item.count > 1) item.count--;
  else state.inventory.splice(itemIndex, 1);

  recalculateStats(state);
  addLog(state, `Equipped ${item.name}.`, '#4a8aff');
}

function applyCharCreation(state: GameState) {
  state.charCreationOpen = false;
  state.playerClass = state.charCreationClass;
  state.playerName = state.charCreationName || 'Wanderer';
  state.outfit = { ...OUTFIT_PRESETS[state.charCreationOutfit].outfit };
  state.skills = makeSkills(state.playerClass);
  // Class stats
  if (state.playerClass === 'warrior') {
    state.hp = 120; state.maxHp = 120; state.mana = 30; state.maxMana = 30;
    state.playerDamage = 7; state.playerDefense = 3; state.attackRange = 1;
  } else if (state.playerClass === 'archer') {
    state.hp = 85; state.maxHp = 85; state.mana = 40; state.maxMana = 40;
    state.playerDamage = 6; state.playerDefense = 1; state.attackRange = 3;
  } else {
    state.hp = 70; state.maxHp = 70; state.mana = 80; state.maxMana = 80;
    state.playerDamage = 4; state.playerDefense = 0; state.attackRange = 2;
  }
  recalculateStats(state);
}

function handleCharCreationClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  const pw = Math.min(520, w - 30), ph = Math.min(480, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  // Class buttons
  const classes: PlayerClass[] = ['warrior', 'archer', 'mage'];
  const bw = Math.min(140, (pw - 40) / 3 - 8), bh = 70;
  const bx0 = px + (pw - (bw * 3 + 16)) / 2;
  for (let i = 0; i < 3; i++) {
    const x = bx0 + i * (bw + 8), y2 = py + 120;
    if (cx >= x && cx <= x + bw && cy >= y2 && cy <= y2 + bh) {
      state.charCreationClass = classes[i];
      return;
    }
  }

  // Outfit buttons
  const ow = 60, oh = 60;
  const ox0 = px + (pw - (ow * OUTFIT_PRESETS.length + (OUTFIT_PRESETS.length - 1) * 6)) / 2;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) {
    const x = ox0 + i * (ow + 6), y2 = py + 224;
    if (cx >= x && cx <= x + ow && cy >= y2 && cy <= y2 + oh) {
      state.charCreationOutfit = i;
      return;
    }
  }

  // Start button
  const sbw = 200, sbh = 40;
  const sbx = px + (pw - sbw) / 2, sby = py + ph - 70;
  if (cx >= sbx && cx <= sbx + sbw && cy >= sby && cy <= sby + sbh) {
    applyCharCreation(state);
    startGame(state);
  }
}

function handleOutfitClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  const pw = Math.min(420, w - 30), ph = 200;
  const px = (w - pw) / 2, py = (h - ph) / 2;
  const ow = 56, oh = 56;
  const ox0 = px + (pw - (ow * OUTFIT_PRESETS.length + (OUTFIT_PRESETS.length - 1) * 6)) / 2;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) {
    const x = ox0 + i * (ow + 6), y2 = py + 42;
    if (cx >= x && cx <= x + ow && cy >= y2 && cy <= y2 + oh) {
      state.outfit = { ...OUTFIT_PRESETS[i].outfit };
      state.outfitMenuOpen = false;
      return;
    }
  }
  // Click outside closes
  state.outfitMenuOpen = false;
}

function startGame(state: GameState) {
  if (state.gameStarted) return;
  state.gameStarted = true;
  const now = performance.now();
  state.hudActivity = now;
  state.minimapActivity = now;
  generateWorld(state);
  spawnInitialMonsters(state);
  for (let ey = -VIEW_MIN_RADIUS; ey <= VIEW_MIN_RADIUS; ey++)
    for (let ex = -VIEW_MIN_RADIUS; ex <= VIEW_MIN_RADIUS; ex++) {
      const wx = state.px + ex, wy = state.py + ey;
      if (wx >= 0 && wx < WORLD_SIZE && wy >= 0 && wy < WORLD_SIZE)
        state.explored[wy * WORLD_SIZE + wx] = 1;
    }
  // Spawn NPCs in the village
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
  addLog(state, 'You awaken near a small village...', '#c4a860');
  addLog(state, 'The world stretches endlessly before you.', '#8a8070');
}

// ═══════════════════════════════════════════════════════════
// STATS PANEL (fades with HUD)
// ═══════════════════════════════════════════════════════════
export function renderStatsPanel(ctx: CanvasRenderingContext2D, state: GameState, _w: number, _h: number, now: number) {
  const sinceActivity = now - state.hudActivity;
  let alpha = 1;
  if (sinceActivity > 10000) alpha = Math.max(0, 1 - (sinceActivity - 10000) / 2000);
  if (alpha <= 0) return;

  ctx.globalAlpha = alpha;
  const px = 12, py = 68;
  const pw = 148;

  // Rounded panel
  // Sharp panel
  drawRect(ctx, px - 2, py - 2, pw + 4, 78, '#0f0f0e', '#3a3a35', 1);

  ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`⚔ ATK: ${state.playerDamage}`, px + 6, py + 4);
  ctx.fillText(`🛡 DEF: ${state.playerDefense}`, px + 6, py + 16);

  const r = state.resistances;
  ctx.fillText(`🔥 ${r.fire}%  ❄ ${r.ice}%  ⚡ ${r.energy}%  🪨 ${r.earth}%`, px + 6, py + 30);

  ctx.fillStyle = '#888';
  ctx.fillText(`Skull: ${state.skullLevel > 0 ? '⚠' : '✓'}`, px + 6, py + 44);

  const kills = state.monstersKilled;
  ctx.fillText(`Kills: ${kills}`, px + 6, py + 56);

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
// GLOBAL CHAT
// ═══════════════════════════════════════════════════════════
export function renderChat(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, now: number) {
  const sinceChat = now - state.chatActivity;
  let alpha = 1;
  if (sinceChat > 5000) alpha = Math.max(0, 1 - (sinceChat - 5000) / 2000);
  if (alpha <= 0 && !state.chatOpen) return;

  const chatW = Math.min(360, w * 0.45);
  const chatH = state.chatOpen ? Math.min(200, h * 0.3) : Math.min(100, h * 0.15);
  const cx = 12;
  const cy = h - chatH - 60;

  ctx.globalAlpha = Math.max(alpha, state.chatOpen ? 1 : 0.3);
  ctx.fillStyle = 'rgba(10,10,10,0.85)'; ctx.fillRect(cx - 2, cy - 2, chatW + 4, chatH + 4);
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.strokeRect(cx - 2, cy - 2, chatW + 4, chatH + 4);

  // Header
  ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#888';
  ctx.fillText('[GLOBAL] Press Enter to chat', cx + 6, cy + 4);

  // Messages (show recent)
  const messages = state.chatMessages.filter(m => m.type === 'global' || (m.type === 'party' && state.party.length > 0));
  const recentMsgs = messages.slice(-5);
  for (let i = 0; i < recentMsgs.length; i++) {
    const msg = recentMsgs[i];
    const msgY = cy + 18 + i * 16;
    ctx.fillStyle = '#aaa';
    ctx.fillText(`${msg.sender}:`, cx + 6, msgY);
    ctx.fillStyle = '#ccc';
    const msgText = msg.text.length > 45 ? msg.text.slice(0, 42) + '...' : msg.text;
    ctx.fillText(msgText, cx + 6 + msg.sender.length * 7 + 6, msgY);
  }

  // Input field when open
  if (state.chatOpen) {
    ctx.fillStyle = '#222'; ctx.fillRect(cx + 4, cy + chatH - 22, chatW - 8, 18);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(cx + 4, cy + chatH - 22, chatW - 8, 18);
    ctx.font = '11px monospace'; ctx.fillStyle = '#ddd';
    ctx.fillText(state.chatInput + (Math.floor(now * 0.005) % 2 === 0 ? '|' : ' '), cx + 8, cy + chatH - 20);
  }

  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
// FRIENDS & PARTY
// ═══════════════════════════════════════════════════════════
export function renderSocial(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.friendListOpen && !state.partyOpen) return;

  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(300, w * 0.35), ph = Math.min(300, h * 0.4);
  const px = (w - pw) / 2, py = (h - ph) / 2;

  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('SOCIAL', px + pw / 2, py + 12);

  // Friends
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#888';
  ctx.textAlign = 'left';
  ctx.fillText('FRIENDS', px + 14, py + 36);

  for (let i = 0; i < state.friends.length; i++) {
    const f = state.friends[i];
    const iy = py + 54 + i * 22;
    ctx.fillStyle = f.online ? '#4c4' : '#444';
    ctx.beginPath(); ctx.arc(px + 20, iy + 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc';
    ctx.fillText(f.name, px + 32, iy);
    ctx.font = '9px monospace'; ctx.fillStyle = f.online ? '#4a4' : '#666';
    ctx.fillText(f.online ? 'Online' : 'Offline', px + 120, iy + 1);
  }

  // Party
  const partyY = py + 54 + state.friends.length * 22 + 10;
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#888';
  ctx.fillText('PARTY', px + 14, partyY);

  if (state.party.length === 0) {
    ctx.font = '10px monospace'; ctx.fillStyle = '#555';
    ctx.fillText('No party members. Invite friends!', px + 16, partyY + 18);
  }
  for (let i = 0; i < state.party.length; i++) {
    const pm = state.party[i];
    const iy = partyY + 18 + i * 22;
    const hpPct = pm.hp / pm.maxHp;
    ctx.fillStyle = '#000'; ctx.fillRect(px + 16, iy + 4, pw - 32, 18);
    ctx.fillStyle = hpPct > 0.5 ? '#4a4a4a' : '#4a2a2a';
    ctx.fillRect(px + 16, iy + 4, (pw - 32) * hpPct, 18);
    ctx.font = '10px monospace'; ctx.fillStyle = '#ccc';
    ctx.fillText(`${pm.name} (${pm.hp}/${pm.maxHp})`, px + 20, iy + 6);
  }

  ctx.textAlign = 'center';
  ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Press F for friends  •  P for party  •  ESC to close', px + pw / 2, py + ph - 18);
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
// CHAT INPUT HANDLER
// ═══════════════════════════════════════════════════════════
export function handleChatInput(state: GameState, key: string, now: number) {
  if (key === 'Enter') {
    if (state.chatOpen && state.chatInput.trim()) {
      state.chatMessages.push({ text: state.chatInput, sender: state.playerName, time: now, type: state.chatTab });
      state.chatInput = '';
      state.chatOpen = false;
      state.chatActivity = now;
    } else {
      state.chatOpen = !state.chatOpen;
      state.chatActivity = now;
    }
    return;
  }
  if (!state.chatOpen) return;
  if (key === 'Escape') { state.chatOpen = false; return; }
  if (key === 'Backspace') { state.chatInput = state.chatInput.slice(0, -1); return; }
  if (key.length === 1 && state.chatInput.length < 60) { state.chatInput += key; }
  state.chatActivity = now;
}

// ═══════════════════════════════════════════════════════════
// PUSH SYSTEM
// ═══════════════════════════════════════════════════════════

function getTileSize(w: number, h: number): number {
  const tileSize = Math.ceil(Math.max(w, h) / 21);
  return Math.max(18, tileSize);
}

// Simplified rectangular drawing
function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillStyle: string, strokeStyle?: string, lineWidth: number = 1) {
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, w, h);
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
  }
}

function screenToTile(canvasX: number, canvasY: number, state: GameState, canvasW: number, canvasH: number): { x: number; y: number } {
  const tileSize = getTileSize(canvasW, canvasH);
  const camOffX = state.camX - Math.floor(state.camX);
  const camOffY = state.camY - Math.floor(state.camY);
  const baseX = canvasW / 2 - camOffX * tileSize;
  const baseY = canvasH / 2 - camOffY * tileSize;
  const camTileX = Math.floor(state.camX);
  const camTileY = Math.floor(state.camY);
  return {
    x: camTileX + Math.floor((canvasX - baseX) / tileSize),
    y: camTileY + Math.floor((canvasY - baseY) / tileSize),
  };
}

export function handlePointerDown(state: GameState, canvasX: number, canvasY: number, canvasW: number, canvasH: number, now: number) {
  if (!state.gameStarted) return;

  const tile = screenToTile(canvasX, canvasY, state, canvasW, canvasH);

  // Push mode only activates when Alt is held — skip all other click behavior
  if (state.altKeyDown) {
    const clickedMonster = state.monsters.find(m => !m.dead && m.x === tile.x && m.y === tile.y && m.pushable);
    const clickedItem = state.items.find(it => it.x === tile.x && it.y === tile.y);

    if (clickedMonster) {
      state.pushHeld = true;
      state.pushStartTime = now;
      state.pushStartX = canvasX;
      state.pushStartY = canvasY;
      state.pushTargetId = clickedMonster.id;
      state.pushTargetType = 'monster';
      state.pushOriginX = clickedMonster.x;
      state.pushOriginY = clickedMonster.y;
    } else if (clickedItem) {
      state.pushHeld = true;
      state.pushStartTime = now;
      state.pushStartX = canvasX;
      state.pushStartY = canvasY;
      state.pushTargetId = clickedItem.id;
      state.pushTargetType = 'item';
      state.pushOriginX = clickedItem.x;
      state.pushOriginY = clickedItem.y;
    }
    return; // Don't do targeting/attack/walk when Alt is held
  }
}

export function handlePointerUp(state: GameState, canvasX: number, canvasY: number, canvasW: number, canvasH: number, now: number) {
  if (!state.pushHeld || !state.pushTargetId || !state.pushTargetType) {
    clearPushState(state);
    return;
  }

  // Only complete push if Alt was held during the action
  if (!state.altKeyDown) {
    clearPushState(state);
    return;
  }

  const holdDuration = now - state.pushStartTime;
  if (holdDuration < 300) {
    clearPushState(state);
    return;
  }

  const target = state.pushTargetType === 'monster'
    ? state.monsters.find(m => m.id === state.pushTargetId && !m.dead)
    : state.items.find(it => it.id === state.pushTargetId) || null;

  if (!target) {
    clearPushState(state);
    return;
  }

  // Target must not have moved away since push started
  if (target.x !== state.pushOriginX || target.y !== state.pushOriginY) {
    addLog(state, 'Target moved away.', '#888');
    clearPushState(state);
    return;
  }

  // Must be adjacent to push
  if (chebDist(state.px, state.py, target.x, target.y) > 1) {
    addLog(state, 'Too far away to push.', '#888');
    clearPushState(state);
    return;
  }

  // Determine push direction relative to target tile, not player tile.
  const releaseTile = screenToTile(canvasX, canvasY, state, canvasW, canvasH);
  let pushDx = releaseTile.x - target.x;
  let pushDy = releaseTile.y - target.y;

  // If released on same tile, push away from player
  if (pushDx === 0 && pushDy === 0) {
    pushDx = target.x - state.px;
    pushDy = target.y - state.py;
  }

  // Normalize to max 1 sqm
  pushDx = Math.sign(pushDx);
  pushDy = Math.sign(pushDy);

  // Prefer cardinal when drag is mostly one direction
  const pixelDx = canvasX - state.pushStartX;
  const pixelDy = canvasY - state.pushStartY;
  const absDx = Math.abs(pixelDx);
  const absDy = Math.abs(pixelDy);
  if (absDx > absDy * 2) pushDy = 0;
  else if (absDy > absDx * 2) pushDx = 0;

  executePush(state, target, pushDx, pushDy, now, state.pushTargetType);
  clearPushState(state);
}

function clearPushState(state: GameState) {
  state.pushHeld = false;
  state.pushTargetId = null;
  state.pushTargetType = null;
  state.pushOriginX = 0;
  state.pushOriginY = 0;
}

function canPushTo(state: GameState, x: number, y: number, ignoreMonsterId?: number, ignoreItemId?: number): boolean {
  if (!isWalkable(state, x, y)) return false;
  if (state.npcs.some(n => n.x === x && n.y === y)) return false;
  if (state.items.some(it => it.id !== ignoreItemId && it.x === x && it.y === y)) return false;
  if (state.monsters.some(m => !m.dead && m.id !== ignoreMonsterId && m.x === x && m.y === y)) return false;
  return true;
}

function executePush(
  state: GameState,
  target: Monster | WorldItem,
  dx: number,
  dy: number,
  now: number,
  targetType: 'monster' | 'item'
) {
  const newX = target.x + dx;
  const newY = target.y + dy;

  if (dx === 0 && dy === 0) {
    addLog(state, 'No push direction selected.', '#888');
    return;
  }

  const blocked = targetType === 'monster'
    ? !canPushTo(state, newX, newY, (target as Monster).id, undefined)
    : !canPushTo(state, newX, newY, undefined, (target as WorldItem).id);

  if (blocked) {
    const label = 'type' in target ? (target as Monster).type : (target as WorldItem).name;
    addLog(state, `${label} can't be pushed there — blocked.`, '#888');
    addFloat(state, target.x, target.y, 'BLOCKED', '#888');
    return;
  }

  target.x = newX;
  target.y = newY;

  if (targetType === 'monster') {
    const pushedMonster = target as Monster;
    pushedMonster.pushedUntil = now + 800;
    pushedMonster.lastMove = now;
  }

  addFloat(state, newX, newY, 'PUSHED', '#88aaff');
  const label = 'type' in target ? (target as Monster).type : (target as WorldItem).name;
  addLog(state, `Pushed ${label}.`, '#88aaff');
  state.hudActivity = now;
}

export function renderPushIndicator(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, now: number) {
  if (!state.pushHeld || !state.pushTargetId || !state.pushTargetType) return;

  const target = state.pushTargetType === 'monster'
    ? state.monsters.find(m => m.id === state.pushTargetId && !m.dead)
    : state.items.find(it => it.id === state.pushTargetId);
  if (!target) return;

  const tileSize = getTileSize(w, h);
  const camOffX = state.camX - Math.floor(state.camX);
  const camOffY = state.camY - Math.floor(state.camY);
  const baseX = w / 2 - camOffX * tileSize;
  const baseY = h / 2 - camOffY * tileSize;
  const camTileX = Math.floor(state.camX);
  const camTileY = Math.floor(state.camY);

  const sx = baseX + (target.x - camTileX) * tileSize + tileSize / 2;
  const sy = baseY + (target.y - camTileY) * tileSize + tileSize / 2;

  const holdDuration = now - state.pushStartTime;
  const progress = Math.min(1, holdDuration / 300);

  ctx.save();
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 3;

  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(sx, sy, tileSize * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(sx, sy, tileSize * 0.65, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#4488ff';
  ctx.globalAlpha = progress >= 1 ? 0.9 : 0.5;
  ctx.font = `bold ${Math.max(8, tileSize * 0.2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(progress >= 1 ? 'PUSH' : 'HOLD', sx, sy - tileSize * 0.7);

  ctx.restore();
}

export function syncRefs(state: GameState) {
  _playerName = state.playerName;
  _playerOutfit = state.outfit;
  _playerClass = state.playerClass;
}
