// Tests for the table functions in src/repositories/. Run with: npm test (in backend/)
// Like users.test.js they need a throwaway Postgres on localhost whose name ends in _test, set in
// TEST_DATABASE_URL (see the top of users.test.js), and they are skipped without it.
// They build the real tables from test/schema.sql in their own Postgres schema (repo_test), so they don't
// clash with users.test.js, which runs at the same time on the same database. auth.users is a stand-in
// for Supabase's login table.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { testDbProblem } from './testDb.js';
import * as users from '../src/repositories/users.js';
import * as desks from '../src/repositories/desks.js';
import * as presets from '../src/repositories/presets.js';
import * as routines from '../src/repositories/routines.js';
import * as health from '../src/repositories/health.js';
import * as errors from '../src/repositories/errors.js';

const DB_URL = process.env.TEST_DATABASE_URL;
const SKIP = DB_URL ? false : 'TEST_DATABASE_URL is not set (needs a throwaway Postgres on localhost)';
const dbTest = (name, fn) => test(name, { skip: SKIP }, fn);
const SCHEMA = 'repo_test';
const MISSING = '99999999-9999-4999-8999-999999999999';

let db; // pool whose search_path is repo_test, passed as the last argument of every function

// pg error codes
const DUPLICATE = { code: '23505' };
const NO_SUCH_ROW = { code: '23503' }; // foreign key
const CHECK_FAILED = { code: '23514' };

before(async () => {
  if (SKIP) return;
  const problem = testDbProblem(DB_URL);
  if (problem) throw new Error(`refusing to drop tables: ${problem}`);
  const admin = new pg.Client({ connectionString: DB_URL });
  await admin.connect();
  try {
    await admin.query(`
      drop schema if exists ${SCHEMA} cascade;
      create schema ${SCHEMA};
      create schema if not exists auth;
      create table if not exists auth.users (id uuid primary key default gen_random_uuid());
    `);
  } finally {
    await admin.end();
  }
  db = new pg.Pool({ connectionString: DB_URL, options: `-c search_path=${SCHEMA}`, max: 3 });
  await db.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
});

beforeEach(async () => {
  if (SKIP) return;
  // auth.users -> users -> every other table, all through cascading foreign keys
  await db.query('truncate auth.users, desks cascade');
});

after(async () => {
  await db?.end();
});

// A login account plus its users row, like an admin creating someone once login works.
async function addUser(name = 'Amy', role = 'worker') {
  const { rows } = await db.query('insert into auth.users default values returning id');
  return users.createUser({ user_id: rows[0].id, name, email: `${name.toLowerCase()}@x.dk`, role }, db);
}

// ===== Without a database =====

test('without DATABASE_URL the functions say the database is not configured', { skip: !!process.env.DATABASE_URL }, async () => {
  await assert.rejects(users.getAllUsers(), /Database not configured/);
  await assert.rejects(presets.createPreset({ user_id: MISSING, position_name: 'Sit', value: 70 }), /Database not configured/);
});

// ===== users =====

dbTest('users: create, get, update, delete', async () => {
  const zed = await addUser('Zed', 'admin');
  const amy = await addUser('Amy');
  assert.deepEqual([amy.name, amy.email, amy.role], ['Amy', 'amy@x.dk', 'worker']);
  assert.ok(amy.created_at instanceof Date);

  assert.deepEqual((await users.getAllUsers(db)).map((u) => u.name), ['Amy', 'Zed']);
  assert.equal((await users.getUserById(zed.user_id, db)).role, 'admin');
  assert.equal((await users.getUserByEmail('AMY@X.DK', db)).user_id, amy.user_id);
  assert.equal(await users.getUserById(MISSING, db), null);

  const changed = await users.updateUser(amy.user_id, { role: 'maintenance_worker' }, db);
  assert.deepEqual([changed.role, changed.name], ['maintenance_worker', 'Amy']);
  assert.equal(await users.updateUser(MISSING, { name: 'X' }, db), null);

  assert.equal(await users.deleteUser(amy.user_id, db), true);
  assert.equal(await users.deleteUser(amy.user_id, db), false);
  assert.equal((await users.getAllUsers(db)).length, 1);
});

