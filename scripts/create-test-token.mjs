import { config } from "dotenv";
config();
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const token = crypto.randomBytes(48).toString("hex");
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// Insert directly via raw SQL to avoid TS module resolution issues
await connection.execute(
  `INSERT INTO signingTokens (applicationId, applicantName, applicantEmail, role, location, offerLetterType, token, signed, expiresAt, createdAt)
   VALUES (0, ?, ?, ?, ?, ?, ?, 0, ?, NOW())`,
  [
    "Ay Bello",
    "belllo.ayoola@gmail.com",
    "Yoga Instructor",
    "Kitchener",
    "yoga_instructor",
    token,
    expiresAt,
  ]
);

console.log("TOKEN:", token);
console.log("SIGNING LINK: https://afropuppyyoga.ca/sign?token=" + token);
await connection.end();
