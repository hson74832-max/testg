import { GameState } from './types';

export function renderOptions(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  if (!state.optionsOpen) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h);
  const pw = Math.min(360, w - 40), ph = 240;
  const px = (w - pw) / 2, py = (h - ph) / 2;

  // Square panel
  ctx.fillStyle = '#1a1a18'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a40'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#d4b870';
  ctx.fillText('⚙ GAME OPTIONS', px + pw / 2, py + 14);

  const toggles = [
    { key: 'showFps', label: 'Display FPS Counter' },
    { key: 'screenShakeEnabled', label: 'Screen Shaking on Damage' },
    { key: 'minimapEnabled', label: 'Enable Minimap' }
  ] as const;

  ctx.textAlign = 'left';
  let yOff = py + 48;
  for (const t of toggles) {
    const enabled = state[t.key];
    ctx.fillStyle = enabled ? '#2a3a2a' : '#1a1a18';
    ctx.fillRect(px + 14, yOff, pw - 28, 28);
    ctx.strokeStyle = enabled ? '#5a7a4a' : '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 14, yOff, pw - 28, 28);

    // Checkbox
    ctx.fillStyle = enabled ? '#aadd77' : '#444';
    ctx.fillRect(px + 22, yOff + 8, 12, 12);
    if (enabled) {
      ctx.fillStyle = '#1a1a18';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('✓', px + 28, yOff + 10);
      ctx.textAlign = 'left';
    }

    ctx.font = '11px monospace'; ctx.fillStyle = enabled ? '#ddd' : '#888';
    ctx.fillText(t.label, px + 44, yOff + 10);
    yOff += 34;
  }

  ctx.textAlign = 'center'; ctx.font = '10px monospace'; ctx.fillStyle = '#666';
  ctx.fillText('Click toggle to change  •  Press ESC to close', px + pw / 2, py + ph - 22);
}

export function handleOptionsClick(state: GameState, cx: number, cy: number, w: number, h: number) {
  if (!state.optionsOpen) return;
  const pw = Math.min(360, w - 40), ph = 240;
  const px = (w - pw) / 2, py = (h - ph) / 2;

  if (cx < px || cx > px + pw || cy < py || cy > py + ph) {
    state.optionsOpen = false;
    return;
  }

  const toggles = ['showFps', 'screenShakeEnabled', 'minimapEnabled'] as const;
  let yOff = py + 48;
  for (const key of toggles) {
    if (cx >= px + 14 && cx <= px + pw - 14 && cy >= yOff && cy <= yOff + 28) {
      state[key] = !state[key];
      return;
    }
    yOff += 34;
  }
}
