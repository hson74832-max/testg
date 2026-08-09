import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { PROTOCOL_VERSION, CLIENT_MESSAGES } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8787);
const TICK_RATE = 20;
const players = new Map();

const httpServer = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, players: players.size })); return; }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('testg MMO server is running. WebSocket endpoint: /ws\n');
});
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

function send(socket, message) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function broadcast(message, exceptId = null) { for (const player of players.values()) if (player.id !== exceptId) send(player.socket, message); }
function publicPlayer(player) { return { id: player.id, name: player.name, x: player.x, y: player.y }; }
function validStep(value) { return value === -1 || value === 0 || value === 1; }

wss.on('connection', (socket) => {
  const id = randomUUID();
  const player = { id, name: `Adventurer-${id.slice(0, 4)}`, x: 128, y: 128, socket };
  players.set(id, player);

  send(socket, { type: 'welcome', protocolVersion: PROTOCOL_VERSION, player: publicPlayer(player), players: [...players.values()].map(publicPlayer) });
  broadcast({ type: 'player_joined', player: publicPlayer(player) }, player.id);

  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { send(socket, { type: 'error', code: 'INVALID_JSON' }); return; }

    if (message.type === CLIENT_MESSAGES.PING) { send(socket, { type: 'pong', serverTime: Date.now() }); return; }
    if (message.type === CLIENT_MESSAGES.SET_NAME) {
      const name = typeof message.name === 'string' ? message.name.trim().slice(0, 20) : '';
      if (!name) return;
      player.name = name;
      broadcast({ type: 'player_updated', player: publicPlayer(player) });
      return;
    }
    if (message.type === CLIENT_MESSAGES.MOVE) {
      const dx = Number(message.dx); const dy = Number(message.dy);
      if (!validStep(dx) || !validStep(dy) || (dx === 0 && dy === 0)) { send(socket, { type: 'error', code: 'INVALID_MOVE' }); return; }
      player.x += dx;
      player.y += dy;
      return;
    }
    send(socket, { type: 'error', code: 'COMMAND_NOT_IMPLEMENTED', command: message.type });
  });

  socket.on('close', () => { players.delete(id); broadcast({ type: 'player_left', playerId: id }); });
});

setInterval(() => {
  const snapshot = { type: 'world_snapshot', serverTime: Date.now(), players: [...players.values()].map(publicPlayer) };
  for (const player of players.values()) send(player.socket, snapshot);
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => { console.log(`testg MMO server listening on http://localhost:${PORT}`); console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`); console.log(`Health check:       http://localhost:${PORT}/health`); });
