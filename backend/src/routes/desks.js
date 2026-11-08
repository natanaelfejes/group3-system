import { Router } from 'express';
import * as simulator from '../simulator/client.js';

// ===== Desk endpoints: /api/desks/... =====
// The Pico W and the website call these.
// We don't check the desk id or position here. The simulator functions do that,
// and if something is wrong, server.js sends back a 400 error.
export const desksRouter = Router();

// List all desk ids
desksRouter.get('/', async (_req, res) => {
  res.json(await simulator.listDeskIds());
});

// Everything about one desk
desksRouter.get('/:deskId', async (req, res) => {
  const desk = await simulator.getDesk(req.params.deskId);
  res.json({ id: req.params.deskId, ...desk });
});

// Name and manufacturer
desksRouter.get('/:deskId/config', async (req, res) => {
  res.json(await simulator.getDeskConfig(req.params.deskId));
});

// Height, speed and status
desksRouter.get('/:deskId/state', async (req, res) => {
  res.json(await simulator.getDeskState(req.params.deskId));
});

// Usage counters
desksRouter.get('/:deskId/usage', async (req, res) => {
  res.json(await simulator.getDeskUsage(req.params.deskId));
});

// Last errors
desksRouter.get('/:deskId/errors', async (req, res) => {
  res.json(await simulator.getDeskErrors(req.params.deskId));
});

// IMPORTANT: move a desk. Send JSON like {"position_mm": 1000}
// Answers with the height the desk will actually go to.
desksRouter.put('/:deskId/position', async (req, res) => {
  const accepted = await simulator.setDeskPosition(req.params.deskId, req.body?.position_mm);
  res.json({ position_mm: accepted });
});
