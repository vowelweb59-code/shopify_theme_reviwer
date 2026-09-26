/**
 * Dumps every collection of the MONGODB_URI database to one Extended JSON
 * file per collection (lossless: ObjectIds, dates and binaries round-trip),
 * so a destructive maintenance step like db:compact can be undone.
 * No mongodump needed.
 *
 *   npm run db:backup                    # writes backups/<db>-<timestamp>/
 *   npm run db:backup -- --out <dir>
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db/connect";

const outFlag = process.argv.indexOf("--out");

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = outFlag > -1 ? process.argv[outFlag + 1] : path.join("backups", `${db.databaseName}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Backing up "${db.databaseName}" on ${mongoose.connection.host} to ${outDir}`);

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const file = fs.createWriteStream(path.join(outDir, `${name}.ejson`));
    let count = 0;
    for await (const doc of db.collection(name).find()) {
      file.write(mongoose.mongo.BSON.EJSON.stringify(doc, { relaxed: false }) + "\n");
      count++;
    }
    await new Promise<void>((resolve, reject) => file.end((err?: Error | null) => (err ? reject(err) : resolve())));
    console.log(`  ${name}: ${count} documents`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
