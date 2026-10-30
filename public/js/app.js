// ── Estado ──────────────────────────────────────────────────────────────────
let currentTab = 'contributions';

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  showTab('contributions');
  checkStatus();
  setInterval(checkStatus, 30000);
});

async function checkStatus() {
  try {
    const res = await fetch('/api/contributions');
    const badge = document.getElementById('status-badge');
    if (res.ok) {
      badge.textContent = '🟢 Online';
      badge.className = 'ml-auto text-xs bg-green-600 text-white px-3 py-1 rounded-full';
    }
  } catch {
    const badge = document.getElementById('status-badge');
    badge.textContent = '🔴 Offline';
    badge.className = 'ml-auto text-xs bg-red-600 text-white px-3 py-1 rounded-full';
  }
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach((el) => {
    el.classList.remove('border-green-500', 'text-green-700', 'font-semibold', 'border-b-2');
  });
  document.getElementById(`tab-${tab}-content`).classList.remove('hidden');
  const btn = document.getElementById(`tab-${tab}`);
  btn.classList.add('border-b-2', 'border-green-500', 'text-green-700', 'font-semibold');

  if (tab === 'contributions') loadContributions();
  if (tab === 'expenses') loadExpenses();
  if (tab === 'members') loadMembers();
}

function backToList(tab) {
  document.getElementById(`${tab === 'contributions' ? 'contribution' : 'expense'}-list-view`).classList.remove('hidden');
  document.getElementById(`${tab === 'contributions' ? 'contribution' : 'expense'}-detail-view`).classList.add('hidden');
}

// ── Contribuições ─────────────────────────────────────────────────────────
async function loadContributions() {
  const res = await fetch('/api/contributions');
  const lists = await res.json();
  const container = document.getElementById('contributions-cards');

  if (!lists.length) {
    container.innerHTML = '<p class="text-gray-400 text-sm col-span-3">Nenhuma lista de contribuição detectada ainda.</p>';
    return;
  }

  container.innerHTML = lists.map((l) => `
    <div onclick="openContribution(${l.id})"
      class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition">
      <p class="font-semibold text-gray-800 text-sm">💰 ${l.title}</p>
      <p class="text-xs text-gray-400 mt-1">${formatDate(l.created_at)}</p>
    </div>
  `).join('');
}

