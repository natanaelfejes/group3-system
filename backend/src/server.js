import express from 'express';
import { desksRouter } from './routes/desks.js';
import { listDeskIds, SimulatorError } from './simulator/client.js';

// ===== Settings (from .env) =====
const PORT = Number(process.env.PORT ?? 3000);
// IMPORTANT: 0.0.0.0 lets the Pico W connect over Wi-Fi. 127.0.0.1 would only allow this computer.
const HOST = process.env.HOST ?? '0.0.0.0';

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
  if (error) throw error;
  console.log(`API listening on http://${HOST}:${PORT}`);
});
