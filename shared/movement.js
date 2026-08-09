export const MOVE_REJECT_REASON = Object.freeze({
  RATE_LIMITED: 'MOVE_RATE_LIMITED',
  INVALID: 'INVALID_MOVE',
  BLOCKED: 'MOVE_BLOCKED',
});

export function isValidStep(dx, dy) {
  return Number.isInteger(dx) && Number.isInteger(dy)
    && dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1
    && (dx !== 0 || dy !== 0);
}

export function applyStep(x, y, dx, dy) {
  return { x: x + dx, y: y + dy };
}
