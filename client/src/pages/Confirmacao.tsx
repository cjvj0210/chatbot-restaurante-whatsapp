import { useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, MessageCircle, Clock } from "lucide-react";

export default function Confirmacao() {
  const { sessionId } = useParams<{ sessionId: string }>();

  useEffect(() => {
    // Limpar carrinho do localStorage
    if (sessionId) {
      localStorage.removeItem(`cart_${sessionId}`);
    }
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">Pedido Confirmado!</CardTitle>
          <CardDescription className="text-base">
            Seu pedido foi recebido com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <MessageCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-blue-900">Acompanhe pelo WhatsApp</p>
              <p className="text-sm text-blue-700 mt-1">
                Você receberá uma mensagem no WhatsApp com todos os detalhes do seu pedido e atualizações sobre o status.
              </p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
            <Clock className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-orange-900">Tempo estimado</p>
              <p className="text-sm text-orange-700 mt-1">
                Seu pedido ficará pronto em aproximadamente 30-45 minutos. Você será notificado quando estiver a caminho ou pronto para retirada.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Obrigado por escolher a <span className="font-semibold">Churrascaria Estrela do Sul</span>! 🤠
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
