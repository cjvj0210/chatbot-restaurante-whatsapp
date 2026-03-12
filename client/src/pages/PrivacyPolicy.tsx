import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Cabeçalho */}
        <div className="mb-8">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Política de Privacidade</h1>
          <p className="text-sm text-gray-500">Churrascaria Estrela do Sul — Última atualização: março de 2026</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-gray-900 mb-2">1. Quem somos</h2>
            <p>
              A <strong>Churrascaria Estrela do Sul</strong>, localizada em Catanduva/SP, é responsável pelo tratamento
              dos seus dados pessoais coletados por meio de nosso cardápio digital, chatbot WhatsApp e sistema de reservas.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">2. Dados coletados</h2>
            <p>Coletamos apenas os dados necessários para a prestação do serviço:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Nome completo</li>
              <li>Número de WhatsApp / telefone</li>
              <li>Endereço de entrega (apenas para pedidos delivery)</li>
              <li>Data de nascimento (opcional — para promoções de aniversário)</li>
              <li>Histórico de pedidos e reservas</li>
              <li>Mensagens trocadas com o chatbot</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">3. Finalidade do tratamento</h2>
            <p>Seus dados são utilizados exclusivamente para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Processar e confirmar pedidos de delivery e retirada</li>
              <li>Gerenciar reservas de mesa</li>
              <li>Enviar notificações sobre o status do seu pedido via WhatsApp</li>
              <li>Enviar lembretes de reserva</li>
              <li>Enviar promoções de aniversário (apenas se você forneceu a data)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">4. Base legal (LGPD — Lei nº 13.709/2018)</h2>
            <p>
              O tratamento dos seus dados é fundamentado no <strong>art. 7º, V</strong> da LGPD (execução de contrato),
              e no <strong>art. 7º, IX</strong> (legítimo interesse) para comunicações operacionais relacionadas ao seu pedido.
              Para promoções de aniversário, a base legal é o <strong>consentimento (art. 7º, I)</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">5. Compartilhamento de dados</h2>
            <p>
              Seus dados <strong>não são vendidos ou compartilhados</strong> com terceiros para fins comerciais.
              Utilizamos serviços de infraestrutura (hospedagem em nuvem e API do WhatsApp) que processam dados
              sob contratos de confidencialidade.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">6. Retenção de dados</h2>
            <p>
              Mantemos seus dados pelo período necessário à prestação do serviço e cumprimento de obrigações legais
              (prazo mínimo de 5 anos para registros fiscais). Dados de conversas do chatbot são retidos por
              até 12 meses após a última interação.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">7. Seus direitos</h2>
            <p>Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
              <li>Confirmar a existência de tratamento dos seus dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão dos seus dados (quando não houver obrigação legal de retenção)</li>
              <li>Revogar consentimento a qualquer momento</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato: <strong>(17) 3325-8628</strong> ou via WhatsApp <strong>(17) 9 8212-3269</strong>.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">8. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado,
              incluindo criptografia em trânsito (HTTPS), controle de acesso e monitoramento de acessos.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-2">9. Contato</h2>
            <p>
              Dúvidas sobre esta política? Fale conosco:<br />
              <strong>Churrascaria Estrela do Sul</strong><br />
              Catanduva/SP<br />
              Tel: (17) 3325-8628<br />
              WhatsApp: (17) 9 8212-3269
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
