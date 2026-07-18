exports.up = function(knex) {
  return knex.schema
    .createTable('users', (table) => {
      table.increments('id').primary();
      table.string('app_id').unique().notNullable();
      table.string('email').unique().notNullable();
      table.string('phone').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('role').defaultTo('student'); // 'student', 'admin', 'superadmin'
      table.boolean('is_email_verified').defaultTo(false);
      table.datetime('last_login');
      table.boolean('is_active').defaultTo(true);
      table.integer('failed_login_attempts').defaultTo(0);
      table.datetime('locked_until');
      table.timestamps(true, true);
    })
    .createTable('applications', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('status').defaultTo('Draft');
      // Personal Info
      table.string('full_name');
      table.string('father_name');
      table.string('mother_name');
      table.date('dob');
      table.integer('age');
      table.string('blood_group');
      table.string('aadhaar_number');
      // Contact Numbers
      table.string('phone_number');
      table.string('whatsapp_number');
      table.string('guardian_mobile');
      // Address
      table.string('house_name');
      table.string('place');
      table.string('pin_code');
      table.string('district');
      // Academic (kept for compatibility)
      table.string('first_name');
      table.string('last_name');
      table.string('class_name');
      table.string('roll_number');
      // Emergency Contact
      table.string('guardian_name');
      table.string('guardian_phone');
      table.string('emergency_phone');
      // Volunteer Profile
      table.text('skills');
      table.text('interests');
      table.text('volunteer_exp');
      table.text('essay_why_nss');
      // Uploads
      table.string('photo_path');
      table.string('signature_path');
      table.string('docs_path');
      // Admin fields
      table.integer('interview_marks').defaultTo(0);
      table.text('admin_remarks');
      table.datetime('submitted_at');
      table.timestamps(true, true);
    })
    .createTable('otp_codes', (table) => {
      table.increments('id').primary();
      table.string('email');
      table.string('phone');
      table.string('code_hash').notNullable();
      table.string('type').notNullable(); // 'registration', 'forgot_password'
      table.text('payload'); // Serialized draft data for registration
      table.datetime('expires_at').notNullable();
      table.integer('attempts').defaultTo(0);
      table.timestamps(true, true);
    })
    .createTable('settings', (table) => {
      table.string('key').primary();
      table.text('value').notNullable();
      table.string('description');
      table.timestamps(true, true);
    })
    .createTable('notifications', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('title').notNullable();
      table.text('message').notNullable();
      table.boolean('is_read').defaultTo(false);
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('notifications')
    .dropTableIfExists('settings')
    .dropTableIfExists('otp_codes')
    .dropTableIfExists('applications')
    .dropTableIfExists('users');
};
