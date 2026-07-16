const crypto = require('crypto');
const db = require('../../../database/connection');
const config = require('../../config');
const { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyToken } = require('../utils/auth');
const { generateOTP } = require('../utils/otp');
const { sendMail } = require('../utils/email');
const { isRegistrationOpen, isLoginEnabled } = require('../utils/portalSettings');

// Helper to generate Application ID: NSS26-0001
async function generateNextAppId(trx = db) {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  const prefix = `NSS${yearSuffix}-`;

  const lastUser = await trx('users')
    .whereLike('app_id', `${prefix}%`)
    .orderBy('app_id', 'desc')
    .first();

  let nextNum = 1;
  if (lastUser) {
    const lastNumStr = lastUser.app_id.substring(prefix.length);
    const parsedNum = parseInt(lastNumStr, 10);
    if (!isNaN(parsedNum)) {
      nextNum = parsedNum + 1;
    }
  }

  const paddedNum = nextNum.toString().padStart(4, '0');
  return `${prefix}${paddedNum}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  return {
    id: user.id,
    app_id: user.app_id,
    email: user.email,
    role: user.role
  };
}

async function issueSessionTokens(res, user) {
  const tokenPayload = { id: user.id, app_id: user.app_id, role: user.role };
  const token = generateToken(tokenPayload);
  const refreshToken = generateRefreshToken({
    id: user.id,
    app_id: user.app_id,
    role: user.role,
    type: 'refresh',
    jti: crypto.randomBytes(16).toString('hex')
  });
  const expiresAt = new Date(Date.now() + config.refreshTokenCookieMaxAge);

  await db('refresh_tokens').insert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: config.refreshTokenCookieMaxAge
  });

  return token;
}

async function revokeRefreshToken(token) {
  if (!token) return;
  await db('refresh_tokens')
    .where({ token_hash: hashToken(token) })
    .update({ revoked_at: new Date(), updated_at: new Date() });
}

async function registerInitiate(req, res) {
  try {
    const { email, phone, dob } = req.body;

    // Check database settings if registration is open
    const registrationAllowed = await isRegistrationOpen();
    if (!registrationAllowed) {
      return res.status(403).json({ error: 'Registration is currently closed.' });
    }

    const maxSetting = await db('settings').where({ key: 'max_applicants' }).first();

    if (maxSetting) {
      const studentCount = await db('users').where({ role: 'student' }).count('id as count').first();
      if (studentCount.count >= parseInt(maxSetting.value, 10)) {
        return res.status(400).json({ error: 'Maximum application limit reached.' });
      }
    }

    // Check duplicate email, phone, or aadhaar in users and applications
    const existingUser = await db('users')
      .where({ email })
      .orWhere({ phone })
      .first();

    if (existingUser) {
      return res.status(400).json({ error: 'Email or phone number is already registered.' });
    }



    // Generate OTP
    const rawOtp = generateOTP();
    const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Store unverified details in payload column of otp_codes
    const payload = JSON.stringify({ email, phone, dob });

    await db('otp_codes').insert({
      email,
      phone,
      code_hash: hashedOtp,
      type: 'registration',
      payload,
      expires_at: expiresAt,
      attempts: 0
    });

    // Send OTP email
    await sendMail(email, 'NSS Vettathur Registration Verification OTP', 'otp.html', {
      STUDENT_NAME: 'Student',
      OTP_CODE: rawOtp
    });

    res.json({ message: 'OTP sent to your registered email address.' });
  } catch (error) {
    console.error('Registration initiate error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function registerVerify(req, res) {
  try {
    const { email, otp, password } = req.body;

    const registrationAllowed = await isRegistrationOpen();
    if (!registrationAllowed) {
      return res.status(403).json({ error: 'Registration is currently closed.' });
    }

    const record = await db('otp_codes')
      .where({ email, type: 'registration' })
      .andWhere('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (record.attempts >= 3) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashedInputOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.code_hash !== hashedInputOtp) {
      await db('otp_codes').where({ id: record.id }).increment('attempts', 1);
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    // OTP verified, extract registration details
    const details = JSON.parse(record.payload);

    // Create User transactionally to prevent duplicate ID generation conflicts
    let app_id;
    await db.transaction(async (trx) => {
      // Re-verify email/phone duplicate check inside transaction
      const duplicateUser = await trx('users').where({ email: details.email }).orWhere({ phone: details.phone }).first();
      if (duplicateUser) {
        throw new Error('Email or phone already exists.');
      }

      app_id = await generateNextAppId(trx);
      const passwordHash = await hashPassword(password);

      const [userId] = await trx('users').insert({
        app_id,
        email: details.email,
        phone: details.phone,
        password_hash: passwordHash,
        role: 'student',
        is_email_verified: true,
        is_active: true
      });

      // Create draft Application profile
      await trx('applications').insert({
        user_id: userId,
        status: 'Draft',
        dob: details.dob
      });

      // Delete verified OTP records
      await trx('otp_codes').where({ email, type: 'registration' }).del();
    });

    // Send Welcome Email
    await sendMail(details.email, 'Welcome to NSS Vettathur!', 'welcome.html', {
      STUDENT_NAME: 'Student',
      APP_ID: app_id
    });

    res.json({
      message: 'Registration completed successfully.',
      app_id
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}

async function login(req, res) {
  try {
    const { app_id, password } = req.body;

    if (!app_id || !password) {
      return res.status(400).json({ error: 'Application ID and Password are required.' });
    }

    const user = await db('users').where({ app_id }).first();

    const loginAllowed = await isLoginEnabled();
    if (!loginAllowed && user && user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Portal login is temporarily disabled. Please try again later.'
      });
    }

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }

    // Account lock check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is locked. Please try again later.' });
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      // Increment failed login attempts
      const attempts = user.failed_login_attempts + 1;
      const updates = { failed_login_attempts: attempts };

      if (attempts >= 5) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        updates.failed_login_attempts = 0;
      }

      await db('users').where({ id: user.id }).update(updates);
      if (attempts >= 5) {
        try {
          await sendMail(user.email, 'NSS Vettathur Account Locked', 'account-locked.html', {
            STUDENT_NAME: user.app_id,
            APP_ID: user.app_id,
            REQUEST_TIME: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          });
        } catch (mailErr) {
          console.error('Failed to send account locked email:', mailErr);
        }
      }

      return res.status(401).json({
        error: attempts >= 5
          ? 'Too many failed attempts. Account locked for 15 minutes.'
          : 'Invalid credentials.'
      });
    }

    // Reset failed login attempts on success
    await db('users').where({ id: user.id }).update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date()
    });

    const token = await issueSessionTokens(res, user);

    res.json({
      message: 'Login successful.',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken = req.cookies && req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh session not found.' });
    }

    const decoded = verifyToken(refreshToken, { refresh: true });
    if (!decoded || decoded.type !== 'refresh') {
      await revokeRefreshToken(refreshToken);
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh session expired.' });
    }

    const tokenRecord = await db('refresh_tokens')
      .where({ token_hash: hashToken(refreshToken) })
      .andWhere('expires_at', '>', new Date())
      .whereNull('revoked_at')
      .first();

    if (!tokenRecord) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh session expired.' });
    }

    const user = await db('users').where({ id: decoded.id }).first();
    if (!user || !user.is_active || (user.locked_until && new Date(user.locked_until) > new Date())) {
      await revokeRefreshToken(refreshToken);
      res.clearCookie('refreshToken');
      return res.status(403).json({ error: 'Session is no longer valid.' });
    }

    await revokeRefreshToken(refreshToken);
    const token = await issueSessionTokens(res, user);

    res.json({
      message: 'Session refreshed.',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

async function forgotPasswordInitiate(req, res) {
  try {
    const { identifier, app_id } = req.body;
    const recoveryAppId = app_id || identifier;

    if (!recoveryAppId) {
      return res.status(400).json({ error: 'Application ID is required.' });
    }

    const user = await db('users')
      .where({ app_id: recoveryAppId })
      .first();

    if (!user) {
      // Return success response anyway to prevent user enumeration attacks
      return res.json({ message: 'If credentials match, an OTP has been sent to your email.' });
    }

    const rawOtp = generateOTP();
    const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await db('otp_codes').insert({
      email: user.email,
      code_hash: hashedOtp,
      type: 'forgot_password',
      expires_at: expiresAt,
      attempts: 0
    });

    await sendMail(user.email, 'NSS Vettathur Password Reset OTP', 'forgot-password.html', {
      STUDENT_NAME: user.app_id,
      APP_ID: user.app_id,
      OTP_CODE: rawOtp
    });

    res.json({ message: 'If credentials match, an OTP has been sent to your email.', email: user.email });
  } catch (error) {
    console.error('Forgot password initiate error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function forgotPasswordReset(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and New Password are required.' });
    }

    const record = await db('otp_codes')
      .where({ email, type: 'forgot_password' })
      .andWhere('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (record.attempts >= 3) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashedInputOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.code_hash !== hashedInputOtp) {
      await db('otp_codes').where({ id: record.id }).increment('attempts', 1);
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    // Reset password complexity check
    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!complexityRegex.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await db('users').where({ email }).update({
      password_hash: passwordHash,
      failed_login_attempts: 0,
      locked_until: null
    });

    // Delete verified OTP records
    await db('otp_codes').where({ email, type: 'forgot_password' }).del();
    try {
      const user = await db('users').where({ email }).first();
      if (user) {
        await sendMail(email, 'NSS Vettathur Password Changed Successfully', 'password-changed.html', {
          STUDENT_NAME: user.app_id,
          APP_ID: user.app_id,
          REQUEST_TIME: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
      }
    } catch (mailErr) {
      console.error('Failed to send password changed email:', mailErr);
    }

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Forgot password reset error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function forgotAppIdInitiate(req, res) {
  try {
    const { email, dob } = req.body;

    if (!email || !dob) {
      return res.status(400).json({ error: 'Registered email and date of birth are required.' });
    }

    const user = await db('users')
      .join('applications', 'users.id', 'applications.user_id')
      .select('users.*')
      .where('users.email', email)
      .andWhere('applications.dob', dob)
      .first();
    if (!user) {
      return res.json({ message: 'If the email is registered, an OTP has been sent.' });
    }

    const rawOtp = generateOTP();
    const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db('otp_codes').insert({
      email: user.email,
      code_hash: hashedOtp,
      type: 'forgot_app_id',
      expires_at: expiresAt,
      attempts: 0
    });

    await sendMail(user.email, 'NSS Vettathur Application ID Recovery OTP', 'otp.html', {
      STUDENT_NAME: 'Student',
      OTP_CODE: rawOtp
    });

    res.json({ message: 'If the email is registered, an OTP has been sent.', email: user.email });
  } catch (error) {
    console.error('Forgot app ID initiate error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function forgotAppIdVerify(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const record = await db('otp_codes')
      .where({ email, type: 'forgot_app_id' })
      .andWhere('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    if (record.attempts >= 3) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const hashedInputOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.code_hash !== hashedInputOtp) {
      await db('otp_codes').where({ id: record.id }).increment('attempts', 1);
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(400).json({ error: 'Unable to recover Application ID.' });
    }

    await db('otp_codes').where({ email, type: 'forgot_app_id' }).del();
    try {
      await sendMail(user.email, 'NSS Vettathur Application ID Recovered', 'application-id-recovery.html', {
        STUDENT_NAME: 'Student',
        APP_ID: user.app_id
      });
    } catch (mailErr) {
      console.error('Failed to send application ID recovery email:', mailErr);
    }

    res.json({
      message: 'Application ID recovered successfully.',
      app_id: user.app_id
    });
  } catch (error) {
    console.error('Forgot app ID verify error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function logout(req, res) {
  await revokeRefreshToken(req.cookies && req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.json({ message: 'Logout successful.' });
}

module.exports = {
  registerInitiate,
  registerVerify,
  login,
  refresh,
  me,
  forgotPasswordInitiate,
  forgotPasswordReset,
  forgotAppIdInitiate,
  forgotAppIdVerify,
  logout
};
