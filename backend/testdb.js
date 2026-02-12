import dotenv from "dotenv";
dotenv.config();

console.log("Loaded DB URL:", process.env.DATABASE_URL);

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    console.log("Trying DB connection...");

    const res = await pool.query("SELECT NOW()");

    console.log("✅ DB Connected:", res.rows[0]);

    await pool.end();
    process.exit(0);

  } catch (err) {
    console.error("❌ DB Error:", err);
    process.exit(1);
  }
})();
