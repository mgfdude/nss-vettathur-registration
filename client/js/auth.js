function hideAlert(el) {
  if (el) el.style.display = 'none';
}

function setupOtpInput(hiddenInputId, options = {}) {
  const hiddenInput = document.getElementById(hiddenInputId);
  const container = document.querySelector(`.otp-input-group[data-otp-target="${hiddenInputId}"]`);
  if (!hiddenInput || !container) return null;

  container.innerHTML = '';
  const boxes = [];

  for (let i = 0; i < 6; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'one-time-code';
    input.maxLength = 1;
    input.className = 'otp-digit';
    input.setAttribute('aria-label', `OTP digit ${i + 1}`);
    container.appendChild(input);
    boxes.push(input);
  }

  const syncValue = () => {
    hiddenInput.value = boxes.map(box => box.value).join('');
    if (hiddenInput.value.length === 6 && typeof options.onComplete === 'function') {
      options.onComplete(hiddenInput.value);
    }
    // Dispatch input event so external listeners (validation) can react to OTP changes
    try { hiddenInput.dispatchEvent(new Event('input')); } catch (e) { /* ignore */ }
  };

  const fillFromString = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 6).split('');
    boxes.forEach((box, index) => {
      box.value = digits[index] || '';
    });
    const nextEmpty = boxes.find(box => !box.value);
    (nextEmpty || boxes[5]).focus();
    syncValue();
  };

  boxes.forEach((box, index) => {
    box.addEventListener('input', () => {
      const digit = box.value.replace(/\D/g, '').slice(-1);
      box.value = digit;
      if (digit && index < boxes.length - 1) {
        boxes[index + 1].focus();
      }
      syncValue();
    });

    box.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !box.value && index > 0) {
        boxes[index - 1].focus();
        boxes[index - 1].value = '';
        syncValue();
      }
    });

    box.addEventListener('paste', (event) => {
      event.preventDefault();
      fillFromString(event.clipboardData.getData('text'));
    });
  });

  return {
    focus: () => boxes[0].focus(),
    clear: () => fillFromString(''),
    value: () => hiddenInput.value
  };
}

function startOtpCountdown(button, seconds = 30) {
  if (!button) return;
  let timeLeft = seconds;
  button.disabled = true;
  button.textContent = `Resend OTP (${timeLeft}s)`;

  const timer = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = 'Resend OTP';
    } else {
      button.textContent = `Resend OTP (${timeLeft}s)`;
    }
  }, 1000);
}

