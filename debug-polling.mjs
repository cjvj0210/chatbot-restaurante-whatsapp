import axios from 'axios';

const baseUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

const now = Math.floor(Date.now() / 1000);
const since = now - 300;

const resp = await axios.post(`${baseUrl}/chat/findMessages/${instanceName}`, {
  where: { messageTimestamp: { gte: since } },
  limit: 50
}, {
  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
  timeout: 10000
});

const records = resp.data?.messages?.records || [];
const incoming = records.filter(m => {
  const fromMe = m.key?.fromMe;
  const jid = m.key?.remoteJid || '';
  return fromMe === false && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'));
});

console.log('Total mensagens:', records.length);
console.log('Incoming (não fromMe, individual):', incoming.length);

incoming.slice(0, 10).forEach(m => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '[sem texto]';
  console.log(`  ID: ${m.key?.id} | JID: ${m.key?.remoteJid} | ts: ${m.messageTimestamp} | text: ${text.substring(0, 40)}`);
});

// Verificar o pollingStartTimestamp - quando o servidor subiu
const serverStartTime = Math.floor(Date.now() / 1000) - 600; // ~10 min atrás
console.log('\n=== Diagnóstico ===');
console.log('Agora (unix):', now);
console.log('Desde (unix):', since);

// Verificar se as mensagens recentes estão ANTES do pollingStartTimestamp
const recentMsgs = incoming.filter(m => m.messageTimestamp >= since);
console.log('Mensagens recentes (últimos 5 min):', recentMsgs.length);
recentMsgs.forEach(m => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '[sem texto]';
  const age = now - m.messageTimestamp;
  console.log(`  ${text.substring(0, 40)} | ${age}s atrás`);
});
