import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

// Get all active breeders
const [rows] = await conn.execute(
  'SELECT id, name, contactName, email, phone, breed FROM breeders WHERE isActive = 1 ORDER BY name'
);

// Weekend dates starting from Aug 15
const weekends = [
  { sat: 'Saturday, August 15', sun: 'Sunday, August 16' },
  { sat: 'Saturday, August 22', sun: 'Sunday, August 23' },
  { sat: 'Saturday, August 29', sun: 'Sunday, August 30' },
];

const dateListHTML = weekends.map(w => `<li>${w.sat} &amp; ${w.sun}</li>`).join('');
const smsDateList = 'Aug 15-16, 22-23, 29-30';

// Already sent emails (from first run + duplicate run)
const alreadySentEmails = new Set([
  'applewoodkennel4391@gmail.com',
  'gosiawerder@yahoo.ca',
  'tanya.bmd@gmail.com',
  'sam@mymantraandco.ca',
  'bulldogaristocrat@gmail.com',
  'dannyopaina@gmail.com',
  'otbbullykennel@outlook.com',
].map(e => e.toLowerCase()));

// Already sent SMS (from first run — these went out before kill)
// Based on the terminal output: American Bulldogs (Rosalina) and Applewood Kennels got SMS
const alreadySentPhones = new Set([
  '+16475020322', // American Bulldogs (Rosalina)
  '+15196681515', // Applewood Kennels
]);

// Setup Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'afropuppyyoga@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Setup Twilio
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

// Known first names from contactName field
const KNOWN_NAMES = {
  'Tanya': true, 'Natasha': true, 'Claire': true, 'Lucy': true, 'Sandra': true,
  'Mike': true, 'Jenn': true, 'Andre': true, 'Dave': true, 'Elena': true,
  'Alex': true, 'Abigail': true, 'Dorina': true, 'Ella': true, 'Anissa': true,
  'David': true, 'Tim': true, 'Sarah': true, 'Melissa': true, 'Renee': true,
  'Nicole': true, 'Gosia': true, 'Torrey': true, 'Wyatt': true, 'Amrita': true,
  'Jennifer': true, 'Jim': true, 'Christina': true, 'Victoria': true, 'Tamara': true,
  'Mali': true,
};

function getGreeting(breeder) {
  if (breeder.contactName && breeder.contactName.trim()) {
    const firstName = breeder.contactName.trim().split(/[\s,]+/)[0];
    // Only use the name if it's a real person name (not IG handle, not a business name)
    if (!firstName.startsWith('IG') && !firstName.startsWith('ig') && KNOWN_NAMES[firstName]) {
      return `Hi ${firstName},`;
    }
  }
  return 'Hi,';
}

function getSMSGreeting(breeder) {
  if (breeder.contactName && breeder.contactName.trim()) {
    const firstName = breeder.contactName.trim().split(/[\s,]+/)[0];
    if (!firstName.startsWith('IG') && !firstName.startsWith('ig') && KNOWN_NAMES[firstName]) {
      return `Hi ${firstName}`;
    }
  }
  return 'Hi';
}

function normalizePhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null;
}

