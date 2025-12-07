import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Activity } from "lucide-react";

export default function Debug() {
  const { data: logs, refetch, isLoading } = trpc.debug.getWebhookLogs.useQuery(undefined, {
    refetchInterval: 3000, // Atualizar a cada 3 segundos
  });

  const clearLogs = trpc.debug.clearWebhookLogs.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-500';
      case 'POST':
        return 'bg-green-500';
      case 'PUT':
        return 'bg-yellow-500';
      case 'DELETE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Monitor de Webhooks
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitore em tempo real as requisições recebidas pelo webhook do WhatsApp
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button 
            onClick={() => clearLogs.mutate()} 
            variant="destructive" 
            size="sm"
            disabled={!logs || logs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Logs
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm">Monitorando</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Total de requisições: <strong>{logs?.length || 0}</strong>
              </div>
              <div className="text-sm text-muted-foreground">
                Atualização automática a cada 3 segundos
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando logs...</p>
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma requisição recebida</h3>
            <p className="text-muted-foreground">
              Envie uma mensagem do WhatsApp para o número de teste para ver os logs aparecerem aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getMethodColor(log.method)}>
                      {log.method}
                    </Badge>
                    <code className="text-sm">{log.url}</code>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {log.query && Object.keys(log.query).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Query Parameters:</h4>
                      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(log.query, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {log.body && Object.keys(log.body).length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Body:</h4>
                      <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                        {JSON.stringify(log.body, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Headers:</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(log.headers, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
