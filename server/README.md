# testg MMO server

## Phase 2 — authoritative movement

The server owns each connected player's position. Clients send movement requests; the server validates the step, applies it, and publishes the resulting world snapshot at 20 Hz.

Movement is currently validated for:

- one-tile cardinal or diagonal steps
- world bounds (`256 × 256`)
- a server-side movement rate limit

Collision with the generated terrain will be moved to the server in a later world-authority phase, once the map data is shared between client and server.

## Local development

From the repository root:

```bash
npm install
cd server
npm install
cd ..
npm run dev
```

Open `http://localhost:5173` in two browser windows.

### Phase 2 test

1. Both windows should show `SERVER CONNECTED`.
2. Both should show `Players online: 2`.
3. Use WASD or the arrow keys in window A.
4. The blue player marker in window B should move to the same server-authoritative coordinates.
5. Move window B and verify window A sees it move.
6. Try walking beyond the 0–255 world boundary; the server should reject the step.
7. Close one window; the other should return to `Players online: 1`.

The existing `GameCanvas` remains available as the offline/local prototype. `App.tsx` now uses `NetworkGameCanvas` for the MMO development path.

## Endpoints

- HTTP health check: `http://localhost:8787/health`
- WebSocket endpoint: `ws://localhost:8787/ws`
