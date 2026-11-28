// Shared by the tests that use a real Postgres (TEST_DATABASE_URL). Not a test file itself.
import pg from 'pg';

// Why TEST_DATABASE_URL is not safe to wipe, or null if it is. Reads the URL the way pg does
// (pg-connection-string): ?host= in the query overrides the host in the URL, so new URL() is not enough.
export function testDbProblem(url) {
  let client;
  try {
    client = new pg.Client({ connectionString: url });
  } catch {
    return 'TEST_DATABASE_URL is not a valid connection string';
  }
  const { host, database } = client;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) return `host is ${host}, it must be localhost, 127.0.0.1 or ::1`;
  if (!database?.endsWith('_test')) return `database is ${database}, its name must end in _test`;
  return null;
}
