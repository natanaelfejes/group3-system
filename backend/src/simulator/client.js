// ===== Functions for talking to the desk simulator =====
// Simulator: https://source.coderefinery.org/sdm-edu/wifi2ble-box-simulator
//
// One desk from the simulator looks like this:
// {
//   config:     { name, manufacturer },
//   state:      { position_mm, speed_mms, status, isPositionLost, isOverloadProtectionUp,
//                 isOverloadProtectionDown, isAntiCollision },
//   usage:      { activationsCounter, sitStandCounter },
//   lastErrors: [ { time_s, errorCode } ]   // newest first, errorCode 93 = collision
// }

// ===== Settings (from .env) =====
const SIMULATOR_URL = process.env.SIMULATOR_URL ?? 'http://localhost:8000';
const API_KEY = process.env.SIMULATOR_API_KEY;
if (!API_KEY) {
  throw new Error('SIMULATOR_API_KEY is missing. Create backend/.env (see backend/README.md).');
}

// IMPORTANT: the simulator wants the API key inside the URL, like /api/v2/<key>/desks
const DESKS_URL = `${SIMULATOR_URL}/api/v2/${API_KEY}/desks`;

// Desk ids look like "cd:fb:1a:53:fb:e6"
const DESK_ID_PATTERN = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i;

// Error we throw when a simulator call fails.
// status = the simulator's status code, or null if the simulator is not running.
export class SimulatorError extends Error {
  constructor(message, status, cause) {
    super(message, { cause });
    this.status = status;
  }
}

// ===== Get data =====

// Ids of all desks that are turned on
export async function listDeskIds() {
  return request('GET', '');
}

// Everything about one desk (config, state, usage, lastErrors)
export async function getDesk(deskId) {
  return request('GET', deskPath(deskId));
}

// Name and manufacturer
export async function getDeskConfig(deskId) {
  return request('GET', `${deskPath(deskId)}/config`);
}

// Height, speed and status
export async function getDeskState(deskId) {
  return request('GET', `${deskPath(deskId)}/state`);
}

// How many times the desk was used
export async function getDeskUsage(deskId) {
  return request('GET', `${deskPath(deskId)}/usage`);
}

// Last errors, newest first.
// IMPORTANT: we read the whole desk here, because the simulator gives a 404 for /lastErrors when there are no errors.
export async function getDeskErrors(deskId) {
  return (await getDesk(deskId)).lastErrors;
}

// ===== Set data =====

// IMPORTANT: moves a desk to a height in mm.
// - The desk moves slowly (32 mm per second). Check getDeskState() until speed_mms is 0.
// - The simulator only allows 680-1320 mm. Anything else gets changed to the closest limit.
// - Returns the height the simulator actually accepted.
export async function setDeskPosition(deskId, positionMm) {
  if (!Number.isInteger(positionMm)) {
    throw new RangeError('position_mm must be a whole number of millimetres, e.g. {"position_mm": 1000}');
  }
  const result = await request('PUT', `${deskPath(deskId)}/state`, { position_mm: positionMm });
  return result.position_mm;
}

// ===== Helpers =====

// Sends a request to the simulator and returns its JSON answer.
// Throws a SimulatorError if something goes wrong.
async function request(method, path, body) {
  // Errors only show the path, not the full URL, so the API key doesn't end up in the logs
  const label = `${method} /desks${path}`;

  let response;
  try {
    response = await fetch(DESKS_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(5000), // give up after 5 seconds
    });
  } catch (err) {
    // Simulator is not running, or it took too long
    throw new SimulatorError(`Simulator unreachable (${label})`, null, err);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Simulator answered, but with an error (for example 404 = desk not found)
    throw new SimulatorError(`Simulator answered ${response.status} to ${label}: ${data.error ?? response.statusText}`, response.status);
  }
  return data;
}

// Checks the desk id and turns it into "/<id>" for the URL.
// IMPORTANT: the simulator can't read encoded URLs, so the id must go in as-is (with the colons).
// Checking the id also stops weird input like "../" from getting into the URL.
function deskPath(deskId) {
  if (!DESK_ID_PATTERN.test(deskId)) {
    throw new RangeError(`Invalid desk id "${deskId}", expected a MAC address like cd:fb:1a:53:fb:e6`);
  }
  return `/${deskId}`;
}
