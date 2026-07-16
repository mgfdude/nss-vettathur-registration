function validateRegistrationInitiate(req, res, next) {
  const { email, confirmEmail, phone, confirmPhone, dob, confirmDob } = req.body;

  if (!email || !confirmEmail || !phone || !confirmPhone || !dob || !confirmDob) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
    return res.status(400).json({ error: 'Emails do not match.' });
  }

  if (phone !== confirmPhone) {
    return res.status(400).json({ error: 'Phone numbers do not match.' });
  }

  if (dob !== confirmDob) {
    return res.status(400).json({ error: 'Dates of birth do not match.' });
  }


  // Regex validations
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format (must be 10 digits starting with 6-9).' });
  }


  // Validate DoB
  const parsedDob = new Date(dob);
  if (isNaN(parsedDob.getTime())) {
    return res.status(400).json({ error: 'Invalid Date of Birth format.' });
  }

  // Check student age threshold (e.g. at least 14 years old)
  const age = new Date().getFullYear() - parsedDob.getFullYear();
  if (age < 12 || age > 25) {
    return res.status(400).json({ error: 'Age must be between 12 and 25 to register for NSS.' });
  }

  next();
}

function validateRegistrationVerify(req, res, next) {
  const { otp, password, confirmPassword } = req.body;

  if (!otp || !password || !confirmPassword) {
    return res.status(400).json({ error: 'OTP, password, and confirmation password are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!complexityRegex.test(password)) {
    return res.status(400).json({
      error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
    });
  }

  next();
}

module.exports = {
  validateRegistrationInitiate,
  validateRegistrationVerify
};
