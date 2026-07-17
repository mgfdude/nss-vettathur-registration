const otpRequests = new Map();
const loginAttempts = new Map();

function getClientKey(req) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
}

function otpRateLimiter(req, res, next) {
  const ip = getClientKey(req);
  const email = req.body.email || req.body.identifier || req.body.app_id || 'unknown-email';
  const key = `${ip}:${email}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 5;

  if (!otpRequests.has(key)) {
    otpRequests.set(key, []);
  }

  const requests = otpRequests.get(key).filter(time => now - time < windowMs);
  requests.push(now);
  otpRequests.set(key, requests);

  if (requests.length > maxRequests) {
    return res.status(429).json({
      error: 'Too many OTP requests. Please try again after 1 hour.'
    });
  }

  next();
}

function loginAttemptLimiter(req, res, next) {
  const ip = getClientKey(req);
  const appId = req.body.app_id || req.body.identifier || req.body.email || 'unknown';
  const key = `${ip}:${appId}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;

  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, []);
  }

  const attempts = loginAttempts.get(key).filter(time => now - time < windowMs);
  attempts.push(now);
  loginAttempts.set(key, attempts);

  if (attempts.length > maxAttempts) {
    return res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.'
    });
  }

  next();
}

module.exports = {
  otpRateLimiter,
  loginAttemptLimiter
};
