import type { Request, Response } from "express";

interface WebhookLog {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, any>;
  query: Record<string, any>;
  body: any;
}

const webhookLogs: WebhookLog[] = [];
const MAX_LOGS = 50;

export function logWebhookRequest(req: Request): void {
  const log: WebhookLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body,
  };

  webhookLogs.unshift(log);
  
  // Manter apenas os últimos 50 logs
  if (webhookLogs.length > MAX_LOGS) {
    webhookLogs.pop();
  }

  console.log(`[Debug] ${req.method} ${req.url} - ${new Date().toLocaleString('pt-BR')}`);
}

export function getWebhookLogs(): WebhookLog[] {
  return webhookLogs;
}

export function clearWebhookLogs(): void {
  webhookLogs.length = 0;
}

export async function handleDebugLogs(req: Request, res: Response): Promise<void> {
  res.json({
    total: webhookLogs.length,
    logs: webhookLogs,
  });
}
