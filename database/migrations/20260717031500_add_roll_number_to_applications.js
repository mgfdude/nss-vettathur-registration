exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('applications', 'roll_number');
  if (!hasColumn) {
    await knex.schema.table('applications', (table) => {
      table.string('roll_number');
    });
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('applications', 'roll_number');
  if (hasColumn) {
    await knex.schema.table('applications', (table) => {
      table.dropColumn('roll_number');
    });
  }
};
