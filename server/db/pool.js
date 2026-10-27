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

const dbHost = (process.env.DB_HOST || '').trim();
const dbUser = (process.env.DB_USER || '').trim();
const dbPassword = (process.env.DB_PASSWORD || '').trim();
const dbName = (process.env.DB_NAME || '').trim();
const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT.toString().trim()) : 3306;
const isSsl = ((process.env.DB_SSL || '').toString().trim().toLowerCase() === 'true') || dbHost.includes('tidbcloud.com');

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  ssl: isSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

module.exports = { pool };
