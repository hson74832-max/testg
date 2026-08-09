import { useRef, useEffect, useCallback } from 'react';
import { createGameState, update, render, handleKeyDown, handleKeyUp, handleClick, handlePointerDown, handlePointerUp, syncRefs, GameState, renderOptions } from '../game/engine';
import { renderInventory, renderOutfitMenu, renderShop, renderEquipment, renderSkillTree, renderStatsPanel, renderSocial, renderAutolootSettings, renderPushIndicator, renderFPS } from '../game/ui';

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<GameState>(createGameState());
  const rafRef    = useRef<number>(0);

  // Handle HiDPI
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  // Game loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const state = stateRef.current;
      const now   = performance.now();

      syncRefs(state);
      update(state, now);

      ctx.save();
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = window.innerWidth, h = window.innerHeight;
      render(ctx, state, w, h);
      renderInventory(ctx, state, w, h);
      renderOutfitMenu(ctx, state, w, h);
      renderShop(ctx, state, w, h);
      renderEquipment(ctx, state, w, h);
      renderSkillTree(ctx, state, w, h);
      renderStatsPanel(ctx, state, w, h, now);
      renderSocial(ctx, state, w, h);
      renderAutolootSettings(ctx, state, w, h);
      renderOptions(ctx, state, w, h);
      renderPushIndicator(ctx, state, w, h, now);
      renderFPS(ctx, now, state);
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent default for arrow keys / space to avoid page scroll
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      handleKeyDown(stateRef.current, e.key, performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      handleKeyUp(stateRef.current, e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  // Mouse / Touch
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    handlePointerDown(stateRef.current, x, y, rect.width, rect.height, now);

    // Alt+click is reserved exclusively for push mode
    if (!e.altKey) {
      handleClick(stateRef.current, x, y, rect.width, rect.height, now);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    handlePointerUp(stateRef.current, x, y, rect.width, rect.height, performance.now());
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="block touch-none"
      style={{ cursor: 'crosshair' }}
    />
  );
}
