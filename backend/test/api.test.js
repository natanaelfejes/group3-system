// Tests for the backend API. Run with: npm test (in backend/)
// We start the real server (src/server.js) as a child process and talk to it over HTTP.
// A small fake simulator on another port gives it desks to read, so no Docker is needed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const KEY = 'testkey123';
const DESK = 'cd:fb:1a:53:fb:e6';
const BASE = `/api/v2/${KEY}/desks`;

const desk = {
  config: { name: 'DESK 4486', manufacturer: 'Linak' },
  state: { position_mm: 680, speed_mms: 0, status: 'Normal' },
  usage: { activationsCounter: 1, sitStandCounter: 0 },
  lastErrors: [{ time_s: 10, errorCode: 93 }],
};

let fake; // fake simulator
let api; // child process running src/server.js
let url; // http://127.0.0.1:<port> of the api
let lastPut; // body of the last PUT the fake simulator got

function startFakeSimulator() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const send = (code, body) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const path = req.url;
        if (path === BASE) return send(200, [DESK]);
        if (path === `${BASE}/boom`) return send(500, { error: 'broken' });
        if (path === `${BASE}/${DESK}`) return send(200, desk);
        if (path === `${BASE}/${DESK}/config`) return send(200, desk.config);
        if (path === `${BASE}/${DESK}/state` && req.method === 'GET') return send(200, desk.state);
        if (path === `${BASE}/${DESK}/usage`) return send(200, desk.usage);
        if (path === `${BASE}/${DESK}/state` && req.method === 'PUT') {
          lastPut = JSON.parse(raw);
          return send(200, lastPut);
        }
        send(404, { error: 'not found' });
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Starts src/server.js on a free port and waits until it says it is listening.
function startApi(simulatorUrl, port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js'], {
      env: { ...process.env, PORT: String(port), SIMULATOR_URL: simulatorUrl, SIMULATOR_API_KEY: KEY },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => d.toString().includes('API listening') && resolve(child));
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });
}

const call = (path, options) => fetch(url + path, options);
const put = (path, body) =>
  call(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

before(async () => {
  fake = await startFakeSimulator();
  api = await startApi(`http://127.0.0.1:${fake.address().port}`, 38101);
  url = 'http://127.0.0.1:38101';
});

after(() => {
  api?.kill();
  fake?.close();
});

test('health: ok when the simulator answers', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { api: 'ok', simulator: 'ok' });
});

test('GET /api/desks lists desk ids', async () => {
  assert.deepEqual(await (await call('/api/desks')).json(), [DESK]);
});

test('GET /api/desks/:id returns the desk with its id', async () => {
  const body = await (await call(`/api/desks/${DESK}`)).json();
  assert.equal(body.id, DESK);
  assert.equal(body.state.position_mm, 680);
});

test('config, state and usage endpoints', async () => {
  assert.equal((await (await call(`/api/desks/${DESK}/config`)).json()).manufacturer, 'Linak');
  assert.equal((await (await call(`/api/desks/${DESK}/state`)).json()).speed_mms, 0);
  assert.equal((await (await call(`/api/desks/${DESK}/usage`)).json()).activationsCounter, 1);
});

test('errors endpoint returns lastErrors', async () => {
  assert.deepEqual(await (await call(`/api/desks/${DESK}/errors`)).json(), desk.lastErrors);
});

test('PUT position moves the desk (what the Pico sends)', async () => {
  const res = await put(`/api/desks/${DESK}/position`, { position_mm: 1000 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { position_mm: 1000 });
  assert.deepEqual(lastPut, { position_mm: 1000 });
});

test('PUT position accepts the limits 680 and 1320', async () => {
  assert.equal((await put(`/api/desks/${DESK}/position`, { position_mm: 680 })).status, 200);
  assert.equal((await put(`/api/desks/${DESK}/position`, { position_mm: 1320 })).status, 200);
});

test('PUT position rejects bad values with 400 and never reaches the simulator', async () => {
  lastPut = undefined;
  for (const bad of [{ position_mm: 679 }, { position_mm: 1321 }, { position_mm: 1000.5 }, { position_mm: '1000' }, {}]) {
    assert.equal((await put(`/api/desks/${DESK}/position`, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(lastPut, undefined);
});

test('PUT position without a JSON content type is 400', async () => {
  const res = await call(`/api/desks/${DESK}/position`, { method: 'PUT', body: '{"position_mm":1000}' });
  assert.equal(res.status, 400);
});

test('PUT position with broken JSON is 400', async () => {
  assert.equal((await put(`/api/desks/${DESK}/position`, '{"position_mm":')).status, 400);
});

test('bad desk id is 400 (also path tricks)', async () => {
  assert.equal((await call('/api/desks/not-a-mac')).status, 400);
  assert.equal((await call('/api/desks/..%2F..%2Fx')).status, 400);
});

test('desk that does not exist is 404', async () => {
  assert.equal((await call('/api/desks/00:00:00:00:00:00')).status, 404);
});

test('unknown route is a JSON 404', async () => {
  const res = await call('/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('simulator error becomes 502 and the key is not in the answer', async () => {
  // not a valid desk id for the route, so go through health with a broken simulator instead
  const broken = http.createServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"broken"}');
  });
  await new Promise((r) => broken.listen(0, '127.0.0.1', r));
  const child = await startApi(`http://127.0.0.1:${broken.address().port}`, 38102);
  try {
    const res = await fetch(`http://127.0.0.1:38102/api/desks/${DESK}`);
    assert.equal(res.status, 502);
    assert.ok(!(await res.text()).includes(KEY));
  } finally {
    child.kill();
    broken.close();
  }
});

test('simulator down is 503 on health and on desks, without the key', async () => {
  const child = await startApi('http://127.0.0.1:1', 38103); // nothing listens on port 1
  try {
    const health = await fetch('http://127.0.0.1:38103/api/health');
    assert.equal(health.status, 503);
    assert.ok(!(await health.text()).includes(KEY));
    assert.equal((await fetch('http://127.0.0.1:38103/api/desks')).status, 503);
  } finally {
    child.kill();
  }
});
