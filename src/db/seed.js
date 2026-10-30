const db = require('./knex');

// Lista completa de membros do grupo Casa da vovó Joaquina
const members = [
  'Suelen',
  'Alisson Costa',
  'J.Jorge',
  'Manoel',
  'Flavia',
  'Marcus Vinícius',
  'Tauame',
  'Roger',
  'Débora Franco',
  'Amaral',
  'Rodrigo Rincon',
  'Ana Brandão',
  'Carol Vada',
  'Fabio Vada',
  'Ester Kirchhof',
  'Fernanda',
  'Bruno',
  'José Antonio',
  'Carlos',
  'Wania',
  'Carol Pacheco',
  'Edna',
  'Valcenir',
  'Cris Timbó',
  'Carol Azeredo',
  'Luiza',
  'Adale',
  'Daniella',
  'Guilherme',
  'Paulo',
  'Rubenia',
  'Daniel',
  'Vanessa',
  'José Freitas',
  'Dandara',
  'Samyra',
  'Maria',
  'Micheline',
  'Dayanny',
  'Igor',
  'Amanda Lira',
];

function normalize(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function seed() {
  console.log('🌱 Inserindo membros...');

  for (const name of members) {
    await db('members')
      .insert({ name, normalized_name: normalize(name) })
      .onConflict('normalized_name')
      .ignore();
  }

  console.log(`✅ ${members.length} membros inseridos/verificados.`);
  await db.destroy();
}

seed().catch((err) => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
