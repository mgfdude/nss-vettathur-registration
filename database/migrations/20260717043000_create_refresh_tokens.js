exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('refresh_tokens');
  if (!exists) {
    await knex.schema.createTable('refresh_tokens', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('token_hash').notNullable().unique();
      table.datetime('expires_at').notNullable();
      table.datetime('revoked_at');
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
