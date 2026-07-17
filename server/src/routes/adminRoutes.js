const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole, requirePortalRole } = require('../middlewares/auth');

// All admin routes require authentication and 'admin' / 'superadmin' roles
router.use(authenticateToken);
router.use(requireRole(['admin', 'superadmin']));
router.use(requirePortalRole('admin'));

router.get('/applications', adminController.getApplications);
router.get('/applications/:id', adminController.getApplicationById);
router.patch('/applications/:id', adminController.updateApplicationStatus);
router.get('/stats', adminController.getStats);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);
router.get('/announcements', adminController.getAnnouncements);
router.post('/announcements', adminController.createAnnouncement);
router.patch('/announcements/:id', adminController.updateAnnouncement);
router.delete('/announcements/:id', adminController.deleteAnnouncement);

module.exports = router;
