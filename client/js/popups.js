const Popup = (() => {
  let activeDialog = null;
  let loadingDialog = null;

  const icons = {
    success: '✓',
    error: '!',
    warning: '!',
    info: 'i',
    confirm: '?',
    loading: ''
  };

  function ensureRoot() {
    let root = document.getElementById('popup-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'popup-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function close(dialog, result) {
    if (!dialog) return;
    dialog.classList.remove('open');
    setTimeout(() => dialog.remove(), 180);
    if (activeDialog === dialog) activeDialog = null;
    if (loadingDialog === dialog) loadingDialog = null;
    if (typeof dialog._resolve === 'function') dialog._resolve(result);
  }

  function show(options = {}) {
    const {
      type = 'info',
      title = 'Notice',
      message = '',
      confirmText = 'OK',
      cancelText = 'Cancel',
      showCancel = false,
      closeOnBackdrop = true,
      closeOnEsc = true,
      autoClose = type === 'success' ? 2600 : 0,
      allowClose = type !== 'loading'
    } = options;

    if (activeDialog && type !== 'loading') {
      close(activeDialog, false);
    }

    const root = ensureRoot();
    const overlay = document.createElement('div');
    overlay.className = `popup-overlay popup-${type}${options.wide ? ' popup-wide' : ''}`;
    overlay.setAttribute('role', type === 'confirm' ? 'alertdialog' : 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="popup-card" tabindex="-1">
        ${allowClose ? '<button type="button" class="popup-close" aria-label="Close">&times;</button>' : ''}
        <div class="popup-icon">${type === 'loading' ? '<span class="popup-spinner"></span>' : icons[type]}</div>
        <h3>${title}</h3>
        <div class="popup-message">${message}</div>
        ${type !== 'loading' ? `
          <div class="popup-actions">
            ${showCancel ? `<button type="button" class="btn btn-secondary popup-cancel">${cancelText}</button>` : ''}
            <button type="button" class="btn btn-primary popup-confirm">${confirmText}</button>
          </div>
        ` : ''}
      </div>
    `;

    root.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const card = overlay.querySelector('.popup-card');
    card.focus();

    const promise = new Promise((resolve) => {
      overlay._resolve = resolve;
    });

    const confirmBtn = overlay.querySelector('.popup-confirm');
    const cancelBtn = overlay.querySelector('.popup-cancel');
    const closeBtn = overlay.querySelector('.popup-close');

    if (confirmBtn) confirmBtn.addEventListener('click', () => close(overlay, true));
    if (cancelBtn) cancelBtn.addEventListener('click', () => close(overlay, false));
    if (closeBtn) closeBtn.addEventListener('click', () => close(overlay, false));
    if (closeOnBackdrop) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close(overlay, false);
      });
    }

    function escHandler(event) {
      if (event.key === 'Escape' && closeOnEsc && allowClose) {
        close(overlay, false);
        document.removeEventListener('keydown', escHandler);
      }
    }
    document.addEventListener('keydown', escHandler);

    if (autoClose > 0) {
      setTimeout(() => close(overlay, true), autoClose);
    }

    if (type === 'loading') loadingDialog = overlay;
    else activeDialog = overlay;

    return promise;
  }

  function toast(message, type = 'info', timeout = 2600) {
    let region = document.getElementById('toast-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toast-region';
      region.className = 'toast-region';
      document.body.appendChild(region);
    }

    const item = document.createElement('div');
    item.className = `toast-item toast-${type}`;
    item.innerHTML = `<span>${icons[type] || icons.info}</span><p>${message}</p>`;
    region.appendChild(item);
    requestAnimationFrame(() => item.classList.add('show'));
    setTimeout(() => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 180);
    }, timeout);
  }

  return {
    show,
    success: (message, title = 'Success', options = {}) => show({ ...options, type: 'success', title, message }),
    error: (message, title = 'Something went wrong', options = {}) => show({ ...options, type: 'error', title, message }),
    warning: (message, title = 'Please check', options = {}) => show({ ...options, type: 'warning', title, message }),
    info: (message, title = 'Information', options = {}) => show({ ...options, type: 'info', title, message }),
    confirm: (message, title = 'Confirm action', options = {}) => show({ ...options, type: 'confirm', title, message, showCancel: true }),
    loading: (message = 'Processing...', title = 'Please wait') => show({ type: 'loading', title, message, closeOnBackdrop: false, closeOnEsc: false, allowClose: false }),
    closeLoading: () => close(loadingDialog, true),
    toast
  };
})();
