/**
 * One-time seed script to import breeders from the Excel spreadsheet
 * Run with: node scripts/seed-breeders.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const breeders = [
  { name: "Goldendoodle Breeder", contactInfo: "Jenn, 647-219-5261, jenniferwilliams0311@gmail.com", breed: "Goldendoodles", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Bernese Mountain Dog Breeder", contactInfo: "Tanya, 519-546-1459, tanya.bmd@gmail.com", breed: "Bernese Mountain Dogs", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Cavapoo Breeder", contactInfo: "Natasha, 416-571-5494, cavapoobreeder@gmail.com", breed: "Cavapoos", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Shih Tzu Breeder", contactInfo: "Lucy, 905-483-2910, lucyshihtzu@gmail.com", breed: "Shih Tzus", litterTimeline: null, typicalRate: "450", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Golden Retriever Breeder", contactInfo: "Mike, 519-744-8823, mikegoldens@hotmail.com", breed: "Golden Retrievers", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Labrador Retriever Breeder", contactInfo: "Sandra, 905-318-7654, sandralabs@gmail.com", breed: "Labrador Retrievers", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Poodle Breeder", contactInfo: "Claire, 416-922-3344, clairepoodles@gmail.com", breed: "Poodles", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "French Bulldog Breeder", contactInfo: "Andre, 647-881-2200, andrefrenchies@gmail.com", breed: "French Bulldogs", litterTimeline: null, typicalRate: "550", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Bulldog Aristocrat", contactInfo: "Elena, 6472424348, bulldogaristocrat@gmail.com", breed: "English Bulldogs", litterTimeline: "2025-12-31", typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "German Shepherd Breeder", contactInfo: "Dave, 5197315761, easyspeed4life@gmail.com", breed: "German Shepherds", litterTimeline: "N/A", typicalRate: "450", transport: null, contractStatus: "Contract completed" },
  { name: "Husky Breeder", contactInfo: "Josh - Koloskennel@hotmail.com, IG - Kolos kennel", breed: "Huskies", litterTimeline: null, typicalRate: "550", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Sofi's Cockapoos", contactInfo: "Sofi's Cockapoos, 289-689-2836", breed: "Cockapoos", litterTimeline: null, typicalRate: "400", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Taco Yorkies", contactInfo: "Sonja - 7055004440 - bozik0807@gmail.com, sbozik@gmail.com, IG - taco_yorkie", breed: "Yorkies and Malteses", litterTimeline: "2026-11-14", typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Toronto Frenchies", contactInfo: "oksi.sam@gmail.com, IG - toronto_frenchis", breed: "Frenchies", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Therapy Spaniels", contactInfo: "IG - therapy_spaniel, 6473387011, limonsitolloron@gmail.com", breed: "Springer Spaniels", litterTimeline: null, typicalRate: "550", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Border Collie + Corgi Breeder", contactInfo: "905-320-1114, dannyopaina@gmail.com", breed: "Border Collies & Corgis", litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Doodles", contactInfo: "Abigail, 519-589-7253", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Samoyed Breeder", contactInfo: "437-849-7898", breed: "Samoyeds", litterTimeline: null, typicalRate: null, transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Pomsky Breeder", contactInfo: "Alex, 905-236-2220, gtafitnesscoach@gmail.com", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Labradoodles Breeder", contactInfo: "647-705-1928", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Heart of Gold Retrievers", contactInfo: "Taylor - Taydubuc@gmail.com, IG - heartofgold_retrievers", breed: "Retrievers", litterTimeline: "Winter 2026", typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Aussies (Gosia)", contactInfo: "Gosia, gosiawerder@yahoo.ca", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "Contract completed" },
  { name: "Samoyed Breeder (Light and Rem)", contactInfo: "IG - lightandremthesamoyeds", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Dalmatian Breeder", contactInfo: "Alyssa, IG - 101acre_woods_kennel_woodstock, 5192774451", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Stonbrook Rottweilers", contactInfo: "Melissa, 5195914442", breed: null, litterTimeline: "Not till 2026", typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Pioneer Doxies", contactInfo: "2893371258, ig: pioneer_doxies", breed: null, litterTimeline: "2026-01-01", typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Bulldogs (Fambilt)", contactInfo: "IG - fambuiltbullies", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "American Bulldogs (Rosalina)", contactInfo: "IG - rosalinathebully, 6475020322", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Prophecy Golden Retrievers", contactInfo: "IG - prophecygoldens, 5195015296", breed: null, litterTimeline: "2026-01-01", typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Mini Pinscher Breeder", contactInfo: "Akeel, 4162752808, IG - terriertown905, terriertown416@gmail.com", breed: "Mini Pinschers", litterTimeline: null, typicalRate: null, transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Applewood Kennels Bernese Mountain Dogs", contactInfo: "applewoodkennel4391@gmail.com, (519) 668-1515", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Malshis Breeder", contactInfo: "IG - malshi_furbabies", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "The Doggy in the Basket", contactInfo: "IG - thedoggyinthebasket", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Whistling Ridge", contactInfo: "Tim, 5198978411, info@whistlingridge.ca", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "Contract completed" },
  { name: "Icon Bullies", contactInfo: "David, buckybulldogs@gmail.com, 2896001594", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "Contract sent" },
  { name: "Samoyed x Goldens Breeder", contactInfo: "Toffeesnowy0gmail.com, 4374779999", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "EllaGator Puppies", contactInfo: "Anissa, IG - the_dog_woman, Miss.nisss@hotmail.com", breed: null, litterTimeline: "Spring 2026", typicalRate: "450", transport: "Breeder", contractStatus: "Contract sent" },
  { name: "Red Sea Kennels", contactInfo: "Matt, (647) 502-4254, IG - dogs_after_dark, Brissettbullykutta@hotmail.com", breed: "Shar-pei", litterTimeline: "Coming up", typicalRate: "$500-550", transport: "Breeder", contractStatus: "Contract sent" },
  { name: "Shelties Breeder (Marayan)", contactInfo: "Marayan, 9057308429", breed: "Shelties", litterTimeline: "2026-06-01", typicalRate: "500", transport: null, contractStatus: "No contract yet" },
  { name: "Chow Chow Breeder (Sarah)", contactInfo: "Sarah, 519-535-4170", breed: "Chow Chows", litterTimeline: null, typicalRate: "600", transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Ella's Bernadoodles", contactInfo: "Ella, (647) 781-7101", breed: "Bernadoodles", litterTimeline: null, typicalRate: "450", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "CKC Rottweilers", contactInfo: "Catie, caitiemcgill@hotmail.com", breed: "Rottweilers", litterTimeline: null, typicalRate: "450", transport: "Breeder", contractStatus: "Contract completed" },
  { name: "Pomeranians (Puppy Toronto)", contactInfo: "vluzhna@gmail.com, (416) 988-9030, Puppy_toronto", breed: "Pomeranians", litterTimeline: null, typicalRate: "450", transport: "Depends on location", contractStatus: "Contract completed" },
  { name: "Huskies (Renee)", contactInfo: "Renee, +1 (647) 685-7229", breed: "Huskies", litterTimeline: null, typicalRate: "n/a", transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Bullies (OTB)", contactInfo: "Otbbullykennel@outlook.com", breed: null, litterTimeline: null, typicalRate: "500", transport: "Breeder", contractStatus: "No contract yet" },
  { name: "Denille Johnson", contactInfo: "denillejohnson@live.ca, 647-459-1497", breed: null, litterTimeline: null, typicalRate: null, transport: null, contractStatus: "No contract yet" },
  { name: "Bluecollardobermanz", contactInfo: "Armrit, sam@mymantraandco.ca, 647-542-3097, IG: bluecollardobermanz", breed: "Dobermans", litterTimeline: "2026-06-01", typicalRate: "650", transport: "Breeder", contractStatus: "Contract completed" },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  console.log(`Seeding ${breeders.length} breeders...`);

  for (const b of breeders) {
    await connection.execute(
      `INSERT INTO breeders (name, contactName, breed, litterTimeline, typicalRate, transport, contractStatus, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [b.name, b.contactInfo, b.breed ?? null, b.litterTimeline ?? null, b.typicalRate ?? null, b.transport ?? null, b.contractStatus]
    );
  }

  console.log("Done! Seeded", breeders.length, "breeders.");
  await connection.end();
}

seed().catch(console.error);
