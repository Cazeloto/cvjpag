const db = require('../db/knex');
const {
  isContributionMessage,
  isExpenseMessage,
  parseContributionMessage,
  parseExpenseMessage,
  matchNamesWithMembers,
  normalize,
} = require('../parsers/messageParser');

/**
 * Processa uma nova mensagem recebida do grupo.
 * Identifica o tipo e persiste no banco.
 */
async function handleNewMessage(msg) {
  const text = extractText(msg);
  if (!text) return;

  const chatId = msg.key.remoteJid;
  const waMessageId = msg.key.id;

  if (isContributionMessage(text)) {
    await processContribution(text, chatId, waMessageId);
  } else if (isExpenseMessage(text)) {
    await processExpense(text, chatId, waMessageId);
  }
}

/**
 * Processa edição de mensagem existente.
 * Detecta novos nomes ou marcação de PG em rateios.
 */
async function handleMessageEdit(waMessageId, newText) {
  if (!newText) return;

  // Verifica se é edição de lista de contribuição
  const contribList = await db('contribution_lists')
    .where('wa_message_id', waMessageId)
    .first();

  if (contribList) {
    await updateContributionFromEdit(contribList, newText);
    return;
  }

  // Verifica se é edição de lista de rateio
  const expenseList = await db('expense_lists')
    .where('wa_message_id', waMessageId)
    .first();

  if (expenseList) {
    await updateExpenseFromEdit(expenseList, newText);
  }
}

// ─── Contribuição ──────────────────────────────────────────────────────────

async function processContribution(text, chatId, waMessageId) {
  const { title, monthYear, names } = parseContributionMessage(text);
  if (!monthYear || names.length === 0) return;

  // Evita duplicata pela mensagem WA
  const existing = await db('contribution_lists')
    .where('wa_message_id', waMessageId)
    .first();
  if (existing) return;

  console.log(`📋 Nova lista de contribuição detectada: ${title}`);

  const [list] = await db('contribution_lists')
    .insert({ title, month_year: monthYear, original_message: text, wa_message_id: waMessageId, wa_chat_id: chatId })
    .returning('*');

  const members = await db('members').where('active', true);
  const matched = matchNamesWithMembers(names, members);

  const entries = matched.map(({ nameOnList, memberId }) => ({
    list_id: list.id,
    member_id: memberId,
    name_on_list: nameOnList,
    paid: false,
  }));

  if (entries.length > 0) {
    await db('contribution_entries').insert(entries).onConflict(['list_id', 'name_on_list']).ignore();
  }

  console.log(`✅ Contribuição salva com ${entries.length} entradas.`);
}

async function updateContributionFromEdit(list, newText) {
  const { names } = parseContributionMessage(newText);
  if (names.length === 0) return;

  const members = await db('members').where('active', true);

  for (const nameOnList of names) {
    const normNew = normalize(nameOnList);
    // Verifica se já existe (pelo nome normalizado ou por match parcial)
    const existing = await db('contribution_entries')
      .where('list_id', list.id)
      .whereRaw('LOWER(UNACCENT(name_on_list)) = ?', [normNew.replace(/ /g, ' ')])
      .first();

    if (!existing) {
      // Nome novo adicionado via edição = pessoa confirmou contribuição
      const matched = matchNamesWithMembers([nameOnList], members);
      const { memberId } = matched[0];
      await db('contribution_entries')
        .insert({
          list_id: list.id,
          member_id: memberId,
          name_on_list: nameOnList,
          paid: true,
          paid_at: new Date(),
        })
        .onConflict(['list_id', 'name_on_list'])
        .merge({ paid: true, paid_at: new Date() });

      console.log(`💰 Contribuição confirmada por edição: ${nameOnList}`);
    }
  }
}

// ─── Rateio ─────────────────────────────────────────────────────────────────

async function processExpense(text, chatId, waMessageId) {
  const { title, entries } = parseExpenseMessage(text);
  if (!title) return;

  const existing = await db('expense_lists')
    .where('wa_message_id', waMessageId)
    .first();
  if (existing) return;

  console.log(`🛒 Nova lista de rateio detectada: ${title}`);

  const [list] = await db('expense_lists')
    .insert({ title, original_message: text, wa_message_id: waMessageId, wa_chat_id: chatId })
    .returning('*');

  const members = await db('members').where('active', true);

  if (entries.length > 0) {
    const matched = matchNamesWithMembers(entries.map((e) => e.name), members);
    const rows = matched.map(({ nameOnList, memberId }, i) => ({
      list_id: list.id,
      member_id: memberId,
      name_on_list: nameOnList,
      paid: entries[i].paid,
      paid_at: entries[i].paid ? new Date() : null,
    }));
    await db('expense_entries').insert(rows).onConflict(['list_id', 'name_on_list']).ignore();
  }

  console.log(`✅ Rateio salvo com ${entries.length} entradas.`);
}

async function updateExpenseFromEdit(list, newText) {
  const { entries: newEntries } = parseExpenseMessage(newText);
  if (newEntries.length === 0) return;

  const members = await db('members').where('active', true);

  for (const entry of newEntries) {
    const existing = await db('expense_entries')
      .where('list_id', list.id)
      .whereRaw("LOWER(name_on_list) = LOWER(?)", [entry.name])
      .first();

    if (!existing) {
      // Pessoa adicionou o próprio nome na lista
      const matched = matchNamesWithMembers([entry.name], members);
      await db('expense_entries')
        .insert({
          list_id: list.id,
          member_id: matched[0].memberId,
          name_on_list: entry.name,
          paid: entry.paid,
          paid_at: entry.paid ? new Date() : null,
        })
        .onConflict(['list_id', 'name_on_list'])
        .ignore();
      console.log(`➕ Novo participante no rateio: ${entry.name}`);
    } else if (!existing.paid && entry.paid) {
      // Pessoa marcou PG
      await db('expense_entries')
        .where('id', existing.id)
        .update({ paid: true, paid_at: new Date() });
      console.log(`✅ Pagamento registrado no rateio: ${entry.name}`);
    }
  }
}

/**
 * Extrai texto de um objeto de mensagem Baileys
 */
function extractText(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
    m.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text ||
    null
  );
}

function extractEditedText(msg) {
  const m = msg.message;
  if (!m) return null;
  const proto = m.protocolMessage;
  if (proto && proto.type === 14) {
    // TYPE_MESSAGE_EDIT
    return (
      proto.editedMessage?.conversation ||
      proto.editedMessage?.extendedTextMessage?.text ||
      null
    );
  }
  return null;
}

module.exports = { handleNewMessage, handleMessageEdit, extractText, extractEditedText };
