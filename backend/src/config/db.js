const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DB_Connection_String,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err.message);
});

// Simple query helper with error catching
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
};

// Get a client for transactions
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
