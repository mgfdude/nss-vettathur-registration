const {
  isRegistrationOpen,
  isEditingOpen,
  isStudentLoginEnabled
} = require('../utils/portalSettings');

async function requireRegistrationOpen(req, res, next) {
  try {
    const open = await isRegistrationOpen();
    if (!open) {
      return res.status(403).json({ error: 'Registration is currently closed.' });
    }
    return next();
  } catch (error) {
    console.error('Registration gate error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function requireEditingOpen(req, res, next) {
  try {
    const open = await isEditingOpen();
    if (!open) {
      return res.status(403).json({
        error: 'Application editing is currently closed. Your application is view-only.'
      });
    }
    return next();
  } catch (error) {
    console.error('Editing gate error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function requireStudentLoginEnabled(req, res, next) {
  try {
    const enabled = await isStudentLoginEnabled();
    if (!enabled) {
      return res.status(403).json({
        error: 'Portal login is temporarily disabled. Please try again later.'
      });
    }
    return next();
  } catch (error) {
    console.error('Login gate error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  requireRegistrationOpen,
  requireEditingOpen,
  requireStudentLoginEnabled
};
