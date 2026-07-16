/**
 * Extend portal settings and add public announcements.
 */
exports.up = async function (knex) {
  const existingKeys = await knex('settings').pluck('key');
  const now = new Date();

  const newSettings = [
    {
      key: 'editing_open',
      value: 'true',
      description: 'Allow students to edit draft applications and uploads (true/false)'
    },
    {
      key: 'login_enabled',
      value: 'true',
      description: 'Allow student and admin login (true/false)'
    },
    {
      key: 'registration_start',
      value: '2026-07-01T00:00:00Z',
      description: 'Registration start date (ISO UTC)'
    },
    {
      key: 'editing_deadline',
      value: '2026-08-31T23:59:59Z',
      description: 'Deadline for application editing (ISO UTC)'
    },
    {
      key: 'result_date',
      value: '2026-09-15T00:00:00Z',
      description: 'Expected or published result date (ISO UTC)'
    },
    {
      key: 'contact_officer',
      value: 'Programme Officer, NSS Vettathur',
      description: 'Contact person / programme officer name'
    },
    {
      key: 'contact_email',
      value: 'nss@vettathur.edu.in',
      description: 'Public contact email'
    },
    {
      key: 'contact_phone',
      value: '',
      description: 'Public contact phone (optional)'
    },
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
  ];

  for (const setting of newSettings) {
    if (!existingKeys.includes(setting.key)) {
      await knex('settings').insert({ ...setting, created_at: now, updated_at: now });
    }
  }

  const hasAnnouncements = await knex.schema.hasTable('announcements');
  if (!hasAnnouncements) {
    await knex.schema.createTable('announcements', (table) => {
      table.increments('id').primary();
      table.string('title', 200).notNullable();
      table.text('body').notNullable();
      table.boolean('is_published').notNullable().defaultTo(true);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamp('published_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);
    });

    await knex('announcements').insert([
      {
        title: 'Welcome to the NSS Registration Portal',
        body: 'Register online, complete your application, and track your selection status through this portal.',
        is_published: true,
        sort_order: 1,
        published_at: now,
        created_at: now,
        updated_at: now
      },
      {
        title: 'Keep your Application ID safe',
        body: 'Your Application ID is required to sign in. Store it securely and do not share your password with anyone.',
        is_published: true,
        sort_order: 2,
        published_at: now,
        created_at: now,
        updated_at: now
      }
    ]);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('announcements');
  await knex('settings')
    .whereIn('key', [
      'editing_open',
      'login_enabled',
      'registration_start',
      'editing_deadline',
      'result_date',
      'contact_officer',
      'contact_email',
      'contact_phone',
      'faq_json'
    ])
    .del();
};
