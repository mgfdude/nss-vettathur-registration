let selectedApplicationId = null;
let currentApplicationsList = [];
let activePreviewFiles = {};

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.guard(['admin', 'superadmin']);
  if (!user) return;

  // Initial load
  loadDashboardStats();
  loadApplicationsList();

  // Settings tab form binding
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', handleSettingsSave);
  }

  const addAnnouncementBtn = document.getElementById('btn-add-announcement');
  if (addAnnouncementBtn) {
    addAnnouncementBtn.addEventListener('click', handleAddAnnouncement);
  }

  // Drawer evaluation form binding
  const evaluationForm = document.getElementById('review-decision-form');
  if (evaluationForm) {
    evaluationForm.addEventListener('submit', handleReviewSubmit);
  }
});

async function loadDashboardStats() {
  try {
    const stats = await api.get('/admin/stats');
    document.getElementById('stats-total').textContent = stats.totalStudents;
    document.getElementById('stats-submitted').textContent = stats.Submitted;
    document.getElementById('stats-selected').textContent = stats.Selected;
    document.getElementById('stats-waitlisted').textContent = stats.Waitlisted;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadApplicationsList() {
  const search = document.getElementById('admin-search').value.trim();
  const status = document.getElementById('admin-filter-status').value;
  const tbody = document.getElementById('applications-table-body');

  try {
    let endpoint = `/admin/applications?page=1&limit=50`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (status) endpoint += `&status=${status}`;

    const data = await api.get(endpoint);
    tbody.innerHTML = '';
    currentApplicationsList = data.items;

    if (data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No applications match the search filters.</td></tr>';
      return;
    }

    data.items.forEach(app => {
      const fullname = app.full_name || `${app.first_name || 'Draft'} ${app.last_name || ''}`.trim();
      const classRoll = app.class_name ? `${app.class_name} / ${app.roll_number || ''}` : 'N/A';
      const row = `
        <tr>
          <td><strong class="admin-app-id">${app.app_id}</strong></td>
          <td>
            <div class="admin-student-cell">
              <strong>${fullname}</strong>
              <span>${app.email || 'No email'}</span>
            </div>
          </td>
          <td>${classRoll}</td>
          <td><span class="badge badge-${app.status.toLowerCase().replace(' ', '-')}">${app.status}</span></td>
          <td><span class="score-pill">${app.interview_marks || 0}</span></td>
          <td>${app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}</td>
          <td>
            <button class="btn btn-secondary admin-review-btn" onclick="openReviewDrawer(${app.id})">Review</button>
          </td>
        </tr>
      `;
      tbody.insertAdjacentHTML('beforeend', row);
    });
  } catch (err) {
    console.error('Failed to load applications:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--error);">Error: ${err.message}</td></tr>`;
    Popup.error(err.message, 'Could not load applications');
  }
}

async function openReviewDrawer(applicationId) {
  selectedApplicationId = applicationId;
  const drawer = document.getElementById('admin-review-drawer');
  const alertBox = document.getElementById('drawer-alert');
  alertBox.style.display = 'none';

  try {
    const app = await api.get(`/admin/applications/${applicationId}`);
    
    document.getElementById('drawer-subtitle').textContent = `App ID: ${app.app_id}`;
    document.getElementById('view-fullname').textContent = app.full_name || `${app.first_name || 'N/A'} ${app.last_name || ''}`;
    document.getElementById('view-email').textContent = app.email || 'N/A';
    document.getElementById('view-phone').textContent = app.phone || 'N/A';
    document.getElementById('view-dob').textContent = app.dob ? new Date(app.dob).toLocaleDateString() : 'N/A';
    document.getElementById('view-class').textContent = `${app.class_name || 'N/A'} / ${app.roll_number || 'N/A'}`;
    document.getElementById('view-guardian').textContent = `${app.guardian_name || 'N/A'} (${app.guardian_phone || 'N/A'})`;
    
    document.getElementById('view-skills').textContent = app.skills || 'N/A';
    document.getElementById('view-interests').textContent = app.interests || 'N/A';
    document.getElementById('view-exp').textContent = app.volunteer_exp || 'N/A';
    document.getElementById('view-why').textContent = app.essay_why_nss || 'N/A';

    activePreviewFiles = {
      photo: app.photo_path ? { title: 'Applicant Photo', path: app.photo_path } : null,
      signature: app.signature_path ? { title: 'Signature', path: app.signature_path } : null,
      docs: app.docs_path ? { title: 'Supporting Document', path: app.docs_path } : null
    };

    configurePreviewButton('link-photo', activePreviewFiles.photo);
    configurePreviewButton('link-sig', activePreviewFiles.signature);
    configurePreviewButton('link-docs', activePreviewFiles.docs);

    // Populate Evaluation Form Values
    document.getElementById('eval-marks').value = app.interview_marks || 0;
    document.getElementById('eval-remarks').value = app.admin_remarks || '';
    document.getElementById('eval-status').value = app.status;

    drawer.classList.add('open');
  } catch (err) {
    Popup.error(err.message, 'Failed to load application');
  }
}

function closeDrawer() {
  document.getElementById('admin-review-drawer').classList.remove('open');
}

function configurePreviewButton(buttonId, fileInfo) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  if (!fileInfo) {
    button.style.display = 'none';
    button.onclick = null;
    return;
  }

  button.style.display = 'inline-flex';
  button.onclick = () => openFilePreview(fileInfo.title, fileInfo.path);
}

function openFilePreview(title, filePath) {
  const modal = document.getElementById('file-preview-modal');
  const body = document.getElementById('file-preview-body');
  const titleEl = document.getElementById('file-preview-title');
  const subtitleEl = document.getElementById('file-preview-subtitle');
  const url = `/api/uploads/${filePath}`;
  const filename = filePath.split('/').pop();
  const isPdf = /\.pdf$/i.test(filePath);
  const isImage = /\.(png|jpe?g)$/i.test(filePath);

  titleEl.textContent = title;
  subtitleEl.textContent = filename;
  body.innerHTML = '';

  if (isImage) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = title;
    img.className = 'file-preview-image';
    body.appendChild(img);
  } else if (isPdf) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = title;
    iframe.className = 'file-preview-frame';
    body.appendChild(iframe);
  } else {
    body.innerHTML = '<p style="color: var(--text-muted);">Preview is not available for this file type.</p>';
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeFilePreview() {
  const modal = document.getElementById('file-preview-modal');
  const body = document.getElementById('file-preview-body');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  body.innerHTML = '';
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeFilePreview();
  }
});

