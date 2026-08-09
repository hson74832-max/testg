import { GameState, OUTFIT_PRESETS } from './types';
import { HUD_FADE_TIME, HUD_FADE_DUR } from './constants';
import { getCurrentWeight } from './items';

function getTileSize(w: number, h: number): number {
  const tileSize = Math.ceil(Math.max(w, h) / 21);
  return Math.max(18, tileSize);
}

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fillStyle: string, strokeStyle?: string, lineWidth: number = 1) {
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, w, h);
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, w, h);
  }
}

// ═══════════════════════════════════════════════════════════
// FPS COUNTER
// ═══════════════════════════════════════════════════════════
let fpsFrames = 0;
let fpsLastTime = 0;
let fpsDisplay = 0;

export function renderFPS(ctx: CanvasRenderingContext2D, now: number, state?: GameState) {
  if (state && !state.showFps) return;
  fpsFrames++;
  if (now - fpsLastTime >= 1000) {
    fpsDisplay = fpsFrames;
    fpsFrames = 0;
    fpsLastTime = now;
  }
  ctx.save();
  ctx.fillStyle = '#44ff44';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`FPS: ${fpsDisplay}`, ctx.canvas.width - 8, 4);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════
export function renderHUD(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, now: number) {
  const sinceActivity = now - state.hudActivity;
  let hudAlpha = 1;
  if (sinceActivity > HUD_FADE_TIME) hudAlpha = Math.max(0, 1 - (sinceActivity - HUD_FADE_TIME) / HUD_FADE_DUR);

  // HP / Mana / XP bars
  if (hudAlpha > 0) {
    ctx.globalAlpha = hudAlpha;
    const barW = Math.min(320, w * 0.5), barH = 14;
    const barX = (w - barW) / 2, barY = 12;

    drawRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, '#0a0a0a');
    drawRect(ctx, barX, barY, barW, barH, '#2a1515');
    ctx.fillStyle = '#c44a4a'; ctx.fillRect(barX, barY, barW * (state.hp / state.maxHp), barH);
    ctx.fillStyle = '#e45555'; ctx.fillRect(barX, barY, barW * (state.hp / state.maxHp), 2);
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText(`HP  ${state.hp} / ${state.maxHp}`, barX + barW / 2, barY + barH / 2);

    const mBarY = barY + barH + 4;
    drawRect(ctx, barX - 2, mBarY - 2, barW + 4, barH + 4, '#0a0a0a');
    drawRect(ctx, barX, mBarY, barW, barH, '#15152a');
    ctx.fillStyle = '#4a6ac4'; ctx.fillRect(barX, mBarY, barW * (state.mana / state.maxMana), barH);
    ctx.fillStyle = '#5a8ae4'; ctx.fillRect(barX, mBarY, barW * (state.mana / state.maxMana), 2);
    ctx.fillStyle = '#fff'; ctx.fillText(`MP  ${state.mana} / ${state.maxMana}`, barX + barW / 2, mBarY + barH / 2);

    const xBarY = mBarY + barH + 3;
    drawRect(ctx, barX - 1, xBarY - 1, barW + 2, 7, '#0a0a0a');
    drawRect(ctx, barX, xBarY, barW, 5, '#1a1a15');
    ctx.fillStyle = '#8a8a2a'; ctx.fillRect(barX, xBarY, barW * (state.xp / state.xpToNext), 5);
    ctx.font = '8px monospace'; ctx.fillStyle = '#aaa'; ctx.fillText(`Lv.${state.level}  XP ${state.xp}/${state.xpToNext}`, barX + barW / 2, xBarY + 3);

    // Skill bar
    const slotSize = Math.min(40, w * 0.062);
    const gap = 4;
    const totalW = state.skills.length * slotSize + (state.skills.length - 1) * gap;
    const slotX = (w - totalW) / 2;
    const slotY = h - slotSize - 14;

    for (let i = 0; i < state.skills.length; i++) {
      const skill = state.skills[i];
      const x = slotX + i * (slotSize + gap);
      const elapsed = now - skill.lastUsed;
      const cdFrac = Math.min(1, elapsed / skill.cooldown);
      const onCD = cdFrac < 1;

      drawRect(ctx, x, slotY, slotSize, slotSize, state.activeSkillIdx === i ? '#2e2e1e' : '#252525', skill.color, 1.5);
      if (onCD) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, slotY, slotSize, slotSize * (1 - cdFrac));
        ctx.font = `bold ${slotSize * 0.3}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText(`${Math.ceil((skill.cooldown - elapsed) / 1000)}s`, x + slotSize / 2, slotY + slotSize / 2);
      }
      ctx.font = `${slotSize * 0.38}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = onCD ? hudAlpha * 0.4 : hudAlpha;
      ctx.fillText(skill.icon, x + slotSize / 2, slotY + slotSize / 2);
      ctx.globalAlpha = hudAlpha;
      ctx.font = '8px monospace';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${i + 1}`, x + slotSize - 3, slotY + slotSize - 2);
    }
    ctx.globalAlpha = 1;
  }

  // Minimap (top-right)
  const sinceMap = now - state.minimapActivity;
  let mmAlpha = 1;
  if (sinceMap > HUD_FADE_TIME) mmAlpha = Math.max(0, 1 - (sinceMap - HUD_FADE_TIME) / HUD_FADE_DUR);
  if (mmAlpha > 0 && state.minimapEnabled) {
    ctx.globalAlpha = mmAlpha;
    const mmSize = Math.min(96, w * 0.18), mmX = w - mmSize - 12, mmY = 12;
    drawRect(ctx, mmX - 2, mmY - 2, mmSize + 4, mmSize + 4, '#0a0a0a', '#3a3a3a', 1);
    const mmScale = mmSize / 80;
    for (let my = -40; my < 40; my++) for (let mx = -40; mx < 40; mx++) {
      const wx = state.px + mx, wy = state.py + my;
      if (wx < 0 || wx >= 256 || wy < 0 || wy >= 256) continue;
      const ei = wy * 256 + wx;
      if (!state.explored[ei]) continue;
      const ter = state.terrain[ei];
      let c = '#2a3a1a';
      if (ter === 0) c = '#1a3050';
      else if (ter === 1) c = '#8a7840';
      else if (ter === 5) c = '#4a4a4a';
      else if (ter === 3) c = '#1a2a10';
      else if (ter === 7 || ter === 8) c = '#5a5a50';
      else if (ter === 6) c = '#2a3a2a';
      else if (ter === 4) c = '#5a4a30';
      ctx.fillStyle = c;
      ctx.fillRect(mmX + (mx + 40) * mmScale, mmY + (my + 40) * mmScale, Math.ceil(mmScale), Math.ceil(mmScale));
    }
    for (const m of state.monsters) {
      if (m.dead) continue;
      const mx2 = m.x - state.px + 40, my2 = m.y - state.py + 40;
      if (mx2 < 0 || mx2 >= 80 || my2 < 0 || my2 >= 80) continue;
      ctx.fillStyle = '#c44'; ctx.fillRect(mmX + mx2 * mmScale, mmY + my2 * mmScale, Math.ceil(mmScale * 1.5), Math.ceil(mmScale * 1.5));
    }
    ctx.fillStyle = '#ffdd44'; ctx.fillRect(mmX + 40 * mmScale - 2, mmY + 40 * mmScale - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  // Combat log
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '10px monospace';
  const recent = state.log.filter(l => now - l.time < 6000).slice(-6);
  for (let i = 0; i < recent.length; i++) {
    const l = recent[i];
    const age = now - l.time;
    const a = age > 4000 ? Math.max(0, 1 - (age - 4000) / 2000) : 1;
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = '#000'; ctx.fillText(l.text, w - 10, h - 170 + i * 14 + 1);
    ctx.fillStyle = l.color; ctx.fillText(l.text, w - 11, h - 170 + i * 14);
  }
  ctx.globalAlpha = 1;

  // Death overlay
  if (state.dead) {
    ctx.fillStyle = 'rgba(80,10,10,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.font = `bold ${Math.min(48, w * 0.08)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff2222'; ctx.fillText('YOU HAVE DIED', w / 2, h / 2 - 20);
    ctx.font = '14px monospace'; ctx.fillStyle = '#cc8888'; ctx.fillText('Respawning at village...', w / 2, h / 2 + 20);
  }
}

