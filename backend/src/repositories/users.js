// ===== users table =====
// user_id must be the id of an existing Supabase Auth account (users.user_id references auth.users).
// Until Google login is set up there are no such accounts, so createUser fails with a foreign key
// error (23503) for a made-up id. Deleting the auth account deletes the users row too (cascade).
import { pool } from '../db.js';
import { rows, first, insertRow, updateRow, deleteRow } from './helpers.js';

const CREATE = ['user_id', 'name', 'email', 'role'];
const UPDATE = ['name', 'email', 'role'];

export const getAllUsers = (db = pool) => rows(db, 'select * from users order by name, user_id');

export const getUserById = (userId, db = pool) => first(db, 'select * from users where user_id = $1', [userId]);

// Emails are compared without letter case: Amy@X.dk finds amy@x.dk.
export const getUserByEmail = (email, db = pool) =>
  first(db, 'select * from users where lower(email) = lower($1)', [email]);

// { user_id, name, email, role? } -> the new row. role defaults to 'worker'.
export const createUser = (user, db = pool) => insertRow(db, 'users', CREATE, user);

// { name?, email?, role? } -> the changed row, or null if there is no such user.
export const updateUser = (userId, changes, db = pool) => updateRow(db, 'users', 'user_id', userId, UPDATE, changes);

// Deletes the profile row only. The database also deletes the user's presets, routines and health
// rows and frees their desk. The Supabase Auth account stays, so the real delete should remove that
// account instead (once login is set up). True if a user was deleted.
export const deleteUser = (userId, db = pool) => deleteRow(db, 'users', 'user_id', userId);
