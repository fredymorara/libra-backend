const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDB() {
  console.log('Recreating vector extension...');
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
  console.log('Vector extension recreated successfully.');
  process.exit(0);
}

fixDB().catch((err) => {
  console.error(err);
  process.exit(1);
});
