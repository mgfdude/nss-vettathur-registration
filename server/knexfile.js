const path = require('path');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '..', 'database', 'nss_portal.sqlite')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '..', 'database', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, '..', 'database', 'seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },
  production: {
    // Easily configurable for PostgreSQL later:
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, '..', 'database', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, '..', 'database', 'seeds')
    }
  }
};
