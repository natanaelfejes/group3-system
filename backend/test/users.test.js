// Tests for the user admin endpoints (/api/users, /api/db/desks). Run with: npm test (in backend/)
// They need a REAL Postgres. Set TEST_DATABASE_URL to a throwaway database, e.g.
//   docker run -d --rm --name g3-test-pg -e POSTGRES_PASSWORD=x -p 127.0.0.1:55432:5432 postgres:16
//   TEST_DATABASE_URL=postgresql://postgres:x@127.0.0.1:55432/postgres npm test
// Without it the database tests are skipped (CI has no Postgres); the gate, "no DATABASE_URL" and
// "database down" tests need no Postgres and always run. The database tests DROP and re-create the
// users/desks/presets/routines/health tables, so the URL must point at localhost (checked below).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import pg from 'pg';

const DB_URL = process.env.TEST_DATABASE_URL;
const SKIP = DB_URL ? false : 'TEST_DATABASE_URL is not set (needs a throwaway Postgres on localhost)';
const dbTest = (name, fn) => test(name, { skip: SKIP }, fn);

const D1 = '11111111-1111-4111-8111-111111111111';
const D2 = '22222222-2222-4222-8222-222222222222';
const D3 = '33333333-3333-4333-8333-333333333333';
const MISSING = '99999999-9999-4999-8999-999999999999';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let db; // test-side connection, for seeding and for checking what the API did to the tables
let api; // server with the admin API on
const children = [];

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

