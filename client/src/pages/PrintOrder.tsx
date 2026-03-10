import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Página de impressão de comanda
 * Otimizada para impressoras térmicas 80mm
 * CSS sem imagens, sombras ou gradientes para evitar falhas de impressão
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
      setTimeout(() => window.print(), 600);
    }
  }, [order, isLoading]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "monospace" }}>Carregando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "monospace" }}>Pedido não encontrado</p>
      </div>
    );
  }

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  // Calcular troco: changeFor é o valor que o cliente vai pagar (ex: R$50)
  // troco = changeFor - total
  const changeFor = (order as any).changeFor as number | null | undefined;
  const trocoValor = changeFor && changeFor > order.total ? changeFor - order.total : null;

  return (
    <>
      <style>{`
        /* ============================================
           CSS TÉRMICO — SEM SOMBRAS, SEM IMAGENS,
           SEM GRADIENTES, SEM CORES DE FUNDO
           Compatível com impressoras ESC/POS 80mm
        ============================================ */

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background: #fff !important;
          color: #000 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .thermal-wrap {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4mm 2mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.5;
          color: #000;
          background: #fff;
        }

        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .large  { font-size: 14px; }
        .xlarge { font-size: 16px; }
        .small  { font-size: 10px; }

        .divider-solid {
          border: none;
          border-top: 1px solid #000;
          margin: 4px 0;
        }
        .divider-dashed {
          border: none;
          border-top: 1px dashed #000;
          margin: 4px 0;
        }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 2px 0;
        }
        .row-label { flex: 0 0 auto; font-weight: bold; margin-right: 4px; }
        .row-value { flex: 1; word-break: break-word; }
        .row-right { text-align: right; white-space: nowrap; }

        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
        }
        .item-qty  { flex: 0 0 28px; font-weight: bold; }
        .item-name { flex: 1; }
        .item-price { flex: 0 0 60px; text-align: right; }

        .obs-line {
          font-style: italic;
          font-size: 10px;
          padding-left: 28px;
          margin-bottom: 2px;
        }

        .total-block {
          margin: 4px 0;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .total-final {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid #000;
        }

        .troco-box {
          border: 1px solid #000;
          padding: 4px 6px;
          margin: 6px 0;
          font-weight: bold;
          font-size: 12px;
        }
        .troco-box .troco-title {
          font-size: 10px;
          font-weight: normal;
          margin-bottom: 2px;
        }

        /* Botão só aparece na tela, nunca imprime */
        .no-print { display: block; }

        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }

          html, body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Forçar preto puro — sem cinza, sem meio-tom */
          * {
            color: #000 !important;
            background: transparent !important;
            border-color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-filter: none !important;
            filter: none !important;
          }

          .thermal-wrap {
            width: 72mm !important;
            padding: 2mm !important;
          }

          .no-print { display: none !important; }
        }
      `}</style>

      <div className="thermal-wrap">

        {/* ===== CABEÇALHO ===== */}
        <div className="center bold large">CHURRASCARIA ESTRELA</div>
        <div className="center bold large">DO SUL</div>
        <div className="center small" style={{ marginTop: "2px" }}>
          Pedido #{order.orderNumber}
        </div>
        <div className="center small">
          {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </div>

        <hr className="divider-solid" style={{ margin: "6px 0" }} />

        {/* ===== CLIENTE ===== */}
        <div className="row">
          <span className="row-label">Cliente:</span>
          <span className="row-value">{order.customerName}</span>
        </div>
        <div className="row">
          <span className="row-label">Telefone:</span>
          <span className="row-value">{order.customerPhone}</span>
        </div>
        <div className="row">
          <span className="row-label">Tipo:</span>
          <span className="row-value bold">
            {order.orderType === "delivery" ? "DELIVERY" : "RETIRADA"}
          </span>
        </div>
        {order.orderType === "delivery" && order.deliveryAddress && (
          <div style={{ marginTop: "3px" }}>
            <span className="bold">Endereco:</span>
            <div style={{ paddingLeft: "4px", marginTop: "2px", wordBreak: "break-word" }}>
              {order.deliveryAddress}
            </div>
          </div>
        )}

        <hr className="divider-dashed" style={{ margin: "6px 0" }} />

        {/* ===== ITENS ===== */}
        <div className="bold" style={{ marginBottom: "4px" }}>ITENS DO PEDIDO:</div>
        {order.items?.map((item: any, idx: number) => (
          <div key={item.id ?? idx}>
            <div className="item-row">
              <span className="item-qty">{item.quantity}x</span>
              <span className="item-name">{item.menuItemName}</span>
              <span className="item-price">
                {fmt(item.unitPrice * item.quantity)}
              </span>
            </div>
            {item.observations && (
              <div className="obs-line">Obs: {item.observations}</div>
            )}
          </div>
        ))}

        <hr className="divider-dashed" style={{ margin: "6px 0" }} />

        {/* ===== TOTAIS ===== */}
        <div className="total-block">
          <div className="total-line">
            <span>Subtotal:</span>
            <span>{fmt(order.subtotal)}</span>
          </div>
          {order.orderType === "delivery" && (order.deliveryFee ?? 0) > 0 && (
            <div className="total-line">
              <span>Taxa de Entrega:</span>
              <span>{fmt(order.deliveryFee)}</span>
            </div>
          )}
          <div className="total-final">
            <span>TOTAL:</span>
            <span>{fmt(order.total)}</span>
          </div>
        </div>

        <hr className="divider-dashed" style={{ margin: "6px 0" }} />

        {/* ===== PAGAMENTO ===== */}
        <div className="row">
          <span className="row-label">Pagamento:</span>
          <span className="row-value bold">
            {order.paymentMethod === "dinheiro" && "DINHEIRO"}
            {order.paymentMethod === "cartao" && "CARTAO"}
            {order.paymentMethod === "pix" && "PIX"}
          </span>
        </div>

        {/* Troco — exibe somente quando pagamento em dinheiro */}
        {order.paymentMethod === "dinheiro" && changeFor && changeFor > 0 && (
          <div className="troco-box">
            <div className="troco-title">** TROCO NECESSARIO **</div>
            {trocoValor !== null ? (
              <>
                <div>Mandar: {fmt(trocoValor)}</div>
                <div className="small">(troco para {fmt(changeFor)})</div>
              </>
            ) : (
              <div>Pago exato — sem troco</div>
            )}
          </div>
        )}

        {/* ===== OBSERVAÇÕES ===== */}
        {order.customerNotes && (
          <>
            <hr className="divider-dashed" style={{ margin: "6px 0" }} />
            <div className="bold">OBSERVACOES:</div>
            <div style={{ marginTop: "3px", wordBreak: "break-word" }}>
              {order.customerNotes}
            </div>
          </>
        )}

        <hr className="divider-solid" style={{ margin: "8px 0" }} />

        {/* ===== RODAPÉ ===== */}
        <div className="center small">
          Tempo estimado: {order.estimatedTime || 40} minutos
        </div>
        <div className="center small" style={{ marginTop: "4px" }}>
          Obrigado pela preferencia!
        </div>

        {/* Espaço final para corte da bobina */}
        <div style={{ marginTop: "16px" }}>&nbsp;</div>
        <div style={{ marginTop: "4px" }}>&nbsp;</div>

      </div>

      {/* Botão fechar — só aparece na tela */}
      <div className="no-print" style={{ textAlign: "center", marginTop: "20px", marginBottom: "30px" }}>
        <button
          onClick={() => window.close()}
          style={{
            padding: "10px 24px",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: "13px",
          }}
        >
          Fechar
        </button>
      </div>
    </>
  );
}
