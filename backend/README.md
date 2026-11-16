# Backend (Node.js API)

Wraps the [WiFi2BLE box simulator](https://source.coderefinery.org/sdm-edu/wifi2ble-box-simulator) and exposes a small HTTP API for the Pico W and the web app.

The simulator only listens on `localhost`, so the Pico W cannot reach it directly. It goes through this API instead.

```
Pico W / web app  --HTTP-->  this API (:3000)  --HTTP-->  simulator (:8000, localhost only)
```

## Running it

Requires Node.js 22.9 or newer, and Python 3 for the simulator.

1. Start the simulator in HTTP mode (in the simulator repo):
   ```bash
   python simulator/main.py --port 8000
   ```
   Add `--no-user-simulation` if you don't want the simulated users moving the desks while you test.
2. Create `backend/.env`. It's not in git (`.gitignore` skips it), so everyone makes their own:
   ```
   PORT=3000
   HOST=0.0.0.0
   SIMULATOR_URL=http://localhost:8000
   SIMULATOR_API_KEY=<your simulator API key>
   ```
   Get the API key from the simulator repo. `HOST=0.0.0.0` lets the Pico W connect over Wi-Fi; leave it out to only allow this computer (`127.0.0.1`, the default).
3. Start the API (in `backend/`):
   ```bash
   npm install
   npm run dev              # restarts on file changes; use `npm start` otherwise
   ```
4. Check it: open http://localhost:3000/api/health. It should show `{"api":"ok","simulator":"ok"}`.

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

- Use `http://<IP of the machine running the API>:3000`. On Windows, run `ipconfig` and use the IPv4 address. The Pico must be on the same network.
- The first time the API starts, Windows asks whether to let Node.js through the firewall. Allow it on private networks.
- Plain HTTP only, so the Pico needs no TLS.
- Example request:
  ```http
  PUT /api/desks/cd:fb:1a:53:fb:e6/position HTTP/1.1
  Host: 192.168.1.50:3000
  Content-Type: application/json
  Content-Length: 19

  {"position_mm":900}
  ```

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