// Same idea as startApi in api.test.js: real server as a child process, waits until it listens.
async function startApi(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      SIMULATOR_URL: 'http://127.0.0.1:1', // these tests never touch the simulator
      SIMULATOR_API_KEY: 'testkey123',
      DATABASE_URL: '',
      ENABLE_USER_ADMIN_API: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const server = { child, url: `http://127.0.0.1:${port}`, out: '' };
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

const call = (path, options, server = api) => fetch(server.url + path, options);
const send = (method, path, body, server = api) =>
  call(path, { method, headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }, server);
const post = (body) => send('POST', '/api/users', body);
const patch = (id, body) => send('PATCH', `/api/users/${id}`, body);
const del = (id) => call(`/api/users/${id}`, { method: 'DELETE' });
const q = async (sql, params) => (await db.query(sql, params)).rows;
const deskOwner = async (id) => (await q('select user_id from desks where desk_id = $1', [id]))[0].user_id;

// Creates a user through the database (not the API) and returns its id.
async function addUser(name, email, role = 'worker', deskId = null) {
  const [{ user_id }] = await q(
    'insert into users (user_id, name, email, role, created_at) values (gen_random_uuid(), $1, $2, $3, now()) returning user_id',
    [name, email, role],
  );
  if (deskId) await q('update desks set user_id = $1 where desk_id = $2', [user_id, deskId]);
  return user_id;
}

async function reset() {
  await q('truncate routines, presets, health, desks, users cascade');
  await q(`insert into desks (desk_id, user_id, manufacturer, last_height) values
    ('${D1}', null, 'Linak', 700), ('${D2}', null, 'Linak', 800), ('${D3}', null, 'Flexispot', 900)`);
}

before(async () => {
  if (SKIP) return;
  const host = new URL(DB_URL).hostname;
  assert.ok(['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host), `refusing to drop tables on ${host}: TEST_DATABASE_URL must be localhost`);
  db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  // Sensible definitions for a throwaway database. Production defaults are not known.
  await db.query(`
    drop table if exists routines, presets, health, desks, users cascade;
    create table users (user_id uuid primary key default gen_random_uuid(), name text, email text unique, role text, created_at timestamptz default now());
    create table desks (desk_id uuid primary key default gen_random_uuid(), user_id uuid references users, manufacturer text, last_height integer);
    create table presets (preset_id uuid primary key default gen_random_uuid(), user_id uuid references users, name text, height integer);
    create table routines (routine_id uuid primary key default gen_random_uuid(), user_id uuid references users, preset_id uuid references presets, name text);
    create table health (health_id uuid primary key default gen_random_uuid(), user_id uuid references users, note text);
  `);
  api = await startApi({ DATABASE_URL: DB_URL, ENABLE_USER_ADMIN_API: '1' });
});

after(async () => {
  await Promise.all(children.map((c) => (c.exitCode === null ? new Promise((r) => (c.once('exit', r), c.kill())) : null)));
  await db?.end();
});

// ===== The gate =====

test('gate off (default): /api/users and /api/db/desks are the normal JSON 404, even with a database', async () => {
  // DATABASE_URL points nowhere: if the routes were mounted we would get 503, not 404
  const dead = await freePort();
  const off = await startApi({ DATABASE_URL: `postgresql://user:pw@127.0.0.1:${dead}/postgres` });
  for (const [method, path] of [['GET', '/api/users'], ['GET', '/api/db/desks'], ['DELETE', `/api/users/${MISSING}`]]) {
    const res = await call(path, { method }, off);
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  }
  const res = await send('POST', '/api/users', { name: 'A', email: 'a@x.dk', role: 'admin' }, off);
  assert.equal(res.status, 404);
  // ENABLE_USER_ADMIN_API must be exactly "1"
  const other = await startApi({ ENABLE_USER_ADMIN_API: 'true' });
  assert.equal((await call('/api/users', {}, other)).status, 404);
});

dbTest('gate on does not break other /api URLs: unknown one is still 404', async () => {
  assert.equal((await call('/api/nope')).status, 404);
});

// ===== Reading =====

dbTest('GET /api/users: shape, desk_id, ordered by name', async () => {
  await reset();
  const zed = await addUser('Zed', 'zed@x.dk', 'admin');
  const amy = await addUser('Amy', 'amy@x.dk', 'maintenance_worker', D2);
  const res = await call('/api/users');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.map((u) => u.name), ['Amy', 'Zed']);
  assert.deepEqual(Object.keys(body[0]).sort(), ['created_at', 'desk_id', 'email', 'name', 'role', 'user_id']);
  assert.deepEqual([body[0].user_id, body[0].desk_id, body[0].role], [amy, D2, 'maintenance_worker']);
  assert.deepEqual([body[1].user_id, body[1].desk_id], [zed, null]);
  assert.ok(!Number.isNaN(Date.parse(body[0].created_at)));
});

dbTest('GET /api/db/desks: shape and owner', async () => {
  await reset();
  const u = await addUser('Amy', 'amy@x.dk', 'worker', D1);
  const body = await (await call('/api/db/desks')).json();
  assert.equal(body.length, 3);
  assert.deepEqual(Object.keys(body[0]).sort(), ['desk_id', 'manufacturer', 'user_id']);
  assert.deepEqual(body.find((d) => d.desk_id === D1), { desk_id: D1, manufacturer: 'Linak', user_id: u });
  assert.equal(body.find((d) => d.desk_id === D3).user_id, null);
});

// ===== Create =====

dbTest('POST creates a user (201), trims the name, assigns the desk', async () => {
  await reset();
  const res = await post({ name: '  Amy Jensen ', email: 'amy@x.dk', role: 'worker', desk_id: D1 });
  assert.equal(res.status, 201);
  const u = await res.json();
  assert.match(u.user_id, UUID);
  assert.deepEqual([u.name, u.email, u.role, u.desk_id], ['Amy Jensen', 'amy@x.dk', 'worker', D1]);
  assert.ok(!Number.isNaN(Date.parse(u.created_at)));
  assert.equal(await deskOwner(D1), u.user_id);
});

dbTest('POST without a desk gives desk_id null', async () => {
  await reset();
  const res = await post({ name: 'Amy', email: 'amy@x.dk', role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).desk_id, null);
});

dbTest('POST: duplicate email in a different case is 409, only one row stays', async () => {
  await reset();
  assert.equal((await post({ name: 'Amy', email: 'Amy@X.dk', role: 'worker' })).status, 201);
  const res = await post({ name: 'Other', email: 'aMY@x.DK', role: 'worker' });
  assert.equal(res.status, 409);
  assert.ok((await res.json()).error);
  assert.equal((await q('select * from users')).length, 1);
});

dbTest('POST: a taken desk is 409 and no user is created; a missing desk is 404', async () => {
  await reset();
  await addUser('Amy', 'amy@x.dk', 'worker', D1);
  assert.equal((await post({ name: 'Bob', email: 'bob@x.dk', role: 'worker', desk_id: D1 })).status, 409);
  assert.equal((await post({ name: 'Bob', email: 'bob@x.dk', role: 'worker', desk_id: MISSING })).status, 404);
  assert.equal((await q('select * from users')).length, 1);
});

dbTest('POST: bad name, email, role or desk_id is 400 and nothing is stored', async () => {
  await reset();
  const ok = { name: 'Amy', email: 'amy@x.dk', role: 'worker' };
  const bad = [
    { ...ok, name: '' },
    { ...ok, name: '   ' },
    { ...ok, name: 'x'.repeat(101) },
    { ...ok, name: 5 },
    { ...ok, email: 'nope' },
    { ...ok, email: 'a b@x.dk' },
    { ...ok, email: `${'a'.repeat(250)}@x.dk` },
    { ...ok, email: undefined },
    { ...ok, role: 'boss' },
    { ...ok, role: 'Admin' },
    { ...ok, role: undefined },
    { ...ok, desk_id: 'not-a-uuid' },
    { ...ok, desk_id: null },
    [],
  ];
  for (const body of bad) assert.equal((await post(body)).status, 400, JSON.stringify(body));
  assert.equal((await post('{"name":')).status, 400); // broken JSON
  assert.equal((await q('select * from users')).length, 0);
  // name of exactly 100 characters is fine
  assert.equal((await post({ ...ok, name: 'x'.repeat(100) })).status, 201);
});

dbTest('POST without a JSON content type is 400', async () => {
  await reset();
  const res = await call('/api/users', { method: 'POST', body: JSON.stringify({ name: 'Amy', email: 'amy@x.dk', role: 'worker' }) });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
  assert.equal((await q('select * from users')).length, 0);
});

dbTest('SQL-injection-looking name and email are stored literally', async () => {
  await reset();
  const name = "Robert'); DROP TABLE users;--";
  const email = "x'||(select 1)--@evil.dk";
  const res = await post({ name, email, role: 'worker' });
  assert.equal(res.status, 201);
  const u = await res.json();
  assert.deepEqual([u.name, u.email], [name, email]);
  const [row] = await q('select name, email from users where user_id = $1', [u.user_id]);
  assert.deepEqual(row, { name, email });
  assert.equal((await call('/api/users')).status, 200); // the table is still there
});

// ===== Patch =====

dbTest('PATCH role', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk', 'worker');
  const res = await patch(id, { role: 'maintenance_worker' });
  assert.equal(res.status, 200);
  const u = await res.json();
  assert.deepEqual([u.user_id, u.role, u.name, u.desk_id], [id, 'maintenance_worker', 'Amy', null]);
  assert.equal((await q('select role from users where user_id = $1', [id]))[0].role, 'maintenance_worker');
});

dbTest('PATCH desk_id: assign, move (old desk is freed) and unassign with null', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk');
  assert.equal((await (await patch(id, { desk_id: D1 })).json()).desk_id, D1);
  assert.equal(await deskOwner(D1), id);

  const moved = await patch(id, { desk_id: D2 });
  assert.equal(moved.status, 200);
  assert.equal((await moved.json()).desk_id, D2);
  assert.equal(await deskOwner(D1), null);
  assert.equal(await deskOwner(D2), id);

  assert.equal((await (await patch(id, { desk_id: D2 })).json()).desk_id, D2); // same desk again is fine

  const freed = await patch(id, { desk_id: null });
  assert.equal(freed.status, 200);
  assert.equal((await freed.json()).desk_id, null);
  assert.equal(await deskOwner(D2), null);
  assert.equal((await patch(id, { desk_id: null })).status, 200); // already without a desk is fine
});

