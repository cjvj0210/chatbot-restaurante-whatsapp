#!/bin/bash

echo "🔍 Monitorando logs do webhook do WhatsApp..."
echo "Aguardando mensagens..."
echo ""
echo "Envie uma mensagem do WhatsApp para o número de teste!"
echo ""

# Encontrar PID do processo Node.js
PID=$(pgrep -f "tsx watch server/_core/index.ts" | head -1)

if [ -z "$PID" ]; then
  echo "❌ Processo do servidor não encontrado!"
  exit 1
fi

echo "✅ Servidor encontrado (PID: $PID)"
echo "📡 Monitorando logs..."
echo ""

# Monitorar stdout/stderr do processo
tail -f /proc/$PID/fd/1 /proc/$PID/fd/2 2>/dev/null | grep --line-buffered -i "webhook\|whatsapp\|message\|error"