// ═══════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════
export function renderInventory(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.inventoryOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const panelW = Math.min(400, w - 40), panelH = Math.min(500, h - 80);
  const px = (w - panelW) / 2, py = (h - panelH) / 2;
  drawRect(ctx, px, py, panelW, panelH, '#1a1a18', '#4a4a40', 2);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#d4b870'; ctx.fillText('INVENTORY', px + panelW / 2, py + 12);

  const weight = getCurrentWeight(state);
  const ratio = weight / state.maxCapacity;
  const wc = ratio < 0.5 ? '#8aaa6a' : ratio < 1.0 ? '#d4a430' : '#c44a4a';
  ctx.font = '11px monospace'; ctx.fillStyle = '#888'; ctx.fillText(`Gold: ${state.gold}`, px + 80, py + 34);
  ctx.fillStyle = wc; ctx.fillText(`Cap: ${weight.toFixed(1)}/${state.maxCapacity}`, px + panelW - 80, py + 34);
  ctx.fillStyle = '#222'; ctx.fillRect(px + 20, py + 48, panelW - 40, 4);
  ctx.fillStyle = wc; ctx.fillRect(px + 20, py + 48, (panelW - 40) * Math.min(1, ratio), 4);

  const btnX = px + panelW - 92, btnY = py + 58, btnW = 80, btnH = 18;
  drawRect(ctx, btnX, btnY, btnW, btnH, '#2a3a2a', '#5a7a4a', 1);
  ctx.font = '9px monospace'; ctx.fillStyle = '#aadd77'; ctx.textAlign = 'center';
  ctx.fillText('🎯 AUTOLOOT', btnX + btnW / 2, btnY + 5);

  ctx.strokeStyle = '#3a3a30'; ctx.beginPath(); ctx.moveTo(px + 20, py + 82); ctx.lineTo(px + panelW - 20, py + 82); ctx.stroke();

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const itemY = py + 92, lineH = 28;
  if (state.inventory.length === 0) {
    ctx.font = '12px monospace'; ctx.fillStyle = '#555'; ctx.fillText('Your backpack is empty.', px + 20, itemY + 10);
  }
  for (let i = 0; i < state.inventory.length; i++) {
    const item = state.inventory[i];
    const iy = itemY + i * lineH;
    if (iy + lineH > py + panelH - 20) break;
    ctx.fillStyle = item.color; ctx.fillRect(px + 20, iy + 4, 16, 16);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(px + 20, iy + 4, 16, 16);
    ctx.font = '12px monospace'; ctx.fillStyle = '#ccc'; ctx.fillText(item.name, px + 44, iy + 6);
    ctx.textAlign = 'right'; ctx.fillStyle = '#888'; ctx.fillText(`×${item.count}`, px + panelW - 60, iy + 6);
    ctx.fillStyle = '#8a7a30'; ctx.fillText(`${item.value}g`, px + panelW - 20, iy + 6);
    ctx.textAlign = 'left';
  }
  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click item to equip  •  Press I or ESC to close', px + panelW / 2, py + panelH - 20);
}