dbTest('users: needs a login account, unique email, valid role', async () => {
  await assert.rejects(users.createUser({ user_id: MISSING, name: 'Amy', email: 'a@x.dk' }, db), NO_SUCH_ROW);
  const amy = await addUser('Amy');
  const { rows } = await db.query('insert into auth.users default values returning id');
  await assert.rejects(users.createUser({ user_id: rows[0].id, name: 'Other', email: 'amy@x.dk' }, db), DUPLICATE);
  await assert.rejects(users.updateUser(amy.user_id, { role: 'boss' }, db), CHECK_FAILED);
});

dbTest('a typo in a column name or an empty update throws before touching the database', async () => {
  const amy = await addUser('Amy');
  await assert.rejects(users.updateUser(amy.user_id, { nmae: 'X' }, db), /unknown column\(s\): nmae/);
  await assert.rejects(users.updateUser(amy.user_id, {}, db), /nothing to update/);
  await assert.rejects(users.updateUser(amy.user_id, { name: undefined }, db), /nothing to update/);
  // user_id can't be changed through updateUser
  await assert.rejects(users.updateUser(amy.user_id, { user_id: MISSING }, db), /unknown column/);
});

dbTest('deleting the login account deletes the user and everything that is theirs', async () => {
  const amy = await addUser('Amy');
  const desk = await desks.createDesk({ manufacturer: 'Linak', user_id: amy.user_id }, db);
  await presets.createPreset({ user_id: amy.user_id, position_name: 'Sit', value: 70 }, db);
  await health.recordPosition(amy.user_id, 'sitting', db);
  await db.query('delete from auth.users where id = $1', [amy.user_id]);
  assert.equal(await users.getUserById(amy.user_id, db), null);
  assert.deepEqual(await presets.getAllPresets(db), []);
  assert.deepEqual(await health.getAllHealth(db), []);
  assert.equal((await desks.getDeskById(desk.desk_id, db)).user_id, null); // desk is kept, just free
});

// ===== desks =====

dbTest('desks: create, find by MAC (any case) and by user, update, delete', async () => {
  const amy = await addUser('Amy');
  const desk = await desks.createDesk({ manufacturer: 'Linak', mac_address: 'CD:FB:1A:53:FB:E6' }, db);
  assert.equal(desk.mac_address, 'cd:fb:1a:53:fb:e6');
  assert.equal(desk.user_id, null);
  assert.equal((await desks.getDeskByMac('Cd:Fb:1a:53:fB:e6', db)).desk_id, desk.desk_id);
  assert.equal(await desks.getDeskByMac('00:00:00:00:00:00', db), null);

  await desks.updateDesk(desk.desk_id, { user_id: amy.user_id, last_height: 1000 }, db);
  const mine = await desks.getDeskByUser(amy.user_id, db);
  assert.deepEqual([mine.desk_id, mine.last_height], [desk.desk_id, 1000]);

  assert.equal((await desks.updateDesk(desk.desk_id, { user_id: null }, db)).user_id, null);
  assert.equal(await desks.getDeskByUser(amy.user_id, db), null);

  await desks.createDesk({ manufacturer: 'Flexispot' }, db); // MAC is optional for now
  assert.equal((await desks.getAllDesks(db)).length, 2);
  assert.equal(await desks.deleteDesk(desk.desk_id, db), true);
  assert.equal((await desks.getAllDesks(db)).length, 1);
});

