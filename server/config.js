require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'nss_portal_super_secret_jwt_key_2026',
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'nss_portal_refresh_secret_key_2026',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  refreshTokenCookieMaxAge: parseInt(process.env.REFRESH_TOKEN_COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000,
  portalUrl: process.env.PORTAL_URL || `http://localhost:${process.env.PORT || 3000}`,
  contactEmail: process.env.CONTACT_EMAIL || 'techora@gmail.com',
  recoveryEmail: process.env.RECOVERY_EMAIL || process.env.CONTACT_EMAIL || 'techora2008@gmail.com',
  email: {
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || 'test@ethereal.email',
    pass: process.env.EMAIL_PASS || 'testpass'
  },
  sessionSecret: process.env.SESSION_SECRET || 'nss_portal_session_secret_key_2026',
  nodeEnv: process.env.NODE_ENV || 'development'
};
