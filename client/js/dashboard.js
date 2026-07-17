let currentStatus = 'Draft';
let autosaveTimeout;
let currentStepIndex = 0;
const applicationSteps = [
  { id: 'personal', title: 'Personal Information' },
  { id: 'academic', title: 'Academic Information' },
  { id: 'contact', title: 'Contact Information' },
  { id: 'profile', title: 'Volunteer Profile' },
  { id: 'uploads', title: 'Uploads' }
];
let latestPrintableApplicationHtml = '';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await auth.guard(['student']);
  if (!user) return;

  document.getElementById('user-welcome-sub').textContent = `Application ID: ${user.app_id}`;

  // Fetch baseline dashboard metrics & notifications
  await loadDashboardData();

  // Load application form info
  await loadApplicationForm();

  // Attach autosave inputs handler
  const form = document.getElementById('application-form');
  if (form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        if (currentStatus === 'Draft' && window.__editingOpen !== false) {
          triggerAutosave();
        }
      });
    });
  }
});

async function loadDashboardData() {
  try {
    const data = await api.get('/student/dashboard');
    currentStatus = data.applicationStatus;
    
    document.getElementById('display-email').textContent = data.email;
    document.getElementById('display-phone').textContent = data.phone;

    // Set Status Badge — hide final outcomes until results are published
    const badge = document.getElementById('application-status-badge');
    const finalStatuses = ['Selected', 'Rejected', 'Waitlisted'];
    const displayStatus = (!data.selectionOpen && finalStatuses.includes(currentStatus))
      ? 'Under Review'
      : currentStatus;
    badge.textContent = displayStatus;
    badge.className = `badge badge-${displayStatus.toLowerCase().replace(' ', '-')}`;

    // Handle Selection Result Alert Panel
    const banner = document.getElementById('selection-banner');
    if (data.selectionOpen && finalStatuses.includes(currentStatus)) {
      banner.style.display = 'block';
      if (currentStatus === 'Selected') {
        banner.className = 'alert alert-success';
        banner.innerHTML = '🎉 <strong>Selected!</strong> Congratulations, you have been selected to join the NSS Vettathur unit.';
      } else if (currentStatus === 'Rejected') {
        banner.className = 'alert alert-danger';
        banner.innerHTML = '❌ <strong>Not Selected.</strong> Thank you for your interest. Unfortunately, your application was not selected for this term.';
      } else {
        banner.className = 'alert alert-warning';
        banner.innerHTML = '⏳ <strong>Waitlisted.</strong> Your application has been waitlisted. We will notify you if a slot becomes available.';
      }
    } else {
      banner.style.display = 'none';
    }

    // Editing closed notice for draft applications
    let editingBanner = document.getElementById('editing-closed-banner');
    if (!editingBanner) {
      editingBanner = document.createElement('div');
      editingBanner.id = 'editing-closed-banner';
      editingBanner.className = 'alert alert-warning';
      editingBanner.style.display = 'none';
      const dashSection = document.getElementById('section-dashboard');
      if (dashSection) {
        const header = dashSection.querySelector('.content-header');
        if (header && header.nextSibling) {
          dashSection.insertBefore(editingBanner, header.nextSibling);
        } else {
          dashSection.prepend(editingBanner);
        }
      }
    }
    window.__editingOpen = data.editingOpen !== false;
    if (!window.__editingOpen && currentStatus === 'Draft') {
      editingBanner.style.display = 'flex';
      editingBanner.textContent = 'Application editing is currently closed. You can view your application, but changes and uploads are disabled.';
    } else {
      editingBanner.style.display = 'none';
    }

    // Populate Recent Notifications
    const container = document.getElementById('dashboard-notifications');
    const fullList = document.getElementById('notifications-list');
    container.innerHTML = '';
    fullList.innerHTML = '';

    if (data.notifications.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">No new announcements.</p>';
      fullList.innerHTML = '<p style="color: var(--text-muted);">No notifications available.</p>';
    } else {
      data.notifications.forEach(n => {
        const itemHtml = `
          <div class="stat-card" style="margin-bottom: 12px; border-left: 4px solid var(--primary);">
            <h4 style="color: var(--primary);">${n.title}</h4>
            <p style="font-size: 14px; margin-top: 5px;">${n.message}</p>
            <span style="font-size: 11px; color: var(--text-muted);">${new Date(n.created_at).toLocaleString()}</span>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHtml);
        fullList.insertAdjacentHTML('beforeend', itemHtml);
      });
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

async function loadApplicationForm() {
  try {
    const app = await api.get('/student/application');
    if (!app) return;

    // Populate fields
    document.getElementById('full_name').value = app.full_name || '';
    document.getElementById('father_name').value = app.father_name || '';
    document.getElementById('mother_name').value = app.mother_name || '';
    document.getElementById('dob-read').value = app.dob ? new Date(app.dob).toLocaleDateString('en-IN') : '';
    document.getElementById('age').value = app.age || '';
    document.getElementById('blood_group').value = app.blood_group || '';
    document.getElementById('aadhaar_number').value = app.aadhaar_number || '';
    document.getElementById('phone_number').value = app.phone_number || '';
    document.getElementById('whatsapp_number').value = app.whatsapp_number || '';
    document.getElementById('guardian_mobile').value = app.guardian_mobile || '';
    document.getElementById('house_name').value = app.house_name || '';
    document.getElementById('place').value = app.place || '';
    document.getElementById('pin_code').value = app.pin_code || '';
    document.getElementById('district').value = app.district || '';
    document.getElementById('class_name').value = app.class_name || '';
    document.getElementById('roll_number').value = app.roll_number || '';
    document.getElementById('guardian_name').value = app.guardian_name || '';
    document.getElementById('guardian_phone').value = app.guardian_phone || '';
    document.getElementById('emergency_phone').value = app.emergency_phone || '';
    document.getElementById('skills').value = app.skills || '';
    document.getElementById('interests').value = app.interests || '';
    document.getElementById('volunteer_exp').value = app.volunteer_exp || '';
    document.getElementById('essay_why_nss').value = app.essay_why_nss || '';

    // Handle Upload previews
    if (app.photo_path) {
      const img = document.getElementById('photo-preview');
      img.src = `/api/uploads/${app.photo_path}`;
      img.style.display = 'block';
      document.getElementById('photo-empty').style.display = 'none';
    }
    if (app.signature_path) {
      const img = document.getElementById('sig-preview');
      img.src = `/api/uploads/${app.signature_path}`;
      img.style.display = 'block';
      document.getElementById('sig-empty').style.display = 'none';
    }
    if (app.docs_path) {
      const docsPreview = document.getElementById('docs-preview');
      docsPreview.textContent = app.docs_path.toLowerCase().endsWith('.pdf') ? 'PDF attached' : 'Image attached';
    }

    await loadUploadedFiles();

    // Read-only Lock Checks
    if (currentStatus !== 'Draft' || window.__editingOpen === false) {
      lockFormFields();
    }

    updateWizardStep();
  } catch (err) {
    console.error('Failed to load application form:', err);
  }
}

function lockFormFields() {
  const form = document.getElementById('application-form');
  if (form) {
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.disabled = true;
    });
  }

  const isEditingClosedDraft = currentStatus === 'Draft' && window.__editingOpen === false;
  const submitBtn = document.getElementById('submit-app-btn');
  const saveBtn = document.getElementById('save-draft-btn');
  const statusEl = document.getElementById('autosave-status');

  submitBtn.disabled = true;
  submitBtn.textContent = isEditingClosedDraft ? 'Editing Closed' : 'Submitted';
  saveBtn.disabled = true;

  // Keep wizard navigation available so students can still view all steps read-only
  const nextBtn = document.getElementById('wizard-next-btn');
  if (nextBtn) nextBtn.disabled = false;

  if (statusEl) {
    statusEl.textContent = isEditingClosedDraft ? 'Editing Closed (Read-only)' : 'Application Locked';
    statusEl.style.color = isEditingClosedDraft ? 'var(--warning)' : 'var(--text-muted)';
  }

  // Disable uploads clicks
  const boxes = document.querySelectorAll('.upload-box');
  boxes.forEach(b => {
    b.onclick = null;
    b.style.cursor = 'default';
    b.style.borderColor = 'var(--border)';
  });
}

function switchTab(tabName) {
  // Toggle Side Menus
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`menu-${tabName}`).classList.add('active');

  // Toggle Sections
  document.getElementById('section-dashboard').style.display = tabName === 'dashboard' ? 'block' : 'none';
  document.getElementById('section-application').style.display = tabName === 'application' ? 'block' : 'none';
  document.getElementById('section-notifications').style.display = tabName === 'notifications' ? 'block' : 'none';

  if (tabName === 'application') {
    updateWizardStep();
  }
}

function showFormStep(stepId) {
  const nextIndex = applicationSteps.findIndex(step => step.id === stepId);
  if (nextIndex === -1) return;
  currentStepIndex = nextIndex;
  updateWizardStep();
}

function updateWizardStep() {
  const currentStep = applicationSteps[currentStepIndex];
  if (!currentStep) return;

  document.querySelectorAll('.form-section').forEach(sec => {
    sec.style.display = 'none';
  });

  const activeSection = document.getElementById(`form-tab-${currentStep.id}`);
  if (activeSection) {
    activeSection.style.display = 'block';
  }

  document.querySelectorAll('.form-section-tabs .tab-btn').forEach((btn, index) => {
    btn.classList.toggle('active', btn.dataset.step === currentStep.id);
    btn.classList.toggle('completed', index < currentStepIndex);
  });

  document.getElementById('wizard-step-count').textContent = `Step ${currentStepIndex + 1} of ${applicationSteps.length}`;
  document.getElementById('wizard-step-title').textContent = currentStep.title;
  document.getElementById('wizard-back-btn').disabled = currentStepIndex === 0;

  const isFinalStep = currentStepIndex === applicationSteps.length - 1;
  document.getElementById('wizard-next-btn').style.display = isFinalStep ? 'none' : 'inline-flex';
  document.getElementById('wizard-final-actions').style.display = isFinalStep ? 'flex' : 'none';
}

function goToNextStep() {
  if (currentStepIndex < applicationSteps.length - 1) {
    currentStepIndex += 1;
    updateWizardStep();
    scrollApplicationTop();
  }
}

function goToPreviousStep() {
  if (currentStepIndex > 0) {
    currentStepIndex -= 1;
    updateWizardStep();
    scrollApplicationTop();
  }
}

function scrollApplicationTop() {
  const section = document.getElementById('section-application');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function collectApplicationPayload() {
  const formData = new FormData(document.getElementById('application-form'));
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

function triggerAutosave() {
  document.getElementById('autosave-status').textContent = 'Saving...';
  document.getElementById('autosave-status').style.color = 'var(--warning)';

  clearTimeout(autosaveTimeout);
  autosaveTimeout = setTimeout(async () => {
    try {
      await api.patch('/student/application', collectApplicationPayload());
      document.getElementById('autosave-status').textContent = 'Autosaved';
      document.getElementById('autosave-status').style.color = 'var(--success)';
      Popup.toast('Application saved.', 'success');
    } catch (err) {
      document.getElementById('autosave-status').textContent = 'Autosave Failed';
      document.getElementById('autosave-status').style.color = 'var(--error)';
    }
  }, 1000);
}

async function saveApplicationDraftNow() {
  if (currentStatus !== 'Draft') return;

  try {
    document.getElementById('autosave-status').textContent = 'Saving draft...';
    document.getElementById('autosave-status').style.color = 'var(--warning)';
    clearTimeout(autosaveTimeout);
    Popup.loading('Saving application...');
    await api.patch('/student/application', collectApplicationPayload());
    Popup.closeLoading();
    document.getElementById('autosave-status').textContent = 'Draft saved';
    document.getElementById('autosave-status').style.color = 'var(--success)';
    Popup.success('Your application draft has been saved.', 'Draft saved');
  } catch (err) {
    Popup.closeLoading();
    document.getElementById('autosave-status').textContent = 'Save failed';
    document.getElementById('autosave-status').style.color = 'var(--error)';
    Popup.error(err.message);
  }
}

function triggerUpload(inputId) {
  if (currentStatus !== 'Draft') return;
  document.getElementById(inputId).click();
}

async function handleFileUpload(inputId, fileField) {
  const fileInput = document.getElementById(inputId);
  if (!fileInput.files.length) return;
  
  const file = fileInput.files[0];
  const validationError = validateUploadFile(file, fileField);
  if (validationError) {
    showUploadAlert(validationError, 'danger');
    fileInput.value = '';
    return;
  }

  document.getElementById('autosave-status').textContent = 'Uploading file...';
  document.getElementById('autosave-status').style.color = 'var(--warning)';
  setUploadProgress(fileField, 0);
  showUploadAlert('', 'danger', false);

  try {
    let endpoint = '/student/application/upload';
    if (fileField === 'signature') endpoint = '/student/application/upload-sig';
    if (fileField === 'docs') endpoint = '/student/application/upload-docs';

    Popup.loading('Uploading file...');
    const res = await api.upload(endpoint, file, fileField, (progress) => {
      setUploadProgress(fileField, progress);
    });

    Popup.closeLoading();
    document.getElementById('autosave-status').textContent = 'Uploaded';
    document.getElementById('autosave-status').style.color = 'var(--success)';
    showUploadAlert(`${file.name} uploaded successfully.`, 'success');
    Popup.toast('File uploaded successfully.', 'success');

    // Update displays
    if (fileField === 'photo') {
      const img = document.getElementById('photo-preview');
      img.src = res.upload.url;
      img.style.display = 'block';
      document.getElementById('photo-empty').style.display = 'none';
    } else if (fileField === 'signature') {
      const img = document.getElementById('sig-preview');
      img.src = res.upload.url;
      img.style.display = 'block';
      document.getElementById('sig-empty').style.display = 'none';
    } else {
      document.getElementById('docs-preview').textContent = res.upload.is_pdf ? 'PDF attached' : 'Image attached';
    }
    await loadUploadedFiles();
  } catch (err) {
    Popup.closeLoading();
    showUploadAlert(err.message, 'danger');
    document.getElementById('autosave-status').textContent = 'Upload Failed';
    document.getElementById('autosave-status').style.color = 'var(--error)';
  } finally {
    setTimeout(() => setUploadProgress(fileField, null), 800);
    fileInput.value = '';
  }
}

function validateUploadFile(file, fileField) {
  const maxSize = 2 * 1024 * 1024;
  const allowedImageTypes = ['image/jpeg', 'image/png'];
  const allowedDocTypes = [...allowedImageTypes, 'application/pdf'];
  const allowedTypes = fileField === 'docs' ? allowedDocTypes : allowedImageTypes;

  if (!allowedTypes.includes(file.type)) {
    return fileField === 'docs'
      ? 'Only PDF, JPG, or PNG files are supported for documents.'
      : 'Only JPG or PNG image files are supported here.';
  }

  if (file.size > maxSize) {
    return 'File size must be 2MB or less.';
  }

  return '';
}

function setUploadProgress(fileField, progress) {
  const wrap = document.getElementById(`${fileField}-progress-wrap`);
  const bar = document.getElementById(`${fileField}-progress-bar`);
  if (!wrap || !bar) return;

  if (progress === null) {
    wrap.style.display = 'none';
    bar.style.width = '0%';
    return;
  }

  wrap.style.display = 'block';
  bar.style.width = `${progress}%`;
}

function showUploadAlert(message, type = 'danger', visible = true) {
  const alert = document.getElementById('upload-alert');
  if (!alert) return;
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.style.display = visible ? 'flex' : 'none';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadUploadedFiles() {
  const list = document.getElementById('uploaded-files-list');
  if (!list) return;

  try {
    const data = await api.get('/student/application/uploads');
    list.innerHTML = '';

    if (!data.items.length) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No files uploaded yet.</p>';
      return;
    }

    data.items.forEach((item) => {
      const icon = item.is_image ? 'IMG' : 'PDF';
      const deleteButton = currentStatus === 'Draft'
        ? `<button type="button" class="btn btn-danger" onclick="deleteUploadedFile('${item.type}')">Delete</button>`
        : '';
      const row = `
        <div class="uploaded-file-row">
          <div class="file-type-icon">${icon}</div>
          <div class="uploaded-file-meta">
            <strong>${item.filename}</strong>
            <span>${new Date(item.uploaded_at).toLocaleString()} · ${formatFileSize(item.size)}</span>
          </div>
          <button type="button" class="btn btn-secondary" onclick="openStudentFilePreview('${item.url}', '${item.filename}', ${item.is_pdf}, ${item.is_image})">View</button>
          ${deleteButton}
        </div>
      `;
      list.insertAdjacentHTML('beforeend', row);
    });
  } catch (err) {
    list.innerHTML = `<p style="color: var(--error); font-size: 14px;">${err.message}</p>`;
  }
}

async function deleteUploadedFile(type) {
  const confirmed = await Popup.confirm('This file will be removed from your application. You can upload a replacement before final submission.', 'Delete uploaded file', {
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    Popup.loading('Deleting file...');
    await api.delete(`/student/application/uploads/${type}`);
    Popup.closeLoading();
    showUploadAlert('File deleted successfully.', 'success');
    Popup.toast('File deleted.', 'success');
    if (type === 'photo') {
      document.getElementById('photo-preview').style.display = 'none';
      document.getElementById('photo-empty').style.display = 'block';
    } else if (type === 'signature') {
      document.getElementById('sig-preview').style.display = 'none';
      document.getElementById('sig-empty').style.display = 'block';
    } else {
      document.getElementById('docs-preview').textContent = 'PDF / Image';
    }
    await loadUploadedFiles();
  } catch (err) {
    Popup.closeLoading();
    showUploadAlert(err.message, 'danger');
    Popup.error(err.message);
  }
}

async function submitApplication() {
  const confirmed = await Popup.confirm('After submission, you will not be able to edit the application or uploaded files.', 'Submit application?', {
    confirmText: 'Submit',
    cancelText: 'Review again'
  });
  if (!confirmed) return;
  
  try {
    clearTimeout(autosaveTimeout);
    document.getElementById('autosave-status').textContent = 'Saving final draft...';
    document.getElementById('autosave-status').style.color = 'var(--warning)';
    Popup.loading('Submitting application...');
    await api.patch('/student/application', collectApplicationPayload());

    await api.post('/student/application/submit');
    Popup.closeLoading();
    await Popup.success('Your application has been submitted successfully.', 'Application submitted');
    currentStatus = 'Submitted';
    loadDashboardData();
    lockFormFields();
    switchTab('dashboard');
  } catch (err) {
    Popup.closeLoading();
    Popup.error(err.message);
  }
}

async function handleLogout() {
  const confirmed = await Popup.confirm('You will need to sign in again to access the portal.', 'Log out?', {
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

function openStudentFilePreview(url, filename, isPdf, isImage) {
  const title = filename || 'Uploaded file';
  if (isImage) {
    Popup.show({
      type: 'info',
      title,
      message: `<img src="${url}" alt="${title}" style="max-width:100%;max-height:65vh;border-radius:10px;">`,
      confirmText: 'Close'
    });
  } else if (isPdf) {
    Popup.show({
      type: 'info',
      title,
      message: `<iframe src="${url}" title="${title}" style="width:100%;height:65vh;border:0;border-radius:10px;"></iframe>`,
      confirmText: 'Close'
    });
  } else {
    Popup.info('Preview is not available for this file type.', title);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchProtectedDataUrl(url) {
  async function fetchBlob() {
    const response = await fetch(url, {
      credentials: 'include',
      headers: auth.getToken() ? { Authorization: `Bearer ${auth.getToken()}` } : {}
    });

    if ((response.status === 401 || response.status === 403)) {
      await auth.refreshSession();
      return fetch(url, {
        credentials: 'include',
        headers: auth.getToken() ? { Authorization: `Bearer ${auth.getToken()}` } : {}
      });
    }

    return response;
  }

  const response = await fetchBlob();
  if (!response.ok) return '';
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

function printableField(label, value) {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td>${escapeHtml(value || '—')}</td>
    </tr>
  `;
}

function printableSection(title, rows) {
  return `
    <h2>${escapeHtml(title)}</h2>
    <table>${rows}</table>
  `;
}

async function buildPrintableApplicationHtml(app, user) {
  const photoUrl = app.photo_path ? await fetchProtectedDataUrl(`/api/uploads/${app.photo_path}`) : '';
  const signatureUrl = app.signature_path ? await fetchProtectedDataUrl(`/api/uploads/${app.signature_path}`) : '';

  const submittedDate = app.submitted_at
    ? new Date(app.submitted_at).toLocaleString('en-IN')
    : 'Not submitted';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NSS Application - ${escapeHtml(user.app_id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
    .sheet { max-width: 900px; margin: 0 auto; border: 1px solid #111827; padding: 22px; }
    .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: .2px; }
    .header p { margin: 2px 0; font-size: 13px; }
    .top-grid { display: grid; grid-template-columns: 1fr 130px; gap: 18px; align-items: start; margin-bottom: 14px; }
    .photo-box { border: 1px solid #111827; min-height: 150px; display: flex; align-items: center; justify-content: center; font-size: 12px; text-align: center; }
    .photo-box img { max-width: 100%; max-height: 148px; object-fit: contain; }
    .meta { border: 1px solid #111827; }
    .meta div { display: grid; grid-template-columns: 150px 1fr; border-bottom: 1px solid #111827; }
    .meta div:last-child { border-bottom: 0; }
    .meta strong, .meta span { padding: 8px; font-size: 13px; }
    h2 { margin: 18px 0 8px; font-size: 15px; border-bottom: 1px solid #111827; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td { border: 1px solid #111827; padding: 8px; vertical-align: top; font-size: 13px; }
    td.label { width: 32%; font-weight: 700; background: #f3f4f6; }
    .essay { min-height: 74px; white-space: pre-wrap; }
    .signature-row { display: grid; grid-template-columns: 1fr 220px; gap: 18px; margin-top: 24px; align-items: end; }
    .signature-box { border-top: 1px solid #111827; text-align: center; padding-top: 6px; min-height: 74px; }
    .signature-box img { max-width: 180px; max-height: 58px; display: block; margin: 0 auto 6px; object-fit: contain; }
    .declaration { font-size: 13px; line-height: 1.5; }
    .footer-note { margin-top: 16px; font-size: 11px; color: #374151; text-align: center; }
    @media print {
      body { padding: 0; }
      .sheet { border: 0; }
      @page { size: A4; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1>National Service Scheme (NSS) - Vettathur</h1>
      <p>Student Application Form for School Submission</p>
      <p>Official Student Portal Generated Copy</p>
    </div>

    <div class="top-grid">
      <div class="meta">
        <div><strong>Application ID</strong><span>${escapeHtml(user.app_id)}</span></div>
        <div><strong>Status</strong><span>${escapeHtml(app.status || 'Draft')}</span></div>
        <div><strong>Submitted Date</strong><span>${escapeHtml(submittedDate)}</span></div>
        <div><strong>Generated On</strong><span>${escapeHtml(new Date().toLocaleString('en-IN'))}</span></div>
      </div>
      <div class="photo-box">${photoUrl ? `<img src="${photoUrl}" alt="Applicant photo">` : 'Applicant<br>Photo'}</div>
    </div>

    ${printableSection('Personal Information', [
      printableField('Full Name', app.full_name),
      printableField('Father Name', app.father_name),
      printableField('Mother Name', app.mother_name),
      printableField('Date of Birth', app.dob ? new Date(app.dob).toLocaleDateString('en-IN') : ''),
      printableField('Age', app.age),
      printableField('Blood Group', app.blood_group),
      printableField('Aadhaar Number', app.aadhaar_number)
    ].join(''))}

    ${printableSection('Contact and Address', [
      printableField('Registered Email', user.email),
      printableField('Registered Phone', user.phone),
      printableField('Phone Number', app.phone_number),
      printableField('WhatsApp Number', app.whatsapp_number),
      printableField('Parent/Guardian Mobile', app.guardian_mobile),
      printableField('House Name', app.house_name),
      printableField('Place', app.place),
      printableField('PIN Code', app.pin_code),
      printableField('District', app.district)
    ].join(''))}

    ${printableSection('Academic Information', [
      printableField('Class', app.class_name),
      printableField('Roll Number', app.roll_number)
    ].join(''))}

    ${printableSection('Emergency Contact', [
      printableField('Guardian Name', app.guardian_name),
      printableField('Guardian Phone', app.guardian_phone),
      printableField('Alternate Emergency Number', app.emergency_phone)
    ].join(''))}

    ${printableSection('Volunteer Profile', [
      printableField('Skills and Hobbies', app.skills),
      printableField('Interests', app.interests),
      printableField('Previous Volunteering Experience', app.volunteer_exp),
      `<tr><td class="label">Why do you want to join NSS?</td><td class="essay">${escapeHtml(app.essay_why_nss || '—')}</td></tr>`
    ].join(''))}

    ${printableSection('Uploaded Documents', [
      printableField('Photo', app.photo_path ? 'Uploaded' : 'Not uploaded'),
      printableField('Signature', app.signature_path ? 'Uploaded' : 'Not uploaded'),
      printableField('Supporting Document', app.docs_path ? 'Uploaded' : 'Not uploaded')
    ].join(''))}

    <div class="signature-row">
      <div class="declaration">
        I hereby declare that the details furnished above are true to the best of my knowledge. I agree to follow the rules and responsibilities of the National Service Scheme.
      </div>
      <div class="signature-box">
        ${signatureUrl ? `<img src="${signatureUrl}" alt="Applicant signature">` : ''}
        Applicant Signature
      </div>
    </div>

    <div class="footer-note">Generated from NSS Vettathur Official Student Portal. Please print, sign if required, and submit to the school office.</div>
  </div>
</body>
</html>`;
}

async function prepareApplicationPrintout() {
  try {
    Popup.loading('Preparing printable application form...');
    const [app, dashboard] = await Promise.all([
      api.get('/student/application'),
      api.get('/student/dashboard')
    ]);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const printUser = {
      app_id: user.app_id || 'NSS-APPLICATION',
      email: dashboard.email || user.email || '',
      phone: dashboard.phone || ''
    };

    latestPrintableApplicationHtml = await buildPrintableApplicationHtml(app, printUser);
    Popup.closeLoading();

    Popup.show({
      type: 'info',
      title: 'Application Form',
      wide: true,
      message: `
        <div class="print-preview-actions">
          <button type="button" class="btn btn-primary" onclick="printPreparedApplication()">Print Form</button>
          <button type="button" class="btn btn-secondary" onclick="downloadPreparedApplication()">Download HTML</button>
        </div>
        <iframe id="application-print-preview" class="print-preview-frame" title="Application print preview"></iframe>
      `,
      confirmText: 'Close'
    });

    setTimeout(() => {
      const frame = document.getElementById('application-print-preview');
      if (frame) frame.srcdoc = latestPrintableApplicationHtml;
    }, 0);
  } catch (err) {
    Popup.closeLoading();
    Popup.error(err.message, 'Could not prepare form');
  }
}

function printPreparedApplication() {
  if (!latestPrintableApplicationHtml) return;
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = latestPrintableApplicationHtml;
}

function downloadPreparedApplication() {
  if (!latestPrintableApplicationHtml) return;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const filename = `NSS_Application_${(user.app_id || 'student').replace(/[^A-Za-z0-9_-]/g, '_')}.html`;
  const blob = new Blob([latestPrintableApplicationHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  Popup.toast('Application form downloaded.', 'success');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}
