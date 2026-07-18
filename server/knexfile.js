const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const migrations = {
  directory: path.join(__dirname, '..', 'database', 'migrations')
};

const seeds = {
  directory: path.join(__dirname, '..', 'database', 'seeds')
};

function pgConnection() {
  const ssl = process.env.DB_SSL === 'false'
    ? false
    : { rejectUnauthorized: false };

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl
    };
  }

  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl
  };
}

const postgresConfig = {
  client: 'pg',
  connection: pgConnection(),
  pool: {
    min: 0,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10)
  },
  migrations,
  seeds
};

module.exports = {
  development: postgresConfig,
  production: postgresConfig,
  test: {
    ...postgresConfig,
    migrations: {
      ...migrations,
      tableName: 'knex_migrations_test'
    },
    seeds
  }
};
