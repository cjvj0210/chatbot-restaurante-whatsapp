import axios from 'axios';

const baseUrl = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

const resp = await axios.post(`${baseUrl}/chat/findMessages/${instanceName}`, {
  where: {
    key: { remoteJid: '212454869074102@lid' }
  },
  limit: 10
}, {
  headers: { apikey: apiKey, 'Content-Type': 'application/json' },
  timeout: 15000
});

const data = resp.data?.messages?.records || resp.data || [];
const msgs = Array.isArray(data) ? data : [];
console.log('Total mensagens @lid:', msgs.length);
msgs.forEach(m => {
  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '[media]';
  const ts = m.messageTimestamp;
  const date = new Date(ts * 1000).toISOString();
  console.log(`fromMe: ${m.key?.fromMe} | ts: ${ts} | date: ${date} | text: ${text.substring(0, 50)}`);
});