dbTest('desks: bad or duplicate MAC, second desk for the same user', async () => {
  const amy = await addUser('Amy');
  await assert.rejects(desks.createDesk({ manufacturer: 'Linak', mac_address: 'cd-fb-1a-53-fb-e6' }, db), CHECK_FAILED);
  await desks.createDesk({ manufacturer: 'Linak', mac_address: 'cd:fb:1a:53:fb:e6', user_id: amy.user_id }, db);
  await assert.rejects(desks.createDesk({ manufacturer: 'Linak', mac_address: 'CD:FB:1A:53:FB:E6' }, db), DUPLICATE);
  await assert.rejects(desks.createDesk({ manufacturer: 'Linak', user_id: amy.user_id }, db), DUPLICATE);
});

// ===== presets =====

dbTest('presets: create, list per user ordered by height, update, delete', async () => {
  const amy = await addUser('Amy');
  const bob = await addUser('Bob');
  const stand = await presets.createPreset({ user_id: amy.user_id, position_name: 'Stand', value: 110 }, db);
  await presets.createPreset({ user_id: amy.user_id, position_name: 'Sit', value: 72 }, db);
  await presets.createPreset({ user_id: bob.user_id, position_name: 'Sit', value: 75 }, db);

  assert.deepEqual((await presets.getPresetsByUser(amy.user_id, db)).map((p) => p.value), [72, 110]);
  assert.equal((await presets.getAllPresets(db)).length, 3);

  const changed = await presets.updatePreset(stand.preset_id, { value: 115 }, db);
  assert.deepEqual([changed.value, changed.position_name], [115, 'Stand']);
  assert.equal((await presets.getPresetById(stand.preset_id, db)).value, 115);
  await assert.rejects(presets.updatePreset(stand.preset_id, { user_id: bob.user_id }, db), /unknown column/);

  assert.equal(await presets.deletePreset(stand.preset_id, db), true);
  assert.equal(await presets.getPresetById(stand.preset_id, db), null);
});

dbTest('presets: value must be 50 to 160, user must exist', async () => {
  const amy = await addUser('Amy');
  for (const value of [49, 161]) {
    await assert.rejects(presets.createPreset({ user_id: amy.user_id, position_name: 'X', value }, db), CHECK_FAILED);
  }
  await presets.createPreset({ user_id: amy.user_id, position_name: 'Low', value: 50 }, db);
  await presets.createPreset({ user_id: amy.user_id, position_name: 'High', value: 160 }, db);
  await assert.rejects(presets.createPreset({ user_id: MISSING, position_name: 'X', value: 70 }, db), NO_SUCH_ROW);
});

// ===== routines =====

async function amyWithPresets() {
  const amy = await addUser('Amy');
  const sit = await presets.createPreset({ user_id: amy.user_id, position_name: 'Sit', value: 72 }, db);
  const stand = await presets.createPreset({ user_id: amy.user_id, position_name: 'Stand', value: 110 }, db);
  return { amy, sit, stand };
}

const routine = (userId, name, extra = {}) => ({ user_id: userId, routine_name: name, sit_minutes: 45, stand_minutes: 15, ...extra });

dbTest('routines: create, get, update, delete', async () => {
  const { amy, sit, stand } = await amyWithPresets();
  const r = await routines.createRoutine(
    routine(amy.user_id, 'Workday', { sitting_preset_id: sit.preset_id, standing_preset_id: stand.preset_id }),
    db,
  );
  assert.deepEqual([r.routine_name, r.sit_minutes, r.stand_minutes, r.is_active], ['Workday', 45, 15, false]);
  assert.equal(r.sitting_preset_id, sit.preset_id);

  await routines.createRoutine(routine(amy.user_id, 'No presets'), db);
  assert.deepEqual((await routines.getRoutinesByUser(amy.user_id, db)).map((x) => x.routine_name), ['Workday', 'No presets']);
  assert.equal((await routines.getAllRoutines(db)).length, 2);

  const changed = await routines.updateRoutine(r.routine_id, { stand_minutes: 20, standing_preset_id: null }, db);
  assert.deepEqual([changed.stand_minutes, changed.standing_preset_id, changed.sit_minutes], [20, null, 45]);
  assert.equal(await routines.updateRoutine(MISSING, { sit_minutes: 1 }, db), null);
  assert.equal(await routines.updateRoutine(MISSING, { sitting_preset_id: sit.preset_id }, db), null);

  assert.equal(await routines.deleteRoutine(r.routine_id, db), true);
  assert.equal(await routines.getRoutineById(r.routine_id, db), null);
});

