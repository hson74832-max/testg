# testg MMO server

Phase 1 provides a minimal authoritative server foundation without changing the existing game client.

## Local development

From the repository root:

```bash
cd server
npm install
npm run dev
```

The server exposes:

- HTTP health check: `http://localhost:8787/health`
- WebSocket endpoint: `ws://localhost:8787/ws`

Phase 1 supports connecting multiple clients, assigning each connection a server-side player ID, broadcasting joins/leaves, renaming players, and sending authoritative world snapshots.

The existing browser game remains unchanged. The next phase will connect the client to this server and synchronize player movement.
