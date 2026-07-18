const path = require('path');
const serverRoot = path.join(__dirname, '..', 'server');

require(path.join(serverRoot, 'node_modules', 'dotenv')).config({
  path: path.join(serverRoot, '.env')
});

const knex = require(path.join(serverRoot, 'node_modules', 'knex'));
const knexConfig = require('../server/knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;
const db = knex(config);

module.exports = db;
