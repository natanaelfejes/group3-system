// ===== presets table =====
// A user's saved desk heights. The database only accepts value 50 to 160 (check constraint).
// Deleting a preset sets the routines that used it to null for that phase (on delete set null).
import { pool } from '../db.js';
import { rows, first, insertRow, updateRow, deleteRow } from './helpers.js';

export const getAllPresets = (db = pool) => rows(db, 'select * from presets order by user_id, value, position_name');

export const getPresetsByUser = (userId, db = pool) =>
  rows(db, 'select * from presets where user_id = $1 order by value, position_name', [userId]);

export const getPresetById = (presetId, db = pool) =>
  first(db, 'select * from presets where preset_id = $1', [presetId]);

// { user_id, position_name, value } -> the new row.
export const createPreset = (preset, db = pool) =>
  insertRow(db, 'presets', ['user_id', 'position_name', 'value'], preset);

// { position_name?, value? } -> the changed row, or null. The owner can't be changed.
export const updatePreset = (presetId, changes, db = pool) =>
  updateRow(db, 'presets', 'preset_id', presetId, ['position_name', 'value'], changes);

export const deletePreset = (presetId, db = pool) => deleteRow(db, 'presets', 'preset_id', presetId);
