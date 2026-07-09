import mysql from 'mysql2/promise';
import fs from 'fs';

const OLD_DB_URL = 'mysql://rctM7roTvbHGWtX.8285ce197966:sb2rH75giqyy9I2Bxlx8@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/TnRBecMtwf5qQkTJcvZpfJ?ssl={"rejectUnauthorized":true}';

// Parse the connection string
function parseUrl(url) {
  const u = new URL(url.replace(/\?ssl=.*$/, ''));
  return {
    host: u.hostname,
    port: parseInt(u.port) || 4000,
    user: u.username,
    password: u.password,
    database: u.pathname.replace('/', ''),
    ssl: { rejectUnauthorized: true },
  };
}

const tables = [
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

async function main() {
  console.log('Connecting to old database...');
  const oldConn = await mysql.createConnection(parseUrl(OLD_DB_URL));
  console.log('Connected to old database.');

  const exportData = {};

  for (const table of tables) {
    try {
      const [rows] = await oldConn.query(`SELECT * FROM \`${table}\``);
      exportData[table] = rows;
      console.log(`  ${table}: ${rows.length} rows`);
    } catch (err) {
      console.log(`  ${table}: SKIPPED (${err.message})`);
      exportData[table] = [];
    }
  }

  await oldConn.end();

  fs.writeFileSync('/home/ubuntu/old_db_export.json', JSON.stringify(exportData, null, 2));
  console.log('\nExport complete → /home/ubuntu/old_db_export.json');

  // Print summary
  for (const [table, rows] of Object.entries(exportData)) {
    if (rows.length > 0) console.log(`  ${table}: ${rows.length} rows to import`);
  }
}

main().catch(console.error);
