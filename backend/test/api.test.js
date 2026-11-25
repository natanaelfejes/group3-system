// Tests for the backend API. Run with: npm test (in backend/)
// We start the real server (src/server.js) as a child process and talk to it over HTTP.
// A small fake simulator on another port gives it desks to read, so no Docker is needed.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const KEY = 'testkey123';
const DESK = 'cd:fb:1a:53:fb:e6';
const DESK_NO_ERRORS = 'aa:bb:cc:dd:ee:ff'; // a desk that has no lastErrors field
const BASE = `/api/v2/${KEY}/desks`;

const desk = {
  config: { name: 'DESK 4486', manufacturer: 'Linak' },
  state: { position_mm: 680, speed_mms: 0, status: 'Normal' },
  usage: { activationsCounter: 1, sitStandCounter: 0 },
  lastErrors: [{ time_s: 10, errorCode: 93 }],
};

let fake; // fake simulator
let api; // the server under test: { child, port, url, out }
let lastPut; // body of the last PUT the fake simulator got
const children = []; // every server we start, so after() can stop them all

beforeEach(() => {
  lastPut = undefined;
});

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
        if (path === `${BASE}/${DESK}`) return send(200, desk);
        if (path === `${BASE}/${DESK_NO_ERRORS}`) return send(200, { config: desk.config, state: desk.state, usage: desk.usage });
        if (path === `${BASE}/${DESK}/config`) return send(200, desk.config);
        if (path === `${BASE}/${DESK}/state` && req.method === 'GET') return send(200, desk.state);
        if (path === `${BASE}/${DESK}/usage`) return send(200, desk.usage);
        if (path === `${BASE}/${DESK}/state` && req.method === 'PUT') {
          lastPut = JSON.parse(raw);
          // Like a real desk, answer with the height it accepted, which can differ from the request.
          return send(200, { position_mm: lastPut.position_mm - (lastPut.position_mm % 10) });
        }
        send(404, { error: 'not found' });
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// A port nobody uses right now: open one, read its number, close it again.
function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

// Starts src/server.js on a free port and waits until it says it is listening.
// `env` overrides the defaults. Rejects (with the server's own output) if it dies or is silent for 5 s.
async function startApi(simulatorUrl, env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    // HOST and PORT are set here so values from the developer's shell or CI can't leak in.
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), SIMULATOR_URL: simulatorUrl, SIMULATOR_API_KEY: KEY, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const server = { child, port, url: `http://127.0.0.1:${port}`, out: '' };
  child.stdout.on('data', (d) => (server.out += d));
  child.stderr.on('data', (d) => (server.out += d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start within 5s:\n${server.out}`)), 5000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early (${code}):\n${server.out}`));
    });
    child.stdout.on('data', () => {
      if (server.out.includes('API listening')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return server;
}

const call = (path, options) => fetch(api.url + path, options);
const put = (path, body) =>
  call(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

before(async () => {
  fake = await startFakeSimulator();
  api = await startApi(`http://127.0.0.1:${fake.address().port}`);
});

after(async () => {
  // wait until every server we started has really stopped
  await Promise.all(children.map((c) => (c.exitCode === null ? new Promise((r) => (c.once('exit', r), c.kill())) : null)));
  fake?.close();
  fake?.closeAllConnections?.();
});

test('health: ok when the simulator answers', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { api: 'ok', simulator: 'ok', db: 'not configured' });
});

test('health: db is "error" (and the status stays 200) when DATABASE_URL points nowhere, password not logged', async () => {
  const dead = await freePort();
  const server = await startApi(`http://127.0.0.1:${fake.address().port}`, {
    DATABASE_URL: `postgresql://user:secretpw123@127.0.0.1:${dead}/postgres`,
  });
  const res = await fetch(`${server.url}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { api: 'ok', simulator: 'ok', db: 'error' });
  assert.ok(!server.out.includes('secretpw123'), 'database password found in the server logs');
});

test('health: a database that never answers does not hang the request', async () => {
  const silent = net.createServer(() => {}); // accepts the connection, never replies
  await new Promise((r) => silent.listen(0, '127.0.0.1', r));
  try {
    const server = await startApi(`http://127.0.0.1:${fake.address().port}`, {
      DATABASE_URL: `postgresql://user:pw@127.0.0.1:${silent.address().port}/postgres`,
    });
    const start = Date.now();
    const res = await fetch(`${server.url}/api/health`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).db, 'error');
    assert.ok(Date.now() - start < 4000, 'health took longer than the 5 s Docker healthcheck allows');
  } finally {
    silent.close();
    silent.closeAllConnections?.();
  }
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

