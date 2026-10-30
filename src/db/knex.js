require('dotenv').config({ path: './config.env' });
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'CVJPAG',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'diler6399',
  },
  pool: { min: 2, max: 10 },
});

module.exports = db;
