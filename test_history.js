/**
 * test_history.js
 * Busca o histórico de mensagens do grupo alvo e tenta detectar
 * listas de contribuição e rateio — SEM gravar nada no banco.
 *
 * Uso: node test_history.js [quantidade]
 *   quantidade = número de mensagens a buscar (padrão: 50)
 */
require('dotenv').config({ path: './config.env' });
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const {
  isContributionMessage,
  isExpenseMessage,
  parseContributionMessage,
  parseExpenseMessage,
} = require('./src/parsers/messageParser');

const TARGET_GROUP = process.env.GROUP_NAME || 'Casa da vovó Joaquina';
const AUTH_DIR = path.join(__dirname, 'auth_info');
const LIMIT = parseInt(process.argv[2]) || 50;

function extractText(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    null
  );
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['CVJPAG Monitor', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR Code:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Conectado!\n');
      console.log(`🔍 Buscando grupo "${TARGET_GROUP}"...`);

      try {
        // Localiza o JID do grupo alvo
        const groups = await sock.groupFetchAllParticipating();
        const target = Object.values(groups).find(
          (g) => g.subject.toLowerCase() === TARGET_GROUP.toLowerCase()
        );

        if (!target) {
          console.error(`❌ Grupo "${TARGET_GROUP}" não encontrado.`);
          console.log('Grupos disponíveis:');
          Object.values(groups).forEach((g) => console.log(`  • ${g.subject}`));
          process.exit(1);
        }

        console.log(`🎯 Grupo encontrado: "${target.subject}" (${target.id})\n`);
        console.log(`📜 Buscando últimas ${LIMIT} mensagens...\n`);
        console.log('═'.repeat(60));

        // Busca histórico
        const history = await sock.fetchMessageHistory(LIMIT, target.id, undefined);
        const messages = history?.messages ?? [];

        if (messages.length === 0) {
          console.log('⚠️  Nenhuma mensagem retornada. Tente aumentar o limite.');
          process.exit(0);
        }

        console.log(`📦 ${messages.length} mensagens recebidas\n`);

        let found = 0;

        for (const msg of messages) {
          const text = extractText(msg);
          if (!text) continue;

          if (isContributionMessage(text)) {
            found++;
            const parsed = parseContributionMessage(text);
            console.log(`\n💰 CONTRIBUIÇÃO MENSAL (#${found})`);
            console.log(`   Título:    ${parsed.title}`);
            console.log(`   Mês/Ano:   ${parsed.monthYear ?? '(não detectado)'}`);
            console.log(`   Nomes (${parsed.names.length}): ${parsed.names.join(', ')}`);
            console.log('─'.repeat(60));

          } else if (isExpenseMessage(text)) {
            found++;
            const parsed = parseExpenseMessage(text);
            console.log(`\n🛒 RATEIO/COMPRAS (#${found})`);
            console.log(`   Título: ${parsed.title}`);
            console.log(`   Entradas (${parsed.entries.length}):`);
            parsed.entries.forEach((e) => {
              console.log(`     ${e.paid ? '✅ PG' : '⬜    '} ${e.name}`);
            });
            console.log('─'.repeat(60));
          }
        }

        if (found === 0) {
          console.log('\n⚠️  Nenhuma lista de contribuição ou rateio encontrada nas últimas mensagens.');
          console.log('   Tente aumentar o limite: node test_history.js 200');
        } else {
          console.log(`\n✅ Total encontrado: ${found} lista(s)`);
        }

      } catch (err) {
        console.error('❌ Erro ao buscar histórico:', err.message);
      }

      process.exit(0);
    }

    if (connection === 'close') {
      console.log('🔌 Conexão encerrada.');
      process.exit(0);
    }
  });
}

console.log('🔍 Busca de histórico — modo diagnóstico (sem gravar no banco)');
console.log(`🎯 Grupo alvo: "${TARGET_GROUP}"`);
console.log(`📊 Limite: ${LIMIT} mensagens\n`);

start().catch(console.error);
