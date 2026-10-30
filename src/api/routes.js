const express = require('express');
const router = express.Router();
const db = require('../db/knex');

// ─── Membros ────────────────────────────────────────────────────────────────

// GET /api/members
router.get('/members', async (req, res) => {
  const members = await db('members').where('active', true).orderBy('name');
  res.json(members);
});

// POST /api/members — cadastrar novo membro
router.post('/members', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name obrigatório' });
  const normalized = normalize(name);
  const [m] = await db('members').insert({ name, normalized_name: normalized }).returning('*');
  res.status(201).json(m);
});

// DELETE /api/members/:id — desativar membro
router.delete('/members/:id', async (req, res) => {
  await db('members').where('id', req.params.id).update({ active: false });
  res.json({ ok: true });
});

// ─── Contribuição ───────────────────────────────────────────────────────────

// GET /api/contributions — lista todas as listas de contribuição
router.get('/contributions', async (req, res) => {
  const lists = await db('contribution_lists').orderBy('created_at', 'desc');
  res.json(lists);
});

// GET /api/contributions/:id — detalhes de uma lista com status de cada membro
router.get('/contributions/:id', async (req, res) => {
  const list = await db('contribution_lists').where('id', req.params.id).first();
  if (!list) return res.status(404).json({ error: 'Lista não encontrada' });

  const entries = await db('contribution_entries as ce')
    .leftJoin('members as m', 'ce.member_id', 'm.id')
    .where('ce.list_id', req.params.id)
    .select('ce.*', 'm.name as member_name')
    .orderBy('ce.name_on_list');

  // Membros cadastrados que NÃO estão na lista
  const allMembers = await db('members').where('active', true);
  const listedNames = entries.map((e) => (e.member_id ? e.member_id : null));
  const missing = allMembers.filter(
    (m) => !entries.some((e) => e.member_id === m.id)
  );

  const summary = {
    total: allMembers.length,
    paid: entries.filter((e) => e.paid).length,
    pending: entries.filter((e) => !e.paid).length,
    notListed: missing.length,
  };

  res.json({ list, entries, missing, summary });
});

// PATCH /api/contributions/entries/:id/paid — marcar como pago manualmente
router.patch('/contributions/entries/:id/paid', async (req, res) => {
  const { paid } = req.body;
  await db('contribution_entries')
    .where('id', req.params.id)
    .update({ paid: !!paid, paid_at: paid ? new Date() : null });
  res.json({ ok: true });
});

// ─── Rateio ─────────────────────────────────────────────────────────────────

// GET /api/expenses — lista todos os rateios
router.get('/expenses', async (req, res) => {
  const lists = await db('expense_lists').orderBy('created_at', 'desc');

  // Adiciona totalizador de pagos/pendentes
  const result = await Promise.all(
    lists.map(async (l) => {
      const counts = await db('expense_entries')
        .where('list_id', l.id)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('SUM(CASE WHEN paid THEN 1 ELSE 0 END) as paid_count')
        )
        .first();
      return {
        ...l,
        total: parseInt(counts.total),
        paid_count: parseInt(counts.paid_count),
        pending_count: parseInt(counts.total) - parseInt(counts.paid_count),
      };
    })
  );

  res.json(result);
});

// GET /api/expenses/:id — detalhes de um rateio
router.get('/expenses/:id', async (req, res) => {
  const list = await db('expense_lists').where('id', req.params.id).first();
  if (!list) return res.status(404).json({ error: 'Rateio não encontrado' });

  const entries = await db('expense_entries as ee')
    .leftJoin('members as m', 'ee.member_id', 'm.id')
    .where('ee.list_id', req.params.id)
    .select('ee.*', 'm.name as member_name')
    .orderBy('ee.name_on_list');

  const summary = {
    total: entries.length,
    paid: entries.filter((e) => e.paid).length,
    pending: entries.filter((e) => !e.paid).length,
  };

  res.json({ list, entries, summary });
});

// PATCH /api/expenses/entries/:id/paid — marcar como pago manualmente
router.patch('/expenses/entries/:id/paid', async (req, res) => {
  const { paid } = req.body;
  await db('expense_entries')
    .where('id', req.params.id)
    .update({ paid: !!paid, paid_at: paid ? new Date() : null });
  res.json({ ok: true });
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

module.exports = router;
