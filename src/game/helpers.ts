import { GameState } from './types';

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
