const otpRequests = new Map();

function otpRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
  const email = req.body.email || 'unknown-email';
  const key = `${ip}:${email}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
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

module.exports = {
  otpRateLimiter
};
