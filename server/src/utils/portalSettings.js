const db = require('../../../database/connection');

async function getSettingsMap(keys = null) {
  let query = db('settings').select('key', 'value');
  if (keys && keys.length) {
    query = query.whereIn('key', keys);
  }
  const rows = await query;
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

function isTruthy(value) {
  return String(value).toLowerCase() === 'true';
}

function isPastDeadline(isoValue) {
  if (!isoValue) return false;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return false;
  return date < new Date();
}

function isBeforeStart(isoValue) {
  if (!isoValue) return false;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return false;
  return date > new Date();
}

async function isRegistrationOpen() {
  const settings = await getSettingsMap([
    'registration_open',
    'registration_deadline',
    'registration_start'
  ]);

  if (!isTruthy(settings.registration_open)) return false;
  if (isBeforeStart(settings.registration_start)) return false;
  if (isPastDeadline(settings.registration_deadline)) return false;
  return true;
}

async function isEditingOpen() {
  const settings = await getSettingsMap(['editing_open', 'editing_deadline']);
  if (!isTruthy(settings.editing_open)) return false;
  if (isPastDeadline(settings.editing_deadline)) return false;
  return true;
}

async function isLoginEnabled() {
  const settings = await getSettingsMap(['login_enabled']);
  // Default to enabled if key is missing (legacy DBs)
  if (settings.login_enabled === undefined) return true;
  return isTruthy(settings.login_enabled);
}

async function isSelectionOpen() {
  const settings = await getSettingsMap(['selection_open']);
  return isTruthy(settings.selection_open);
}

function parseFaq(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function getPublicPortalStatus() {
  const settings = await getSettingsMap([
    'registration_open',
    'registration_start',
    'registration_deadline',
    'editing_open',
    'editing_deadline',
    'login_enabled',
    'selection_open',
    'result_date',
    'max_applicants',
    'contact_officer',
    'contact_email',
    'contact_phone',
    'faq_json'
  ]);

  const registrationOpen = await isRegistrationOpen();
  const editingOpen = await isEditingOpen();
  const loginEnabled = settings.login_enabled === undefined ? true : isTruthy(settings.login_enabled);
  const selectionOpen = isTruthy(settings.selection_open);

  let announcements = [];
  try {
    announcements = await db('announcements')
      .where({ is_published: true })
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'published_at', order: 'desc' }
      ])
      .select('id', 'title', 'body', 'published_at', 'sort_order');
  } catch (error) {
    announcements = [];
  }

  return {
    registrationOpen,
    editingOpen,
    loginEnabled,
    selectionOpen,
    dates: {
      registrationStart: settings.registration_start || null,
      registrationEnd: settings.registration_deadline || null,
      editingDeadline: settings.editing_deadline || null,
      resultDate: settings.result_date || null
    },
    contact: {
      unit: 'NSS Vettathur',
      officer: settings.contact_officer || 'Programme Officer, NSS Vettathur',
      email: settings.contact_email || '',
      phone: settings.contact_phone || ''
    },
    announcements,
    faq: parseFaq(settings.faq_json),
    maxApplicants: settings.max_applicants ? parseInt(settings.max_applicants, 10) : null
  };
}

module.exports = {
  getSettingsMap,
  isTruthy,
  isRegistrationOpen,
  isEditingOpen,
  isLoginEnabled,
  isSelectionOpen,
  getPublicPortalStatus
};
