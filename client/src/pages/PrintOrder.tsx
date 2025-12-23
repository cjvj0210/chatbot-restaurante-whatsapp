import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Página de impressão de comanda
 * Otimizada para impressoras térmicas 80mm
 */
export default function PrintOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = trpc.order.getById.useQuery(
    { id: parseInt(orderId!) },
    { enabled: !!orderId }
  );

  // Imprimir automaticamente quando carregar
  useEffect(() => {
    if (order && !isLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [order, isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Pedido não encontrado</p>
      </div>
    );
  }

  return (
    <div className="print-comanda">
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print-comanda {
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          .no-print {
            display: none !important;
          }
        }
        
        .print-comanda {
          max-width: 80mm;
          margin: 0 auto;
          padding: 10mm;
          font-family: 'Courier New', monospace;
        }
        
        .comanda-header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        
        .comanda-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .comanda-section {
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #ccc;
        }
        
        .comanda-label {
          font-weight: bold;
          display: inline-block;
          width: 120px;
        }
        
        .comanda-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        
        .comanda-item-name {
          flex: 1;
        }
        
        .comanda-item-qty {
          width: 40px;
          text-align: center;
        }
        
        .comanda-item-price {
          width: 80px;
          text-align: right;
        }
        
        .comanda-obs {
          font-style: italic;
          color: #666;
          margin-left: 20px;
          font-size: 11px;
        }
        
        .comanda-total {
          font-size: 16px;
          font-weight: bold;
          text-align: right;
          margin-top: 10px;
        }
        
        .comanda-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
        }
      `}</style>

      {/* Header */}
      <div className="comanda-header">
        <div className="comanda-title">CHURRASCARIA ESTRELA DO SUL</div>
        <div>Pedido #{order.orderNumber}</div>
        <div>{format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
      </div>

      {/* Dados do Cliente */}
      <div className="comanda-section">
        <div>
          <span className="comanda-label">Cliente:</span>
          {order.customerName}
        </div>
        <div>
          <span className="comanda-label">Telefone:</span>
          {order.customerPhone}
        </div>
        <div>
          <span className="comanda-label">Tipo:</span>
          {order.deliveryType === "delivery" ? "DELIVERY" : "RETIRADA"}
        </div>
        {order.deliveryType === "delivery" && order.address && (
          <div>
            <span className="comanda-label">Endereço:</span>
            <div style={{ marginLeft: "120px", marginTop: "5px" }}>
              {order.address}
            </div>
          </div>
        )}
      </div>

      {/* Itens do Pedido */}
      <div className="comanda-section">
        <div style={{ fontWeight: "bold", marginBottom: "10px" }}>ITENS DO PEDIDO:</div>
        {order.items?.map((item: any) => (
          <div key={item.id} style={{ marginBottom: "10px" }}>
            <div className="comanda-item">
              <span className="comanda-item-qty">{item.quantity}x</span>
              <span className="comanda-item-name">{item.menuItemName}</span>
              <span className="comanda-item-price">
                R$ {((item.unitPrice * item.quantity) / 100).toFixed(2)}
              </span>
            </div>
            {item.observations && (
              <div className="comanda-obs">Obs: {item.observations}</div>
            )}
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="comanda-section">
        <div className="comanda-item">
          <span>Subtotal:</span>
          <span>R$ {((order.totalAmount - (order.deliveryFee || 0)) / 100).toFixed(2)}</span>
        </div>
        {order.deliveryType === "delivery" && (
          <div className="comanda-item">
            <span>Taxa de Entrega:</span>
            <span>R$ {((order.deliveryFee || 0) / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="comanda-total">
          TOTAL: R$ {(order.totalAmount / 100).toFixed(2)}
        </div>
      </div>

      {/* Pagamento */}
      <div className="comanda-section">
        <div>
          <span className="comanda-label">Pagamento:</span>
          {order.paymentMethod === "dinheiro" && "DINHEIRO"}
          {order.paymentMethod === "cartao" && "CARTÃO"}
          {order.paymentMethod === "pix" && "PIX"}
        </div>
        {order.paymentMethod === "dinheiro" && order.changeFor && (
          <div>
            <span className="comanda-label">Troco para:</span>
            R$ {(order.changeFor / 100).toFixed(2)}
          </div>
        )}
      </div>

      {/* Observações Adicionais */}
      {order.additionalNotes && (
        <div className="comanda-section">
          <div style={{ fontWeight: "bold" }}>OBSERVAÇÕES:</div>
          <div style={{ marginTop: "5px" }}>{order.additionalNotes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="comanda-footer">
        <div>Tempo estimado: {order.estimatedTime || 30} minutos</div>
        <div style={{ marginTop: "10px" }}>Obrigado pela preferência!</div>
      </div>

      {/* Botão para fechar (não imprime) */}
      <div className="no-print" style={{ textAlign: "center", marginTop: "20px" }}>
        <button 
          onClick={() => window.close()}
          style={{
            padding: "10px 20px",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