dbTest('PATCH role and desk_id together', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk');
  const u = await (await patch(id, { role: 'admin', desk_id: D3 })).json();
  assert.deepEqual([u.role, u.desk_id], ['admin', D3]);
});

dbTest('PATCH: desk of somebody else is 409 and nothing changes (the old desk is kept)', async () => {
  await reset();
  await addUser('Bob', 'bob@x.dk', 'worker', D2);
  const id = await addUser('Amy', 'amy@x.dk', 'worker', D1);
  const res = await patch(id, { role: 'admin', desk_id: D2 });
  assert.equal(res.status, 409);
  assert.equal(await deskOwner(D1), id);
  assert.equal((await q('select role from users where user_id = $1', [id]))[0].role, 'worker');
});

dbTest('PATCH: 404 for a missing user or desk, 400 for bad bodies and ids', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk', 'worker', D1);
  assert.equal((await patch(MISSING, { role: 'admin' })).status, 404);
  assert.equal((await patch(id, { desk_id: MISSING })).status, 404);
  assert.equal(await deskOwner(D1), id); // the failed move did not free the old desk
  for (const body of [{}, { role: 'boss' }, { role: null }, { desk_id: 'x' }, { desk_id: 5 }, { name: 'New' }, { role: 'admin', email: 'a@b.dk' }, []]) {
    assert.equal((await patch(id, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await patch('not-a-uuid', { role: 'admin' })).status, 400);
  const noType = await call(`/api/users/${id}`, { method: 'PATCH', body: '{"role":"admin"}' });
  assert.equal(noType.status, 400);
});

// ===== Delete =====

dbTest('DELETE: 204, desk is freed, presets/routines/health of that user are gone, others stay', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk', 'worker', D1);
  const other = await addUser('Bob', 'bob@x.dk', 'worker', D2);
  for (const owner of [id, other]) {
    const [{ preset_id }] = await q('insert into presets (user_id, name, height) values ($1, $2, 1000) returning preset_id', [owner, 'p']);
    await q('insert into routines (user_id, preset_id, name) values ($1, $2, $3)', [owner, preset_id, 'r']);
    await q('insert into health (user_id, note) values ($1, $2)', [owner, 'h']);
  }
  const res = await del(id);
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(await deskOwner(D1), null);
  assert.equal((await q('select * from users where user_id = $1', [id])).length, 0);
  for (const table of ['presets', 'routines', 'health']) {
    const rows = await q(`select user_id from ${table}`);
    assert.deepEqual(rows.map((r) => r.user_id), [other], table);
  }
  assert.equal(await deskOwner(D2), other);
});

