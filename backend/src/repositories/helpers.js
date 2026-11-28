// ===== Shared code for the table functions in this folder =====
// Every table function takes the database as its LAST argument, `db`. Leave it out to use the shared
// pool from db.js. Pass a pg.Pool (tests) or a client from pool.connect() (inside your own transaction).
// Database errors are not caught here: a broken constraint throws the pg error, with its .code
// (23505 duplicate, 23503 missing foreign key, 23514 check failed). Routes turn those into HTTP answers.
import pg from 'pg';

// Runs one query and returns its rows.
export async function rows(db, text, params) {
  if (!db) throw new Error('Database not configured');
  return (await db.query(text, params)).rows;
}

// Runs one query and returns its first row, or null.
export async function first(db, text, params) {
  return (await rows(db, text, params))[0] ?? null;
}

// The keys of `data` whose value is not undefined. Throws on a key that is not in `allowed`, so a
// typo like { postion_name } fails loudly instead of being ignored.
function columnsOf(data, allowed) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('expected an object');
  const unknown = Object.keys(data).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new TypeError(`unknown column(s): ${unknown.join(', ')}`);
  return Object.keys(data).filter((key) => data[key] !== undefined);
}

// insert into <table> (...) values (...) returning *. Table and column names only ever come from
// this code (the `allowed` lists), never from a request, so building the SQL from them is safe.
// async so a bad key gives a rejected promise, like a database error, instead of a synchronous throw.
export async function insertRow(db, table, allowed, data) {
  const columns = columnsOf(data, allowed);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  return first(
    db,
    `insert into ${table} (${columns.join(', ')}) values (${placeholders.join(', ')}) returning *`,
    columns.map((c) => data[c]),
  );
}

// update <table> set ... where <idColumn> = id returning *. Returns the changed row, or null if
// there is no row with that id. Only the keys in `changes` are touched; a value of null sets NULL.
export async function updateRow(db, table, idColumn, id, allowed, changes) {
  const columns = columnsOf(changes, allowed);
  if (!columns.length) throw new TypeError('nothing to update');
  const sets = columns.map((c, i) => `${c} = $${i + 2}`);
  return first(
    db,
    `update ${table} set ${sets.join(', ')} where ${idColumn} = $1 returning *`,
    [id, ...columns.map((c) => changes[c])],
  );
}

// delete from <table> where <idColumn> = id. True if a row was deleted.
export async function deleteRow(db, table, idColumn, id) {
  if (!db) throw new Error('Database not configured');
  const { rowCount } = await db.query(`delete from ${table} where ${idColumn} = $1`, [id]);
  return rowCount > 0;
}

// Runs fn(client) in one transaction when db is a pool. When db is already a client, the caller
// owns the transaction, so fn just runs on it.
export async function transaction(db, fn) {
  if (!db) throw new Error('Database not configured');
  if (!(db instanceof pg.Pool)) return fn(db);
  const client = await db.connect();
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
