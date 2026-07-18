const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const knex = require('knex');
const knexConfig = require('../server/knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;
const db = knex(config);

module.exports = db;
