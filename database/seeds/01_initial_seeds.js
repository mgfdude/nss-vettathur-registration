const bcrypt = require('../../server/node_modules/bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries in settings and users
  await knex('notifications').del();
  await knex('applications').del();
  await knex('users').del();
  await knex('settings').del();

  // Insert settings
  await knex('settings').insert([
    { key: 'registration_open', value: 'true', description: 'Is registration currently open (true/false)' },
    { key: 'registration_deadline', value: '2026-08-31T23:59:59Z', description: 'Deadline for student applications' },
    { key: 'registration_start', value: '2026-07-01T00:00:00Z', description: 'Registration start date (ISO UTC)' },
    { key: 'editing_open', value: 'true', description: 'Allow students to edit draft applications and uploads (true/false)' },
    { key: 'editing_deadline', value: '2026-08-31T23:59:59Z', description: 'Deadline for application editing (ISO UTC)' },
    { key: 'login_enabled', value: 'true', description: 'Allow student and admin login (true/false)' },
    { key: 'selection_open', value: 'false', description: 'Are selection results visible to students (true/false)' },
    { key: 'result_date', value: '2026-09-15T00:00:00Z', description: 'Expected or published result date (ISO UTC)' },
    { key: 'max_applicants', value: '150', description: 'Maximum number of student registrations allowed' },
    { key: 'contact_officer', value: 'Programme Officer, NSS Vettathur', description: 'Contact person / programme officer name' },
    { key: 'contact_email', value: 'nss@vettathur.edu.in', description: 'Public contact email' },
    { key: 'contact_phone', value: '', description: 'Public contact phone (optional)' },
    {
      key: 'faq_json',
      value: JSON.stringify([
        {
          q: 'Who can register for NSS Vettathur?',
          a: 'Eligible students of the institution may register during the open registration period using a valid email and phone number.'
        },
        {
          q: 'What is an Application ID?',
          a: 'After successful registration you receive a unique Application ID (e.g. NSS26-0001). Use it with your password to sign in.'
        },
        {
          q: 'Can I edit my application after submitting?',
          a: 'Once submitted, your application is locked. While it remains in Draft status and editing is open, you may update details and uploads.'
        },
        {
          q: 'When will selection results be published?',
          a: 'Results appear on your student dashboard only after the administrator enables result publication.'
        },
        {
          q: 'I forgot my Application ID or password. What should I do?',
          a: 'Use Forgot Password or Recover Application ID on the login page. An OTP will be sent to your registered email.'
        }
      ]),
      description: 'FAQ items as JSON array of {q,a}'
    }
  ]);

  if (await knex.schema.hasTable('announcements')) {
    await knex('announcements').del();
    await knex('announcements').insert([
      {
        title: 'Welcome to the NSS Registration Portal',
        body: 'Register online, complete your application, and track your selection status through this portal.',
        is_published: true,
        sort_order: 1
      },
      {
        title: 'Keep your Application ID safe',
        body: 'Your Application ID is required to sign in. Store it securely and do not share your password with anyone.',
        is_published: true,
        sort_order: 2
      }
    ]);
  }

  // Create default admin users
  const legacyPasswordHash = await bcrypt.hash('Password@123', 12);
  const requestedPasswordHash = await bcrypt.hash('admin123', 12);
  await knex('users').insert([
    {
      app_id: 'NSS-ADMIN',
      email: 'admin@nssvettathur.org',
      phone: '9999999999',
      password_hash: legacyPasswordHash,
      role: 'admin',
      is_email_verified: true,
      is_active: true
    },
    {
      app_id: 'admin',
      email: 'techora@gmail.com',
      phone: '9999999998',
      password_hash: requestedPasswordHash,
      role: 'admin',
      is_email_verified: true,
      is_active: true
    }
  ]);
};
