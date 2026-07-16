const knex = require('../server/node_modules/knex');
const knexConfig = require('../server/knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[environment]);

module.exports = db;
