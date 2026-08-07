import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);
const [rows] = await conn.execute('SELECT id, name, contactName, email, phone, breed FROM breeders WHERE isActive = 1 ORDER BY name');
for (const r of rows) {
  console.log(`${r.id}|${r.name}|${r.contactName || ''}|${r.email || ''}|${r.phone || ''}|${r.breed || ''}`);
}
console.log(`\nTotal active breeders: ${rows.length}`);
console.log(`\nBreeders with email: ${rows.filter(r => r.email).length}`);
await conn.end();
