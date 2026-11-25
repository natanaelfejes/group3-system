// ===== Database connection (Supabase Postgres) =====
// DATABASE_URL comes from .env (see backend/README.md). Without it the API still runs,
// it just has no database yet (the simulator endpoints don't need one).
import pg from 'pg';

const { DATABASE_URL } = process.env;

// Remote databases use TLS. The certificate is not checked yet because Supabase signs it with
// its own CA, which Node doesn't know. That stops sniffing but not a man-in-the-middle.
// TODO: add Supabase's CA file and turn the check on.
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])([:/?]|$)/.test(DATABASE_URL ?? '');

export const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 2000,
    })
  : null;

// An idle connection can die (DB restarts). Log only the message: errors can mention the host.
pool?.on('error', (err) => console.error(`Database connection error: ${err.message}`));

// 'ok', 'not configured' (no DATABASE_URL) or throws if the database can't be reached.
// The timeout is for a database that accepts the connection but never answers.
export async function checkDb() {
  if (!pool) return 'not configured';
  await pool.query({ text: 'select 1', query_timeout: 2000 });
  return 'ok';
}
