const multer = require('multer');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const PDF_MIME_TYPES = new Set(['application/pdf']);

const fieldRules = {
  photo: {
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    maxSize: 2 * 1024 * 1024
  },
  signature: {
    extensions: IMAGE_EXTENSIONS,
    mimeTypes: IMAGE_MIME_TYPES,
    maxSize: 1 * 1024 * 1024
  },
  docs: {
    extensions: PDF_EXTENSIONS,
    mimeTypes: PDF_MIME_TYPES,
    maxSize: 5 * 1024 * 1024
  },
  pdf: {
    extensions: PDF_EXTENSIONS,
    mimeTypes: PDF_MIME_TYPES,
    maxSize: 5 * 1024 * 1024
  }
};

const fileFilter = (req, file, cb) => {
  const rule = fieldRules[file.fieldname];
  if (!rule) {
    return cb(new Error('Invalid upload field.'));
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!rule.extensions.has(ext) || !rule.mimeTypes.has(file.mimetype)) {
    return cb(new Error(file.fieldname === 'docs' || file.fieldname === 'pdf'
      ? 'Only PDF files are allowed for documents.'
      : 'Only JPG and PNG images are allowed.'));
  }

  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

function validateUploadedFile(file) {
  const rule = file && fieldRules[file.fieldname];
  if (!file || !rule) {
    throw new Error('Invalid upload file.');
  }

  if (file.size > rule.maxSize) {
    throw new Error(file.fieldname === 'signature'
      ? 'Signature must be 1MB or smaller.'
      : file.fieldname === 'docs' || file.fieldname === 'pdf'
        ? 'PDF must be 5MB or smaller.'
        : 'Photo must be 2MB or smaller.');
  }
}

upload.validateUploadedFile = validateUploadedFile;
upload.fieldRules = fieldRules;

module.exports = upload;