async function handleReviewSubmit(e) {
  e.preventDefault();
  const alertBox = document.getElementById('drawer-alert');
  alertBox.style.display = 'none';

  const status = document.getElementById('eval-status').value;
  const interview_marks = parseInt(document.getElementById('eval-marks').value, 10) || 0;
  const admin_remarks = document.getElementById('eval-remarks').value;

  try {
    Popup.loading('Saving review...');
    await api.patch(`/admin/applications/${selectedApplicationId}`, {
      status,
      interview_marks,
      admin_remarks
    });

    Popup.closeLoading();
    alertBox.className = 'alert alert-success';
    alertBox.textContent = 'Application review changes saved successfully!';
    alertBox.style.display = 'flex';
    Popup.toast('Review saved successfully.', 'success');

    // Refresh data lists
    loadDashboardStats();
    loadApplicationsList();

    setTimeout(() => {
      closeDrawer();
    }, 1000);
  } catch (err) {
    Popup.closeLoading();
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = err.message;
    alertBox.style.display = 'flex';
    Popup.error(err.message);
  }
}

async function switchAdminTab(tabName) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`menu-${tabName}`).classList.add('active');

  document.getElementById('section-applications').style.display = tabName === 'applications' ? 'block' : 'none';
  document.getElementById('section-settings').style.display = tabName === 'settings' ? 'block' : 'none';

  if (tabName === 'settings') {
    loadSettings();
    loadAnnouncementsAdmin();
  }
}

