require('dotenv').config({ path: './config.env' });
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');

const TARGET_GROUP = process.env.GROUP_NAME || 'Casa da vovó Joaquina';
const AUTH_DIR = path.join(__dirname, 'auth_info');

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

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR Code:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log('✅ Conectado! Aguardando mensagens do grupo...\n');
      console.log('─'.repeat(60));
    }
    if (connection === 'close') {
      console.log('🔌 Conexão encerrada.');
      process.exit(0);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid || !jid.endsWith('@g.us')) continue;

      // Pega nome do grupo
      let groupName = '(grupo desconhecido)';
      try {
        const meta = await sock.groupMetadata(jid);
        groupName = meta.subject;
      } catch {}

      // Extrai texto
      const m = msg.message;
      const text =
        m?.conversation ||
        m?.extendedTextMessage?.text ||
        m?.imageMessage?.caption ||
        null;

      const fromMe = msg.key.fromMe ? '[EU]' : '[outro]';
      const isTarget = groupName.toLowerCase().includes(TARGET_GROUP.toLowerCase());

      console.log(`\n📨 Grupo: "${groupName}" ${isTarget ? '🎯 ALVO!' : ''}`);
      console.log(`   De: ${fromMe} | ID: ${msg.key.id}`);
      if (text) {
        console.log(`   Texto: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
      } else {
        console.log(`   (sem texto — tipo: ${Object.keys(m || {}).join(', ')})`);
      }
      console.log('─'.repeat(60));
    }
  });

  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      const jid = update.key.remoteJid;
      if (!jid || !jid.endsWith('@g.us')) continue;

      let groupName = '(grupo desconhecido)';
      try {
        const meta = await sock.groupMetadata(jid);
        groupName = meta.subject;
      } catch {}

      const isTarget = groupName.toLowerCase().includes(TARGET_GROUP.toLowerCase());
      const editMsg = update.update?.message;
      const editedText =
        editMsg?.protocolMessage?.editedMessage?.conversation ||
        editMsg?.protocolMessage?.editedMessage?.extendedTextMessage?.text;

      if (editedText) {
        console.log(`\n✏️  EDIÇÃO — Grupo: "${groupName}" ${isTarget ? '🎯 ALVO!' : ''}`);
        console.log(`   Msg ID: ${update.key.id}`);
        console.log(`   Novo texto: ${editedText.substring(0, 200)}`);
        console.log('─'.repeat(60));
      }
    }
  });
}

console.log('🔍 Modo diagnóstico — captura de mensagens');
console.log(`🎯 Grupo alvo: "${TARGET_GROUP}"`);
console.log('Pressione Ctrl+C para encerrar.\n');

start().catch(console.error);
