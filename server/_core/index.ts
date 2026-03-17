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
import { handleCloudApiWebhookVerification, handleCloudApiWebhookMessage } from "../webhookCloudApi";
import { handleYCloudWebhookMessage, isYCloudPayload } from "../webhookYCloud";
import { startKeepAlive } from "../keepAlive";
import { sendReservationReminders } from "../reservationReminder";
import { runMaintenance, monitorWhatsAppInstance, retryFailedMessages, expireHumanModes } from "../maintenance";
import { cleanupRateLimits } from "../chatbotRateLimit";
import { startMessagePolling, getPollingStats } from "../messagePolling";
import { cleanupProcessedMessages } from "../db";
import { startTokenRefreshScheduler } from "../tokenRefresh";

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
  
  // WhatsApp Webhook (Meta Cloud API - legacy via DB settings)
  app.get("/api/webhook/whatsapp", handleWebhookVerification);
  app.post("/api/webhook/whatsapp", handleWebhookMessage);
  
  // WhatsApp Cloud API Webhook (via env vars - suporta Meta Cloud API e YCloud)
  app.get("/api/webhook/cloud", handleCloudApiWebhookVerification);
  app.post("/api/webhook/cloud", (req, res) => {
    // Detectar automaticamente se o payload é do YCloud ou da Meta Cloud API
    if (isYCloudPayload(req.body)) {
      return handleYCloudWebhookMessage(req, res);
    }
    return handleCloudApiWebhookMessage(req, res);
  });
  
  // Evolution API Webhook
  app.post("/api/webhook/evolution", handleEvolutionWebhook);
  
  // Endpoints de diagnóstico — protegidos por DIAG_SECRET (ou JWT_SECRET como fallback)
  app.get("/api/diag", requireDiagAuth, async (_req, res) => {
    const { getSiteUrl } = await import("../keepAlive").then(() => import("../_core/siteUrl"));
    res.json({
      nodeEnv: process.env.NODE_ENV,
      whatsappProvider: process.env.WHATSAPP_PROVIDER || 'evolution',
      cloudApiToken: process.env.META_CLOUD_API_TOKEN ? 'SET (' + process.env.META_CLOUD_API_TOKEN.length + ' chars)' : 'NOT_SET',
      cloudApiPhoneNumberId: process.env.META_PHONE_NUMBER_ID || 'NOT_SET',
      cloudApiWabaId: process.env.META_WABA_ID || 'NOT_SET',
      evolutionUrl: process.env.EVOLUTION_API_URL ? process.env.EVOLUTION_API_URL.substring(0, 30) + '...' : 'NOT_SET',
      evolutionKey: process.env.EVOLUTION_API_KEY ? 'SET (' + process.env.EVOLUTION_API_KEY.length + ' chars)' : 'NOT_SET',
      evolutionInstance: process.env.EVOLUTION_INSTANCE_NAME || 'NOT_SET',
      siteDevUrl: process.env.SITE_DEV_URL || 'NOT_SET',
      viteSiteUrl: process.env.VITE_SITE_URL || 'NOT_SET',
      getSiteUrlResult: getSiteUrl(),
      timestamp: new Date().toISOString(),
    });
  });

  // Endpoint de teste de envio direto via provider ativo (apenas em desenvolvimento)
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/diag/send-test", requireDiagAuth, async (_req, res) => {
      try {
        const { whatsappService } = await import("../services/whatsappService");
        const provider = whatsappService.getActiveProvider();
        const result = await whatsappService.sendText("5517992253886", `[TESTE DIAG] Bot funcionando via ${provider}! ` + new Date().toLocaleString('pt-BR'));
        res.json({ success: result, provider, timestamp: new Date().toISOString() });
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
  // Em produção, usar a porta exata (o proxy reverso espera exatamente essa porta)
  // Em desenvolvimento, procurar porta alternativa se a preferida estiver ocupada
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV}, PORT env=${process.env.PORT}, binding to port=${port}`);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Verificar provider ativo
    const whatsappProvider = (process.env.WHATSAPP_PROVIDER || 'evolution').toLowerCase();
    
    if (whatsappProvider === 'ycloud') {
      console.log('[YCloud] Provider: YCloud BSP (coexistência App Business + API)');
      console.log('[YCloud] Webhook endpoint: /api/webhook/cloud (detecção automática)');
      console.log('[YCloud] API Key:', process.env.YCLOUD_API_KEY ? 'SET' : 'NOT_SET');
      console.log('[YCloud] Webhook Secret:', process.env.YCLOUD_WEBHOOK_SECRET ? 'SET' : 'NOT_SET');
      console.log('[YCloud] Polling e KeepAlive desativados (desnecessários com YCloud)');
    } else if (whatsappProvider === 'cloud_api') {
      console.log('[CloudAPI] Provider: Meta Cloud API oficial');
      console.log('[CloudAPI] Webhook endpoint: /api/webhook/cloud');
      console.log('[CloudAPI] Polling e KeepAlive desativados (desnecessários com Cloud API)');
      // Iniciar renovação automática do token de longa duração
      startTokenRefreshScheduler();
    } else {
      // Iniciar keep-alive para manter Evolution API acordada (Render.com free tier)
      startKeepAlive();
      // Polling de mensagens: ATIVO como sistema principal
      startMessagePolling();
      console.log('[Polling] Serviço de polling de mensagens ATIVO (sistema principal)');
    }

    // Executar tarefas de inicialização imediata
    sendReservationReminders().catch(() => {});
    monitorWhatsAppInstance().catch(() => {});
    runMaintenance().catch(() => {});

    // Scheduler centralizado: um único setInterval de 5s que verifica quais tarefas precisam rodar
    interface ScheduledTask {
      name: string;
      fn: () => Promise<void>;
      intervalMs: number;
      lastRun: number;
    }

    const scheduledTasks: ScheduledTask[] = [
      { name: "Lembrete de reservas",        fn: () => sendReservationReminders(),  intervalMs: 15 * 60 * 1000, lastRun: Date.now() },
      { name: "Monitoramento WhatsApp",       fn: () => monitorWhatsAppInstance(),   intervalMs:  5 * 60 * 1000, lastRun: Date.now() },
      { name: "Manutenção automática",        fn: () => runMaintenance(),            intervalMs: 60 * 60 * 1000, lastRun: Date.now() },
      { name: "Worker de retry",              fn: () => retryFailedMessages(),       intervalMs:  5 * 60 * 1000, lastRun: Date.now() },
      { name: "Expiração de modo humano",     fn: () => expireHumanModes(),          intervalMs:  5 * 60 * 1000, lastRun: Date.now() },
      { name: "Limpeza de rate limits",       fn: async () => cleanupRateLimits(),   intervalMs: 30 * 60 * 1000, lastRun: Date.now() },
      { name: "Limpeza de dedup distribuída", fn: () => cleanupProcessedMessages(),  intervalMs: 30 * 60 * 1000, lastRun: Date.now() },
    ];

    console.log(`[Cron] ${scheduledTasks.length} tarefas agendadas via scheduler centralizado`);

    setInterval(() => {
      const now = Date.now();
      for (const task of scheduledTasks) {
        if (now - task.lastRun >= task.intervalMs) {
          task.lastRun = now;
          task.fn().catch(err => console.error(`[Cron] Erro em "${task.name}":`, err));
        }
      }
    }, 5_000);
  });
}

startServer().catch(console.error);
