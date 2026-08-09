export const PROTOCOL_VERSION = 1 as const;

export type PlayerSnapshot = { id: string; name: string; x: number; y: number };

export type ServerMessage =
  | { type: 'welcome'; protocolVersion: number; player: PlayerSnapshot; players: PlayerSnapshot[] }
  | { type: 'player_joined'; player: PlayerSnapshot }
  | { type: 'player_updated'; player: PlayerSnapshot }
  | { type: 'player_left'; playerId: string }
  | { type: 'world_snapshot'; serverTime: number; players: PlayerSnapshot[] }
  | { type: 'pong'; serverTime: number }
  | { type: 'error'; code: string; command?: string };

export type ClientMessage =
  | { type: 'ping' }
  | { type: 'set_name'; name: string }
  | { type: 'move'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };
