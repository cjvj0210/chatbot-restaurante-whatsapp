import http from "http";

const data = JSON.stringify({
  event: "MESSAGES_UPSERT",
  instance: "teste",
  data: {
    key: { remoteJid: "5517988112791@s.whatsapp.net", fromMe: false, id: "test-final-" + Date.now() },
    pushName: "Clovis",
    message: { conversation: "Boa noite, esta aberto?" },
    messageType: "conversation",
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
});

const req = http.request({
  hostname: "localhost",
  port: 3000,
  path: "/api/webhook/evolution",
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
}, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => console.log("Response:", res.statusCode, body));
});
req.write(data);
req.end();