function promptLoginOtp({ title = 'Verify Login', subtitle = 'Enter the 6-digit OTP sent to your registered email address.', onResend }) {
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay popup-info';
    overlay.innerHTML = `
      <div class="popup-card" tabindex="-1">
        <button type="button" class="popup-close" aria-label="Close">&times;</button>
        <div class="popup-icon">!</div>
        <h3>${title}</h3>
        <div class="popup-message">${subtitle}</div>
        <div class="otp-input-wrapper" style="margin: 18px 0;">
          <div class="otp-input-group" data-otp-target="login-otp-modal"></div>
          <input type="hidden" id="login-otp-modal">
        </div>
        <div class="popup-actions" style="justify-content: space-between; gap: 8px;">
          <button type="button" class="btn btn-secondary popup-resend">Resend OTP</button>
          <button type="button" class="btn btn-secondary popup-cancel">Cancel</button>
          <button type="button" class="btn btn-primary popup-confirm">Verify</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const hiddenInput = overlay.querySelector('#login-otp-modal');
    const confirmBtn = overlay.querySelector('.popup-confirm');
    const resendBtn = overlay.querySelector('.popup-resend');
    const cancelBtn = overlay.querySelector('.popup-cancel');
    const closeBtn = overlay.querySelector('.popup-close');
    const dialog = overlay.querySelector('.popup-card');

    const otpInput = setupOtpInput('login-otp-modal');
    if (otpInput && typeof otpInput.focus === 'function') {
      otpInput.focus();
    }

    function cleanup() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', escHandler);
    }

    function close(result, canceled = false) {
      cleanup();
      if (canceled) {
        reject(new Error('OTP verification canceled.'));
      } else {
        resolve(result);
      }
    }

    function escHandler(event) {
      if (event.key === 'Escape') {
        close('', true);
      }
    }

    document.addEventListener('keydown', escHandler);
    dialog.focus();

    confirmBtn.addEventListener('click', () => {
      const value = hiddenInput.value.trim();
      if (!/^[0-9]{6}$/.test(value)) {
        Popup.error('Please enter a valid 6-digit OTP.');
        return;
      }
      close(value);
    });

    cancelBtn.addEventListener('click', () => close('', true));
    closeBtn.addEventListener('click', () => close('', true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close('', true);
    });

    if (onResend) {
      resendBtn.addEventListener('click', async () => {
        try {
          Popup.loading('Resending OTP...');
          await onResend();
          Popup.closeLoading();
          Popup.success('OTP resent. Please check your email.', 'OTP sent');
        } catch (error) {
          Popup.closeLoading();
          Popup.error(error.message || 'Could not resend OTP.');
        }
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  let loginSubmitting = false;
  const loginForm = document.getElementById('login-form');
  const adminLoginForm = document.getElementById('admin-login-form');

  // If already signed in on login page, go to dashboard
  if (loginForm && auth.getToken()) {
    auth.redirectIfAuthenticated();
  }

  if (adminLoginForm && auth.getToken()) {
    auth.redirectIfAuthenticated();
  }

  // Open recovery modals from URL hash (landing quick links)
  if (window.location.hash === '#forgot-password') {
    const forgotModal = document.getElementById('forgot-password-modal');
    if (forgotModal) forgotModal.style.display = 'flex';
  }
  if (window.location.hash === '#recover-app-id') {
    const appIdModal = document.getElementById('forgot-app-id-modal');
    if (appIdModal) appIdModal.style.display = 'flex';
  }

  // Hide register CTA when registration is closed
  fetch('/api/portal/status')
    .then((res) => res.json())
    .then((status) => {
      const registerLinks = [
        document.getElementById('login-register-link'),
        document.querySelector('a[href="/register.html"]')
      ].filter(Boolean);

      if (!status.registrationOpen) {
        registerLinks.forEach((link) => {
          if (link.id === 'login-register-link') {
            link.textContent = 'Registration Closed';
            link.href = '/index.html';
            link.style.pointerEvents = 'auto';
          }
        });
      }

      const forgotLink = document.getElementById('forgot-password-link');
      const appIdLink = document.getElementById('forgot-app-id-link');
      const adminForgotLink = document.getElementById('admin-forgot-password-link');

      if (!status.studentLoginEnabled) {
        if (loginForm) {
          loginForm.querySelectorAll('input, button').forEach((element) => {
            element.disabled = true;
          });
        }
        if (forgotLink) forgotLink.style.display = 'none';
        if (appIdLink) appIdLink.style.display = 'none';
        Popup.error('Student login is not available yet. Please check back later.');
      }

      if (!status.adminLoginEnabled) {
        if (adminLoginForm) {
          adminLoginForm.querySelectorAll('input, button').forEach((element) => {
            element.disabled = true;
          });
        }
        if (adminForgotLink) adminForgotLink.style.display = 'none';
        Popup.warning('Admin login is not available yet. Please check back later.');
      }
    })
    .catch(() => {});

  async function performLogin(appId, password, portal) {
    const loginResponse = await api.post('/auth/login', { app_id: appId, password, portal });
    Popup.success(loginResponse.message || 'OTP has been sent to your registered email.', 'OTP sent');

    const otp = await promptLoginOtp({
      title: portal === 'admin' ? 'Admin Login OTP' : 'Student Login OTP',
      subtitle: 'Enter the 6-digit code sent to your registered email.',
      onResend: async () => {
        await api.post('/auth/login', { app_id: appId, password, portal });
      }
    });

    Popup.loading('Verifying OTP...');
    const verifyResponse = await api.post('/auth/login/verify', { app_id: appId, otp, portal });
    Popup.closeLoading();
    auth.setSession(verifyResponse.token, verifyResponse.user);
    return verifyResponse.user;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginSubmitting) return;
      loginSubmitting = true;
      const appId = document.getElementById('app_id').value.trim();
      const password = document.getElementById('password').value;
      const alertBox = null;
      const submitButton = loginForm.querySelector('button[type="submit"]');

      try {
        hideAlert(alertBox);
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Signing in...';
        }

        const user = await performLogin(appId, password, 'student');
        window.location.href = auth.getDashboardPath(user);
      } catch (err) {
        if (err.message === 'OTP verification canceled.') {
          Popup.warning('OTP verification canceled. Please sign in again.', 'Login canceled');
        } else {
          Popup.error(err.message || 'An error occurred');
        }
      } finally {
        loginSubmitting = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Sign In';
        }
      }
    });
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginSubmitting) return;
      loginSubmitting = true;
      const appId = document.getElementById('admin_app_id').value.trim();
      const password = document.getElementById('admin_password').value;
      const alertBox = null;
      const submitButton = adminLoginForm.querySelector('button[type="submit"]');

      try {
        hideAlert(alertBox);
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Signing in...';
        }

        const user = await performLogin(appId, password, 'admin');
        window.location.href = '/admin.html';
      } catch (err) {
        if (err.message === 'OTP verification canceled.') {
          Popup.warning('OTP verification canceled. Please sign in again.', 'Login canceled');
        } else {
          Popup.error(err.message || 'An error occurred');
        }
      } finally {
        loginSubmitting = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Sign In';
        }
      }
    });
  }

  const regStep1 = document.getElementById('register-step-1');
  const regStep2 = document.getElementById('register-step-2');
  const regSuccess = document.getElementById('register-success');
  const alertBox = null;
  const resendBtn = document.getElementById('resend-otp-btn');
  let registrationData = {};

  const registrationOtp = setupOtpInput('otp', {
    onComplete: () => {
      if (regStep2 && document.getElementById('password').value && document.getElementById('confirmPassword').value) {
        regStep2.requestSubmit();
      }
    }
  });

  // Registration form validation: enable submit only when all requirements met
  const regStep1Submit = document.getElementById('register-step-1-submit');
  const regStep2Submit = document.getElementById('register-step-2-submit');

  function cleanPhoneInput(value) {
    return value.replace(/\D/g, '').slice(0, 10);
  }

  function isStep1Valid() {
    if (!regStep1) return false;
    const email = document.getElementById('email').value.trim();
    const confirmEmail = document.getElementById('confirmEmail').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const confirmPhone = document.getElementById('confirmPhone').value.trim();
    const dob = document.getElementById('dob').value;
    const confirmDob = document.getElementById('confirmDob').value;

    if (!email || !confirmEmail || email !== confirmEmail) return false;
    if (!phone || !confirmPhone) return false;
    if (phone !== confirmPhone) return false;
    if (!/^[0-9]{10}$/.test(phone)) return false;
    if (!dob || !confirmDob || dob !== confirmDob) return false;
    return true;
  }

  function validateStep1() {
    if (regStep1Submit) regStep1Submit.disabled = !isStep1Valid();
  }

  function isPasswordValid(pw) {
    if (!pw || pw.length < 8) return false;
    if (!/[A-Z]/.test(pw)) return false;
    if (!/[!@#\$%\^&\*\(\)\-_=+\[\]{};:'"\\|,.<>\/?]/.test(pw)) return false;
    return true;
  }

  function isStep2Valid() {
    if (!regStep2) return false;
    const otp = document.getElementById('otp').value.trim();
    const pw = document.getElementById('password').value;
    const cpw = document.getElementById('confirmPassword').value;
    if (!/^[0-9]{6}$/.test(otp)) return false;
    if (!isPasswordValid(pw)) return false;
    if (pw !== cpw) return false;
    return true;
  }

  function validateStep2() {
    if (regStep2Submit) regStep2Submit.disabled = !isStep2Valid();
  }

  // Attach input listeners for live validation
  ['email', 'confirmEmail', 'phone', 'confirmPhone', 'dob', 'confirmDob'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      if (id === 'phone' || id === 'confirmPhone') {
        const cleaned = cleanPhoneInput(e.target.value);
        if (e.target.value !== cleaned) e.target.value = cleaned;
      }
      validateStep1();
    });
  });

  ['otp', 'password', 'confirmPassword'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => validateStep2());
  });


  async function sendRegistrationOtp() {
    Popup.loading('Sending OTP...');
    await api.post('/auth/register/initiate', registrationData);
    Popup.closeLoading();
    startOtpCountdown(resendBtn);
    registrationOtp && registrationOtp.focus();
    Popup.success('An OTP has been sent to your registered email.', 'OTP sent');
  }

  if (regStep1) {
    regStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      const email = document.getElementById('email').value.trim();
      const confirmEmail = document.getElementById('confirmEmail').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const confirmPhone = document.getElementById('confirmPhone').value.trim();
      const dob = document.getElementById('dob').value;
      const confirmDob = document.getElementById('confirmDob').value;

      try {
        registrationData = { email, confirmEmail, phone, confirmPhone, dob, confirmDob };
        if (email !== confirmEmail) throw new Error('Email addresses do not match.');
        if (phone !== confirmPhone) throw new Error('Phone numbers do not match.');
        if (dob !== confirmDob) throw new Error('Dates of birth do not match.');

        regStep1.style.display = 'none';
        document.querySelector('.auth-header p').textContent = 'Step 2 of 3: Verification & Password';
        document.getElementById('display-otp-email').textContent = email;
        regStep2.style.display = 'block';
        await sendRegistrationOtp();
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      try {
        hideAlert(alertBox);
        await sendRegistrationOtp();
      } catch (err) {
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (regStep2) {
    regStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(alertBox);

      try {
        Popup.loading('Completing registration...');
        const res = await api.post('/auth/register/verify', {
          email: registrationData.email,
          otp: document.getElementById('otp').value.trim(),
          password: document.getElementById('password').value,
          confirmPassword: document.getElementById('confirmPassword').value
        });

        regStep2.style.display = 'none';
        document.querySelector('.auth-header').style.display = 'none';
        document.getElementById('generated-app-id').textContent = res.app_id;
        document.getElementById('signin-footer').style.display = 'none';
        regSuccess.style.display = 'block';
        Popup.closeLoading();
        Popup.success('Your NSS registration has been completed successfully.', 'Registration complete');
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  const forgotLink = document.getElementById('forgot-password-link');
  const forgotModal = document.getElementById('forgot-password-modal');
  const closeModal = document.getElementById('close-modal');
  const forgotStep1 = document.getElementById('forgot-step-1');
  const forgotStep2 = document.getElementById('forgot-step-2');
  const forgotAlert = document.getElementById('forgot-alert');
  const forgotResendBtn = document.getElementById('forgot-resend-otp-btn');
  const adminForgotLink = document.getElementById('admin-forgot-password-link');
  const adminForgotModal = document.getElementById('admin-forgot-password-modal');
  const adminCloseModal = document.getElementById('admin-close-modal');
  const adminForgotStep1 = document.getElementById('admin-forgot-step-1');
  const adminForgotStep2 = document.getElementById('admin-forgot-step-2');
  const adminForgotAlert = document.getElementById('admin-forgot-alert');
  const adminOtp = setupOtpInput('admin-forgot-otp', {
    onComplete: () => {
      if (adminForgotStep2) adminForgotStep2.requestSubmit();
    }
  });
  let resetEmail = '';
  let resetAppId = '';

  const forgotOtp = setupOtpInput('forgot-otp', {
    onComplete: () => {
      if (forgotStep2 && document.getElementById('forgot-new-pass').value && document.getElementById('forgot-confirm-pass').value) {
        forgotStep2.requestSubmit();
      }
    }
  });

  async function sendForgotPasswordOtp() {
    Popup.loading('Sending OTP...');
    const res = await api.post('/auth/forgot-password/initiate', { app_id: resetAppId, portal: 'student' });
    Popup.closeLoading();
    resetEmail = res.email || '';
    startOtpCountdown(forgotResendBtn);
    forgotOtp && forgotOtp.focus();
  }

  async function sendAdminForgotPasswordOtp() {
    Popup.loading('Sending OTP...');
    const res = await api.post('/auth/forgot-password/initiate', { app_id: document.getElementById('admin-forgot-identifier').value.trim(), portal: 'admin' });
    Popup.closeLoading();
    resetEmail = res.email || '';
    adminOtp && adminOtp.focus();
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      forgotModal.style.display = 'flex';
      forgotStep1.style.display = 'block';
      forgotStep2.style.display = 'none';
      hideAlert(forgotAlert);
    });
  }

  if (adminForgotLink) {
    adminForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      adminForgotModal.style.display = 'flex';
      adminForgotStep1.style.display = 'block';
      adminForgotStep2.style.display = 'none';
      hideAlert(adminForgotAlert);
    });
  }

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      forgotModal.style.display = 'none';
    });
  }

  if (adminCloseModal) {
    adminCloseModal.addEventListener('click', () => {
      adminForgotModal.style.display = 'none';
    });
  }

  if (forgotStep1) {
    forgotStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(forgotAlert);
      resetAppId = document.getElementById('forgot-identifier').value.trim();

      try {
        await sendForgotPasswordOtp();
        forgotStep1.style.display = 'none';
        document.getElementById('forgot-subtext').textContent = 'Enter the OTP sent to your registered email and configure a new password.';
        forgotStep2.style.display = 'block';
        Popup.success('OTP sent to the registered email for this Application ID.', 'OTP sent');
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (adminForgotStep1) {
    adminForgotStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(adminForgotAlert);
      try {
        await sendAdminForgotPasswordOtp();
        adminForgotStep1.style.display = 'none';
        document.getElementById('admin-forgot-subtext').textContent = 'Enter the OTP sent to the recovery inbox and configure a new password.';
        adminForgotStep2.style.display = 'block';
        Popup.success('OTP sent for administrator recovery.', 'OTP sent');
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (forgotResendBtn) {
    forgotResendBtn.addEventListener('click', async () => {
      try {
        hideAlert(forgotAlert);
        await sendForgotPasswordOtp();
        Popup.success('A fresh OTP has been sent.', 'OTP sent');
      } catch (err) {
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (forgotStep2) {
    forgotStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(forgotAlert);

      const newPassword = document.getElementById('forgot-new-pass').value;
      const confirmPassword = document.getElementById('forgot-confirm-pass').value;
      if (newPassword !== confirmPassword) {
        Popup.error('Passwords do not match.');
        return;
      }

      try {
        Popup.loading('Resetting password...');
        await api.post('/auth/forgot-password/reset', {
          email: resetEmail,
          otp: document.getElementById('forgot-otp').value.trim(),
          newPassword
        });

        Popup.success('Password reset successful. You can now sign in.', 'Reset complete');
        Popup.closeLoading();
        Popup.success('Your password has been changed. Please sign in again.', 'Password changed');
        setTimeout(() => {
          forgotModal.style.display = 'none';
        }, 1800);
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (adminForgotStep2) {
    adminForgotStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(adminForgotAlert);

      const newPassword = document.getElementById('admin-forgot-new-pass').value;
      const confirmPassword = document.getElementById('admin-forgot-confirm-pass').value;
      if (newPassword !== confirmPassword) {
        Popup.error('Passwords do not match.');
        return;
      }

      try {
        Popup.loading('Resetting password...');
        await api.post('/auth/forgot-password/reset', {
          email: resetEmail,
          otp: document.getElementById('admin-forgot-otp').value.trim(),
          newPassword
        });
        Popup.success('Administrator password reset successful.', 'Reset complete');
        Popup.closeLoading();
        Popup.success('Admin password changed successfully.', 'Password changed');
        setTimeout(() => {
          adminForgotModal.style.display = 'none';
        }, 1800);
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  const appIdLink = document.getElementById('forgot-app-id-link');
  const appIdModal = document.getElementById('forgot-app-id-modal');
  const closeAppIdModal = document.getElementById('close-app-id-modal');
  const appIdStep1 = document.getElementById('app-id-step-1');
  const appIdStep2 = document.getElementById('app-id-step-2');
  const appIdSuccess = document.getElementById('app-id-success');
  const appIdAlert = document.getElementById('app-id-alert');
  const appIdResendBtn = document.getElementById('app-id-resend-otp-btn');
  let appIdRecovery = { email: '', dob: '' };

  const appIdOtp = setupOtpInput('app-id-otp', {
    onComplete: () => {
      if (appIdStep2) appIdStep2.requestSubmit();
    }
  });

  async function sendAppIdOtp() {
    Popup.loading('Sending OTP...');
    await api.post('/auth/forgot-app-id/initiate', appIdRecovery);
    Popup.closeLoading();
    startOtpCountdown(appIdResendBtn);
    appIdOtp && appIdOtp.focus();
  }

  if (appIdLink) {
    appIdLink.addEventListener('click', (e) => {
      e.preventDefault();
      appIdModal.style.display = 'flex';
      appIdStep1.style.display = 'block';
      appIdStep2.style.display = 'none';
      appIdSuccess.style.display = 'none';
      hideAlert(appIdAlert);
    });
  }

  if (closeAppIdModal) {
    closeAppIdModal.addEventListener('click', () => {
      appIdModal.style.display = 'none';
    });
  }

  if (appIdStep1) {
    appIdStep1.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(appIdAlert);
      appIdRecovery = {
        email: document.getElementById('app-id-email').value.trim(),
        dob: document.getElementById('app-id-dob').value
      };

      try {
        await sendAppIdOtp();
        appIdStep1.style.display = 'none';
        appIdStep2.style.display = 'block';
        document.getElementById('app-id-subtext').textContent = 'Enter the OTP sent to your registered email.';
        Popup.success('OTP sent if the email and date of birth match our records.', 'OTP sent');
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (appIdResendBtn) {
    appIdResendBtn.addEventListener('click', async () => {
      try {
        hideAlert(appIdAlert);
        await sendAppIdOtp();
        Popup.success('A fresh OTP has been sent.', 'OTP sent');
      } catch (err) {
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  if (appIdStep2) {
    appIdStep2.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(appIdAlert);

      try {
        Popup.loading('Recovering Application ID...');
        const res = await api.post('/auth/forgot-app-id/verify', {
          email: appIdRecovery.email,
          otp: document.getElementById('app-id-otp').value.trim()
        });
        document.getElementById('recovered-app-id').textContent = res.app_id;
        appIdStep2.style.display = 'none';
        appIdSuccess.style.display = 'block';
        Popup.closeLoading();
        Popup.success('Your Application ID has been recovered.', 'Recovery complete');
      } catch (err) {
        Popup.closeLoading();
        Popup.error(err.message || 'An error occurred');
      }
    });
  }

  const useRecovered = document.getElementById('use-recovered-app-id');
  if (useRecovered) {
    useRecovered.addEventListener('click', () => {
      document.getElementById('app_id').value = document.getElementById('recovered-app-id').textContent;
      appIdModal.style.display = 'none';
      document.getElementById('password').focus();
    });
  }
});
