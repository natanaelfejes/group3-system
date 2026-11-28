// ===== errors table =====
// Faults reported for a desk (desk_id is the desks row, not the MAC address). They are deleted
// with their desk (cascade).
import { pool } from '../db.js';
import { rows, first, deleteRow } from './helpers.js';

// Newest first. limit is optional (e.g. 50 for the maintenance page).
export const getAllErrors = ({ limit = null } = {}, db = pool) =>
  rows(db, 'select * from errors order by created_at desc, error_id limit $1', [limit]);

export const getErrorsByDesk = (deskId, db = pool) =>
  rows(db, 'select * from errors where desk_id = $1 order by created_at desc, error_id', [deskId]);

// Returns the new row.
export const logError = (deskId, description, db = pool) =>
  first(db, 'insert into errors (desk_id, description) values ($1, $2) returning *', [deskId, description]);

export const deleteError = (errorId, db = pool) => deleteRow(db, 'errors', 'error_id', errorId);
