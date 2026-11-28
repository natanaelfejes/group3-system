// ===== health table =====
// A log of when a user sat down or stood up. position is 'sitting' or 'standing' (check constraint).
import { pool } from '../db.js';
import { rows, first } from './helpers.js';

export const getAllHealth = (db = pool) => rows(db, 'select * from health order by recorded_at desc');

// The user's rows, newest first. from / to (Date or ISO string) are optional and inclusive.
export const getHealthByUser = (userId, { from = null, to = null } = {}, db = pool) =>
  rows(
    db,
    `select * from health where user_id = $1
       and ($2::timestamptz is null or recorded_at >= $2)
       and ($3::timestamptz is null or recorded_at <= $3)
     order by recorded_at desc`,
    [userId, from, to],
  );

// Logs that the user is now sitting or standing. Returns the new row.
export const recordPosition = (userId, position, db = pool) =>
  first(db, 'insert into health (user_id, position) values ($1, $2) returning *', [userId, position]);
