const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_-]/g, '-');
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const appId = safeSegment(req.user && req.user.app_id);
    const dir = path.join(__dirname, '..', '..', '..', 'uploads', appId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40) || file.fieldname;
    cb(null, `${file.fieldname}-${base}-${randomHex}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf'];
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG) and PDFs are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

module.exports = upload;
