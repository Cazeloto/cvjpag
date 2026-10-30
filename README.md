# Monitor do Grupo WhatsApp — Casa da vovó Joaquina

Sistema de monitoramento das listas de contribuição e rateio do grupo WhatsApp.

## Pré-requisitos

- Node.js 18+
- PostgreSQL (banco `CVJPAG` já criado)

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Verificar configurações (edite se necessário)
# Arquivo: config.env
#   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, GROUP_NAME

# 3. Criar tabelas no banco
npm run migrate

# 4. Inserir membros iniciais
npm run seed

# 5. Iniciar o sistema
npm start
```

Na primeira execução, um **QR Code** aparecerá no terminal.  
Abra o WhatsApp no celular → **Dispositivos conectados** → **Conectar dispositivo** → escaneie.

## Dashboard Web

Acesse `http://localhost:3000` para visualizar:

- 💰 **Contribuição Mensal** — lista quem pagou e quem está pendente
- 🛒 **Rateios/Compras** — acompanha participantes e pagamentos (PG)
- 👥 **Membros** — gerencia o cadastro de membros

## Como funciona

### Tipo 1 — Contribuição Mensal
- O bot detecta mensagens com o padrão `CONTRIBUIÇÃO MENSAL - Mês/Ano`
- Salva a lista no banco e compara com os membros cadastrados
- Quando alguém **edita** a mensagem adicionando o nome → marcado como pago

### Tipo 2 — Rateio / Compras
- O bot detecta mensagens com título + lista numerada
- Monitora edições: quando alguém adiciona o nome → registra participação
- Quando alguém coloca `PG` na frente do nome → marca como pago
- Dashboard mostra barra de progresso e totalizador de pendentes

## Estrutura

```
src/
  index.js          — ponto de entrada (bot + servidor)
  bot/
    whatsapp.js     — conexão com WhatsApp via Baileys
    messageHandler.js — processa e persiste mensagens
  parsers/
    messageParser.js  — detecção e parse das mensagens
  api/
    routes.js       — API REST
  db/
    knex.js         — conexão com PostgreSQL
    migrate.js      — criação das tabelas
    seed.js         — inserção dos membros iniciais
public/
  index.html        — dashboard web
  js/app.js         — lógica do frontend
config.env          — configurações (DB, grupo)
```
