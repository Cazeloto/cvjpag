/**
 * Normaliza texto: minúsculas, sem acentos, sem espaços extras
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta se uma mensagem é do tipo "Contribuição Mensal"
 * Ex: "CONTRIBUIÇÃO MENSAL - Outubro/2026"
 */
function isContributionMessage(text) {
  return /contribui[cç][aã]o\s+mensal/i.test(text);
}

/**
 * Detecta se uma mensagem é do tipo "Rateio/Compras"
 * Heurística: tem título na primeira linha + lista numerada + NÃO é contribuição mensal
 */
function isExpenseMessage(text) {
  if (isContributionMessage(text)) return false;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  // Pelo menos 2 linhas numeradas
  const numberedLines = lines.filter((l) => /^\d+[\.\)]\s+/.test(l));
  return numberedLines.length >= 2;
}

/**
 * Extrai mês/ano de uma linha como "CONTRIBUIÇÃO MENSAL - Outubro/2026"
 */
function extractMonthYear(text) {
  const match = text.match(/[-–]\s*([A-Za-zÀ-ú]+\/\d{4})/i);
  return match ? match[1] : null;
}

/**
 * Faz parse de uma mensagem de Contribuição Mensal.
 * Retorna { title, monthYear, names: string[] }
 */
function parseContributionMessage(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const titleLine = lines.find((l) => isContributionMessage(l)) || lines[0];
  const monthYear = extractMonthYear(titleLine);

  const names = [];
  for (const line of lines) {
    // Padrão: "1. Nome" ou "1. ⁠Nome" (caractere invisível após o ponto)
    const match = line.match(/^\d+[\.\)]\s+[\u2060\u200b\u200c\u200d]*(.*)/);
    if (match) {
      const name = match[1].trim();
      if (name) names.push(name);
    }
  }

  return { title: titleLine, monthYear, names };
}

/**
 * Faz parse de uma mensagem de Rateio/Compras.
 * Retorna { title, entries: Array<{ name, paid }> }
 * "PG" no início do nome = pago
 */
function parseExpenseMessage(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const title = lines[0];
  const entries = [];

  for (const line of lines.slice(1)) {
    const match = line.match(/^\d+[\.\)]\s+[\u2060\u200b\u200c\u200d]*(.*)/);
    if (match) {
      let name = match[1].trim();
      const paid = /^PG\s+/i.test(name) || /\s+PG$/i.test(name);
      if (paid) {
        name = name.replace(/^PG\s+/i, '').replace(/\s+PG$/i, '').trim();
      }
      if (name) entries.push({ name, paid });
    }
  }

  return { title, entries };
}

/**
 * Compara lista de nomes com membros cadastrados.
 * Retorna array de { nameOnList, memberId, normalized }
 */
function matchNamesWithMembers(names, members) {
  return names.map((nameOnList) => {
    const normName = normalize(nameOnList);
    // Tenta match exato, depois parcial
    let member = members.find((m) => m.normalized_name === normName);
    if (!member) {
      member = members.find(
        (m) =>
          m.normalized_name.includes(normName) ||
          normName.includes(m.normalized_name)
      );
    }
    return {
      nameOnList,
      memberId: member ? member.id : null,
    };
  });
}

module.exports = {
  normalize,
  isContributionMessage,
  isExpenseMessage,
  extractMonthYear,
  parseContributionMessage,
  parseExpenseMessage,
  matchNamesWithMembers,
};
