// ═══════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════

export type PlayerClass = 'warrior' | 'archer' | 'mage';

export interface PlayerOutfit { hairColor: string; skinColor: string; armorColor: string; armorHighlight: string; legColor: string; }
export interface Skill { name: string; icon: string; color: string; cooldown: number; lastUsed: number; active: boolean; description: string; }
export interface Monster { id: number; type: string; x: number; y: number; hp: number; maxHp: number; damage: number; defense: number; xp: number; color: string; bodyColor: string; lastMove: number; lastAttack: number; aggroRange: number; moveDelay: number; dead: boolean; deathTime: number; drops: LootDrop[]; attackedByPlayer: boolean; attackingPlayer: boolean; pushable: boolean; pushedUntil: number; }
export interface LootDrop { name: string; color: string; value: number; }
export interface NPC { id: number; x: number; y: number; name: string; type: 'merchant' | 'blacksmith'; color: string; sells: ShopItem[]; buysFor: number; }
export interface ShopItem { name: string; color: string; value: number; desc: string; }
export interface WorldItem { id: number; x: number; y: number; name: string; color: string; value: number; spawnTime: number; }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; }
export interface FloatText { x: number; y: number; text: string; color: string; life: number; maxLife: number; }
export interface LogMessage { text: string; color: string; time: number; }
export interface InventoryItem { name: string; color: string; value: number; count: number; weight?: number; rarity?: 'common' | 'rare' | 'epic' | 'legendary'; }
export interface AutolootFilter { pickGold: boolean; pickCommon: boolean; pickRare: boolean; pickEpic: boolean; pickLegendary: boolean; pickWeapons: boolean; pickArmor: boolean; pickConsumables: boolean; pickJunk: boolean; }
export interface Equipment { helmet: InventoryItem | null; body: InventoryItem | null; legs: InventoryItem | null; boots: InventoryItem | null; ring: InventoryItem | null; amulet: InventoryItem | null; }
export interface Resistances { fire: number; ice: number; energy: number; earth: number; }
export interface ChatMessage { text: string; sender: string; time: number; type: 'global' | 'party' | 'whisper'; }
export interface Friend { id: string; name: string; online: boolean; }
export interface PartyMember { id: string; name: string; hp: number; maxHp: number; x: number; y: number; }

// ═══════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════

export interface GameState {
  terrain: Uint8Array; objects: Uint8Array; explored: Uint8Array;
  px: number; py: number; prevPx: number; prevPy: number; moveProgress: number; facing: number; walkFrame: number; lastMovedSideways: boolean;
  // When enabled, player position is owned by the MMO server and the client only requests movement.
  networkAuthoritativeMovement?: boolean;
  hp: number; maxHp: number; mana: number; maxMana: number; stamina: number; maxStamina: number;
  xp: number; level: number; xpToNext: number; playerDamage: number; playerDefense: number; attackRange: number; gold: number; skullLevel: number;
  lastStep: number; lastAttack: number; lastCombat: number;
