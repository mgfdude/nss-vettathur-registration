const API_URL = '/api';

const auth = {
  refreshPromise: null,
  redirecting: false,

  getToken() {
    return localStorage.getItem('token');
  },

  setSession(token, user) {
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  },

  clearSession(message = 'Your session has expired. Please sign in again.') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (message) sessionStorage.setItem('authMessage', message);
  },

  redirectToLogin(message) {
    const path = window.location.pathname;
    if (this.redirecting || path.endsWith('/index.html') || path === '/' || path.endsWith('/login.html')) {
      if (path.endsWith('/login.html') || path.endsWith('/index.html') || path === '/') {
        this.clearSession(message);
      }
      return;
    }
    this.redirecting = true;
    this.clearSession(message);
    window.location.href = '/index.html';
  },

  getDashboardPath(user) {
    if (!user) return '/login.html';
    return (user.role === 'admin' || user.role === 'superadmin')
      ? '/admin.html'
      : '/dashboard.html';
  },

  async redirectIfAuthenticated() {
    if (!this.getToken()) return false;
    try {
      const data = await api.get('/auth/me', { skipAuthRedirect: true });
      window.location.href = this.getDashboardPath(data.user);
      return true;
    } catch (error) {
      return false;
    }
  },

  async refreshSession() {
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include'
      })
        .then(async (response) => {
          const data = await parseJson(response);
          if (!response.ok) {
            throw new Error(data.error || 'Session refresh failed.');
          }
          this.setSession(data.token, data.user);
          return data.token;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  },

  showChecking(message = 'Checking your secure session...') {
    let overlay = document.getElementById('auth-check-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auth-check-overlay';
      overlay.className = 'auth-check-overlay';
      overlay.innerHTML = `<div><span class="auth-spinner"></span><p>${message}</p></div>`;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  },

  hideChecking() {
    const overlay = document.getElementById('auth-check-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  async guard(roles = []) {
    this.showChecking();
    try {
      if (!this.getToken()) {
        await this.refreshSession();
      }

      const data = await api.get('/auth/me', { skipAuthRedirect: true });
      const user = data.user;
      if (roles.length && !roles.includes(user.role)) {
        this.redirectToLogin('Please sign in with an account that has permission to access that page.');
        return null;
      }

      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      this.redirectToLogin('Your session has expired. Please sign in again.');
      return null;
    } finally {
      this.hideChecking();
    }
  },

  showLoginMessage() {
    const message = sessionStorage.getItem('authMessage');
    const alertBox = document.getElementById('alert-box') || document.getElementById('session-alert');
    if (message && alertBox) {
      alertBox.className = 'alert alert-warning';
      alertBox.textContent = message;
      alertBox.style.display = 'flex';
      sessionStorage.removeItem('authMessage');
    }
  }
};

async function parseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

async function request(endpoint, options = {}) {
  const requestOptions = { ...options };
  const skipAuthRedirect = Boolean(requestOptions.skipAuthRedirect);
  const retrying = Boolean(requestOptions.retrying);
  delete requestOptions.skipAuthRedirect;
  delete requestOptions.retrying;

  const token = auth.getToken();
  requestOptions.headers = {
    ...(requestOptions.headers || {})
  };

  if (token) {
    requestOptions.headers.Authorization = `Bearer ${token}`;
  }

  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    requestOptions.headers['Content-Type'] = 'application/json';
    if (typeof requestOptions.body === 'object') {
      requestOptions.body = JSON.stringify(requestOptions.body);
    }
  }

  requestOptions.credentials = 'include';

  const response = await fetch(`${API_URL}${endpoint}`, requestOptions);
  const data = await parseJson(response);

  if ((response.status === 401 || response.status === 403) && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/refresh')) {
    if (!retrying) {
      try {
        await auth.refreshSession();
        return request(endpoint, { ...options, retrying: true });
      } catch (error) {
        if (!skipAuthRedirect) {
          auth.redirectToLogin('Your session has expired. Please sign in again.');
        }
        throw error;
      }
    }

    if (!skipAuthRedirect) {
      auth.redirectToLogin('Your session has expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),

  upload: async (endpoint, file, fieldName, onProgress) => {
    const uploadOnce = () => new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append(fieldName, file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}${endpoint}`);
      xhr.withCredentials = true;

      const token = auth.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch (error) {
          reject(new Error('Invalid server response.'));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const err = new Error(data.error || 'Upload failed.');
          err.status = xhr.status;
          reject(err);
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
      xhr.send(formData);
    });

    try {
      return await uploadOnce();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        try {
          await auth.refreshSession();
          return await uploadOnce();
        } catch (refreshError) {
          auth.redirectToLogin('Your session has expired. Please sign in again.');
          throw refreshError;
        }
      }
      throw error;
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  auth.showLoginMessage();

  const path = window.location.pathname;
  if (path.endsWith('/login.html')) {
    await auth.redirectIfAuthenticated();
  }
});
