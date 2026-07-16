const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { authenticateToken } = require('./middlewares/auth');
const db = require('../../database/connection');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const portalRoutes = require('./routes/portalRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve client static files
app.use(express.static(path.join(__dirname, '..', '..', 'client')));

// Protected uploads serving endpoint
app.get('/api/uploads/*', authenticateToken, async (req, res) => {
  try {
    const requestedPath = req.params[0];
    const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
    const resolvedPath = path.resolve(uploadsRoot, requestedPath);

    if (!resolvedPath.startsWith(path.resolve(uploadsRoot) + path.sep) || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Admin can access all uploads
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      return res.sendFile(resolvedPath);
    }

    // Students can only access their own uploads
    const application = await db('applications').where({ user_id: req.user.id }).first();
    if (
      application &&
      (application.photo_path === requestedPath ||
       application.signature_path === requestedPath ||
       application.docs_path === requestedPath)
    ) {
      return res.sendFile(resolvedPath);
    }

    return res.status(403).json({ error: 'Access denied to this file.' });
  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({ error: 'Failed to retrieve file.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/portal', portalRoutes);

// Fallback to client SPA router or index.html for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong on the server!' });
});

// Auto-migrate and seed on startup
async function init() {
  try {
    console.log('Running database migrations...');
    await db.migrate.latest();
    console.log('Migrations complete.');

    // Seed only if settings table is empty (first run)
    const settingsCount = await db('settings').count('key as count').first();
    if (!settingsCount || parseInt(settingsCount.count) === 0) {
      console.log('Seeding initial data...');
      await db.seed.run();
      console.log('Seeding complete.');
    }
  } catch (err) {
    console.error('Database init error:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`==================================================`);
    console.log(`NSS Portal Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`==================================================`);
  });
}

init();

module.exports = app;
