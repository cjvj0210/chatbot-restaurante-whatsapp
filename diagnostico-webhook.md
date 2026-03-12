# Diagnóstico: Webhook Evolution API não entrega mensagens

## Problema
As mensagens reais enviadas pelo WhatsApp (19:33-19:37) não chegam ao nosso servidor.
Testes simulados (curl direto ao webhook) funcionam perfeitamente.

## Evidências
- Instância: "open" (conectada)
- Webhook: configurado e enabled
- Teste externo via curl: funciona (200 OK, bot responde em 2s)
- Mensagens reais do WhatsApp: NÃO chegam ao banco

## Causa provável
A Evolution API v2.3.7 no Render (plano gratuito) hiberna após inatividade.
Quando hiberna, perde a conexão de webhook e não reenvia mensagens perdidas.
O keep-alive de 5 min pode não ser suficiente para manter o Render acordado.

## Soluções implementadas
1. Keep-alive reduzido de 10 para 5 min com ping duplo
2. Webhook reconfigurado via API
3. Instância reiniciada

## Solução adicional necessária
- Adicionar health-check que verifica se o webhook está realmente entregando mensagens
- Se detectar gap > 10 min sem mensagens em horário comercial, reconfigurar webhook automaticamente
