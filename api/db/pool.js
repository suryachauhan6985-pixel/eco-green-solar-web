const mysql = require('mysql2/promise');

const REQUIRED_DB_ENV_VARS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingDbEnvVars = REQUIRED_DB_ENV_VARS.filter((key) => !process.env[key]);
if (missingDbEnvVars.length) {
  console.error(
    `[DB Config] Missing required environment variable(s): ${missingDbEnvVars.join(', ')}. ` +
    'Set these in Render > Environment before starting the server - refusing to start with insecure hardcoded defaults.'
  );
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

module.exports = { pool };
