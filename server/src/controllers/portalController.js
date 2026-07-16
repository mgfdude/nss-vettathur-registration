const {
  getPublicPortalStatus
} = require('../utils/portalSettings');

async function getPortalStatus(req, res) {
  try {
    const status = await getPublicPortalStatus();
    res.json(status);
  } catch (error) {
    console.error('Get portal status error:', error);
    res.status(500).json({ error: 'Unable to load portal status.' });
  }
}

module.exports = {
  getPortalStatus
};
