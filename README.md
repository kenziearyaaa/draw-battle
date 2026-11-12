# DRAW BATTLE

Real-time 1 vs 1 drawing competition. The host controls the match from a laptop; two players join from their phones. Drawing strokes are relayed live through Socket.IO. Match results and leaderboard statistics are stored in PostgreSQL.

## Requirements

- Node.js 20+
- PostgreSQL 14+ (or a managed PostgreSQL service)
- A modern browser. For phone-to-host use over the public internet, deploy behind HTTPS.

## Run locally

```bash
cp .env.example .env
npm install
```

Create a database, then apply the schema:

```bash
createdb draw_battle
psql "$DATABASE_URL" -f db/schema.sql
```

Set `DATABASE_URL` in `.env` to your database connection string. Then:

```bash
npm start
```

Open http://localhost:3000. Host opens `/host.html`; each phone opens `/join.html` and enters the six-character room code. On one computer, you can test multiple browser windows, but phones on the same Wi-Fi are not a substitute for a public deployment test.

## Environment

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 3000) |
| `PUBLIC_URL` | Public base URL used to create the QR join URL. Set this to your HTTPS deployment URL. |
| `DATABASE_URL` | PostgreSQL connection string |
| `PG_SSL` | Set `true` if your managed PostgreSQL requires TLS |

The app still starts without PostgreSQL so room/drawing flow can be tested, but match persistence and leaderboard are unavailable. `/api/leaderboard` returns HTTP 503 until the database is configured. Run `db/schema.sql` once before using a database.

## Deploy

Deploy as a persistent Node.js web service (not static hosting) with WebSocket support. Set the start command to `npm start`, configure the environment variables above, and attach a PostgreSQL database. Set `PUBLIC_URL=https://your-domain.example`. Ensure the reverse proxy forwards WebSocket upgrade requests to the Node service and terminates TLS. The browser then uses HTTPS and Socket.IO uses the secure WebSocket transport automatically.

Do not run multiple app instances without adding shared room state (for example Redis adapter + shared room storage). The included room state is in-memory and is intentionally designed for a single Node process. A restart clears active rooms; saved match history remains in PostgreSQL.

## Routes

- `/` — landing page
- `/host.html` — host dashboard
- `/join.html?room=ABC123` — player join page
- `/leaderboard.html` — persistent leaderboard
- `/api/health` — service health check
- `/api/qr/:code` — QR image data URL
- `/api/leaderboard` — leaderboard JSON

## Security and operational notes

- Host control is bound to the creating socket and a 256-bit resume token kept in the host browser's local storage. Do not share the host browser profile or its token.
- Players are assigned one of two slots by the server. Room codes, phase, player identity, drawing payload shape, stroke count, stroke size, point ranges, and image size are validated server-side.
- Drawing payloads are stroke deltas rather than canvas snapshots. Each point is normalized to a 0–1 coordinate pair. The host receives those deltas and redraws them locally.
- The server rejects strokes outside the active match window. Timer end is authoritative on the server; the browser countdown is a display synchronized to the server's end timestamp.
- This version uses in-memory room state, so active matches do not survive a server restart. Use a single app instance for a school booth.
- A player reconnect can resume their slot using a browser-local player ID while the room remains active. The player should keep the same browser storage and tab.
- For a public event, test the complete deployed setup with the exact laptop, phones, network, and QR scan workflow before opening the booth.

## Current implementation scope

Implemented: room creation, QR generation, two player slots, player registration, live normalized stroke relay, brush/eraser/color/size, undo/redo/clear, server-side timer, host review, manual winner selection, next round, recent match history, and PostgreSQL leaderboard persistence.

Limitations: no spectator access, no multi-instance Redis scaling, no durable recovery of active matches after server restart, and no player account system. Sound is omitted. A finished player's image is sent as a compact final snapshot for the host result view; live drawing uses stroke events.
