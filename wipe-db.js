const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function wipeDB() {
  console.log('Wiping database...');
  await pool.query('DROP SCHEMA public CASCADE;');
  await pool.query('CREATE SCHEMA public;');
  console.log('Database wiped successfully.');
  process.exit(0);
}

wipeDB().catch((err) => {
  console.error(err);
  process.exit(1);
});