dbTest('DELETE: 404 for a missing user (twice in a row), 400 for a bad uuid', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk');
  assert.equal((await del(id)).status, 204);
  assert.equal((await del(id)).status, 404);
  assert.equal((await del(MISSING)).status, 404);
  assert.equal((await del('nope')).status, 400);
  assert.equal((await del(`${id}x`)).status, 400);
});

dbTest('a failure in the middle rolls everything back (DELETE with a table that blocks it)', async () => {
  await reset();
  const id = await addUser('Amy', 'amy@x.dk', 'worker', D1);
  // a second table pointing at users without ON DELETE: the final "delete from users" fails
  await q('create table extra_blocker (user_id uuid references users)');
  await q('insert into extra_blocker values ($1)', [id]);
  try {
    const res = await del(id);
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, 'Internal server error'); // no SQL in the answer
    assert.equal(await deskOwner(D1), id); // the desk is still assigned: rolled back
    assert.equal((await q('select * from users where user_id = $1', [id])).length, 1);
  } finally {
    await q('drop table extra_blocker');
  }
});

// ===== Database problems =====

test('no DATABASE_URL is 503 "Database not configured"', async () => {
  const server = await startApi({ ENABLE_USER_ADMIN_API: '1' });
  for (const [method, path] of [['GET', '/api/users'], ['GET', '/api/db/desks'], ['DELETE', `/api/users/${MISSING}`]]) {
    const res = await call(path, { method }, server);
    assert.equal(res.status, 503, `${method} ${path}`);
    assert.deepEqual(await res.json(), { error: 'Database not configured' });
  }
  assert.equal((await send('POST', '/api/users', { name: 'A', email: 'a@x.dk', role: 'admin' }, server)).status, 503);
  assert.equal((await call('/api/nope', {}, server)).status, 404); // other /api URLs still 404
});

test('database down is 503, password and host nowhere (answer, logs)', async () => {
  const dead = await freePort(); // nothing listens on it
  const server = await startApi({
    ENABLE_USER_ADMIN_API: '1',
    DATABASE_URL: `postgresql://user:secretpw123@127.0.0.1:${dead}/postgres`,
  });
  for (const [method, path] of [['GET', '/api/users'], ['GET', '/api/db/desks'], ['DELETE', `/api/users/${MISSING}`]]) {
    const res = await call(path, { method }, server);
    assert.equal(res.status, 503, `${method} ${path}`);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: 'Database not reachable' });
    assert.ok(!text.includes('secretpw123'));
  }
  const created = await send('POST', '/api/users', { name: 'A', email: 'a@x.dk', role: 'admin' }, server);
  assert.equal(created.status, 503);
  assert.ok(server.out.includes('Users API error'), 'expected a log line');
  assert.ok(!server.out.includes('secretpw123'), 'database password found in the server logs');
});
