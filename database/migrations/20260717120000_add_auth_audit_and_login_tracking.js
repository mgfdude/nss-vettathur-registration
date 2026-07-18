exports.up = async function (knex) {
  await knex.schema.table('users', (table) => {
    table.datetime('last_login_at');
    table.string('last_login_ip');
  });

  await knex.schema.createTable('login_audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('role').defaultTo('student');
    table.string('action').notNullable();
    table.string('ip_address');
    table.string('user_agent');
    table.boolean('success').defaultTo(false);
    table.text('details');
    table.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('login_audit_logs');
  const hasLastLoginAt = await knex.schema.hasColumn('users', 'last_login_at');
  const hasLastLoginIp = await knex.schema.hasColumn('users', 'last_login_ip');

  if (hasLastLoginAt || hasLastLoginIp) {
    await knex.schema.table('users', (table) => {
      if (hasLastLoginAt) table.dropColumn('last_login_at');
      if (hasLastLoginIp) table.dropColumn('last_login_ip');
    });
  }
};
