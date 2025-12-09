import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Calendar, User, Mic, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TestConversations() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessions, isLoading } = trpc.testConversations.getSessions.useQuery();
  const { data: messages } = trpc.testConversations.getMessages.useQuery(
    { sessionId: selectedSessionId! },
    { enabled: !!selectedSessionId }
  );

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Conversas de Teste</h1>
        <p className="text-muted-foreground">
          Visualize todas as conversas realizadas na página pública de teste para analisar e melhorar o chatbot.
        </p>
      </div>

      {!sessions || sessions.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma conversa de teste ainda</h3>
          <p className="text-muted-foreground mb-4">
            Compartilhe a URL <code className="bg-muted px-2 py-1 rounded">/teste</code> para que pessoas testem o chatbot.
          </p>
          <Button onClick={() => {
            navigator.clipboard.writeText(window.location.origin + '/teste');
          }}>
            Copiar URL de Teste
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session: any) => (
            <Card key={session.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="font-mono text-sm text-muted-foreground">
                      {session.sessionId}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(session.startedAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{session.messageCount} mensagens</span>
                    </div>
                    {session.hasAudio && (
                      <div className="flex items-center gap-1">
                        <Mic className="w-4 h-4" />
                        <span>Contém áudio</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSessionId(session.sessionId)}
                >
                  Ver Conversa
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para visualizar mensagens */}
      <Dialog open={!!selectedSessionId} onOpenChange={(open) => !open && setSelectedSessionId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversa de Teste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {messages?.map((message: any) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-[#d9fdd3] dark:bg-[#005c4b]"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {message.role === "user" ? "Usuário" : "Gaúchinho 🤠"}
                    </span>
                    {message.messageType === "audio" && (
                      <Mic className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  {message.messageType === "audio" && message.transcription && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Transcrição: {message.transcription}
                    </p>
                  )}
                  {message.audioUrl && (
                    <audio controls className="mt-2 w-full max-w-xs">
                      <source src={message.audioUrl} type="audio/webm" />
                    </audio>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