test('errors endpoint returns [] when the desk has no lastErrors', async () => {
  const res = await call(`/api/desks/${DESK_NO_ERRORS}/errors`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test('PUT position moves the desk (what the Pico sends)', async () => {
  const res = await put(`/api/desks/${DESK}/position`, { position_mm: 1000 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { position_mm: 1000 });
  assert.deepEqual(lastPut, { position_mm: 1000 });
});

test('PUT position answers with the height the simulator accepted, not the one we sent', async () => {
  // the fake rounds 1005 down to 1000
  const res = await put(`/api/desks/${DESK}/position`, { position_mm: 1005 });
  assert.deepEqual(await res.json(), { position_mm: 1000 });
  assert.deepEqual(lastPut, { position_mm: 1005 });
});

test('PUT position accepts the limits 680 and 1320', async () => {
  assert.equal((await put(`/api/desks/${DESK}/position`, { position_mm: 680 })).status, 200);
  assert.equal((await put(`/api/desks/${DESK}/position`, { position_mm: 1320 })).status, 200);
});

test('PUT position rejects bad values with 400 and never reaches the simulator', async () => {
  for (const bad of [{ position_mm: 679 }, { position_mm: 1321 }, { position_mm: 1000.5 }, { position_mm: '1000' }, {}]) {
    assert.equal((await put(`/api/desks/${DESK}/position`, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(lastPut, undefined);
});

test('PUT position without a JSON content type is 400', async () => {
  const res = await call(`/api/desks/${DESK}/position`, { method: 'PUT', body: '{"position_mm":1000}' });
  assert.equal(res.status, 400);
  assert.equal(lastPut, undefined);
});

test('PUT position with broken JSON is 400', async () => {
  assert.equal((await put(`/api/desks/${DESK}/position`, '{"position_mm":')).status, 400);
  assert.equal(lastPut, undefined);
});

test('bad desk id is 400 (also path tricks and ids with extra characters around a real one)', async () => {
  for (const bad of ['not-a-mac', '..%2F..%2Fx', `${DESK}%2F..%2Fx`, `${DESK}x`, `x${DESK}`]) {
    assert.equal((await call(`/api/desks/${bad}`)).status, 400, bad);
  }
});

test('desk that does not exist is 404', async () => {
  assert.equal((await call('/api/desks/00:00:00:00:00:00')).status, 404);
});

test('unknown route is a JSON 404', async () => {
  const res = await call('/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('simulator error becomes 502 and the key is nowhere (answer, logs)', async () => {
  const broken = http.createServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"broken"}');
  });
  try {
    await new Promise((r) => broken.listen(0, '127.0.0.1', r));
    const server = await startApi(`http://127.0.0.1:${broken.address().port}`);
    const res = await fetch(`${server.url}/api/desks/${DESK}`);
    assert.equal(res.status, 502);
    assert.ok(!(await res.text()).includes(KEY));
    assert.ok(!server.out.includes(KEY), 'key found in the server logs');
  } finally {
    broken.close();
  }
});

test('simulator down is 503 on health and on desks, key nowhere', async () => {
  const dead = await freePort(); // nothing listens on it
  const server = await startApi(`http://127.0.0.1:${dead}`);
  const health = await fetch(`${server.url}/api/health`);
  assert.equal(health.status, 503);
  assert.ok(!(await health.text()).includes(KEY));
  assert.equal((await fetch(`${server.url}/api/desks`)).status, 503);
  assert.ok(!server.out.includes(KEY), 'key found in the server logs');
});

test('server refuses to start without SIMULATOR_API_KEY', async () => {
  await assert.rejects(startApi('http://127.0.0.1:1', { SIMULATOR_API_KEY: '' }), /SIMULATOR_API_KEY is missing/);
});