async function openContribution(id) {
  const res = await fetch(`/api/contributions/${id}`);
  const data = await res.json();
  const { list, entries, missing, summary } = data;

  document.getElementById('contribution-list-view').classList.add('hidden');
  document.getElementById('contribution-detail-view').classList.remove('hidden');

  const paidEntries = entries.filter((e) => e.paid);
  const pendingEntries = entries.filter((e) => !e.paid);

  document.getElementById('contribution-detail').innerHTML = `
    <h2 class="text-lg font-bold text-gray-800 mb-2">${list.title}</h2>
    <div class="flex gap-4 mb-6 flex-wrap">
      ${statCard('Total', summary.total, 'blue')}
      ${statCard('Pagos', summary.paid, 'green')}
      ${statCard('Pendentes', summary.pending + summary.notListed, 'red')}
    </div>

    <h3 class="font-semibold text-green-700 mb-2">✅ Pagos (${paidEntries.length})</h3>
    <div class="grid sm:grid-cols-2 gap-2 mb-6">
      ${paidEntries.map((e) => memberRow(e, true, 'contribution')).join('') || '<p class="text-gray-400 text-sm">Nenhum ainda.</p>'}
    </div>

    <h3 class="font-semibold text-red-600 mb-2">⏳ Pendentes (${pendingEntries.length})</h3>
    <div class="grid sm:grid-cols-2 gap-2 mb-6">
      ${pendingEntries.map((e) => memberRow(e, false, 'contribution')).join('') || '<p class="text-gray-400 text-sm">Todos pagaram! 🎉</p>'}
    </div>

    ${missing.length > 0 ? `
      <h3 class="font-semibold text-orange-500 mb-2">⚠️ Não listados (${missing.length})</h3>
      <div class="grid sm:grid-cols-2 gap-2">
        ${missing.map((m) => `
          <div class="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm text-orange-700">${m.name}</div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ── Rateios ──────────────────────────────────────────────────────────────────
async function loadExpenses() {
  const res = await fetch('/api/expenses');
  const lists = await res.json();
  const container = document.getElementById('expenses-cards');

  if (!lists.length) {
    container.innerHTML = '<p class="text-gray-400 text-sm col-span-3">Nenhum rateio detectado ainda.</p>';
    return;
  }

  container.innerHTML = lists.map((l) => `
    <div onclick="openExpense(${l.id})"
      class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition">
      <p class="font-semibold text-gray-800 text-sm">🛒 ${l.title}</p>
      <div class="mt-2 flex gap-2 text-xs">
        <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ ${l.paid_count} pagos</span>
        <span class="bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⏳ ${l.pending_count} pendentes</span>
      </div>
      <p class="text-xs text-gray-400 mt-1">${formatDate(l.created_at)}</p>
    </div>
  `).join('');
}

async function openExpense(id) {
  const res = await fetch(`/api/expenses/${id}`);
  const data = await res.json();
  const { list, entries, summary } = data;

  document.getElementById('expense-list-view').classList.add('hidden');
  document.getElementById('expense-detail-view').classList.remove('hidden');

  const paidEntries = entries.filter((e) => e.paid);
  const pendingEntries = entries.filter((e) => !e.paid);

  document.getElementById('expense-detail').innerHTML = `
    <h2 class="text-lg font-bold text-gray-800 mb-2">${list.title}</h2>
    <div class="flex gap-4 mb-6 flex-wrap">
      ${statCard('Participantes', summary.total, 'blue')}
      ${statCard('Pagos', summary.paid, 'green')}
      ${statCard('Pendentes', summary.pending, 'red')}
    </div>

    <div class="w-full bg-gray-100 rounded-full h-3 mb-6">
      <div class="bg-green-500 h-3 rounded-full transition-all"
        style="width: ${summary.total ? Math.round((summary.paid / summary.total) * 100) : 0}%"></div>
    </div>

    <h3 class="font-semibold text-green-700 mb-2">✅ Pagos (${paidEntries.length})</h3>
    <div class="grid sm:grid-cols-2 gap-2 mb-6">
      ${paidEntries.map((e) => memberRow(e, true, 'expense')).join('') || '<p class="text-gray-400 text-sm">Nenhum ainda.</p>'}
    </div>

    <h3 class="font-semibold text-red-600 mb-2">⏳ Pendentes (${pendingEntries.length})</h3>
    <div class="grid sm:grid-cols-2 gap-2">
      ${pendingEntries.map((e) => memberRow(e, false, 'expense')).join('') || '<p class="text-gray-400 text-sm">Todos pagaram! 🎉</p>'}
    </div>
  `;
}

// ── Membros ──────────────────────────────────────────────────────────────────
async function loadMembers() {
  const res = await fetch('/api/members');
  const members = await res.json();
  const container = document.getElementById('members-list');

  container.innerHTML = members.map((m) => `
    <div class="bg-white border border-gray-100 rounded-lg px-3 py-2 flex justify-between items-center text-sm">
      <span class="text-gray-700">${m.name}</span>
      <button onclick="removeMember(${m.id})" class="text-red-400 hover:text-red-600 text-xs ml-2">✕</button>
    </div>
  `).join('');
}

async function addMember() {
  const input = document.getElementById('new-member-name');
  const name = input.value.trim();
  if (!name) return;
  await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  input.value = '';
  loadMembers();
}

async function removeMember(id) {
  if (!confirm('Desativar este membro?')) return;
  await fetch(`/api/members/${id}`, { method: 'DELETE' });
  loadMembers();
}

// ── Marcar pagamento manual ───────────────────────────────────────────────────
async function togglePaid(type, entryId, currentPaid, listId) {
  const endpoint = type === 'contribution'
    ? `/api/contributions/entries/${entryId}/paid`
    : `/api/expenses/entries/${entryId}/paid`;

  await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid: !currentPaid }),
  });

  if (type === 'contribution') openContribution(listId);
  else openExpense(listId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statCard(label, value, color) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-600',
  };
  return `
    <div class="rounded-xl px-4 py-3 ${colors[color]} min-w-[90px] text-center">
      <p class="text-2xl font-bold">${value}</p>
      <p class="text-xs mt-0.5">${label}</p>
    </div>`;
}

function memberRow(entry, paid, type) {
  const listId = window._currentListId;
  return `
    <div class="flex items-center justify-between bg-${paid ? 'green' : 'red'}-50
      border border-${paid ? 'green' : 'red'}-100 rounded-lg px-3 py-2 text-sm">
      <span class="text-gray-700">${entry.name_on_list}</span>
      <button onclick="togglePaid('${type}', ${entry.id}, ${paid}, ${entry.list_id})"
        class="text-xs ${paid ? 'text-green-600 hover:text-red-500' : 'text-red-500 hover:text-green-600'} ml-2 font-medium">
        ${paid ? '✅' : '⏳'}
      </button>
    </div>`;
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
