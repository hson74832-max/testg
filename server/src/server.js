import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { createWorld, isWalkableTile } from '../../shared/world.js';
import { isValidStep, applyStep, MOVE_REJECT_REASON } from '../../shared/movement.js';
import { PROTOCOL_VERSION, CLIENT_MESSAGES, SERVER_MESSAGES } from './protocol.js';

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
function canMoveTo(player, x, y) {
  if (!isWalkableTile(world.terrain, world.objects, x, y)) return false;
  for (const other of players.values()) {
    if (other.id !== player.id && other.x === x && other.y === y) return false;
  }
  return true;
}

wss.on('connection', (socket) => {
  const id = randomUUID();
  const player = { id, name: `Adventurer-${id.slice(0, 4)}`, x: START_X, y: START_Y, socket, lastMoveAt: 0, nextMoveSeq: 1 };
  players.set(id, player);
  send(socket, { type: SERVER_MESSAGES.WELCOME, protocolVersion: PROTOCOL_VERSION, player: publicPlayer(player), players: [...players.values()].map(publicPlayer) });
  broadcast({ type: SERVER_MESSAGES.PLAYER_JOINED, player: publicPlayer(player) }, player.id);

  socket.on('message', (raw) => {
    let message; try { message = JSON.parse(raw.toString()); } catch { send(socket, { type: SERVER_MESSAGES.ERROR, code: 'INVALID_JSON' }); return; }
    if (message.type === CLIENT_MESSAGES.PING) { send(socket, { type: SERVER_MESSAGES.PONG, serverTime: Date.now() }); return; }
    if (message.type === CLIENT_MESSAGES.SET_NAME) { const name = typeof message.name === 'string' ? message.name.trim().slice(0, 20) : ''; if (!name) return; player.name = name; broadcast({ type: SERVER_MESSAGES.PLAYER_UPDATED, player: publicPlayer(player) }); return; }
    if (message.type === CLIENT_MESSAGES.MOVE) {
      const seq = Number(message.seq);
      const dx = Number(message.dx), dy = Number(message.dy);
      const ack = (accepted, reason = null) => send(socket, { type: SERVER_MESSAGES.MOVE_ACK, seq: Number.isSafeInteger(seq) ? seq : 0, accepted, reason, player: publicPlayer(player), serverTime: Date.now() });
      if (!Number.isSafeInteger(seq) || seq <= 0) { ack(false, MOVE_REJECT_REASON.INVALID); return; }
      const now = Date.now();
      if (now - player.lastMoveAt < MOVE_INTERVAL_MS) { ack(false, MOVE_REJECT_REASON.RATE_LIMITED); return; }
      if (!isValidStep(dx, dy)) { ack(false, MOVE_REJECT_REASON.INVALID); return; }
      const next = applyStep(player.x, player.y, dx, dy);
      if (!canMoveTo(player, next.x, next.y)) { ack(false, MOVE_REJECT_REASON.BLOCKED); return; }
      player.x = next.x; player.y = next.y; player.lastMoveAt = now;
      ack(true);
      return;
    }
    send(socket, { type: SERVER_MESSAGES.ERROR, code: 'COMMAND_NOT_IMPLEMENTED', command: message.type });
  });
  socket.on('close', () => { players.delete(id); broadcast({ type: SERVER_MESSAGES.PLAYER_LEFT, playerId: id }); });
});

setInterval(() => { const snapshot = { type: SERVER_MESSAGES.WORLD_SNAPSHOT, serverTime: Date.now(), players: [...players.values()].map(publicPlayer) }; for (const player of players.values()) send(player.socket, snapshot); }, 1000 / TICK_RATE);
httpServer.listen(PORT, () => { console.log(`testg MMO server listening on http://localhost:${PORT}`); console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`); console.log(`Health check:       http://localhost:${PORT}/health`); });
