require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./api/routes');
const { startBot } = require('./bot/whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API
app.use('/api', routes);

// Fallback para o frontend SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function main() {
  // Inicia servidor web
  app.listen(PORT, () => {
    console.log(`🌐 Dashboard disponível em http://localhost:${PORT}`);
  });

  // Inicia bot WhatsApp
  await startBot();
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