function buildEmailHTML(greeting) {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <p>${greeting}</p>
  <p>Hope you and the pups are doing well! We're planning our August schedule and wanted to check in on your availability.</p>
  <p>We have classes running every Saturday and Sunday across our three locations — <strong>Kitchener</strong>, <strong>Hamilton</strong>, and <strong>Oakville</strong> — and would love to have your puppies join us for any of the upcoming weekends:</p>
  <ul>
    ${dateListHTML}
  </ul>
  <p>Could you let us know which dates work for you? Just reply to this email with the dates you're available and we'll get you on the schedule.</p>
  <p>Warmly,<br/>The AfroPuppyYoga Team</p>
</div>`;
}

function buildSMS(greeting) {
  return `${greeting}, it's AfroPuppyYoga! We're planning our August schedule for Kitchener, Hamilton & Oakville. Are your puppies available for any upcoming Saturdays/Sundays? (${smsDateList}). Just text back the dates that work! Thanks`;
}

// Track results
const results = { emailSent: 0, emailSkipped: 0, emailFailed: 0, smsSent: 0, smsSkipped: 0, smsFailed: 0, noContact: 0 };
const details = [];

for (const breeder of rows) {
  const greeting = getGreeting(breeder);
  const smsGreeting = getSMSGreeting(breeder);
  const hasEmail = breeder.email && breeder.email.trim();
  const hasPhone = breeder.phone && breeder.phone.trim();
  
  if (!hasEmail && !hasPhone) {
    results.noContact++;
    details.push({ name: breeder.name, email: 'N/A', sms: 'N/A', status: 'SKIPPED (no contact)' });
    continue;
  }

  let emailStatus = '-';
  let smsStatus = '-';

  // Send email
  if (hasEmail) {
    const emailLower = breeder.email.trim().toLowerCase();
    if (alreadySentEmails.has(emailLower)) {
      results.emailSkipped++;
      emailStatus = 'ALREADY SENT';
      console.log(`⏭️  Email already sent to ${breeder.name} (${breeder.email})`);
    } else {
      try {
        await transporter.sendMail({
          from: '"AfroPuppyYoga" <afropuppyyoga@gmail.com>',
          to: breeder.email.trim(),
          subject: 'Puppy Availability — August Weekends 🐾',
          html: buildEmailHTML(greeting),
        });
        results.emailSent++;
        emailStatus = 'SENT';
        console.log(`✅ Email sent to ${breeder.name} (${breeder.email}) — "${greeting}"`);
      } catch (err) {
        results.emailFailed++;
        emailStatus = `FAILED: ${err.message}`;
        console.log(`❌ Email failed for ${breeder.name}: ${err.message}`);
      }
    }
  }

  // Send SMS
  if (hasPhone) {
    const normalizedPhone = normalizePhone(breeder.phone);
    if (!normalizedPhone) {
      smsStatus = 'SKIPPED (invalid phone)';
      console.log(`⚠️  Invalid phone for ${breeder.name}: ${breeder.phone}`);
    } else if (alreadySentPhones.has(normalizedPhone)) {
      results.smsSkipped++;
      smsStatus = 'ALREADY SENT';
      console.log(`⏭️  SMS already sent to ${breeder.name} (${normalizedPhone})`);
    } else {
      try {
        const smsBody = buildSMS(smsGreeting);
        const params = new URLSearchParams();
        params.append('To', normalizedPhone);
        params.append('From', twilioFrom);
        params.append('Body', smsBody);
        
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );
        const data = await resp.json();
        if (data.sid) {
          results.smsSent++;
          smsStatus = 'SENT';
          console.log(`✅ SMS sent to ${breeder.name} (${normalizedPhone}) — "${smsGreeting}"`);
        } else {
          results.smsFailed++;
          smsStatus = `FAILED: ${data.message || JSON.stringify(data)}`;
          console.log(`❌ SMS failed for ${breeder.name}: ${data.message || JSON.stringify(data)}`);
        }
      } catch (err) {
        results.smsFailed++;
        smsStatus = `FAILED: ${err.message}`;
        console.log(`❌ SMS failed for ${breeder.name}: ${err.message}`);
      }
    }
  }

  details.push({ name: breeder.name, email: emailStatus, sms: smsStatus });
  
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n=== FINAL RESULTS ===');
console.log(`Emails sent: ${results.emailSent}`);
console.log(`Emails already sent (skipped): ${results.emailSkipped}`);
console.log(`Emails failed: ${results.emailFailed}`);
console.log(`SMS sent: ${results.smsSent}`);
console.log(`SMS already sent (skipped): ${results.smsSkipped}`);
console.log(`SMS failed: ${results.smsFailed}`);
console.log(`No contact info: ${results.noContact}`);
console.log(`Total breeders: ${rows.length}`);

await conn.end();
