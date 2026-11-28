// ===== routines table =====
// A sit/stand cycle. A user can have only one active routine (unique index on user_id where is_active),
// so is_active is only changed through setActiveRoutine / deactivateRoutine, never through create/update.
// routine_name is unique per user (23505 on a duplicate). The two presets are optional and must be the
// same user's presets; the database doesn't check that, so createRoutine/updateRoutine do.
import { pool } from '../db.js';
import { rows, first, insertRow, updateRow, deleteRow, transaction } from './helpers.js';

const EDITABLE = ['routine_name', 'sit_minutes', 'stand_minutes', 'sitting_preset_id', 'standing_preset_id'];

// Thrown when a routine points at a preset that doesn't exist or belongs to another user.
export class PresetNotOwnedError extends Error {
  constructor() {
    super('Preset not found for this user');
    this.name = 'PresetNotOwnedError';
  }
}

async function checkPresetsBelongTo(db, userId, data) {
  const ids = [...new Set([data.sitting_preset_id, data.standing_preset_id].filter((id) => id != null))];
  if (!ids.length) return;
  const { n } = await first(
    db,
    'select count(*)::int as n from presets where user_id = $1 and preset_id = any($2::uuid[])',
    [userId, ids],
  );
  if (n !== ids.length) throw new PresetNotOwnedError();
}

export const getAllRoutines = (db = pool) => rows(db, 'select * from routines order by user_id, created_at');

export const getRoutinesByUser = (userId, db = pool) =>
  rows(db, 'select * from routines where user_id = $1 order by created_at', [userId]);

export const getRoutineById = (routineId, db = pool) =>
  first(db, 'select * from routines where routine_id = $1', [routineId]);

// The user's active routine, or null.
export const getActiveRoutine = (userId, db = pool) =>
  first(db, 'select * from routines where user_id = $1 and is_active', [userId]);

// { user_id, routine_name, sit_minutes, stand_minutes, sitting_preset_id?, standing_preset_id? }
// -> the new row (not active). Throws PresetNotOwnedError for another user's preset.
export async function createRoutine(routine, db = pool) {
  await checkPresetsBelongTo(db, routine?.user_id, routine ?? {});
  return insertRow(db, 'routines', ['user_id', ...EDITABLE], routine);
}

// Any of EDITABLE -> the changed row, or null if there is no such routine.
export async function updateRoutine(routineId, changes, db = pool) {
  if (changes?.sitting_preset_id != null || changes?.standing_preset_id != null) {
    const routine = await getRoutineById(routineId, db);
    if (!routine) return null;
    await checkPresetsBelongTo(db, routine.user_id, changes);
  }
  return updateRow(db, 'routines', 'routine_id', routineId, EDITABLE, changes);
}

// Makes this routine the user's active one and switches their other routines off, in one transaction.
// Returns the routine, or null if it doesn't exist.
export function setActiveRoutine(routineId, db = pool) {
  return transaction(db, async (client) => {
    const routine = await first(client, 'select user_id from routines where routine_id = $1', [routineId]);
    if (!routine) return null;
    // Locking the user's row makes two calls for the same user wait for each other instead of
    // both turning a routine on and one of them failing on the unique index.
    await client.query('select 1 from users where user_id = $1 for update', [routine.user_id]);
    await client.query('update routines set is_active = false where user_id = $1 and is_active and routine_id <> $2', [
      routine.user_id,
      routineId,
    ]);
    return first(client, 'update routines set is_active = true where routine_id = $1 returning *', [routineId]);
  });
}

// Returns the routine (now inactive), or null.
export const deactivateRoutine = (routineId, db = pool) =>
  first(db, 'update routines set is_active = false where routine_id = $1 returning *', [routineId]);

export const deleteRoutine = (routineId, db = pool) => deleteRow(db, 'routines', 'routine_id', routineId);
