import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

// Get all active breeders with contact info
const [rows] = await conn.execute(
  'SELECT id, name, contactName, email, phone, breed FROM breeders WHERE isActive = 1 ORDER BY name'
);

// Compute upcoming Saturdays and Sundays (next 4 weekends)
const today = new Date();
const weekends = [];
const d = new Date(today);
// Move to next Saturday
d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7);
if (d.getDay() !== 6) d.setDate(d.getDate() + (6 - d.getDay()));

for (let i = 0; i < 4; i++) {
  const sat = new Date(d);
  sat.setDate(d.getDate() + i * 7);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  weekends.push({
    sat: sat.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    sun: sun.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    satISO: sat.toISOString().split('T')[0],
    sunISO: sun.toISOString().split('T')[0],
  });
}

// Categorize breeders
const withEmail = rows.filter(r => r.email && r.email.trim());
const withPhone = rows.filter(r => r.phone && r.phone.trim());
const emailOnly = withEmail.filter(r => !r.phone || !r.phone.trim());
const phoneOnly = withPhone.filter(r => !r.email || !r.email.trim());
const both = withEmail.filter(r => r.phone && r.phone.trim());
const neither = rows.filter(r => (!r.email || !r.email.trim()) && (!r.phone || !r.phone.trim()));

console.log('=== UPCOMING WEEKENDS ===');
weekends.forEach((w, i) => console.log(`Weekend ${i+1}: ${w.sat} & ${w.sun}`));

console.log(`\n=== BREEDER SUMMARY ===`);
console.log(`Total active breeders: ${rows.length}`);
console.log(`With email: ${withEmail.length}`);
console.log(`With phone: ${withPhone.length}`);
console.log(`Both email + phone: ${both.length}`);
console.log(`Email only (no phone): ${emailOnly.length}`);
console.log(`Phone only (no email): ${phoneOnly.length}`);
console.log(`No contact info: ${neither.length}`);

console.log(`\n=== EMAIL RECIPIENTS (${withEmail.length}) ===`);
withEmail.forEach(r => {
  const phone = r.phone ? ` | ${r.phone}` : '';
  console.log(`  ${r.name} | ${r.contactName || '-'} | ${r.email}${phone} | ${r.breed || '-'}`);
});

console.log(`\n=== SMS RECIPIENTS (${withPhone.length}) ===`);
withPhone.forEach(r => {
  const email = r.email ? ` | ${r.email}` : '';
  console.log(`  ${r.name} | ${r.contactName || '-'} | ${r.phone}${email} | ${r.breed || '-'}`);
});

console.log(`\n=== NO CONTACT INFO (${neither.length}) ===`);
neither.forEach(r => {
  console.log(`  ${r.name} | ${r.contactName || '-'} | ${r.breed || '-'}`);
});

await conn.end();