// ═══════════════════════════════════════════════════════════
// OUTFIT MENU
// ═══════════════════════════════════════════════════════════
export function renderOutfitMenu(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.outfitMenuOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(420, w - 30), ph = 200, px = (w - pw) / 2, py = (h - ph) / 2;
  drawRect(ctx, px, py, pw, ph, '#1a1a18', '#4a4a40', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d4b870'; ctx.fillText('CHANGE OUTFIT', px + pw / 2, py + 12);
  const ow = 56, oh = 56;
  const ox0 = px + (pw - (ow * OUTFIT_PRESETS.length + (OUTFIT_PRESETS.length - 1) * 6)) / 2;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) {
    const preset = OUTFIT_PRESETS[i];
    const x = ox0 + i * (ow + 6), y2 = py + 42;
    const selected = state.outfit.armorColor === preset.outfit.armorColor && state.outfit.hairColor === preset.outfit.hairColor;
    drawRect(ctx, x, y2, ow, oh, selected ? '#2a2a20' : '#1a1a18', selected ? '#d4a430' : '#3a3a30', selected ? 2 : 1);
    const pp = ow / 16;
    ctx.fillStyle = preset.outfit.legColor; ctx.fillRect(x+5*pp,y2+11*pp,2*pp,4*pp); ctx.fillRect(x+9*pp,y2+11*pp,2*pp,4*pp);
    ctx.fillStyle = preset.outfit.armorColor; ctx.fillRect(x+4*pp,y2+5*pp,8*pp,7*pp);
    ctx.fillStyle = preset.outfit.armorHighlight; ctx.fillRect(x+5*pp,y2+6*pp,6*pp,5*pp);
    ctx.fillStyle = preset.outfit.skinColor; ctx.fillRect(x+5*pp,y2+1*pp,6*pp,5*pp);
    ctx.fillStyle = preset.outfit.hairColor; ctx.fillRect(x+5*pp,y2+0.5*pp,6*pp,2.5*pp);
    ctx.font = '8px monospace'; ctx.fillStyle = '#888'; ctx.fillText(preset.name, x + ow / 2, y2 + oh + 2);
  }
  ctx.font = '10px monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
  ctx.fillText('Click outfit to apply  •  Press O or ESC to close', px + pw / 2, py + ph - 18);
}

