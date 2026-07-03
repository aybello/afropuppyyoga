/**
 * Fix breeder contact data: the import put "Name, Phone, Email" all into contactName.
 * This script parses each row and splits into the correct columns.
 */
import { createConnection } from 'mysql2/promise';
import 'dotenv/config';

const conn = await createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(
  'SELECT id, name, contactName, phone, email FROM breeders WHERE phone IS NULL AND email IS NULL'
);

console.log(`Found ${rows.length} breeders to fix...`);

let fixed = 0;
let skipped = 0;

for (const row of rows) {
  const raw = row.contactName ?? '';
  if (!raw.trim()) { skipped++; continue; }

  // Pattern: "FirstName LastName, 647-xxx-xxxx, email@domain.com"
  // or "FirstName, 647-xxx-xxxx, email@domain.com"
  // Split on commas
  const parts = raw.split(',').map(p => p.trim());

  let contactName = null;
  let phone = null;
  let email = null;

  for (const part of parts) {
    // Detect email
    if (part.includes('@')) {
      email = part;
    }
    // Detect phone: contains digits and dashes/spaces, looks like a phone number
    else if (/^\+?[\d\s\-().]{7,}$/.test(part)) {
      phone = part;
    }
    // Otherwise it's the name
    else if (part.length > 0) {
      contactName = part;
    }
  }

  if (!contactName && !phone && !email) { skipped++; continue; }

  await conn.execute(
    'UPDATE breeders SET contactName = ?, phone = ?, email = ? WHERE id = ?',
    [contactName, phone, email, row.id]
  );
  console.log(`  ✓ #${row.id} "${row.name}" → contact: "${contactName}", phone: "${phone}", email: "${email}"`);
  fixed++;
}

console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`);
await conn.end();
