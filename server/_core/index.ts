import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleWebhookVerification, handleWebhookMessage } from "../webhook";
import { handleEvolutionWebhook } from "../webhookEvolution";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // WhatsApp Webhook (Meta Cloud API)
  app.get("/api/webhook/whatsapp", handleWebhookVerification);
  app.post("/api/webhook/whatsapp", handleWebhookMessage);
  
  // Evolution API Webhook
  app.post("/api/webhook/evolution", handleEvolutionWebhook);
  
  // Endpoint de diagnóstico temporário
  app.get("/api/diag", (_req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      evolutionUrl: process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.substring(0, 30) + '...' : 'NOT_SET',
      evolutionKey: process.env.EVOLUTION_API_KEY ? 'SET (' + process.env.EVOLUTION_API_KEY.length + ' chars)' : 'NOT_SET',
      evolutionInstance: process.env.EVOLUTION_INSTANCE_NAME || 'NOT_SET',
      siteDevUrl: process.env.SITE_DEV_URL || 'NOT_SET',
      viteSiteUrl: process.env.VITE_SITE_URL || 'NOT_SET',
      timestamp: new Date().toISOString(),
    });
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
