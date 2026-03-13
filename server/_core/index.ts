import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleWebhookVerification, handleWebhookMessage } from "../webhook";
import { handleEvolutionWebhook } from "../webhookEvolution";
import { startKeepAlive } from "../keepAlive";
import { sendReservationReminders } from "../reservationReminder";
import { runMaintenance, monitorWhatsAppInstance, retryFailedMessages, expireHumanModes } from "../maintenance";
import { cleanupRateLimits } from "../chatbotRateLimit";
import { startMessagePolling, getPollingStats } from "../messagePolling";
import { cleanupProcessedMessages } from "../db";

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

// Middleware para verificar se a requisição vem de um admin (apenas via header, nunca query string)
// SEGURANÇA: DIAG_SECRET dedicado — NÃO usar JWT_SECRET como fallback
function requireDiagAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const diagSecret = process.env.DIAG_SECRET || "";
  if (!diagSecret) {
    // DIAG_SECRET não configurado — bloquear acesso por segurança
    res.status(503).json({ error: "Diagnóstico não disponível" });
    return;
  }
  // Aceitar segredo APENAS via header X-Diag-Secret (nunca via query string — evita logs)
  const provided = req.headers["x-diag-secret"] as string;
  if (!provided || provided !== diagSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Confiar no proxy reverso (Manus/Nginx) para X-Forwarded-For correto
  app.set("trust proxy", 1);

  // ── Segurança: Helmet (headers HTTP defensivos) ──
  app.use(helmet({
    // CSP: proteção contra XSS — React em produção não precisa desativar CSP
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-inline/eval necessário para Vite dev + React
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://d2xsxph8kpxj0f.cloudfront.net", "https://*.cloudfront.net"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Necessário para iframes externos
  }));

  // ── Segurança: CORS — aceitar apenas origens conhecidas ──
  const allowedOrigins = [
    process.env.VITE_SITE_URL,
    process.env.SITE_DEV_URL,
    "https://chatbotwa-hesngyeo.manus.space",
  ].filter(Boolean) as string[];
  app.use((_req, res, next) => {
    const origin = _req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Diag-Secret");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // ── Segurança: Permissions-Policy ──
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // ── Compressão gzip para respostas HTTP ──
  app.use(compression());

  // ── Rate limiting global: 300 req/min por IP ──
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas requisições. Tente novamente em breve." },
    skip: (req) => req.path.startsWith("/api/oauth"), // não limitar OAuth
  });
  app.use(globalLimiter);

  // ── Rate limiting agressivo para o webhook do chatbot: 60 req/min ──
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit do webhook atingido." },
  });
  app.use("/api/webhook", webhookLimiter);

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
  
  // Endpoints de diagnóstico — protegidos por DIAG_SECRET (ou JWT_SECRET como fallback)
  app.get("/api/diag", requireDiagAuth, async (_req, res) => {
    const { getSiteUrl } = await import("../keepAlive").then(() => import("../_core/siteUrl"));
    res.json({
      nodeEnv: process.env.NODE_ENV,
      evolutionUrl: process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.substring(0, 30) + '...' : 'NOT_SET',
      evolutionKey: process.env.EVOLUTION_API_KEY ? 'SET (' + process.env.EVOLUTION_API_KEY.length + ' chars)' : 'NOT_SET',
      evolutionInstance: process.env.EVOLUTION_INSTANCE_NAME || 'NOT_SET',
      siteDevUrl: process.env.SITE_DEV_URL || 'NOT_SET',
      viteSiteUrl: process.env.VITE_SITE_URL || 'NOT_SET',
      getSiteUrlResult: getSiteUrl(),
      timestamp: new Date().toISOString(),
    });
  });

  // Endpoint de teste de envio direto via Evolution API (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/diag/send-test", requireDiagAuth, async (_req, res) => {
      try {
        const { sendTextMessageEvolution } = await import("../evolutionApi");
        const result = await sendTextMessageEvolution("5517992253886", "[TESTE DIAG] Bot funcionando! " + new Date().toLocaleString('pt-BR'));
        res.json({ success: result, timestamp: new Date().toISOString() });
      } catch (e: any) {
        res.json({ success: false, error: e.message, timestamp: new Date().toISOString() });
      }
    });
  }

  // Endpoint para capturar payload real da Evolution API
  // SEGURANÇA: sanitizar campos sensíveis antes de armazenar
  const lastPayloads: Array<{ ts: string; instance?: string; event?: string }> = [];
  app.post("/api/diag/capture", requireDiagAuth, (req, res) => {
    // Armazenar apenas metadados, não o payload completo (evitar exposição de PII)
    const sanitized = {
      ts: new Date().toISOString(),
      instance: req.body?.instance,
      event: req.body?.event,
    };
    lastPayloads.unshift(sanitized);
    if (lastPayloads.length > 5) lastPayloads.pop();
    res.json({ ok: true });
  });
  app.get("/api/diag/payloads", requireDiagAuth, (_req, res) => {
    res.json(lastPayloads);
  });

  // Endpoint de diagnóstico do polling
  app.get("/api/diag/polling", requireDiagAuth, (_req, res) => {
    res.json(getPollingStats());
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Handler global de erros Express (deve vir após todas as rotas)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Express] Erro não capturado:", err.message, err.stack);
    res.status(500).json({ error: "Erro interno do servidor" });
  });
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
    // Iniciar keep-alive para manter Evolution API acordada (Render.com free tier)
    startKeepAlive();
    // Iniciar cron job de lembretes de reserva (a cada 15 minutos)
    setInterval(() => {
      sendReservationReminders().catch(err =>
        console.error('[Cron] Erro no lembrete de reserva:', err)
      );
    }, 15 * 60 * 1000);
    // Executar imediatamente na inicialização também
    sendReservationReminders().catch(() => {});
    console.log('[Cron] Lembrete de reservas iniciado (a cada 15 min)');

    // Monitoramento da instância WhatsApp (a cada 5 minutos)
    setInterval(() => {
      monitorWhatsAppInstance().catch(err =>
        console.error('[Cron] Erro no monitoramento WhatsApp:', err)
      );
    }, 5 * 60 * 1000);
    monitorWhatsAppInstance().catch(() => {});
    console.log('[Cron] Monitoramento WhatsApp iniciado (a cada 5 min)');

    // Manutenção: limpeza de sessões expiradas (a cada 1 hora)
    setInterval(() => {
      runMaintenance().catch(err =>
        console.error('[Cron] Erro na manutenção:', err)
      );
    }, 60 * 60 * 1000);
    runMaintenance().catch(() => {});
    console.log('[Cron] Manutenção automática iniciada (a cada 1 hora)');

    // Worker de retry: reenviar mensagens com falha (a cada 5 minutos)
    setInterval(() => {
      retryFailedMessages().catch(err =>
        console.error('[Cron] Erro no worker de retry:', err)
      );
    }, 5 * 60 * 1000);
    console.log('[Cron] Worker de retry de mensagens iniciado (a cada 5 min)');

    // Expirar modo humano proativamente a cada 5 minutos
    setInterval(() => {
      expireHumanModes().catch(() => {});
    }, 5 * 60 * 1000);
    console.log('[Cron] Expiração proativa de modo humano iniciada (a cada 5 min)');

    // Limpeza de rate limits do chatbot (a cada 30 minutos)
    setInterval(() => {
      cleanupRateLimits();
    }, 30 * 60 * 1000);
    console.log('[Cron] Limpeza de rate limits iniciada (a cada 30 min)');

    // Polling de mensagens: ATIVO como sistema principal
    // O webhook da Evolution API no Render não dispara de forma confiável.
    // O polling busca mensagens a cada 3s. Webhook continua ativo como complemento.
    // Deduplicação por messageId via BANCO DE DADOS garante que não há respostas duplicadas
    // mesmo com múltiplas instâncias do servidor (dev + produção).
    startMessagePolling();
    console.log('[Polling] Serviço de polling de mensagens ATIVO (sistema principal)');

    // Limpeza de mensagens processadas no banco (a cada 30 minutos)
    setInterval(() => {
      cleanupProcessedMessages().catch(err =>
        console.error('[Cron] Erro na limpeza de dedup:', err)
      );
    }, 30 * 60 * 1000);
    console.log('[Cron] Limpeza de dedup distribuída iniciada (a cada 30 min)');
  });
}

startServer().catch(console.error);
