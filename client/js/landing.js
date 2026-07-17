function formatPortalDate(isoValue) {
  if (!isoValue) return 'To be announced';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setStatusBadge(el, open, openLabel, closedLabel) {
  if (!el) return;
  el.textContent = open ? openLabel : closedLabel;
  el.className = `status-value ${open ? 'is-open' : 'is-closed'}`;
}

function setRegisterVisibility(isOpen) {
  ['header-register-btn', 'hero-register-btn', 'quick-register'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isOpen) {
      el.hidden = false;
      el.removeAttribute('aria-disabled');
      el.classList.remove('is-disabled');
      if (el.tagName === 'A') el.href = '/register.html';
    } else {
      el.hidden = id !== 'quick-register';
      if (id === 'quick-register') {
        el.classList.add('is-disabled');
        el.setAttribute('aria-disabled', 'true');
        el.href = '#';
        el.title = 'Registration is currently closed';
        el.textContent = 'Register (Closed)';
      }
    }
  });
}

function setLoginAvailability(isEnabled) {
  window.portalLoginEnabled = isEnabled;

  ['header-login-btn', 'hero-login-btn', 'quick-login'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isEnabled) {
      el.hidden = false;
      el.removeAttribute('aria-disabled');
      el.classList.remove('is-disabled');
      if (el.tagName === 'A') el.href = '/login.html';
      el.title = '';
    } else {
      el.hidden = false;
      el.classList.add('is-disabled');
      el.setAttribute('aria-disabled', 'true');
      el.href = '#';
      el.title = 'Login is not available yet';
      if (id === 'quick-login') {
        el.textContent = 'Login (Coming Soon)';
      }
    }
  });

  ['quick-forgot', 'quick-recover'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !isEnabled;
    if (!isEnabled) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
    }
  });
}

async function redirectIfLoggedIn(event) {
  if (window.portalLoginEnabled === false) {
    if (event) event.preventDefault();
    Popup.warning('Login is not available yet. Please check back later.', 'Login unavailable');
    return;
  }

  const token = auth.getToken();
  if (!token) return;

  if (event) event.preventDefault();

  try {
    const data = await api.get('/auth/me', { skipAuthRedirect: true });
    const role = data.user && data.user.role;
    window.location.href = (role === 'admin' || role === 'superadmin')
      ? '/admin.html'
      : '/dashboard.html';
  } catch (error) {
    // Session invalid — stay on public pages
  }
}

function renderAnnouncements(items) {
  const container = document.getElementById('announcements-list');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<p class="landing-muted">No announcements at this time. Please check back later.</p>';
    return;
  }

  container.innerHTML = items.map((item) => `
    <article class="landing-announcement">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <time datetime="${escapeHtml(item.published_at || '')}">${formatPortalDate(item.published_at)}</time>
    </article>
  `).join('');
}

