import { Router } from 'express';
import { pool } from '../db.js';

// ===== User admin endpoints: /api/users and /api/db/desks =====
// Only mounted when ENABLE_USER_ADMIN_API=1 (see server.js). There is no authentication yet.
// Errors: the routes throw HttpError (or a pg error) and the error handler at the bottom of this
// file turns it into JSON {error}. It never sends SQL or connection details, and logs err.message only.
export const usersRouter = Router();

const ROLES = ['admin', 'worker', 'maintenance_worker'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// One user as the API shows it. desk_id is the desk whose desks.user_id is this user (or null).
const USER_SQL = `select u.user_id, u.name, u.email, u.role, u.created_at,
  (select d.desk_id from desks d where d.user_id = u.user_id order by d.desk_id limit 1) as desk_id
  from users u`;

// Runs fn(client) inside one transaction.
async function tx(fn) {
  const client = await pool.connect();
  let broken = null;
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch((rollbackErr) => (broken = rollbackErr));
    throw err;
  } finally {
    client.release(broken ?? undefined); // an error here makes the pool drop the connection
  }
}

const getUser = async (client, userId) => (await client.query(`${USER_SQL} where u.user_id = $1`, [userId])).rows[0];

// Locks the desk row. 404 if it doesn't exist, 409 if somebody other than userId has it.
async function lockFreeDesk(client, deskId, userId = null) {
  const { rows } = await client.query('select user_id from desks where desk_id = $1 for update', [deskId]);
  if (!rows.length) throw new HttpError(404, 'Desk not found');
  if (rows[0].user_id && rows[0].user_id !== userId) throw new HttpError(409, 'Desk is already taken');
}

// Locks the user row or throws 404.
async function lockUser(client, userId) {
  const { rows } = await client.query('select user_id from users where user_id = $1 for update', [userId]);
  if (!rows.length) throw new HttpError(404, 'User not found');
}

const isObject = (b) => b !== null && typeof b === 'object' && !Array.isArray(b);
const isUuid = (v) => typeof v === 'string' && UUID.test(v);

function checkRole(role) {
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(', ')}`);
}

// No pool = no DATABASE_URL. Only for our own paths: the router is mounted on /api, other /api URLs must still 404.
usersRouter.use(['/users', '/db/desks'], (_req, _res, next) => {
  next(pool ? undefined : new HttpError(503, 'Database not configured'));
});

usersRouter.get('/users', async (_req, res, next) => {
  try {
    res.json((await pool.query(`${USER_SQL} order by u.name, u.created_at`)).rows);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/db/desks', async (_req, res, next) => {
  try {
    res.json((await pool.query('select desk_id, manufacturer, user_id from desks order by manufacturer, desk_id')).rows);
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/users', async (req, res, next) => {
  try {
    // no JSON content type = express.json leaves req.body undefined
    if (!isObject(req.body)) throw new HttpError(400, 'Send a JSON body (Content-Type: application/json)');
    const { role, desk_id } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    if (name.length < 1 || name.length > 100) throw new HttpError(400, 'name must be 1 to 100 characters');
    if (email.length > 254 || !EMAIL.test(email)) throw new HttpError(400, 'email is not valid');
    checkRole(role);
    if (desk_id != null && !isUuid(desk_id)) throw new HttpError(400, 'desk_id must be a uuid or null');

    const user = await tx(async (client) => {
      // One at a time, so two requests can't both pass the email check (we can't see a lower(email) index in production).
      await client.query("select pg_advisory_xact_lock(hashtext('users.email'))");
      if (desk_id != null) await lockFreeDesk(client, desk_id.toLowerCase());
      const dup = await client.query('select 1 from users where lower(email) = lower($1)', [email]);
      if (dup.rows.length) throw new HttpError(409, 'Email already exists');
      const { rows } = await client.query(
        'insert into users (user_id, name, email, role, created_at) values (gen_random_uuid(), $1, $2, $3, now()) returning user_id',
        [name, email, role],
      );
      const userId = rows[0].user_id;
      if (desk_id != null) await client.query('update desks set user_id = $1 where desk_id = $2', [userId, desk_id.toLowerCase()]);
      return getUser(client, userId);
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/users/:user_id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.user_id)) throw new HttpError(400, 'user_id must be a uuid');
    if (!isObject(req.body)) throw new HttpError(400, 'Send a JSON body (Content-Type: application/json)');
    const keys = Object.keys(req.body);
    if (!keys.length || keys.some((k) => k !== 'role' && k !== 'desk_id')) {
      throw new HttpError(400, 'Send role and/or desk_id');
    }
    const { role, desk_id } = req.body;
    if ('role' in req.body) checkRole(role);
    if ('desk_id' in req.body && desk_id !== null && !isUuid(desk_id)) throw new HttpError(400, 'desk_id must be a uuid or null');

    const userId = req.params.user_id.toLowerCase();
    const user = await tx(async (client) => {
      await lockUser(client, userId);
      if ('desk_id' in req.body) {
        const deskId = desk_id?.toLowerCase() ?? null;
        if (deskId) await lockFreeDesk(client, deskId, userId);
        // a user has at most one desk: free the old one (all of them if desk_id is null)
        await client.query('update desks set user_id = null where user_id = $1 and desk_id is distinct from $2', [userId, deskId]);
        if (deskId) await client.query('update desks set user_id = $1 where desk_id = $2', [userId, deskId]);
      }
      if ('role' in req.body) await client.query('update users set role = $1 where user_id = $2', [role, userId]);
      return getUser(client, userId);
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.delete('/users/:user_id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.user_id)) throw new HttpError(400, 'user_id must be a uuid');
    const userId = req.params.user_id.toLowerCase();
    await tx(async (client) => {
      await lockUser(client, userId);
      await client.query('update desks set user_id = null where user_id = $1', [userId]);
      // routines reference presets, so they go first
      for (const table of ['routines', 'presets', 'health']) {
        await client.query(`delete from ${table} where user_id = $1`, [userId]);
      }
      await client.query('delete from users where user_id = $1', [userId]);
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Database unreachable: connection errors, Postgres "shutting down" (57P), "too many connections" (53), connection class (08)
const DB_DOWN_CODE = /^(08|53|57P)|^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|EAI_AGAIN)$/;
const DB_DOWN_MESSAGE = /timeout exceeded when trying to connect|Connection terminated|connection error/i;

usersRouter.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'Email already exists or desk already taken' });
  // Only the message: pg errors and the pool can mention the host, never log the whole error.
  console.error(`Users API error: ${err.message}`);
  if (DB_DOWN_CODE.test(err.code ?? '') || DB_DOWN_MESSAGE.test(err.message)) {
    return res.status(503).json({ error: 'Database not reachable' });
  }
  res.status(500).json({ error: 'Internal server error' });
});
