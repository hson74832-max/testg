import { GameState, Monster, PlayerClass, PlayerOutfit } from './types';
import { TERRAIN, OBJECT } from './constants';
import { chebDist } from './utils';

// ==================== HELPER ====================
function getTileSize(w: number, h: number): number {
  const tileSize = Math.ceil(Math.max(w, h) / 21);
  return Math.max(18, tileSize);
}

// ==================== TERRAIN & OBJECTS ====================
const TERRAIN_COLORS: Record<number, [string, string, string]> = {
  [TERRAIN.WATER]: ['#2a5070', '#1e4060', '#3a6888'],
  [TERRAIN.SAND]: ['#c4a860', '#b89850', '#d4b870'],
  [TERRAIN.GRASS]: ['#4a7a3a', '#3e6e30', '#56864a'],
  [TERRAIN.DARK_GRASS]: ['#2d5422', '#234418', '#376630'],
  [TERRAIN.DIRT]: ['#7a6244', '#6e563a', '#886e50'],
  [TERRAIN.STONE]: ['#6a6a6a', '#5e5e5e', '#787878'],
  [TERRAIN.SWAMP]: ['#3a5a3a', '#2e4e2e', '#466646'],
  [TERRAIN.STONE_FLOOR]: ['#7a7872', '#706e68', '#848280'],
  [TERRAIN.ROAD]: ['#8a8478', '#7e786e', '#969084'],
};

export function drawObject(ctx: CanvasRenderingContext2D, obj: number, sx: number, sy: number, ts: number, now: number) {
  if (obj === OBJECT.NONE) return;
  const p = ts / 16;
  if (obj === OBJECT.TREE) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx + 6 * p, sy + 9 * p, 4 * p, 7 * p);
    ctx.fillStyle = '#1a3a0a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 6 * p, 5.5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a5a1a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 5 * p, 5 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a6a2a';
    ctx.beginPath(); ctx.arc(sx + 7 * p, sy + 4 * p, 3 * p, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJECT.ROCK) {
    ctx.fillStyle = '#5e5e5e';
    ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 10 * p, 5 * p, 4 * p, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a7a7a';
    ctx.beginPath(); ctx.ellipse(sx + 7.5 * p, sy + 9 * p, 4 * p, 3 * p, -0.2, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJECT.BUSH) {
    ctx.fillStyle = '#3a6a2a';
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 11 * p, 4 * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7a3a';
    ctx.beginPath(); ctx.arc(sx + 7 * p, sy + 10 * p, 3 * p, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJECT.CACTUS) {
    ctx.fillStyle = '#3a7a3a';
    ctx.fillRect(sx + 6.5 * p, sy + 3 * p, 3 * p, 12 * p);
    ctx.fillRect(sx + 3 * p, sy + 5 * p, 3.5 * p, 3 * p);
    ctx.fillRect(sx + 9.5 * p, sy + 7 * p, 3.5 * p, 3 * p);
    ctx.fillRect(sx + 3 * p, sy + 3 * p, 3 * p, 3 * p);
    ctx.fillRect(sx + 9.5 * p, sy + 5 * p, 3 * p, 3 * p);
  } else if (obj === OBJECT.WALL || obj === OBJECT.RUINS) {
    ctx.fillStyle = obj === OBJECT.WALL ? '#6a6862' : '#5a5852';
    ctx.fillRect(sx + 1 * p, sy + 2 * p, 14 * p, 12 * p);
    ctx.fillStyle = obj === OBJECT.WALL ? '#7a7872' : '#6a6862';
    ctx.fillRect(sx + 2 * p, sy + 3 * p, 12 * p, 10 * p);
    ctx.fillStyle = '#4a4842';
    ctx.fillRect(sx + 8 * p, sy + 3 * p, p * 0.5, 10 * p);
    ctx.fillRect(sx + 2 * p, sy + 7 * p, 12 * p, p * 0.5);
    if (obj === OBJECT.RUINS) {
      ctx.fillStyle = '#3a3832';
      ctx.fillRect(sx + 4 * p, sy + 2 * p, 2 * p, 2 * p);
      ctx.fillRect(sx + 11 * p, sy + 9 * p, 3 * p, 5 * p);
    }
  } else if (obj === OBJECT.CAMPFIRE) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx + 4 * p, sy + 11 * p, 8 * p, 2 * p);
    ctx.fillRect(sx + 5 * p, sy + 10 * p, 6 * p, 2 * p);
    const flicker = Math.sin(now * 0.01) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(220,100,20,${0.7 + flicker * 0.3})`;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 8 * p, (2.5 + flicker) * p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,200,50,${0.5 + flicker * 0.3})`;
    ctx.beginPath(); ctx.arc(sx + 8 * p, sy + 7 * p, (1.5 + flicker * 0.5) * p, 0, Math.PI * 2); ctx.fill();
  } else if (obj === OBJECT.CHEST) {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx + 3 * p, sy + 7 * p, 10 * p, 7 * p);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(sx + 4 * p, sy + 8 * p, 8 * p, 5 * p);
    ctx.fillStyle = '#d4a430'; ctx.fillRect(sx + 7 * p, sy + 9 * p, 2 * p, 2 * p);
  }
}

