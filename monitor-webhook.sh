#!/bin/bash
# Script para monitorar logs do webhook em tempo real

echo "🔍 Monitorando webhook do WhatsApp..."
echo "Aguardando mensagens..."
echo ""

# Adicionar timestamp ao console.log do Node.js
export FORCE_COLOR=1

# Monitorar stdout do processo
tail -f /proc/$(pgrep -f "node.*server/_core/index.ts" | head -1)/fd/1 2>/dev/null || \
tail -f /proc/$(pgrep -f "tsx.*server/_core/index.ts" | head -1)/fd/1 2>/dev/null || \
echo "❌ Processo do servidor não encontrado"
