import { Router } from 'express';
import * as simulator from '../services/deskSimulatorClient.js';

// ===== Desk endpoints: /api/desks/... =====
// The Pico W and the website call these.
// We don't check the desk id or position here. The simulator functions do that.
// Every route catches its errors and passes them on with next(err).
// IMPORTANT: next(err) makes Express skip all normal routes and jump straight to the
// error handler at the bottom of server.js (the function with 4 parameters: err, req, res, next).
// That handler picks the status code (400, 404, 502, 503 or 500) and sends {"error": "..."},
// so the routes don't have to. A catch block must always call next(err), otherwise the request hangs.
export const desksRouter = Router();

// List all desk ids
desksRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await simulator.listDeskIds());
  } catch (err) {
    next(err);
  }
});

// Everything about one desk
desksRouter.get('/:deskId', async (req, res, next) => {
  try {
    const desk = await simulator.getDesk(req.params.deskId);
    res.json({ id: req.params.deskId, ...desk });
  } catch (err) {
    next(err);
  }
});

// Name and manufacturer
desksRouter.get('/:deskId/config', async (req, res, next) => {
  try {
    res.json(await simulator.getDeskConfig(req.params.deskId));
  } catch (err) {
    next(err);
  }
});

// Height, speed and status
desksRouter.get('/:deskId/state', async (req, res, next) => {
  try {
    res.json(await simulator.getDeskState(req.params.deskId));
  } catch (err) {
    next(err);
  }
});

// Usage counters
desksRouter.get('/:deskId/usage', async (req, res, next) => {
  try {
    res.json(await simulator.getDeskUsage(req.params.deskId));
  } catch (err) {
    next(err);
  }
});

// Last errors
desksRouter.get('/:deskId/errors', async (req, res, next) => {
  try {
    res.json(await simulator.getDeskErrors(req.params.deskId));
  } catch (err) {
    next(err);
  }
});

// IMPORTANT: move a desk. Send JSON like {"position_mm": 1000}
// Answers with the height the desk will actually go to.
desksRouter.put('/:deskId/position', async (req, res, next) => {
  try {
    const accepted = await simulator.setDeskPosition(req.params.deskId, req.body?.position_mm);
    res.json({ position_mm: accepted });
  } catch (err) {
    next(err);
  }
});
