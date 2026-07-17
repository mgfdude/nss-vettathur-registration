const { verifyToken } = require('../utils/auth');
const db = require('../../../database/connection');
const { isAdminRole, isStudentRole } = require('../utils/authRoles');

async function authenticateToken(req, res, next) {
  // Check auth header or cookie
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // Fetch fresh user data to verify status
  const user = await db('users').where({ id: decoded.id }).first();
  if (!user || !user.is_active) {
    return res.status(403).json({ error: 'User is suspended or inactive.' });
  }

  // Account locking check
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({ error: 'Account is locked. Please try again later.' });
  }

  req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

function requirePortalRole(portal) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (portal === 'student' && !isStudentRole(req.user.role)) {
      return res.status(403).json({ error: 'This account belongs to an administrator. Please use the Admin Login Portal.' });
    }

    if (portal === 'admin' && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'This account belongs to a student. Please use the Student Login Portal.' });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requirePortalRole
};
