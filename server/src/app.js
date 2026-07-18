const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('../config');
const { authenticateToken } = require('./middlewares/auth');
const db = require('../../database/connection');
const {
  getStorageDownloadUrl,
  sanitizeStoragePath
} = require('./utils/supabaseStorage');

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
    const requestedPath = sanitizeStoragePath(req.params[0]);
    if (!requestedPath) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    let allowed = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!allowed) {
      const application = await db('applications').where({ user_id: req.user.id }).first();
      allowed = Boolean(
        application &&
        (application.photo_path === requestedPath ||
         application.signature_path === requestedPath ||
         application.docs_path === requestedPath)
      );
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Access denied to this file.' });
    }

    const signedUrl = await getStorageDownloadUrl(requestedPath);
    if (!signedUrl) {
      return res.status(404).json({ error: 'File not found.' });
    }

    return res.redirect(signedUrl);
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
    setupConsoleCommands();
  });
}

function setupConsoleCommands() {
  if (!process.stdin.isTTY) {
    console.log('Console commands disabled: stdin is not a TTY.');
    return;
  }

  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  console.log('Console command mode enabled. Type "help" for commands.');

  function formatTimestamp(value) {
    if (!value) return 'never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `date = ${date.toLocaleDateString('en-GB')} time = ${date.toLocaleTimeString('en-GB')}`;
  }

  process.stdin.on('data', async (input) => {
    const text = String(input).trim();
    if (!text) return;

    const [command, ...args] = text.split(/\s+/);
    try {
      switch (command.toLowerCase()) {
        case 'help':
          console.log('Available commands:');
          console.log('  help                 - show this help');
          console.log('  catch <NSS_UID>      - show status for a specific user app_id');
          console.log('  techora              - show all active users');
          console.log('  active               - same as techora');
          console.log('  inactive             - show all inactive users');
          console.log('  exit                 - stop the server process');
          break;

        case 'catch': {
          const appId = args.join(' ');
          if (!appId) {
            console.log('Usage: catch <NSS_UID>');
            break;
          }
          const user = await db('users').where({ app_id: appId }).first();
          if (!user) {
            console.log(`User not found: ${appId}`);
            break;
          }
          console.log('User status:');
          console.log(`  id: ${user.id}`);
          console.log(`  app_id: ${user.app_id}`);
          console.log(`  email: ${user.email}`);
          console.log(`  role: ${user.role}`);
          console.log(`  is_active: ${user.is_active}`);
          console.log(`  failed_login_attempts: ${user.failed_login_attempts}`);
          console.log(`  locked_until: ${formatTimestamp(user.locked_until)}`);
          console.log(`  last_login: ${formatTimestamp(user.last_login)}`);
          console.log(`  last_login_at: ${formatTimestamp(user.last_login_at)}`);
          console.log(`  last_login_ip: ${user.last_login_ip}`);
          console.log(`  created_at: ${formatTimestamp(user.created_at)}`);
          console.log(`  updated_at: ${formatTimestamp(user.updated_at)}`);
          break;
        }

        case 'techora':
        case 'active': {
          const users = await db('users').where({ is_active: true }).orderBy('app_id', 'asc').select('id', 'app_id', 'email', 'role', 'last_login_at');
          if (!users.length) {
            console.log('No active users found.');
            break;
          }
          console.log(`Active users (${users.length}):`);
          users.forEach((user) => {
            console.log(`  ${user.app_id} | ${user.role} | last_login_at=${formatTimestamp(user.last_login_at)} | email=${user.email}`);
          });
          break;
        }

        case 'inactive': {
          const users = await db('users').where({ is_active: false }).orderBy('app_id', 'asc').select('id', 'app_id', 'email', 'role', 'last_login_at');
          if (!users.length) {
            console.log('No inactive users found.');
            break;
          }
          console.log(`Inactive users (${users.length}):`);
          users.forEach((user) => {
            console.log(`  ${user.app_id} | ${user.role} | last_login_at=${formatTimestamp(user.last_login_at)} | email=${user.email}`);
          });
          break;
        }

        case 'exit':
          console.log('Shutting down server...');
          process.exit(0);
          break;

        default:
          console.log(`Unknown command: ${command}. Type "help" for a list of commands.`);
      }
    } catch (err) {
      console.error('Console command error:', err);
    }
  });
}

init();

module.exports = app;
