export type NetworkStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type NetworkPlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type WelcomeMessage = {
  type: 'welcome';
  protocolVersion: number;
  player: NetworkPlayer;
  players: NetworkPlayer[];
};

type WorldSnapshotMessage = {
  type: 'world_snapshot';
  serverTime: number;
  players: NetworkPlayer[];
};

type PlayerEventMessage =
  | { type: 'player_joined'; player: NetworkPlayer }
  | { type: 'player_updated'; player: NetworkPlayer }
  | { type: 'player_left'; playerId: string };

type ServerMessage = WelcomeMessage | WorldSnapshotMessage | PlayerEventMessage | { type: string; [key: string]: unknown };

export type NetworkState = {
  status: NetworkStatus;
  playerId: string | null;
  players: Map<string, NetworkPlayer>;
  lastServerTime: number | null;
};

type Listener = (state: NetworkState) => void;

const SERVER_URL = import.meta.env.VITE_GAME_SERVER_URL ?? 'ws://localhost:8787/ws';

export class GameNetwork {
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private state: NetworkState = {
    status: 'disconnected',
    playerId: null,
    players: new Map(),
    lastServerTime: null,
  };

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;

    this.clearReconnectTimer();
    this.update({ status: 'connecting' });

    const socket = new WebSocket(SERVER_URL);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.update({ status: 'connected' });
    });

    socket.addEventListener('message', (event) => {
      try {
        this.handleMessage(JSON.parse(event.data) as ServerMessage);
      } catch {
        this.update({ status: 'error' });
      }
    });

    socket.addEventListener('error', () => {
      this.update({ status: 'error' });
    });

    socket.addEventListener('close', () => {
      this.socket = null;
      this.update({ status: 'disconnected' });
      this.scheduleReconnect();
    });
  }

  disconnect() {
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
    this.update({ status: 'disconnected', playerId: null, players: new Map(), lastServerTime: null });
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private handleMessage(message: ServerMessage) {
    if (message.type === 'welcome') {
      this.update({
        status: 'connected',
        playerId: message.player.id,
        players: new Map(message.players.map((player) => [player.id, player])),
      });
      return;
    }

    if (message.type === 'world_snapshot') {
      this.update({
        status: 'connected',
        lastServerTime: message.serverTime,
        players: new Map(message.players.map((player) => [player.id, player])),
      });
      return;
    }

    if (message.type === 'player_joined' || message.type === 'player_updated') {
      const players = new Map(this.state.players);
      players.set(message.player.id, message.player);
      this.update({ players });
      return;
    }

    if (message.type === 'player_left') {
      const players = new Map(this.state.players);
      players.delete(message.playerId);
      this.update({ players });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 5000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private update(patch: Partial<NetworkState>) {
    this.state = { ...this.state, ...patch };
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private snapshot(): NetworkState {
    return {
      ...this.state,
      players: new Map(this.state.players),
    };
  }
}
