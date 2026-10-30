const db = require('./knex');

async function migrate() {
  console.log('🔧 Iniciando migrações...');

  // Tabela de membros cadastrados
  await db.schema.createTableIfNotExists('members', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.string('normalized_name', 100).notNullable().unique(); // nome em lowercase sem acentos
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Listas de Contribuição Mensal
  await db.schema.createTableIfNotExists('contribution_lists', (t) => {
    t.increments('id').primary();
    t.string('title', 255).notNullable();        // ex: "CONTRIBUIÇÃO MENSAL - Outubro/2026"
    t.string('month_year', 20).notNullable();    // ex: "Outubro/2026"
    t.text('original_message');                  // texto bruto da mensagem
    t.string('wa_message_id', 100);              // ID da mensagem no WhatsApp
    t.string('wa_chat_id', 100);                 // ID do grupo
    t.timestamps(true, true);
  });

  // Entradas de cada lista de contribuição
  await db.schema.createTableIfNotExists('contribution_entries', (t) => {
    t.increments('id').primary();
    t.integer('list_id').references('id').inTable('contribution_lists').onDelete('CASCADE');
    t.integer('member_id').references('id').inTable('members').nullable(); // pode não encontrar match
    t.string('name_on_list', 100).notNullable();  // nome exatamente como aparece na mensagem
    t.boolean('paid').defaultTo(false);
    t.timestamp('paid_at').nullable();
    t.unique(['list_id', 'name_on_list']);
  });

  // Listas de Rateio/Compras
  await db.schema.createTableIfNotExists('expense_lists', (t) => {
    t.increments('id').primary();
    t.string('title', 255).notNullable();         // título da mensagem
    t.text('original_message');
    t.string('wa_message_id', 100);
    t.string('wa_chat_id', 100);
    t.boolean('active').defaultTo(true);          // false quando encerrado
    t.timestamps(true, true);
  });

  // Entradas de cada lista de rateio
  await db.schema.createTableIfNotExists('expense_entries', (t) => {
    t.increments('id').primary();
    t.integer('list_id').references('id').inTable('expense_lists').onDelete('CASCADE');
    t.integer('member_id').references('id').inTable('members').nullable();
    t.string('name_on_list', 100).notNullable();
    t.boolean('paid').defaultTo(false);
    t.timestamp('paid_at').nullable();
    t.unique(['list_id', 'name_on_list']);
  });

  console.log('✅ Migrações concluídas com sucesso!');
  await db.destroy();
}

migrate().catch((err) => {
  console.error('❌ Erro na migração:', err);
  process.exit(1);
});
