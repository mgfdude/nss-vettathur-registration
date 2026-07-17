const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticateToken, requireRole, requirePortalRole } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// All student routes require authentication and 'student' role
router.use(authenticateToken);
router.use(requireRole(['student']));
router.use(requirePortalRole('student'));

router.get('/dashboard', studentController.getDashboardData);
router.get('/application', studentController.getApplication);
router.get('/application/uploads', studentController.getUploads);
router.patch('/application', studentController.saveApplicationDraft);
router.post('/application/submit', studentController.submitApplication);
router.delete('/application/uploads/:type', studentController.deleteUpload);

// Upload endpoint supporting photo, signature, docs fields
router.post('/application/upload', upload.single('photo'), studentController.uploadDocument);
router.post('/application/upload-sig', upload.single('signature'), studentController.uploadDocument);
router.post('/application/upload-docs', upload.single('docs'), studentController.uploadDocument);

module.exports = router;
