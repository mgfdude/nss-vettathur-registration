const db = require('../../../database/connection');
const fs = require('fs').promises;
const path = require('path');
const { sendMail } = require('../utils/email');
const {
  isRegistrationOpen,
  isEditingOpen,
  isSelectionOpen
} = require('../utils/portalSettings');

const uploadColumns = {
  photo: 'photo_path',
  signature: 'signature_path',
  docs: 'docs_path'
};

function uploadsRoot() {
  return path.join(__dirname, '..', '..', '..', 'uploads');
}

function safeUploadPath(relativePath) {
  if (!relativePath) return null;
  const root = path.resolve(uploadsRoot());
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function removeUploadFile(relativePath) {
  const resolved = safeUploadPath(relativePath);
  if (!resolved) return;
  try {
    await fs.unlink(resolved);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function buildUploadItem(type, relativePath) {
  if (!relativePath) return null;
  const resolved = safeUploadPath(relativePath);
  if (!resolved) return null;

  try {
    const stat = await fs.stat(resolved);
    return {
      type,
      filename: path.basename(relativePath),
      path: relativePath,
      url: `/api/uploads/${relativePath.replace(/\\/g, '/')}`,
      size: stat.size,
      uploaded_at: stat.mtime,
      is_image: /\.(png|jpe?g)$/i.test(relativePath),
      is_pdf: /\.pdf$/i.test(relativePath)
    };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function getApplication(req, res) {
  try {
    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application form not found.' });
    }

    // Omit sensitive data hashes for user privacy
    delete app.aadhaar_hash;

    res.json(app);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function saveApplicationDraft(req, res) {
  try {
    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (app.status !== 'Draft') {
      return res.status(400).json({ error: 'Application is locked and cannot be edited.' });
    }

    const editingAllowed = await isEditingOpen();
    if (!editingAllowed) {
      return res.status(400).json({ error: 'Application editing is currently closed. Your form is read-only.' });
    }

    const updatableFields = [
      'full_name', 'father_name', 'mother_name', 'age', 'blood_group', 'aadhaar_number',
      'phone_number', 'whatsapp_number', 'guardian_mobile',
      'house_name', 'place', 'pin_code', 'district',
      'first_name', 'last_name', 'class_name', 'roll_number',
      'guardian_name', 'guardian_phone', 'emergency_phone',
      'skills', 'interests', 'volunteer_exp', 'essay_why_nss'
    ];

    const updates = {};
    for (const key of updatableFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    updates.updated_at = new Date();

    await db('applications').where({ user_id: req.user.id }).update(updates);

    res.json({ message: 'Draft saved successfully.' });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function uploadDocument(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (app.status !== 'Draft') {
      return res.status(400).json({ error: 'Cannot upload files after submission.' });
    }

    const editingAllowed = await isEditingOpen();
    if (!editingAllowed) {
      return res.status(400).json({ error: 'Application editing is currently closed. Uploads are read-only.' });
    }

    const fieldName = file.fieldname; // photo, signature, docs
    const columnName = uploadColumns[fieldName];
    if (!columnName) {
      return res.status(400).json({ error: 'Invalid field source.' });
    }

    if (app[columnName]) {
      await removeUploadFile(app[columnName]);
    }

    const relativePath = `${req.user.app_id}/${file.filename}`;

    await db('applications').where({ user_id: req.user.id }).update({
      [columnName]: relativePath,
      updated_at: new Date()
    });

    const upload = await buildUploadItem(fieldName, relativePath);

    res.json({
      message: 'File uploaded successfully.',
      filename: file.filename,
      upload
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getUploads(req, res) {
  try {
    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const items = await Promise.all(
      Object.entries(uploadColumns).map(([type, column]) => buildUploadItem(type, app[column]))
    );

    res.json({ items: items.filter(Boolean) });
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteUpload(req, res) {
  try {
    const { type } = req.params;
    const columnName = uploadColumns[type];
    if (!columnName) {
      return res.status(400).json({ error: 'Invalid upload type.' });
    }

    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (app.status !== 'Draft') {
      return res.status(400).json({ error: 'Cannot delete files after submission.' });
    }

    const editingAllowed = await isEditingOpen();
    if (!editingAllowed) {
      return res.status(400).json({ error: 'Application editing is currently closed. Uploads are read-only.' });
    }

    await removeUploadFile(app[columnName]);
    await db('applications').where({ user_id: req.user.id }).update({
      [columnName]: null,
      updated_at: new Date()
    });

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function submitApplication(req, res) {
  try {
    const app = await db('applications').where({ user_id: req.user.id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (app.status !== 'Draft') {
      return res.status(400).json({ error: 'Application is already submitted.' });
    }

    const registrationAllowed = await isRegistrationOpen();
    if (!registrationAllowed) {
      return res.status(400).json({ error: 'Registration is closed. New submissions are not accepted.' });
    }

    const editingAllowed = await isEditingOpen();
    if (!editingAllowed) {
      return res.status(400).json({ error: 'Application editing is closed. Submission is not available.' });
    }

    // Mandatory field check
    const requiredFields = [
      'full_name', 'father_name', 'mother_name', 'age', 'blood_group', 'aadhaar_number',
      'phone_number', 'whatsapp_number', 'guardian_mobile',
      'house_name', 'place', 'pin_code', 'district',
      'class_name', 'roll_number',
      'guardian_name', 'guardian_phone',
      'essay_why_nss', 'photo_path', 'signature_path'
    ];

    const missing = [];
    for (const field of requiredFields) {
      if (!app[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Please complete all required fields and upload your Photo & Signature before submitting.',
        missingFields: missing
      });
    }

    await db('applications').where({ user_id: req.user.id }).update({
      status: 'Submitted',
      submitted_at: new Date(),
      updated_at: new Date()
    });

    // Create notification
    await db('notifications').insert({
      user_id: req.user.id,
      title: 'Application Submitted',
      message: 'Your NSS Application has been submitted successfully for verification.'
    });

    try {
      await sendMail(req.user.email, 'NSS Vettathur Application Submitted', 'application-submitted.html', {
        STUDENT_NAME: app.full_name || req.user.app_id,
        APP_ID: req.user.app_id
      });
    } catch (mailErr) {
      console.error('Failed to send application submitted email:', mailErr);
    }

    res.json({ message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getDashboardData(req, res) {
  try {
    const app = await db('applications').where({ user_id: req.user.id }).first();
    const notifications = await db('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(10);

    const [selectionOpen, editingOpen, registrationOpen] = await Promise.all([
      isSelectionOpen(),
      isEditingOpen(),
      isRegistrationOpen()
    ]);

    res.json({
      applicationStatus: app ? app.status : 'Draft',
      selectionOpen,
      editingOpen,
      registrationOpen,
      notifications,
      email: req.user.email,
      phone: req.user.phone
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  getApplication,
  getUploads,
  saveApplicationDraft,
  uploadDocument,
  deleteUpload,
  submitApplication,
  getDashboardData
};