dbTest('routines: another user\'s preset or a missing preset is refused', async () => {
  const { amy, sit } = await amyWithPresets();
  const bob = await addUser('Bob');
  const bobs = await presets.createPreset({ user_id: bob.user_id, position_name: 'Sit', value: 80 }, db);

  await assert.rejects(
    routines.createRoutine(routine(amy.user_id, 'R', { sitting_preset_id: bobs.preset_id }), db),
    routines.PresetNotOwnedError,
  );
  await assert.rejects(
    routines.createRoutine(routine(amy.user_id, 'R', { standing_preset_id: MISSING }), db),
    routines.PresetNotOwnedError,
  );
  const r = await routines.createRoutine(routine(amy.user_id, 'R', { sitting_preset_id: sit.preset_id, standing_preset_id: sit.preset_id }), db);
  await assert.rejects(routines.updateRoutine(r.routine_id, { standing_preset_id: bobs.preset_id }, db), routines.PresetNotOwnedError);
  assert.equal((await routines.getRoutineById(r.routine_id, db)).standing_preset_id, sit.preset_id);
});

dbTest('routines: duplicate name per user, minutes must be positive, is_active not settable directly', async () => {
  const amy = await addUser('Amy');
  const bob = await addUser('Bob');
  await routines.createRoutine(routine(amy.user_id, 'Workday'), db);
  await assert.rejects(routines.createRoutine(routine(amy.user_id, 'Workday'), db), DUPLICATE);
  await routines.createRoutine(routine(bob.user_id, 'Workday'), db); // other user, same name is fine
  await assert.rejects(routines.createRoutine(routine(amy.user_id, 'Zero', { sit_minutes: 0 }), db), CHECK_FAILED);
  await assert.rejects(routines.createRoutine(routine(amy.user_id, 'X', { is_active: true }), db), /unknown column/);
});

dbTest('routines: only one active per user, setActiveRoutine switches', async () => {
  const amy = await addUser('Amy');
  const bob = await addUser('Bob');
  const a = await routines.createRoutine(routine(amy.user_id, 'A'), db);
  const b = await routines.createRoutine(routine(amy.user_id, 'B'), db);
  const bobs = await routines.createRoutine(routine(bob.user_id, 'A'), db);
  assert.equal(await routines.getActiveRoutine(amy.user_id, db), null);

  assert.equal((await routines.setActiveRoutine(a.routine_id, db)).is_active, true);
  await routines.setActiveRoutine(bobs.routine_id, db);
  await routines.setActiveRoutine(b.routine_id, db);
  assert.equal((await routines.getActiveRoutine(amy.user_id, db)).routine_id, b.routine_id);
  assert.equal((await routines.getRoutineById(a.routine_id, db)).is_active, false);
  assert.equal((await routines.getActiveRoutine(bob.user_id, db)).routine_id, bobs.routine_id); // Bob untouched

  // setting the same one again is fine
  assert.equal((await routines.setActiveRoutine(b.routine_id, db)).is_active, true);
  assert.equal(await routines.setActiveRoutine(MISSING, db), null);

  // the database itself refuses a second active routine
  await assert.rejects(db.query('update routines set is_active = true where routine_id = $1', [a.routine_id]), DUPLICATE);

  assert.equal((await routines.deactivateRoutine(b.routine_id, db)).is_active, false);
  assert.equal(await routines.getActiveRoutine(amy.user_id, db), null);
  assert.equal(await routines.deactivateRoutine(MISSING, db), null);
});

