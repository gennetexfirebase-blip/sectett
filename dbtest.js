// Quick MongoDB connectivity check.
// Reads the connection string from the MONGODB_URI environment variable so no
// credentials are ever written into this file. Run it with, for example:
//   MONGODB_URI="mongodb+srv://user:pass@host/..." node dbtest.js      (bash)
//   $env:MONGODB_URI="..."; node dbtest.js                              (PowerShell)
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Алдаа: MONGODB_URI орчны хувьсагч тодорхойлогдоогүй байна.");
  process.exit(1);
}

(async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  const started = Date.now();
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const dbs = await client.db().admin().listDatabases();
    console.log(`✓ Холбогдлоо (${Date.now() - started} мс)`);
    console.log("Өгөгдлийн сангууд:");
    for (const d of dbs.databases) {
      console.log(`  · ${d.name} — ${(d.sizeOnDisk / 1024).toFixed(1)} KB`);
    }
  } catch (err) {
    console.error(`✗ Холбогдож чадсангүй: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
})();