async function loadSettings() {
  try {
    const settings = await api.get('/admin/settings');
    document.getElementById('setting-reg-open').value = settings.registration_open || 'false';
    document.getElementById('setting-editing-open').value = settings.editing_open || 'true';
    document.getElementById('setting-login-enabled').value = settings.login_enabled || 'true';
    document.getElementById('setting-selection-open').value = settings.selection_open || 'false';
    document.getElementById('setting-reg-start').value = settings.registration_start || '';
    document.getElementById('setting-reg-deadline').value = settings.registration_deadline || '';
    document.getElementById('setting-editing-deadline').value = settings.editing_deadline || '';
    document.getElementById('setting-result-date').value = settings.result_date || '';
    document.getElementById('setting-max-applicants').value = settings.max_applicants || '100';
    document.getElementById('setting-contact-officer').value = settings.contact_officer || '';
    document.getElementById('setting-contact-email').value = settings.contact_email || '';
    document.getElementById('setting-contact-phone').value = settings.contact_phone || '';
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function handleSettingsSave(e) {
  e.preventDefault();
  const alertBox = document.getElementById('settings-alert');
  alertBox.className = 'alert alert-success';
  alertBox.style.display = 'none';

  const payload = {
    registration_open: document.getElementById('setting-reg-open').value,
    editing_open: document.getElementById('setting-editing-open').value,
    login_enabled: document.getElementById('setting-login-enabled').value,
    selection_open: document.getElementById('setting-selection-open').value,
    registration_start: document.getElementById('setting-reg-start').value.trim(),
    registration_deadline: document.getElementById('setting-reg-deadline').value.trim(),
    editing_deadline: document.getElementById('setting-editing-deadline').value.trim(),
    result_date: document.getElementById('setting-result-date').value.trim(),
    max_applicants: document.getElementById('setting-max-applicants').value.trim(),
    contact_officer: document.getElementById('setting-contact-officer').value.trim(),
    contact_email: document.getElementById('setting-contact-email').value.trim(),
    contact_phone: document.getElementById('setting-contact-phone').value.trim()
  };

  try {
    Popup.loading('Saving portal settings...');
    await api.patch('/admin/settings', payload);

    Popup.closeLoading();
    alertBox.textContent = 'Configuration settings saved successfully.';
    alertBox.style.display = 'flex';
    Popup.success('Portal settings have been updated.', 'Settings saved');
  } catch (err) {
    Popup.closeLoading();
    alertBox.className = 'alert alert-danger';
    alertBox.textContent = err.message;
    alertBox.style.display = 'flex';
    Popup.error(err.message);
  }
}

async function loadAnnouncementsAdmin() {
  const list = document.getElementById('announcements-admin-list');
  if (!list) return;

  try {
    const data = await api.get('/admin/announcements');
    const items = data.items || [];
    if (!items.length) {
      list.innerHTML = '<p style="color: var(--text-muted);">No announcements yet. Add a notice for the public home page.</p>';
      return;
    }

    list.innerHTML = items.map((item) => `
      <div class="stat-card" style="margin-bottom: 12px;" data-announcement-id="${item.id}">
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;">
          <div>
            <h4 style="color: var(--primary); margin-bottom: 4px;">${escapeHtml(item.title)}</h4>
            <p style="font-size: 14px; margin-bottom: 6px;">${escapeHtml(item.body)}</p>
            <span style="font-size: 12px; color: var(--text-muted);">
              ${item.is_published ? 'Published' : 'Hidden'} · Order ${item.sort_order}
            </span>
          </div>
          <div style="display: flex; gap: 8px; flex-shrink: 0;">
            <button type="button" class="btn btn-secondary" style="width: auto; padding: 6px 10px;" onclick="editAnnouncement(${item.id})">Edit</button>
            <button type="button" class="btn btn-danger" style="width: auto; padding: 6px 10px;" onclick="deleteAnnouncement(${item.id})">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="color: var(--error);">${escapeHtml(err.message)}</p>`;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function promptAnnouncement(defaults = {}) {
  const title = window.prompt('Announcement title', defaults.title || '');
  if (title === null) return null;
  const body = window.prompt('Announcement body', defaults.body || '');
  if (body === null) return null;
  const published = window.confirm('Publish this announcement on the public home page?');
  const sortRaw = window.prompt('Sort order (number)', String(defaults.sort_order ?? 0));
  if (sortRaw === null) return null;
  return {
    title: title.trim(),
    body: body.trim(),
    is_published: published,
    sort_order: parseInt(sortRaw, 10) || 0
  };
}

async function handleAddAnnouncement() {
  const payload = await promptAnnouncement();
  if (!payload || !payload.title || !payload.body) return;

  try {
    Popup.loading('Creating announcement...');
    await api.post('/admin/announcements', payload);
    Popup.closeLoading();
    Popup.success('Announcement published.', 'Saved');
    loadAnnouncementsAdmin();
  } catch (err) {
    Popup.closeLoading();
    Popup.error(err.message);
  }
}

async function editAnnouncement(id) {
  try {
    const data = await api.get('/admin/announcements');
    const item = (data.items || []).find((row) => row.id === id);
    if (!item) return;

    const payload = await promptAnnouncement(item);
    if (!payload || !payload.title || !payload.body) return;

    Popup.loading('Updating announcement...');
    await api.patch(`/admin/announcements/${id}`, payload);
    Popup.closeLoading();
    Popup.success('Announcement updated.', 'Saved');
    loadAnnouncementsAdmin();
  } catch (err) {
    Popup.closeLoading();
    Popup.error(err.message);
  }
}

async function deleteAnnouncement(id) {
  const confirmed = await Popup.confirm('This notice will be removed from the public home page.', 'Delete announcement?', {
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    Popup.loading('Deleting...');
    await api.delete(`/admin/announcements/${id}`);
    Popup.closeLoading();
    Popup.success('Announcement deleted.');
    loadAnnouncementsAdmin();
  } catch (err) {
    Popup.closeLoading();
    Popup.error(err.message);
  }
}

function exportData() {
  if (currentApplicationsList.length === 0) {
    Popup.info('No applications match the current filters.', 'Nothing to export');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Application ID,Email,Phone,Name,Class,Roll Number,Status,Interview Marks\n";

  currentApplicationsList.forEach(app => {
    const name = `"${app.full_name || `${app.first_name || ''} ${app.last_name || ''}`.trim()}"`;
    const row = `${app.app_id},${app.email},${app.phone},${name},${app.class_name || ''},${app.roll_number || ''},${app.status},${app.interview_marks || 0}`;
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `NSS_Applications_${new Date().toLocaleDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function handleLogout() {
  const confirmed = await Popup.confirm('You will need to sign in again to access the admin portal.', 'Log out?', {
    confirmText: 'Logout',
    cancelText: 'Stay'
  });
  if (!confirmed) return;
  try {
    await api.post('/auth/logout');
  } catch (err) {
    console.error(err);
  }
  auth.clearSession('');
  window.location.href = '/index.html';
}
