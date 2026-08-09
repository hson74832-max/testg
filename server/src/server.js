import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { createWorld, isWalkableTile } from '../../shared/world.js';
import { PROTOCOL_VERSION, CLIENT_MESSAGES } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8787);
const TICK_RATE = 20;
const MOVE_INTERVAL_MS = 180;
const START_X = 128;
const START_Y = 128;
const players = new Map();
const world = createWorld();

const httpServer = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: players.size })); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('testg MMO server is running. WebSocket endpoint: /ws\n');
});
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
function send(socket, message) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function broadcast(message, exceptId = null) { for (const player of players.values()) if (player.id !== exceptId) send(player.socket, message); }
function publicPlayer(player) { return { id: player.id, name: player.name, x: player.x, y: player.y }; }
function validStep(value) { return value === -1 || value === 0 || value === 1; }
function canMoveTo(player, x, y) {
  if (!isWalkableTile(world.terrain, world.objects, x, y)) return false;
  for (const other of players.values()) {
    if (other.id !== player.id && other.x === x && other.y === y) return false;
  }
  return true;
}

wss.on('connection', (socket) => {
  const id = randomUUID();
  const player = { id, name: `Adventurer-${id.slice(0, 4)}`, x: START_X, y: START_Y, socket, lastMoveAt: 0 };
  players.set(id, player);
  send(socket, { type: 'welcome', protocolVersion: PROTOCOL_VERSION, player: publicPlayer(player), players: [...players.values()].map(publicPlayer) });
  broadcast({ type: 'player_joined', player: publicPlayer(player) }, player.id);

  socket.on('message', (raw) => {
    let message; try { message = JSON.parse(raw.toString()); } catch { send(socket, { type: 'error', code: 'INVALID_JSON' }); return; }
    if (message.type === CLIENT_MESSAGES.PING) { send(socket, { type: 'pong', serverTime: Date.now() }); return; }
    if (message.type === CLIENT_MESSAGES.SET_NAME) { const name = typeof message.name === 'string' ? message.name.trim().slice(0, 20) : ''; if (!name) return; player.name = name; broadcast({ type: 'player_updated', player: publicPlayer(player) }); return; }
    if (message.type === CLIENT_MESSAGES.MOVE) {
      const now = Date.now();
      if (now - player.lastMoveAt < MOVE_INTERVAL_MS) { send(socket, { type: 'error', code: 'MOVE_RATE_LIMITED' }); return; }
      const dx = Number(message.dx), dy = Number(message.dy);
      if (!validStep(dx) || !validStep(dy) || (dx === 0 && dy === 0)) { send(socket, { type: 'error', code: 'INVALID_MOVE' }); return; }
      const nextX = player.x + dx, nextY = player.y + dy;
      if (!canMoveTo(player, nextX, nextY)) { send(socket, { type: 'error', code: 'MOVE_BLOCKED' }); return; }
      player.x = nextX; player.y = nextY; player.lastMoveAt = now; return;
    }
    send(socket, { type: 'error', code: 'COMMAND_NOT_IMPLEMENTED', command: message.type });
  });
  socket.on('close', () => { players.delete(id); broadcast({ type: 'player_left', playerId: id }); });
});

setInterval(() => { const snapshot = { type: 'world_snapshot', serverTime: Date.now(), players: [...players.values()].map(publicPlayer) }; for (const player of players.values()) send(player.socket, snapshot); }, 1000 / TICK_RATE);
httpServer.listen(PORT, () => { console.log(`testg MMO server listening on http://localhost:${PORT}`); console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`); console.log(`Health check:       http://localhost:${PORT}/health`); });