dbTest('routines: switching at the same time for one user leaves exactly one active', async () => {
  const amy = await addUser('Amy');
  const list = await Promise.all(['A', 'B', 'C'].map((n) => routines.createRoutine(routine(amy.user_id, n), db)));
  await Promise.all(list.map((r) => routines.setActiveRoutine(r.routine_id, db)));
  const active = (await routines.getRoutinesByUser(amy.user_id, db)).filter((r) => r.is_active);
  assert.equal(active.length, 1);
});

dbTest('routines: deleting a preset keeps the routine, without that preset', async () => {
  const { amy, sit, stand } = await amyWithPresets();
  const r = await routines.createRoutine(
    routine(amy.user_id, 'R', { sitting_preset_id: sit.preset_id, standing_preset_id: stand.preset_id }),
    db,
  );
  await presets.deletePreset(sit.preset_id, db);
  const after = await routines.getRoutineById(r.routine_id, db);
  assert.deepEqual([after.sitting_preset_id, after.standing_preset_id], [null, stand.preset_id]);
});

// ===== health =====

dbTest('health: record, list newest first, filter by time', async () => {
  const amy = await addUser('Amy');
  const bob = await addUser('Bob');
  const row = await health.recordPosition(amy.user_id, 'standing', db);
  assert.equal(row.position, 'standing');
  assert.ok(row.recorded_at instanceof Date);

  await db.query('truncate health');
  await db.query(
    `insert into health (user_id, position, recorded_at) values
       ($1, 'sitting', '2026-11-01T08:00Z'), ($1, 'standing', '2026-11-01T09:00Z'),
       ($1, 'sitting', '2026-11-02T08:00Z'), ($2, 'sitting', '2026-11-01T08:30Z')`,
    [amy.user_id, bob.user_id],
  );
  const times = (list) => list.map((h) => h.recorded_at.toISOString());
  assert.deepEqual(times(await health.getHealthByUser(amy.user_id, {}, db)), [
    '2026-11-02T08:00:00.000Z',
    '2026-11-01T09:00:00.000Z',
    '2026-11-01T08:00:00.000Z',
  ]);
  const nov1 = await health.getHealthByUser(amy.user_id, { from: '2026-11-01T08:00Z', to: new Date('2026-11-01T09:00Z') }, db);
  assert.deepEqual(times(nov1), ['2026-11-01T09:00:00.000Z', '2026-11-01T08:00:00.000Z']);
  assert.equal((await health.getAllHealth(db)).length, 4);
  await assert.rejects(health.recordPosition(amy.user_id, 'lying', db), CHECK_FAILED);
});

// ===== errors =====

dbTest('errors: log, list newest first with a limit, per desk, delete, removed with the desk', async () => {
  const d1 = await desks.createDesk({ manufacturer: 'Linak' }, db);
  const d2 = await desks.createDesk({ manufacturer: 'Linak' }, db);
  const logged = await errors.logError(d1.desk_id, 'Collision', db);
  assert.equal(logged.description, 'Collision');
  await db.query(
    `insert into errors (desk_id, description, created_at) values
       ($1, 'old', '2026-01-01T00:00Z'), ($2, 'other desk', '2026-06-01T00:00Z')`,
    [d1.desk_id, d2.desk_id],
  );
  assert.deepEqual((await errors.getAllErrors({}, db)).map((e) => e.description), ['Collision', 'other desk', 'old']);
  assert.deepEqual((await errors.getAllErrors({ limit: 2 }, db)).map((e) => e.description), ['Collision', 'other desk']);
  assert.deepEqual((await errors.getErrorsByDesk(d1.desk_id, db)).map((e) => e.description), ['Collision', 'old']);
  await assert.rejects(errors.logError(MISSING, 'x', db), NO_SUCH_ROW);

  assert.equal(await errors.deleteError(logged.error_id, db), true);
  await desks.deleteDesk(d1.desk_id, db);
  assert.deepEqual((await errors.getAllErrors({}, db)).map((e) => e.description), ['other desk']);
});
