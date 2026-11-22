# Backend (Node.js API)

Wraps the [WiFi2BLE box simulator](https://source.coderefinery.org/sdm-edu/wifi2ble-box-simulator) and exposes a small HTTP API for the Pico W and the web app.

The simulator only listens on `localhost`, so the Pico W cannot reach it directly. It goes through this API instead.

```
Pico W / web app  --HTTP-->  this API (:3000)  --HTTP-->  simulator (:8000, localhost only)
```

## Running it

Easiest: `docker compose up --build` in the repo root runs the simulator, this API and the web app (see [docs/deployment.md](../docs/deployment.md)). The API is then on http://localhost:3000.

To work on the backend with auto-restart instead:

1. Start only the simulator (repo root, needs the root `.env` with `SIMULATOR_API_KEY`): `docker compose up simulator`. Leave the `api` container off, it uses port 3000 too.
2. Create `backend/.env` (not in git):
   ```
   SIMULATOR_URL=http://localhost:8000
   SIMULATOR_API_KEY=<same key as SIMULATOR_API_KEY in the root .env>
   DATABASE_URL=<Supabase connection string, optional, see below>
   ```
3. In `backend/`: `npm install`, then `npm run dev`.
4. Check http://localhost:3000/api/health. It should show `{"api":"ok","simulator":"ok","db":"ok"}`. `db` is `"not configured"` without `DATABASE_URL` and `"error"` if the database cannot be reached (the status code only depends on the simulator).

Requires Node.js 22.9 or newer.

## Database (Supabase)

`src/db.js` exports a `pg` connection pool built from `DATABASE_URL`. Get the string in the Supabase dashboard: Project > Connect > Session pooler (works over IPv4, the VM needs that). Keep it in `.env` only. Tables (`users`, `desks`, `presets`, ...) are created in Supabase, not by this code.

## Endpoints

`:deskId` is the desk's MAC address, e.g. `cd:fb:1a:53:fb:e6`. Get the list from `GET /api/desks`.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{"api":"ok","simulator":"ok"}`, or 503 if the simulator can't be used |
| GET | `/api/desks` | `["cd:fb:1a:53:fb:e6", "ee:62:5b:b8:73:1d"]`: desks that are powered on |
| GET | `/api/desks/:deskId` | Everything: `{ id, config, state, usage, lastErrors }` |
| GET | `/api/desks/:deskId/state` | `{ position_mm, speed_mms, status, isPositionLost, isOverloadProtectionUp, isOverloadProtectionDown, isAntiCollision }` |
| GET | `/api/desks/:deskId/config` | `{ name, manufacturer }` |
| GET | `/api/desks/:deskId/usage` | `{ activationsCounter, sitStandCounter }` |
| GET | `/api/desks/:deskId/errors` | `[{ time_s, errorCode }]`, newest first (93 = collision) |
| PUT | `/api/desks/:deskId/position` | Body `{"position_mm": 1000}`. Returns `{"position_mm": 1000}`, the target the desk accepted |

Errors are always JSON: `{"error": "..."}`.

| Status | Meaning |
|---|---|
| 400 | Bad desk id, or bad body (`position_mm` must be a whole number from 680 to 1320, `Content-Type: application/json`) |
| 404 | Desk not found, or it is powered off (the simulator powers desks off at random) |
| 502 | The simulator rejected the request, e.g. wrong `SIMULATOR_API_KEY` (the message says which) |
| 503 | The simulator is not running or not reachable |

### Moving a desk

`PUT .../position` returns immediately. The desk then moves about 32 mm per second, so poll `GET .../state` to follow it: `speed_mms` is positive going up, negative going down, and 0 when it has stopped. Positions must be 680–1320 mm (the simulator's limits). Anything outside that range gets a 400.

## Calling it from the Pico W

The Pico calls the deployed backend through port 80: `http://4.233.89.145/api/...`. Exact requests, errors and firmware notes are in [docs/pico-api.md](../docs/pico-api.md). Never call the simulator directly, its key would end up in the firmware.

## Code layout

| File | What it does |
|---|---|
| `src/services/deskSimulatorClient.js` | One function per simulator call: `listDeskIds`, `getDesk`, `getDeskState`, `getDeskConfig`, `getDeskUsage`, `getDeskErrors`, `setDeskPosition`. Import these from any backend code that needs desks. |
| `src/routes/desks.js` | The `/api/desks` endpoints |
| `src/server.js` | Entry point: Express app, `/api/health`, turns errors into HTTP status codes |

Simulator quirks the client already handles:
- Desk IDs are put into the simulator URL raw, because the simulator doesn't URL-decode paths.
- `getDeskErrors` reads the full desk, because the simulator's `/lastErrors` answers 404 when there are no errors.
- The API key never appears in error messages or logs.
