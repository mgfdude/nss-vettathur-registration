function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function isAdminRole(role) {
  const normalized = normalizeRole(role);
  return ['admin', 'superadmin', 'programme_officer', 'reviewer'].includes(normalized);
}

function isStudentRole(role) {
  return normalizeRole(role) === 'student';
}

module.exports = {
  normalizeRole,
  isAdminRole,
  isStudentRole
};
