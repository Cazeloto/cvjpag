/**
 * test_read_last.js
 * Conecta ao WhatsApp, encontra o grupo alvo e tenta capturar
 * a próxima mensagem recebida OU edição — exibe o texto completo.
 *
 * Como usar:
 *   1. node test_read_last.js
 *   2. No WhatsApp, ENCAMINHE ou EDITE a mensagem da lista no grupo
 *   3. O script exibe o texto completo e roda o parser
 *
 * Pressione Ctrl+C para encerrar.
 */
require('dotenv').config({ path: './config.env' });
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
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

function parseAndShow(text, label) {
  console.log('\n' + '═'.repeat(60));
  console.log(`📨 ${label}`);
  console.log('─'.repeat(60));
  console.log('📝 Texto completo:');
  console.log(text);
  console.log('─'.repeat(60));

  if (isContributionMessage(text)) {
    const parsed = parseContributionMessage(text);
    console.log('✅ Tipo: CONTRIBUIÇÃO MENSAL');
    console.log(`   Título:  ${parsed.title}`);
    console.log(`   Mês/Ano: ${parsed.monthYear ?? '⚠️  não detectado'}`);
    console.log(`   Nomes (${parsed.names.length}):`);
    parsed.names.forEach((n, i) => console.log(`     ${i + 1}. ${n}`));

  } else if (isExpenseMessage(text)) {
    const parsed = parseExpenseMessage(text);
    console.log('✅ Tipo: RATEIO/COMPRAS');
    console.log(`   Título: ${parsed.title}`);
    console.log(`   Entradas (${parsed.entries.length}):`);
    parsed.entries.forEach((e, i) => {
      console.log(`     ${i + 1}. ${e.paid ? '✅ PG' : '⬜   '} ${e.name}`);
    });

  } else {
    console.log('❌ Tipo não reconhecido pelo parser');
  }
  console.log('═'.repeat(60));
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

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR Code:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅ Conectado!\n');
      console.log(`⏳ Aguardando mensagens do grupo "${TARGET_GROUP}"...`);
      console.log('👉 Encaminhe ou edite a mensagem da lista no grupo agora.');
      console.log('   Pressione Ctrl+C para encerrar.\n');
    }
    if (connection === 'close') {
      console.log('🔌 Conexão encerrada.');
      process.exit(0);
    }
  });

  // Mensagem nova
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;

      let groupName = '';
      try {
        const meta = await sock.groupMetadata(jid);
        groupName = meta.subject;
      } catch {}

      if (groupName.toLowerCase() !== TARGET_GROUP.toLowerCase()) continue;

      const text = extractText(msg);
      if (text) parseAndShow(text, 'NOVA MENSAGEM');
    }
  });

  // Edição de mensagem
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      const jid = update.key.remoteJid;
      if (!jid?.endsWith('@g.us')) continue;

      let groupName = '';
      try {
        const meta = await sock.groupMetadata(jid);
        groupName = meta.subject;
      } catch {}

      if (groupName.toLowerCase() !== TARGET_GROUP.toLowerCase()) continue;

      const editMsg = update.update?.message;
      const editedText =
        editMsg?.protocolMessage?.editedMessage?.conversation ||
        editMsg?.protocolMessage?.editedMessage?.extendedTextMessage?.text;

      if (editedText) parseAndShow(editedText, 'EDIÇÃO DE MENSAGEM');
    }
  });
}

console.log('🔍 Leitor de mensagens completas — sem gravar no banco');
console.log(`🎯 Grupo alvo: "${TARGET_GROUP}"\n`);

start().catch(console.error);
