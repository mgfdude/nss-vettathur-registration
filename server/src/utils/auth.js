const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../../config');

function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, config.refreshTokenSecret, { expiresIn: config.refreshTokenExpiry });
}

function verifyToken(token, options = {}) {
  try {
    return jwt.verify(token, options.refresh ? config.refreshTokenSecret : config.jwtSecret);
  } catch (error) {
    return null;
  }
}

async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword
};