// ═══════════════════════════════════════════════════════════
// SHOP
// ═══════════════════════════════════════════════════════════
export function renderShop(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.shopOpen || !state.shopNpc) return;
  const npc = state.shopNpc;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(440, w - 20), ph = Math.min(420, h - 40);
  const px = (w - pw) / 2, py = (h - ph) / 2;
  drawRect(ctx, px, py, pw, ph, '#1a1a18', '#4a4a40', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#d4a060'; ctx.fillText(npc.name, px + pw / 2, py + 12);
  ctx.font = '10px monospace'; ctx.fillStyle = '#888'; ctx.fillText(npc.type === 'merchant' ? 'General Goods' : 'Weapons & Armor', px + pw / 2, py + 32);
  ctx.fillStyle = '#d4a430'; ctx.fillText(`Your gold: ${state.gold}`, px + pw / 2, py + 46);

  ctx.textAlign = 'left'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#aaa'; ctx.fillText('BUY', px + 16, py + 68);
  const lineH = 30;
  for (let i = 0; i < npc.sells.length; i++) {
    const item = npc.sells[i]; const iy = py + 86 + i * lineH;
    drawRect(ctx, px + 14, iy, pw - 28, lineH - 4, '#222', '#333', 1);
    ctx.fillStyle = item.color; ctx.fillRect(px + 20, iy + 5, 14, 14);
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'left'; ctx.fillText(item.name, px + 40, iy + 8);
    ctx.font = '9px monospace'; ctx.fillStyle = '#777'; ctx.fillText(item.desc, px + 40 + item.name.length * 7 + 8, iy + 9);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = state.gold >= item.value ? '#d4a430' : '#664422';
    ctx.fillText(`${item.value}g`, px + pw - 22, iy + 8);
  }
  const sellY = py + 86 + npc.sells.length * lineH + 14;
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'left'; ctx.fillText(`SELL (${npc.buysFor}% value)`, px + 16, sellY);
  for (let i = 0; i < Math.min(state.inventory.length, 5); i++) {
    const item = state.inventory[i]; const iy = sellY + 18 + i * lineH;
    const sp = Math.max(1, Math.floor(item.value * npc.buysFor / 100));
    drawRect(ctx, px + 14, iy, pw - 28, lineH - 4, '#222', '#333', 1);
    ctx.fillStyle = item.color; ctx.fillRect(px + 20, iy + 5, 14, 14);
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc'; ctx.textAlign = 'left'; ctx.fillText(`${item.name} ×${item.count}`, px + 40, iy + 8);
    ctx.textAlign = 'right'; ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#8a8a2a'; ctx.fillText(`+${sp}g`, px + pw - 22, iy + 8);
  }
  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666'; ctx.fillText('Press ESC to close', px + pw / 2, py + ph - 18);
}

