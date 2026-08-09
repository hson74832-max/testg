// ═══════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════

export type PlayerClass = 'warrior' | 'archer' | 'mage';

export interface PlayerOutfit {
  hairColor: string;
  skinColor: string;
  armorColor: string;
  armorHighlight: string;
  legColor: string;
}

export interface Skill {
  name: string;
  icon: string;
  color: string;
  cooldown: number;
  lastUsed: number;
  active: boolean;
  description: string;
}

export interface Monster {
  id: number;
  type: string;
  x: number; y: number;
  hp: number; maxHp: number;
  damage: number; defense: number;
  xp: number;
  color: string; bodyColor: string;
  lastMove: number; lastAttack: number;
  aggroRange: number; moveDelay: number;
  dead: boolean; deathTime: number;
  drops: LootDrop[];
  attackedByPlayer: boolean;
  attackingPlayer: boolean;
  pushable: boolean;
  pushedUntil: number;
}

export interface LootDrop {
  name: string;
  color: string;
  value: number;
}

export interface NPC {
  id: number;
  x: number; y: number;
  name: string;
  type: 'merchant' | 'blacksmith';
  color: string;
  sells: ShopItem[];
  buysFor: number;
}

export interface ShopItem {
  name: string;
  color: string;
  value: number;
  desc: string;
}

export interface WorldItem {
  id: number;
  x: number; y: number;
  name: string;
  color: string;
  value: number;
  spawnTime: number;
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

export interface FloatText {
  x: number; y: number;
  text: string; color: string;
  life: number; maxLife: number;
}

export interface LogMessage {
  text: string;
  color: string;
  time: number;
}

export interface InventoryItem {
  name: string;
  color: string;
  value: number;
  count: number;
  weight?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface AutolootFilter {
  pickGold: boolean;
  pickCommon: boolean;
  pickRare: boolean;
  pickEpic: boolean;
  pickLegendary: boolean;
  pickWeapons: boolean;
  pickArmor: boolean;
  pickConsumables: boolean;
  pickJunk: boolean;
}

export interface Equipment {
  helmet: InventoryItem | null;
  body: InventoryItem | null;
  legs: InventoryItem | null;
  boots: InventoryItem | null;
  ring: InventoryItem | null;
  amulet: InventoryItem | null;
}

export interface Resistances {
  fire: number;
  ice: number;
  energy: number;
  earth: number;
}

export interface ChatMessage {
  text: string;
  sender: string;
  time: number;
  type: 'global' | 'party' | 'whisper';
}

export interface Friend {
  id: string;
  name: string;
  online: boolean;
}

export interface PartyMember {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
}

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════

export interface GameState {
  // World
  terrain: Uint8Array;
  objects: Uint8Array;
  explored: Uint8Array;

  // Player
  px: number; py: number;
  prevPx: number; prevPy: number;
  moveProgress: number;
  facing: number;
  walkFrame: number;
  lastMovedSideways: boolean;
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  stamina: number; maxStamina: number;
  xp: number; level: number; xpToNext: number;
  playerDamage: number; playerDefense: number;
  attackRange: number;
  gold: number;
  skullLevel: number;
  lastStep: number;
  lastAttack: number;
  lastCombat: number;
  lastHpRegen: number;
  playerUnderAttack: boolean;
  playerUnderAttackTime: number;
  dead: boolean; deathTime: number;
  respawnX: number; respawnY: number;

  // Class & appearance
  playerClass: PlayerClass;
  playerName: string;
  outfit: PlayerOutfit;

  // Camera
  camX: number; camY: number;

  // Entities
  monsters: Monster[];
  items: WorldItem[];
  npcs: NPC[];

  // Effects
  particles: Particle[];
  floatTexts: FloatText[];
  screenShake: number;

  // Input state
  keysDown: Set<string>;
  moveTarget: { x: number; y: number } | null;
  attackTarget: Monster | null;
  interactTarget: NPC | null;

  // HUD
  hudActivity: number;
  minimapActivity: number;
  log: LogMessage[];

  // Skills
  skills: Skill[];
  activeSkillIdx: number;
  skillPoints: number;
  unlockedSkills: string[];
  skillTreeOpen: boolean;

  // Equipment
  equipment: Equipment;

  // Shop
  shopOpen: boolean;
  shopNpc: NPC | null;

  // Inventory
  inventory: InventoryItem[];
  inventoryOpen: boolean;
  outfitMenuOpen: boolean;

  // Character creation
  charCreationOpen: boolean;
  charCreationClass: PlayerClass;
  charCreationOutfit: number;
  charCreationName: string;

  // Time
  worldTime: number;
  gameStarted: boolean;

  // IDs
  nextId: number;

  // Stats
  monstersKilled: number;
  tilesWalked: number;

  // Resistances
  resistances: Resistances;

  // Chat
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  chatInput: string;
  chatTab: 'global' | 'party';
  chatActivity: number;

  // Friends
  friends: Friend[];
  friendListOpen: boolean;

  // Party
  party: PartyMember[];
  partyOpen: boolean;

  // Push system
  pushHeld: boolean;
  pushStartTime: number;
  pushStartX: number;
  pushStartY: number;
  pushTargetId: number | null;
  pushTargetType: 'monster' | 'item' | null;
  pushOriginX: number;
  pushOriginY: number;
  altKeyDown: boolean;

  // Capacity & autoloot
  maxCapacity: number;
  autolootFilter: AutolootFilter;
  autolootSettingsOpen: boolean;

  // Game Settings (Toggles)
  optionsOpen: boolean;
  showFps: boolean;
  screenShakeEnabled: boolean;
  minimapEnabled: boolean;
}

// ═══════════════════════════════════════════════════════════
// OUTFIT PRESETS
// ═══════════════════════════════════════════════════════════

export const OUTFIT_PRESETS: { name: string; outfit: PlayerOutfit }[] = [
  { name: 'Steel', outfit: { hairColor: '#4a3a2a', skinColor: '#d4a574', armorColor: '#4a5a7a', armorHighlight: '#5a6a8a', legColor: '#5a4a3a' } },
  { name: 'Crimson', outfit: { hairColor: '#2a1a1a', skinColor: '#d4a574', armorColor: '#7a2a2a', armorHighlight: '#8a3a3a', legColor: '#4a3030' } },
  { name: 'Forest', outfit: { hairColor: '#3a4a2a', skinColor: '#c4a070', armorColor: '#3a5a3a', armorHighlight: '#4a6a4a', legColor: '#3a3a2a' } },
  { name: 'Shadow', outfit: { hairColor: '#1a1a2a', skinColor: '#b09a80', armorColor: '#2a2a3a', armorHighlight: '#3a3a4a', legColor: '#2a2a2a' } },
  { name: 'Royal', outfit: { hairColor: '#5a4a30', skinColor: '#d4a574', armorColor: '#4a3a6a', armorHighlight: '#5a4a7a', legColor: '#4a3a4a' } },
  { name: 'Desert', outfit: { hairColor: '#6a5a3a', skinColor: '#c49a60', armorColor: '#8a7a50', armorHighlight: '#9a8a60', legColor: '#6a5a40' } },
];
