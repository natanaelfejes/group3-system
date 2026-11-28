// ===== desks table =====
// mac_address links a row to the real desk: it is the id the simulator and the Pico use
// (e.g. cd:fb:1a:53:fb:e6). The database only accepts lowercase, so these functions lowercase it.
// user_id is unique: a user has at most one desk. Deleting a desk deletes its errors (cascade).
import { pool } from '../db.js';
import { rows, first, insertRow, updateRow, deleteRow } from './helpers.js';

const COLUMNS = ['manufacturer', 'mac_address', 'user_id', 'last_height'];

const lowerMac = (data) =>
  typeof data?.mac_address === 'string' ? { ...data, mac_address: data.mac_address.toLowerCase() } : data;

export const getAllDesks = (db = pool) => rows(db, 'select * from desks order by mac_address, desk_id');

export const getDeskById = (deskId, db = pool) => first(db, 'select * from desks where desk_id = $1', [deskId]);

export const getDeskByMac = (mac, db = pool) =>
  first(db, 'select * from desks where mac_address = $1', [String(mac).toLowerCase()]);

// The desk assigned to this user, or null.
export const getDeskByUser = (userId, db = pool) => first(db, 'select * from desks where user_id = $1', [userId]);

// { manufacturer, mac_address?, user_id?, last_height? } -> the new row.
export const createDesk = (desk, db = pool) => insertRow(db, 'desks', COLUMNS, lowerMac(desk));

// Any of the columns above. { user_id: null } frees the desk. Returns the changed row, or null.
export const updateDesk = (deskId, changes, db = pool) =>
  updateRow(db, 'desks', 'desk_id', deskId, COLUMNS, lowerMac(changes));

export const deleteDesk = (deskId, db = pool) => deleteRow(db, 'desks', 'desk_id', deskId);