// ═══════════════════════════════════════════════════════════
// EQUIPMENT
// ═══════════════════════════════════════════════════════════
export function renderEquipment(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.inventoryOpen) return;
  const pw = Math.min(420, w - 40); const px = (w - pw) / 2 + pw + 10;
  if (px + 200 > w) return;
  const ph = 280, py = (h - ph) / 2;
  drawRect(ctx, px, py, 200, ph, '#1a1a18', '#4a4a40', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#d4b870'; ctx.fillText('EQUIPMENT', px + 100, py + 10);

  const slots = ['helmet', 'body', 'legs', 'boots', 'ring', 'amulet'];
  ctx.textAlign = 'left';
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]; const iy = py + 38 + i * 38;
    drawRect(ctx, px + 10, iy, 180, 32, '#222', '#333', 1);
    ctx.font = '10px monospace'; ctx.fillStyle = '#888'; ctx.fillText(s.charAt(0).toUpperCase() + s.slice(1), px + 16, iy + 6);
    const item = (state.equipment as any)[s];
    if (item) {
      ctx.fillStyle = item.color || '#aaa'; ctx.fillRect(px + 16, iy + 14, 14, 14);
      ctx.fillStyle = '#ccc'; ctx.font = '9px monospace'; ctx.fillText(item.name, px + 34, iy + 18);
    } else { ctx.fillStyle = '#555'; ctx.font = '9px monospace'; ctx.fillText('— Empty —', px + 34, iy + 18); }
  }
}

