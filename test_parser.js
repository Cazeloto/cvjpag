/**
 * test_parser.js
 * Testa o parser com mensagens de exemplo — sem WhatsApp, sem banco.
 *
 * Uso: node test_parser.js
 */
const {
  isContributionMessage,
  isExpenseMessage,
  parseContributionMessage,
  parseExpenseMessage,
} = require('./src/parsers/messageParser');

// ── Cole aqui mensagens reais para testar ─────────────────────────────────────

const mensagens = [
  // Contribuição mensal (da imagem)
  `CONTRIBUIÇÃO MENSAL - Outubro/2026

1. Suelen
2. Alisson Costa
3. J.Jorge
4. Manoel
5. Flavia
6. Marcus Vinícius
7. Tauame
8. Roger
9. Débora Franco
10. Amaral
11. Rodrigo Rincon
12. Ana Brandão
13. Carol Vada
14. Fabio Vada
15. Ester Kirchhof
16. Fernanda
17. Bruno
18. José Antonio`,

  // Exemplo de rateio (edite conforme necessário)
  `Compra do mês - Mercado

1. João
2. PG Maria
3. Pedro PG
4. Ana`,
];

// ── Execução ──────────────────────────────────────────────────────────────────

console.log('🧪 Teste do Parser — sem WhatsApp, sem banco\n');
console.log('═'.repeat(60));

mensagens.forEach((texto, i) => {
  console.log(`\n📨 Mensagem ${i + 1}:`);
  console.log('─'.repeat(60));

  if (isContributionMessage(texto)) {
    const parsed = parseContributionMessage(texto);
    console.log('✅ Tipo detectado: CONTRIBUIÇÃO MENSAL');
    console.log(`   Título:    ${parsed.title}`);
    console.log(`   Mês/Ano:   ${parsed.monthYear ?? '⚠️  não detectado'}`);
    console.log(`   Nomes (${parsed.names.length}):`);
    parsed.names.forEach((n, idx) => console.log(`     ${idx + 1}. ${n}`));

  } else if (isExpenseMessage(texto)) {
    const parsed = parseExpenseMessage(texto);
    console.log('✅ Tipo detectado: RATEIO/COMPRAS');
    console.log(`   Título: ${parsed.title}`);
    console.log(`   Entradas (${parsed.entries.length}):`);
    parsed.entries.forEach((e, idx) => {
      console.log(`     ${idx + 1}. ${e.paid ? '✅ PG' : '⬜   '} ${e.name}`);
    });

  } else {
    console.log('❌ Tipo não reconhecido');
    console.log(`   Texto: ${texto.substring(0, 100)}...`);
  }

  console.log('─'.repeat(60));
});
