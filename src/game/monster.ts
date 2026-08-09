import { GameState, Monster } from './types';
import { chebDist, isMonsterWalkable } from './utils';
import { monsterAttackPlayer } from './combat';

const CARDINAL_COST = 1;
const DIAGONAL_COST = 1.45;
const SEARCH_PADDING = 6;

const DIRECTIONS = [
  { dx: 1, dy: 0, cost: CARDINAL_COST },
  { dx: -1, dy: 0, cost: CARDINAL_COST },
  { dx: 0, dy: 1, cost: CARDINAL_COST },
  { dx: 0, dy: -1, cost: CARDINAL_COST },
  { dx: 1, dy: 1, cost: DIAGONAL_COST },
  { dx: 1, dy: -1, cost: DIAGONAL_COST },
  { dx: -1, dy: 1, cost: DIAGONAL_COST },
  { dx: -1, dy: -1, cost: DIAGONAL_COST },
] as const;

interface SearchNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: string | null;
}

export function updateMonsters(state: GameState, now: number) {
  for (const m of state.monsters) {
    if (m.dead) continue;

    m.attackingPlayer = false;

    // After being pushed, pause briefly before immediately walking back.
    // This makes push create real spacing instead of being instantly negated.
    if (now < m.pushedUntil) continue;

    const d = chebDist(m.x, m.y, state.px, state.py);

    if (d <= 1) {
      monsterAttackPlayer(state, m, now);
      continue;
    }

    if (now - m.lastMove < m.moveDelay) continue;
    m.lastMove = now;

    if (d <= m.aggroRange) {
      chasePlayer(state, m);
    } else {
      wander(state, m);
    }
  }
}

function chasePlayer(state: GameState, m: Monster) {
  const nextStep = findBestPathStep(state, m);
  if (nextStep) {
    m.x = nextStep.x;
    m.y = nextStep.y;
    return;
  }

  // Fallback: best local move if path search fails
  let bestMove: { x: number; y: number } | null = null;
  let bestScore = Infinity;

  for (const dir of DIRECTIONS) {
    const nx = m.x + dir.dx;
    const ny = m.y + dir.dy;
    if (!isMonsterWalkable(state, nx, ny, m.id)) continue;

    const dist = octileDistance(nx, ny, state.px, state.py);
    const score = dist + dir.cost;
    if (score < bestScore) {
      bestScore = score;
      bestMove = { x: nx, y: ny };
    }
  }

  if (bestMove) {
    m.x = bestMove.x;
    m.y = bestMove.y;
  }
}

function findBestPathStep(state: GameState, m: Monster): { x: number; y: number } | null {
  const minX = Math.min(m.x, state.px) - SEARCH_PADDING;
  const maxX = Math.max(m.x, state.px) + SEARCH_PADDING;
  const minY = Math.min(m.y, state.py) - SEARCH_PADDING;
  const maxY = Math.max(m.y, state.py) + SEARCH_PADDING;

  const boundedMinX = Math.max(0, minX);
  const boundedMaxX = maxX;
  const boundedMinY = Math.max(0, minY);
  const boundedMaxY = maxY;

  const startKey = keyOf(m.x, m.y);
  const nodes = new Map<string, SearchNode>();
  const open = new Set<string>([startKey]);
  const closed = new Set<string>();

  nodes.set(startKey, {
    x: m.x,
    y: m.y,
    g: 0,
    f: heuristicToPlayerAdjacency(m.x, m.y, state.px, state.py),
    parent: null,
  });

  let foundGoalKey: string | null = null;

  while (open.size > 0) {
    const currentKey = getLowestF(open, nodes);
    if (!currentKey) break;
    open.delete(currentKey);
    closed.add(currentKey);

    const current = nodes.get(currentKey);
    if (!current) continue;

    if (chebDist(current.x, current.y, state.px, state.py) <= 1) {
      foundGoalKey = currentKey;
      break;
    }

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (nx < boundedMinX || nx > boundedMaxX || ny < boundedMinY || ny > boundedMaxY) continue;
      if (!isMonsterWalkable(state, nx, ny, m.id)) continue;

      // Prevent tight corner cutting through obstacle corners
      if (dir.dx !== 0 && dir.dy !== 0) {
        const sideAOpen = isMonsterWalkable(state, current.x + dir.dx, current.y, m.id);
        const sideBOpen = isMonsterWalkable(state, current.x, current.y + dir.dy, m.id);
        if (!sideAOpen && !sideBOpen) continue;
      }

      const neighborKey = keyOf(nx, ny);
      if (closed.has(neighborKey)) continue;

      const tentativeG = current.g + dir.cost;
      const existing = nodes.get(neighborKey);

      if (!existing || tentativeG < existing.g) {
        nodes.set(neighborKey, {
          x: nx,
          y: ny,
          g: tentativeG,
          f: tentativeG + heuristicToPlayerAdjacency(nx, ny, state.px, state.py),
          parent: currentKey,
        });
        open.add(neighborKey);
      }
    }
  }

  if (!foundGoalKey) return null;

  // Backtrack to first step from start
  let walkKey = foundGoalKey;
  let node = nodes.get(walkKey) ?? null;
  while (node && node.parent && node.parent !== startKey) {
    walkKey = node.parent;
    node = nodes.get(walkKey) ?? null;
  }

  const step = nodes.get(walkKey);
  if (!step || (step.x === m.x && step.y === m.y)) return null;
  return { x: step.x, y: step.y };
}

function heuristicToPlayerAdjacency(x: number, y: number, px: number, py: number): number {
  const dx = Math.abs(px - x);
  const dy = Math.abs(py - y);
  const targetDx = Math.max(0, dx - 1);
  const targetDy = Math.max(0, dy - 1);
  return octileDistanceRaw(targetDx, targetDy);
}

function octileDistance(x1: number, y1: number, x2: number, y2: number): number {
  return octileDistanceRaw(Math.abs(x2 - x1), Math.abs(y2 - y1));
}

function octileDistanceRaw(dx: number, dy: number): number {
  const min = Math.min(dx, dy);
  const max = Math.max(dx, dy);
  return min * DIAGONAL_COST + (max - min) * CARDINAL_COST;
}

function getLowestF(open: Set<string>, nodes: Map<string, SearchNode>): string | null {
  let bestKey: string | null = null;
  let bestF = Infinity;
  let bestG = Infinity;

  for (const key of open) {
    const node = nodes.get(key);
    if (!node) continue;
    if (node.f < bestF || (node.f === bestF && node.g < bestG)) {
      bestF = node.f;
      bestG = node.g;
      bestKey = key;
    }
  }

  return bestKey;
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function wander(state: GameState, m: Monster) {
  if (Math.random() < 0.3) {
    const cardinalFirst = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ].sort(() => Math.random() - 0.5);

    for (const move of cardinalFirst) {
      if (isMonsterWalkable(state, m.x + move.dx, m.y + move.dy, m.id)) {
        m.x += move.dx;
        m.y += move.dy;
        return;
      }
    }
  }
}


