import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Buscar mensagens 'Bom dia', 'Tudo bem?', 'Oi' em qualquer conversa
const [msgs] = await conn.execute(
  "SELECT m.id, m.conversationId, m.role, m.content, m.createdAt FROM messages m WHERE m.content IN ('Bom dia', 'Tudo bem?', 'Oi') AND m.createdAt > '2026-03-14T00:00:00' ORDER BY m.createdAt DESC"
);
console.log('=== Mensagens Bom dia/Tudo bem?/Oi hoje ===');
console.log('Encontradas:', msgs.length);
msgs.forEach(r => console.log(r.id, '| conv:', r.conversationId, '|', r.content, '|', r.createdAt));

// Verificar todas as mensagens entre 14:00 e 15:00 UTC
const [recent] = await conn.execute(
  "SELECT m.id, m.conversationId, m.role, m.content, m.createdAt FROM messages m WHERE m.createdAt BETWEEN '2026-03-14T14:00:00' AND '2026-03-14T15:00:00' ORDER BY m.createdAt DESC"
);
console.log('\n=== Mensagens entre 14:00-15:00 UTC (11:00-12:00 BRT) ===');
console.log('Encontradas:', recent.length);
recent.forEach(r => console.log(r.id, '| conv:', r.conversationId, '|', r.role, '|', r.content?.substring(0, 40), '|', r.createdAt));

// Verificar se o pollingStartTimestamp bloqueou as mensagens
// O servidor reiniciou por volta de 14:18 UTC
// pollingStartTimestamp = Math.floor(Date.now() / 1000) no momento do start
// As mensagens de 14:18-14:20 UTC deveriam ter timestamp >= pollingStartTimestamp

// Verificar se há mensagens processadas nesse período
const [pm] = await conn.execute(
  "SELECT * FROM processed_messages WHERE processedAt BETWEEN '2026-03-14T14:00:00' AND '2026-03-14T15:00:00'"
);
console.log('\n=== processed_messages entre 14:00-15:00 UTC ===');
console.log('Encontradas:', pm.length);
pm.forEach(r => console.log(r.messageId, '|', r.source, '|', r.processedAt));

await conn.end();