function renderFaq(items) {
  const container = document.getElementById('faq-list');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<p class="landing-muted">FAQ will be published soon.</p>';
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <details class="landing-faq-item" ${index === 0 ? 'open' : ''}>
      <summary>${escapeHtml(item.q)}</summary>
      <p>${escapeHtml(item.a)}</p>
    </details>
  `).join('');
}

function renderPortalStatus(status) {
  const badges = document.getElementById('hero-status-badges');
  if (badges) {
    badges.innerHTML = `
      <span class="status-badge ${status.registrationOpen ? 'is-open' : 'is-closed'}">
        Registration ${status.registrationOpen ? 'Open' : 'Closed'}
      </span>
      <span class="status-badge ${status.editingOpen ? 'is-open' : 'is-closed'}">
        Editing ${status.editingOpen ? 'Open' : 'Closed'}
      </span>
      <span class="status-badge ${status.selectionOpen ? 'is-open' : 'is-muted'}">
        Results ${status.selectionOpen ? 'Published' : 'Not Published'}
      </span>
    `;
  }

  setStatusBadge(
    document.getElementById('status-registration'),
    status.registrationOpen,
    'Open',
    'Closed'
  );
  setStatusBadge(
    document.getElementById('status-editing'),
    status.editingOpen,
    'Open',
    'Closed'
  );
  setStatusBadge(
    document.getElementById('status-results'),
    status.selectionOpen,
    'Published',
    'Not Published'
  );

  setRegisterVisibility(status.registrationOpen);

  const editingNotice = document.getElementById('editing-notice');
  if (editingNotice) {
    if (!status.editingOpen) {
      editingNotice.style.display = 'flex';
      editingNotice.textContent = 'Application editing is currently closed. Existing applicants can still log in and view their application in read-only mode.';
    } else {
      editingNotice.style.display = 'none';
    }
  }

  const resultsNotice = document.getElementById('results-notice');
  if (resultsNotice) {
    if (status.selectionOpen) {
      resultsNotice.style.display = 'flex';
      resultsNotice.innerHTML = '<strong>Results Available.</strong>&nbsp;Sign in to your student dashboard to view your selection status.';
    } else {
      resultsNotice.style.display = 'none';
    }
  }

  const dates = status.dates || {};
  document.getElementById('date-reg-start').textContent = formatPortalDate(dates.registrationStart);
  document.getElementById('date-reg-end').textContent = formatPortalDate(dates.registrationEnd);
  document.getElementById('date-editing').textContent = formatPortalDate(dates.editingDeadline);
  document.getElementById('date-result').textContent = formatPortalDate(dates.resultDate);

  const contact = status.contact || {};
  document.getElementById('contact-unit').textContent = contact.unit || 'NSS Vettathur';
  document.getElementById('contact-officer').textContent = contact.officer || '—';
  document.getElementById('contact-email').textContent = contact.email || '—';
  const phoneRow = document.getElementById('contact-phone-row');
  const phoneEl = document.getElementById('contact-phone');
  if (contact.phone) {
    phoneEl.textContent = contact.phone;
    phoneRow.style.display = '';
  } else {
    phoneRow.style.display = 'none';
  }

  renderAnnouncements(status.announcements);
  renderFaq(status.faq);
}

function showSessionMessage() {
  const message = sessionStorage.getItem('authMessage');
  const alertBox = document.getElementById('session-alert');
  if (message && alertBox) {
    alertBox.textContent = message;
    alertBox.style.display = 'flex';
    sessionStorage.removeItem('authMessage');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('footer-year').textContent = String(new Date().getFullYear());
  showSessionMessage();

  ['header-login-btn', 'hero-login-btn', 'quick-login'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', redirectIfLoggedIn);
  });

  const forgot = document.getElementById('quick-forgot');
  if (forgot) {
    forgot.addEventListener('click', (e) => {
      if (window.portalLoginEnabled === false) {
        e.preventDefault();
        Popup.warning('Login is not available yet. Please check back later.', 'Login unavailable');
        return;
      }
      e.preventDefault();
      window.location.href = '/login.html#forgot-password';
    });
  }

  const recover = document.getElementById('quick-recover');
  if (recover) {
    recover.addEventListener('click', (e) => {
      if (window.portalLoginEnabled === false) {
        e.preventDefault();
        Popup.warning('Login is not available yet. Please check back later.', 'Login unavailable');
        return;
      }
      e.preventDefault();
      window.location.href = '/login.html#recover-app-id';
    });
  }

  try {
    const status = await fetch('/api/portal/status').then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load portal status.');
      return data;
    });
    setLoginAvailability(status.loginEnabled);
    renderPortalStatus(status);
  } catch (error) {
    const badges = document.getElementById('hero-status-badges');
    if (badges) {
      badges.innerHTML = '<span class="status-badge is-muted">Unable to load live status</span>';
    }
    document.getElementById('announcements-list').innerHTML =
      `<p class="landing-muted">${escapeHtml(error.message)}</p>`;
  }
});