// ==================== MONSTERS ====================
export function drawMonster(ctx: CanvasRenderingContext2D, m: Monster, sx: number, sy: number, ts: number) {
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

// ==================== PLAYER ====================
export function drawPlayer(ctx: CanvasRenderingContext2D, sx: number, sy: number, ts: number, facing: number, frame: number, now: number, outfit: PlayerOutfit, playerClass: PlayerClass, playerName: string) {
  const p = ts / 16;
  const walkBob = Math.sin(now * 0.012) * p * 0.5;
  const legPhase = frame % 2;
  const o = outfit;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(sx + 8 * p, sy + 15 * p, 4 * p, 1.5 * p, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = o.legColor;
  if (legPhase === 0) {
    ctx.fillRect(sx + 5.5 * p, sy + 12 * p + walkBob, 2 * p, 3.5 * p);
    ctx.fillRect(sx + 8.5 * p, sy + 11.5 * p + walkBob, 2 * p, 4 * p);
  } else {
    ctx.fillRect(sx + 5.5 * p, sy + 11.5 * p + walkBob, 2 * p, 4 * p);
    ctx.fillRect(sx + 8.5 * p, sy + 12 * p + walkBob, 2 * p, 3.5 * p);
  }

  ctx.fillStyle = o.armorColor; ctx.fillRect(sx + 4.5 * p, sy + 5.5 * p + walkBob, 7 * p, 7 * p);
  ctx.fillStyle = o.armorHighlight; ctx.fillRect(sx + 5 * p, sy + 6 * p + walkBob, 6 * p, 6 * p);
  ctx.fillStyle = '#6a5030'; ctx.fillRect(sx + 4.5 * p, sy + 11 * p + walkBob, 7 * p, 1.2 * p);
  ctx.fillStyle = '#d4a430'; ctx.fillRect(sx + 7.5 * p, sy + 11 * p + walkBob, 1.5 * p, 1.2 * p);

  ctx.fillStyle = o.armorColor;
  ctx.fillRect(sx + 2.5 * p, sy + 6 * p + walkBob, 2 * p, 5 * p);
  ctx.fillRect(sx + 11.5 * p, sy + 6 * p + walkBob, 2 * p, 5 * p);
  ctx.fillStyle = o.skinColor;
  ctx.fillRect(sx + 2.5 * p, sy + 10.5 * p + walkBob, 2 * p, 1.5 * p);
  ctx.fillRect(sx + 11.5 * p, sy + 10.5 * p + walkBob, 2 * p, 1.5 * p);

  if (playerClass === 'warrior') {
    ctx.fillStyle = '#aab4c4'; ctx.fillRect(sx + 12.5 * p, sy + 3 * p + walkBob, 1 * p, 8 * p);
    ctx.fillStyle = '#6a5030'; ctx.fillRect(sx + 11.5 * p, sy + 10 * p + walkBob, 3 * p, 1.2 * p);
  } else if (playerClass === 'archer') {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx + 13 * p, sy + 3 * p + walkBob, 0.8 * p, 9 * p);
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = p * 0.4;
    ctx.beginPath(); ctx.moveTo(sx + 13.4 * p, sy + 3.5 * p + walkBob);
    ctx.quadraticCurveTo(sx + 15 * p, sy + 7.5 * p + walkBob, sx + 13.4 * p, sy + 11.5 * p + walkBob); ctx.stroke();
  } else {
    ctx.fillStyle = '#6a4a3a'; ctx.fillRect(sx + 12.5 * p, sy + 2 * p + walkBob, 0.8 * p, 9 * p);
    ctx.fillStyle = '#aa66ff'; ctx.beginPath(); ctx.arc(sx + 12.9 * p, sy + 1.5 * p + walkBob, 1.5 * p, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = o.skinColor; ctx.fillRect(sx + 5.5 * p, sy + 1 * p + walkBob, 5 * p, 5 * p);
  ctx.fillStyle = o.hairColor; ctx.fillRect(sx + 5 * p, sy + 0.5 * p + walkBob, 6 * p, 2.5 * p);

  if (facing === 2) {
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + 6.5 * p, sy + 3 * p + walkBob, p * 0.8, p * 0.8);
    ctx.fillRect(sx + 9 * p,   sy + 3 * p + walkBob, p * 0.8, p * 0.8);
  } else if (facing !== 0) {
    const ex = facing === 1 ? 9 : 6;
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + ex * p, sy + 3 * p + walkBob, p * 0.8, p * 0.8);
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.font = `bold ${Math.max(9, ts * 0.22)}px monospace`;
  ctx.fillStyle = '#000'; ctx.fillText(playerName, sx + 8 * p + 1, sy - p + 1);
  ctx.fillStyle = '#e0d8c0'; ctx.fillText(playerName, sx + 8 * p, sy - p);
}

// ==================== RENDER ENTRY ====================
export function render(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  if (!state.gameStarted) {
    // Title screen logic moved to engine.ts for simplicity in this split
    return;
  }

  const tileSize = getTileSize(w, h);
  const halfX = Math.ceil(w / tileSize / 2) + 1;
  const halfY = Math.ceil(h / tileSize / 2) + 1;

  const camOffX = state.camX - Math.floor(state.camX);
  const camOffY = state.camY - Math.floor(state.camY);
  const camTileX = Math.floor(state.camX);
  const camTileY = Math.floor(state.camY);
  const baseX = w / 2 - camOffX * tileSize;
  const baseY = h / 2 - camOffY * tileSize;

  const now = performance.now();

  // Terrain
  for (let vy = -halfY; vy <= halfY; vy++) {
    for (let vx = -halfX; vx <= halfX; vx++) {
      const wx = camTileX + vx, wy = camTileY + vy;
      if (wx < 0 || wx >= 256 || wy < 0 || wy >= 256) continue;
      const sx = baseX + vx * tileSize, sy = baseY + vy * tileSize;
      if (sx + tileSize < 0 || sx > w || sy + tileSize < 0 || sy > h) continue;

      const idx = wy * 256 + wx;
      const ter = state.terrain[idx];
      const obj = state.objects[idx];
      const colors = TERRAIN_COLORS[ter] || TERRAIN_COLORS[TERRAIN.GRASS];

      ctx.fillStyle = colors[0];
      ctx.fillRect(sx, sy, tileSize, tileSize);

      // Simplified detail
      if (ter === TERRAIN.GRASS || ter === TERRAIN.DARK_GRASS) {
        ctx.fillStyle = colors[2];
        ctx.fillRect(sx + 4, sy + 4, 2, 4);
      }
      drawObject(ctx, obj, sx, sy, tileSize, now);
    }
  }

  // Items
  for (const item of state.items) {
    const sx = baseX + (item.x - camTileX) * tileSize;
    const sy = baseY + (item.y - camTileY) * tileSize;
    if (sx + tileSize < 0 || sx > w || sy + tileSize < 0 || sy > h) continue;
    ctx.fillStyle = item.color;
    ctx.fillRect(sx + tileSize * 0.35, sy + tileSize * 0.35, tileSize * 0.3, tileSize * 0.3);
  }

  // Monsters
  for (const m of state.monsters) {
    if (m.dead) continue;
    const sx = baseX + (m.x - camTileX) * tileSize;
    const sy = baseY + (m.y - camTileY) * tileSize;
    if (sx + tileSize < -tileSize || sx > w + tileSize || sy + tileSize < -tileSize || sy > h + tileSize) continue;

    const distToPlayer = chebDist(state.px, state.py, m.x, m.y);
    const isTarget = state.attackTarget?.id === m.id;
    if (isTarget) {
      // Simplified target ring
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx + tileSize / 2, sy + tileSize / 2, tileSize * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawMonster(ctx, m, sx, sy, tileSize);

    if (distToPlayer <= 3 && m.hp < m.maxHp) {
      const bw = tileSize * 0.85, bh = 4;
      const barX = sx + (tileSize - bw) / 2;
      const barY = sy - 8;
      ctx.fillStyle = '#111';
      ctx.fillRect(barX - 1, barY - 1, bw + 2, bh + 2);
      const pct = Math.max(0, m.hp / m.maxHp);
      const barColor = pct > 0.6 ? '#44cc44' : pct > 0.3 ? '#cccc44' : '#cc4444';
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, bw * pct, bh);
    }
  }

  // Player
  const playerSx = baseX + (state.px - camTileX) * tileSize;
  const playerSy = baseY + (state.py - camTileY) * tileSize;
  if (!state.dead) {
    drawPlayer(ctx, playerSx, playerSy, tileSize, state.facing, state.walkFrame, now, state.outfit, state.playerClass, state.playerName);
  }
}
