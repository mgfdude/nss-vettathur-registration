function showAlert(el, message, type = 'danger') {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'flex';
}

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

document.addEventListener('DOMContentLoaded', () => {
  let loginSubmitting = false;
  const loginForm = document.getElementById('login-form');

  // If already signed in on login page, go to dashboard
  if (loginForm && auth.getToken()) {
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

      if (!status.loginEnabled && loginForm) {
        const alertBox = document.getElementById('alert-box');
        showAlert(alertBox, 'Portal login is temporarily disabled. Please try again later.', 'warning');
        loginForm.querySelectorAll('input, button').forEach((el) => {
          el.disabled = true;
        });
      }
    })
    .catch(() => {});

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginSubmitting) return;
      loginSubmitting = true;
      const appId = document.getElementById('app_id').value.trim();
      const password = document.getElementById('password').value;
      const alertBox = document.getElementById('alert-box');
      const submitButton = loginForm.querySelector('button[type="submit"]');

      try {
        hideAlert(alertBox);
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Signing in...';
        }
        const res = await api.post('/auth/login', { app_id: appId, password });
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        window.location.href = res.user.role === 'admin' || res.user.role === 'superadmin'
          ? '/admin.html'
          : '/dashboard.html';
      } catch (err) {
        showAlert(alertBox, err.message);
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
  const alertBox = document.getElementById('alert-box');
  const resendBtn = document.getElementById('resend-otp-btn');
  let registrationData = {};

  const registrationOtp = setupOtpInput('otp', {
    onComplete: () => {
      if (regStep2 && document.getElementById('password').value && document.getElementById('confirmPassword').value) {
        regStep2.requestSubmit();
      }
    }
  });

  async function sendRegistrationOtp() {
    Popup.loading('Sending OTP...');
    await api.post('/auth/register/initiate', registrationData);
    Popup.closeLoading();
    startOtpCountdown(resendBtn);
    registrationOtp && registrationOtp.focus();
    showAlert(alertBox, 'An OTP has been sent to your registered email.', 'success');
    Popup.toast('OTP sent to your registered email.', 'success');
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
        showAlert(alertBox, err.message);
      }
    });
  }

  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      try {
        hideAlert(alertBox);
        await sendRegistrationOtp();
      } catch (err) {
        showAlert(alertBox, err.message);
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
        showAlert(alertBox, err.message);
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
    const res = await api.post('/auth/forgot-password/initiate', { app_id: resetAppId });
    Popup.closeLoading();
    resetEmail = res.email || '';
    startOtpCountdown(forgotResendBtn);
    forgotOtp && forgotOtp.focus();
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

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      forgotModal.style.display = 'none';
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
        showAlert(forgotAlert, 'OTP sent to the registered email for this Application ID.', 'success');
      } catch (err) {
        Popup.closeLoading();
        showAlert(forgotAlert, err.message);
      }
    });
  }

  if (forgotResendBtn) {
    forgotResendBtn.addEventListener('click', async () => {
      try {
        hideAlert(forgotAlert);
        await sendForgotPasswordOtp();
        showAlert(forgotAlert, 'A fresh OTP has been sent.', 'success');
      } catch (err) {
        showAlert(forgotAlert, err.message);
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
        showAlert(forgotAlert, 'Passwords do not match.');
        return;
      }

      try {
        Popup.loading('Resetting password...');
        await api.post('/auth/forgot-password/reset', {
          email: resetEmail,
          otp: document.getElementById('forgot-otp').value.trim(),
          newPassword
        });

        showAlert(forgotAlert, 'Password reset successful. You can now sign in.', 'success');
        Popup.closeLoading();
        Popup.success('Your password has been changed. Please sign in again.', 'Password changed');
        setTimeout(() => {
          forgotModal.style.display = 'none';
        }, 1800);
      } catch (err) {
        Popup.closeLoading();
        showAlert(forgotAlert, err.message);
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
        showAlert(appIdAlert, 'OTP sent if the email and date of birth match our records.', 'success');
      } catch (err) {
        Popup.closeLoading();
        showAlert(appIdAlert, err.message);
      }
    });
  }

  if (appIdResendBtn) {
    appIdResendBtn.addEventListener('click', async () => {
      try {
        hideAlert(appIdAlert);
        await sendAppIdOtp();
        showAlert(appIdAlert, 'A fresh OTP has been sent.', 'success');
      } catch (err) {
        showAlert(appIdAlert, err.message);
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
        showAlert(appIdAlert, err.message);
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
