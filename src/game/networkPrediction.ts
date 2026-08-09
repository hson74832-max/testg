import type { NetworkStatus, NetworkPlayer } from './network';

export type PendingMove = { seq: number; dx: number; dy: number };
export type PredictionState = { status: NetworkStatus; playerId: string | null; players: Map<string, NetworkPlayer>; lastServerTime: number | null; pendingMoves: PendingMove[]; lastMoveAckSeq: number; lastMoveAccepted: boolean | null; lastMoveRejectReason: string | null };

type ServerMessage =
  | { type: 'welcome'; protocolVersion: number; player: NetworkPlayer; players: NetworkPlayer[] }
  | { type: 'player_joined'; player: NetworkPlayer }
  | { type: 'player_updated'; player: NetworkPlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'world_snapshot'; serverTime: number; players: NetworkPlayer[] }
  | { type: 'move_ack'; seq: number; accepted: boolean; reason: string | null; player: NetworkPlayer; serverTime: number }
  | { type: 'pong'; serverTime: number }
  | { type: 'error'; code: string; command?: string };

type Listener = (state: PredictionState) => void;
const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:8787/ws';

export class PredictedGameNetwork {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private nextMoveSeq = 1;
  private state: PredictionState = { status: 'disconnected', playerId: null, players: new Map(), lastServerTime: null, pendingMoves: [], lastMoveAckSeq: 0, lastMoveAccepted: null, lastMoveRejectReason: null };
  connect() { if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return; this.clearReconnectTimer(); this.update({ status: 'connecting' }); const socket = new WebSocket(SERVER_URL); this.socket = socket; socket.addEventListener('open', () => { this.reconnectAttempt = 0; this.update({ status: 'connected', pendingMoves: [] }); }); socket.addEventListener('message', (event) => { try { this.handleMessage(JSON.parse(event.data) as ServerMessage); } catch { this.update({ status: 'error' }); } }); socket.addEventListener('error', () => this.update({ status: 'error' })); socket.addEventListener('close', () => { this.socket = null; this.update({ status: 'disconnected' }); this.scheduleReconnect(); }); }
  disconnect() { this.clearReconnectTimer(); this.socket?.close(); this.socket = null; this.update({ status: 'disconnected', playerId: null, players: new Map(), lastServerTime: null, pendingMoves: [] }); }
  sendMove(dx: number, dy: number) { const seq = this.nextMoveSeq++; const move = { seq, dx, dy }; this.update({ pendingMoves: [...this.state.pendingMoves, move] }); this.send({ type: 'move', ...move }); return seq; }
  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.snapshot()); return () => this.listeners.delete(listener); }
  private send(message: { type: string; [key: string]: unknown }) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  private handleMessage(message: ServerMessage) { if (message.type === 'welcome') { this.update({ status: 'connected', playerId: message.player.id, players: new Map(message.players.map((p) => [p.id, p])), pendingMoves: [] }); return; } if (message.type === 'world_snapshot') { this.update({ lastServerTime: message.serverTime, players: new Map(message.players.map((p) => [p.id, p])) }); return; } if (message.type === 'move_ack') { const pendingMoves = this.state.pendingMoves.filter((move) => move.seq > message.seq); const players = new Map(this.state.players); players.set(message.player.id, message.player); this.update({ players, pendingMoves, lastMoveAckSeq: message.seq, lastMoveAccepted: message.accepted, lastMoveRejectReason: message.reason }); return; } if (message.type === 'player_joined' || message.type === 'player_updated') { const players = new Map(this.state.players); players.set(message.player.id, message.player); this.update({ players }); return; } if (message.type === 'player_left') { const players = new Map(this.state.players); players.delete(message.playerId); this.update({ players }); } }
  private scheduleReconnect() { if (this.reconnectTimer !== null) return; const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 5000); this.reconnectAttempt += 1; this.reconnectTimer = window.setTimeout(() => { this.reconnectTimer = null; this.connect(); }, delay); }
  private clearReconnectTimer() { if (this.reconnectTimer !== null) { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = null; } }
  private update(patch: Partial<PredictionState>) { this.state = { ...this.state, ...patch }; const snapshot = this.snapshot(); for (const listener of this.listeners) listener(snapshot); }
  private snapshot(): PredictionState { return { ...this.state, players: new Map(this.state.players), pendingMoves: [...this.state.pendingMoves] }; }
}
