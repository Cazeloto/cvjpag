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
const { handleNewMessage, handleMessageEdit, extractText, extractEditedText } = require('./messageHandler');

const TARGET_GROUP = process.env.GROUP_NAME || 'Casa da vovó Joaquina';
const AUTH_DIR = path.join(__dirname, '../../auth_info');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`🤖 Iniciando bot — Baileys v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['CVJPAG Monitor', 'Chrome', '1.0.0'],
  });

  // ── Autenticação / QR Code ─────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`🔌 Conexão encerrada (código ${code}). Reconectar: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 5000);
      } else {
        console.log('🚫 Sessão encerrada. Delete a pasta auth_info e reinicie para novo QR Code.');
      }
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      await logTargetGroup(sock);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Novas mensagens ────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.key.remoteJid) continue;
      if (msg.key.fromMe) continue; // ignora mensagens próprias

      const groupName = await getGroupName(sock, msg.key.remoteJid);
      if (!isTargetGroup(groupName)) continue;

      // Detecta se é edição
      const editedText = extractEditedText(msg);
      if (editedText) {
        const editedMsgId = msg.message?.protocolMessage?.key?.id;
        if (editedMsgId) {
          console.log(`✏️  Edição detectada na mensagem ${editedMsgId}`);
          await handleMessageEdit(editedMsgId, editedText);
        }
        continue;
      }

      // Nova mensagem normal
      const text = extractText(msg);
      if (text) {
        await handleNewMessage(msg);
      }
    }
  });

  // ── Edições via messages.update ────────────────────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (!update.key.remoteJid) continue;

      const groupName = await getGroupName(sock, update.key.remoteJid);
      if (!isTargetGroup(groupName)) continue;

      // Edição via protocolMessage type 14
      const editMsg = update.update?.message;
      if (editMsg?.protocolMessage?.type === 14) {
        const editedText =
          editMsg.protocolMessage.editedMessage?.conversation ||
          editMsg.protocolMessage.editedMessage?.extendedTextMessage?.text;
        const editedMsgId = editMsg.protocolMessage.key?.id;
        if (editedText && editedMsgId) {
          console.log(`✏️  Edição via update: ${editedMsgId}`);
          await handleMessageEdit(editedMsgId, editedText);
        }
      }
    }
  });

  return sock;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const groupNameCache = new Map();

async function getGroupName(sock, jid) {
  if (!jid.endsWith('@g.us')) return null;
  if (groupNameCache.has(jid)) return groupNameCache.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    groupNameCache.set(jid, meta.subject);
    return meta.subject;
  } catch {
    return null;
  }
}

function isTargetGroup(name) {
  if (!name) return false;
  return name.toLowerCase() === TARGET_GROUP.toLowerCase();
}

async function logTargetGroup(sock) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    const found = Object.values(groups).find((g) =>
      g.subject.toLowerCase() === TARGET_GROUP.toLowerCase()
    );
    if (found) {
      console.log(`🎯 Grupo alvo encontrado: "${found.subject}" (${found.id})`);
    } else {
      console.warn(`⚠️  Grupo "${TARGET_GROUP}" não encontrado. Verifique o nome no config.env`);
    }
  } catch (e) {
    console.warn('⚠️  Não foi possível listar grupos:', e.message);
  }
}

module.exports = { startBot };
