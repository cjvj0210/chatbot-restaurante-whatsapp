const axios = require("axios");
require("dotenv").config();

const baseUrl = process.env.EVOLUTION_API_URL || "";
const apiKey = process.env.EVOLUTION_API_KEY || "";
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "teste";

console.log("Base URL:", baseUrl);
console.log("Instance:", instanceName);

async function test() {
  // Testar DELETE
  try {
    const res = await axios.delete(
      `${baseUrl}/chat/deleteMessageForEveryone/${instanceName}`,
      {
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        data: {
          id: "test-fake-id",
          fromMe: true,
          remoteJid: "5500000000000@s.whatsapp.net"
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    console.log("DELETE Status:", res.status);
    console.log("DELETE Response:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error("DELETE Error:", e.message);
  }

  // Testar POST
  try {
    const res2 = await axios.post(
      `${baseUrl}/chat/deleteMessageForEveryone/${instanceName}`,
      {
        id: "test-fake-id",
        fromMe: true,
        remoteJid: "5500000000000@s.whatsapp.net"
      },
      {
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        timeout: 10000,
        validateStatus: () => true
      }
    );
    console.log("POST Status:", res2.status);
    console.log("POST Response:", JSON.stringify(res2.data, null, 2));
  } catch (e) {
    console.error("POST Error:", e.message);
  }
}

test();
