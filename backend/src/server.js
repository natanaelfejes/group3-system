import express from 'express';
import { desksRouter } from './routes/desks.js';
import { listDeskIds, SimulatorError } from './services/deskSimulatorClient.js';

// ===== Settings (from .env) =====
const PORT = Number(process.env.PORT ?? 3000);
// IMPORTANT: 127.0.0.1 only allows this computer (safe default, there is no auth yet).
// Set HOST=0.0.0.0 in .env to let the Pico W connect over Wi-Fi.
const HOST = process.env.HOST ?? '127.0.0.1';

const app = express();
app.use(express.json()); // lets us read JSON sent in requests

// ===== Routes =====

// Checks if the API and the simulator are both working
app.get('/api/health', async (_req, res) => {
  try {
    await listDeskIds();
    res.json({ api: 'ok', simulator: 'ok' });
  } catch (err) {
    res.status(503).json({ api: 'ok', simulator: 'error', error: err.message });
  }
});

// All desk endpoints are in routes/desks.js
app.use('/api/desks', desksRouter);

// Any other URL gets a 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ===== Error handling =====
// IMPORTANT: every error thrown in the routes ends up here.
// We turn it into a JSON error with the right status code.
app.use((err, _req, res, _next) => {
  if (err instanceof RangeError || err.type === 'entity.parse.failed') {
    // 400 = bad desk id, bad position, or broken JSON
    res.status(400).json({ error: err.message });
  } else if (err instanceof SimulatorError && err.status === 404) {
    // 404 = desk doesn't exist or is turned off
    res.status(404).json({ error: 'Desk not found (it may be powered off)' });
  } else if (err instanceof SimulatorError) {
    // 503 = simulator is not running, 502 = simulator gave some other error
    console.error(err);
    res.status(err.status === null ? 503 : 502).json({ error: err.message });
  } else {
    // 500 = a bug in our own code
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== Start the server =====
app.listen(PORT, HOST, (error) => {
  if (error) {
    // IMPORTANT: "fail fast" = if the server can't start, stop right away instead of
    // running half-broken. We print a clear reason first, so it's easy to fix. Common ones:
    //   EADDRINUSE    = something else already uses this port (change PORT in .env)
    //   EADDRNOTAVAIL = HOST in .env is not an address of this computer
    // process.exit(1) stops the program; 1 means "ended with an error" (0 would mean success).
    console.error(`Could not start the API on ${HOST}:${PORT}: ${error.message}`);
    process.exit(1);
  }
  console.log(`API listening on http://${HOST}:${PORT}`);
});
