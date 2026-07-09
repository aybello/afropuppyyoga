import mysql from 'mysql2/promise';
import fs from 'fs';

// New DB URL is read from environment
const NEW_DB_URL = process.env.DATABASE_URL;
if (!NEW_DB_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

function parseUrl(url) {
  // Handle ssl param in query string
  const sslMatch = url.match(/\?ssl=(.+)$/);
  const cleanUrl = url.replace(/\?ssl=.+$/, '');
  const u = new URL(cleanUrl);
  const config = {
    host: u.hostname,
    port: parseInt(u.port) || 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace('/', ''),
  };
  if (sslMatch) {
    try { config.ssl = JSON.parse(decodeURIComponent(sslMatch[1])); } catch { config.ssl = { rejectUnauthorized: true }; }
  }
  return config;
}

const data = JSON.parse(fs.readFileSync('/home/ubuntu/old_db_export.json', 'utf8'));

// Tables to import in dependency order (users first)
const IMPORT_ORDER = [
  'users',
  'invoices',
  'jobApplications',
  'birthdayInquiries',
  'partnershipInquiries',
  'staffInvites',
  'signingTokens',
  'privateEventInquiries',
  'breeders',
  'breederConfirmations',
  'locationPresets',
  'refunds',
  'breederAvailabilityBlasts',
  'breederAvailabilityResponses',
  'puppySchedule',
];

// Columns that need Date → string conversion for timestamps
const TIMESTAMP_COLS = ['createdAt', 'updatedAt', 'lastSignedIn', 'expiresAt', 'signedAt', 'firstUsedAt', 'lastUsedAt', 'dueDate', 'respondedAt'];

function formatRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString().slice(0, 19).replace('T', ' ');
    } else if (v === null || v === undefined) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  console.log('Connecting to new database...');
  const conn = await mysql.createConnection(parseUrl(NEW_DB_URL));
  console.log('Connected.\n');

  for (const table of IMPORT_ORDER) {
    const rows = data[table];
    if (!rows || rows.length === 0) {
      console.log(`  ${table}: 0 rows — skipped`);
      continue;
    }

    let inserted = 0;
    let skipped = 0;

    for (const rawRow of rows) {
      const row = formatRow(rawRow);
      const cols = Object.keys(row).map(c => `\`${c}\``).join(', ');
      const placeholders = Object.keys(row).map(() => '?').join(', ');
      const values = Object.values(row);

      try {
        await conn.execute(
          `INSERT IGNORE INTO \`${table}\` (${cols}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (err) {
        console.log(`    [WARN] ${table} row id=${row.id}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`  ${table}: ${inserted} inserted, ${skipped} skipped`);
  }

  await conn.end();
  console.log('\nMigration complete!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