// ═══════════════════════════════════════════════════════════
// SKILL TREE
// ═══════════════════════════════════════════════════════════
export function renderSkillTree(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.skillTreeOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(560, w - 40), ph = Math.min(480, h - 60);
  const px = (w - pw) / 2, py = (h - ph) / 2;
  drawRect(ctx, px, py, pw, ph, '#141412', '#4a4a40', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = '#d4b870'; ctx.fillText('SKILL WEB', px + pw / 2, py + 18);
  ctx.font = '12px monospace'; ctx.fillStyle = '#8a8a2a'; ctx.fillText(`Available Points: ${state.skillPoints}`, px + pw / 2, py + 42);

  const nodes = [
    { id: 'core', x: px + pw/2, y: py + 110, label: 'Core', desc: 'Base Stats', cost: 0 },
    { id: 'combat1', x: px + pw/2 - 110, y: py + 180, label: 'Brutal Strike', desc: '+2 Damage', cost: 1 },
    { id: 'combat2', x: px + pw/2 + 110, y: py + 180, label: 'Iron Will', desc: '+3 Defense', cost: 1 },
    { id: 'surv1', x: px + pw/2 - 70, y: py + 260, label: 'Tough Skin', desc: '+15 Max HP', cost: 1 },
    { id: 'surv2', x: px + pw/2 + 70, y: py + 260, label: 'Quick Feet', desc: 'Faster Move', cost: 1 },
    { id: 'magic1', x: px + pw/2, y: py + 340, label: 'Mana Flow', desc: '+10 Max MP', cost: 1 },
    { id: 'mastery', x: px + pw/2, y: py + 420, label: 'Mastery', desc: 'Unlock Tier 2', cost: 3 },
  ];
  const connections = [['core','combat1'],['core','combat2'],['combat1','surv1'],['combat2','surv2'],['surv1','magic1'],['surv2','magic1'],['magic1','mastery']];

  ctx.lineWidth = 2;
  for (const [a, b] of connections) {
    const na = nodes.find(n => n.id === a)!; const nb = nodes.find(n => n.id === b)!;
    ctx.strokeStyle = (state.unlockedSkills.includes(a) || a === 'core') && (state.unlockedSkills.includes(b) || b === 'core') ? '#6a8a4a' : '#3a3a30';
    ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
  }
  for (const node of nodes) {
    const unlocked = state.unlockedSkills.includes(node.id) || node.id === 'core';
    const canBuy = state.skillPoints >= node.cost && !unlocked && node.id !== 'core';
    const size = node.id === 'core' || node.id === 'mastery' ? 18 : 14;
    if (unlocked) { ctx.fillStyle = 'rgba(170,221,119,0.2)'; ctx.beginPath(); ctx.arc(node.x, node.y, size + 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = unlocked ? '#3a5a2a' : canBuy ? '#2a3a1a' : '#1a1a18';
    ctx.strokeStyle = unlocked ? '#aadd77' : canBuy ? '#d4a430' : '#4a4a40';
    ctx.lineWidth = unlocked || canBuy ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(node.x, node.y, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = unlocked ? '#d4ffaa' : '#aaa';
    ctx.font = 'bold 10px monospace'; ctx.fillText(node.label, node.x, node.y + size + 16);
    ctx.font = '8px monospace'; ctx.fillStyle = '#777'; ctx.fillText(node.desc, node.x, node.y + size + 28);
    if (!unlocked && node.cost > 0) { ctx.fillStyle = canBuy ? '#d4a430' : '#666'; ctx.fillText(`${node.cost} SP`, node.x, node.y - size - 8); }
  }
  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666'; ctx.fillText('Click node to unlock  •  Press T or ESC to close', px + pw / 2, py + ph - 22);
}

// ═══════════════════════════════════════════════════════════
// AUTOLOOT SETTINGS
// ═══════════════════════════════════════════════════════════
export function renderAutolootSettings(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.autolootSettingsOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(360, w - 40), ph = Math.min(440, h - 60), px = (w - pw) / 2, py = (h - ph) / 2;
  drawRect(ctx, px, py, pw, ph, '#1a1a18', '#5a7a4a', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#aadd77'; ctx.fillText('🎯 AUTOLOOT FILTER', px + pw / 2, py + 14);
  ctx.font = '10px monospace'; ctx.fillStyle = '#888'; ctx.fillText('Toggle which items are auto-collected', px + pw / 2, py + 36);

  const filters: { key: keyof typeof state.autolootFilter; label: string; group: string }[] = [
    { key: 'pickGold', label: '💰 Gold', group: 'Currency' },
    { key: 'pickCommon', label: '⚪ Common items', group: 'Rarity' },
    { key: 'pickRare', label: '🔵 Rare items', group: 'Rarity' },
    { key: 'pickEpic', label: '🟣 Epic items', group: 'Rarity' },
    { key: 'pickLegendary', label: '🟡 Legendary items', group: 'Rarity' },
    { key: 'pickWeapons', label: '⚔ Weapons', group: 'Type' },
    { key: 'pickArmor', label: '🛡 Armor', group: 'Type' },
    { key: 'pickConsumables', label: '🧪 Consumables', group: 'Type' },
    { key: 'pickJunk', label: '🦴 Junk', group: 'Type' },
  ];
  ctx.textAlign = 'left'; let yOff = py + 56; let lastGroup = '';
  for (const f of filters) {
    if (f.group !== lastGroup) { ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#888'; ctx.fillText(f.group.toUpperCase(), px + 16, yOff); yOff += 16; lastGroup = f.group; }
    const enabled = state.autolootFilter[f.key];
    drawRect(ctx, px + 14, yOff, pw - 28, 22, enabled ? '#2a3a2a' : '#1a1a18', enabled ? '#5a7a4a' : '#333', 1);
    ctx.fillStyle = enabled ? '#aadd77' : '#444'; ctx.fillRect(px + 20, yOff + 6, 10, 10);
    if (enabled) { ctx.fillStyle = '#1a1a18'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('✓', px + 25, yOff + 7); ctx.textAlign = 'left'; }
    ctx.font = '11px monospace'; ctx.fillStyle = enabled ? '#ddd' : '#888'; ctx.fillText(f.label, px + 36, yOff + 7);
    yOff += 26;
  }
  ctx.textAlign = 'center'; ctx.font = '9px monospace'; ctx.fillStyle = '#666'; ctx.fillText('Click row to toggle  •  ESC to close', px + pw / 2, py + ph - 18);
}

// ═══════════════════════════════════════════════════════════
// PUSH INDICATOR
// ═══════════════════════════════════════════════════════════
export function renderPushIndicator(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, now: number) {
  if (!state.pushHeld || !state.pushTargetId || !state.pushTargetType) return;
  const target = state.pushTargetType === 'monster'
    ? state.monsters.find(m => m.id === state.pushTargetId && !m.dead)
    : state.items.find(it => it.id === state.pushTargetId);
  if (!target) return;
  const tileSize = getTileSize(w, h);
  const camOffX = state.camX - Math.floor(state.camX), camOffY = state.camY - Math.floor(state.camY);
  const baseX = w / 2 - camOffX * tileSize, baseY = h / 2 - camOffY * tileSize;
  const camTileX = Math.floor(state.camX), camTileY = Math.floor(state.camY);
  const sx = baseX + (target.x - camTileX) * tileSize + tileSize / 2;
  const sy = baseY + (target.y - camTileY) * tileSize + tileSize / 2;
  const progress = Math.min(1, (now - state.pushStartTime) / 300);

  ctx.save();
  ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 3;
  ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(sx, sy, tileSize * 0.65, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(sx, sy, tileSize * 0.65, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#4488ff'; ctx.globalAlpha = progress >= 1 ? 0.9 : 0.5;
  ctx.font = `bold ${Math.max(8, tileSize * 0.2)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(progress >= 1 ? 'PUSH' : 'HOLD', sx, sy - tileSize * 0.7);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════
// STATS PANEL
// ═══════════════════════════════════════════════════════════
export function renderStatsPanel(ctx: CanvasRenderingContext2D, state: GameState, _w: number, _h: number, now: number) {
  const sinceActivity = now - state.hudActivity;
  let alpha = 1;
  if (sinceActivity > 10000) alpha = Math.max(0, 1 - (sinceActivity - 10000) / 2000);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  const px = 12, py = 68, pw = 148;
  drawRect(ctx, px - 2, py - 2, pw + 4, 78, '#0f0f0e', '#3a3a35', 1);
  ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#aaa';
  ctx.fillText(`⚔ ATK: ${state.playerDamage}`, px + 6, py + 4);
  ctx.fillText(`🛡 DEF: ${state.playerDefense}`, px + 6, py + 16);
  const r = state.resistances;
  ctx.fillText(`🔥 ${r.fire}%  ❄ ${r.ice}%  ⚡ ${r.energy}%  🪨 ${r.earth}%`, px + 6, py + 30);
  ctx.fillStyle = '#888'; ctx.fillText(`Skull: ${state.skullLevel > 0 ? '⚠' : '✓'}`, px + 6, py + 44);
  ctx.fillText(`Kills: ${state.monstersKilled}`, px + 6, py + 56);
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════
// SOCIAL (Friends & Party)
// ═══════════════════════════════════════════════════════════
export function renderSocial(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.friendListOpen && !state.partyOpen) return;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(300, w * 0.35), ph = Math.min(300, h * 0.4), px = (w - pw) / 2, py = (h - ph) / 2;
  drawRect(ctx, px, py, pw, ph, '#1a1a18', '#4a4a40', 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#d4b870'; ctx.fillText('SOCIAL', px + pw / 2, py + 12);
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'left'; ctx.fillText('FRIENDS', px + 14, py + 36);
  for (let i = 0; i < state.friends.length; i++) {
    const f = state.friends[i]; const iy = py + 54 + i * 22;
    ctx.fillStyle = f.online ? '#4c4' : '#444'; ctx.beginPath(); ctx.arc(px + 20, iy + 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px monospace'; ctx.fillStyle = '#ccc'; ctx.fillText(f.name, px + 32, iy);
    ctx.font = '9px monospace'; ctx.fillStyle = f.online ? '#4a4' : '#666'; ctx.fillText(f.online ? 'Online' : 'Offline', px + 120, iy + 1);
  }
  const partyY = py + 54 + state.friends.length * 22 + 10;
  ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#888'; ctx.fillText('PARTY', px + 14, partyY);
  if (state.party.length === 0) { ctx.font = '10px monospace'; ctx.fillStyle = '#555'; ctx.fillText('No party members.', px + 16, partyY + 18); }
  for (let i = 0; i < state.party.length; i++) {
    const pm = state.party[i]; const iy = partyY + 18 + i * 22;
    const pct = pm.hp / pm.maxHp;
    ctx.fillStyle = '#000'; ctx.fillRect(px + 16, iy + 4, pw - 32, 18);
    ctx.fillStyle = pct > 0.5 ? '#4a4a4a' : '#4a2a2a'; ctx.fillRect(px + 16, iy + 4, (pw - 32) * pct, 18);
    ctx.font = '10px monospace'; ctx.fillStyle = '#ccc'; ctx.fillText(`${pm.name} (${pm.hp}/${pm.maxHp})`, px + 20, iy + 6);
  }
  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666'; ctx.fillText('Press F for friends  •  P for party  •  ESC to close', px + pw / 2, py + ph - 18);
}
