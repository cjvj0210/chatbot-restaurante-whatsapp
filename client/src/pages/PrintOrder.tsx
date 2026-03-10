import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Página de impressão de comanda — DUAS VIAS DIFERENCIADAS
 * VIA 1 — COZINHA: itens + complementos/adicionais + observações
 * VIA 2 — CAIXA:   dados do cliente + endereço + totais + pagamento + troco
 *
 * Otimizada para impressoras térmicas 80mm
 * - Fonte mínima 13px, negrito em todo o texto
 */

interface SelectedAddon {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceExtra: number;
  quantity?: number;
}

export default function PrintOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading } = trpc.order.getById.useQuery(
    { id: parseInt(orderId!) },
    { enabled: !!orderId }
  );

  useEffect(() => {
    if (order && !isLoading) {
      setTimeout(() => window.print(), 600);
    }
  }, [order, isLoading]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "monospace", fontWeight: "bold" }}>Carregando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontFamily: "monospace", fontWeight: "bold" }}>Pedido nao encontrado</p>
      </div>
    );
  }

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const changeFor = (order as any).changeFor as number | null | undefined;
  const trocoValor = changeFor && changeFor > order.total ? changeFor - order.total : null;

  // Parse addons de cada item
  const parseAddons = (addonsStr: string | null | undefined): SelectedAddon[] => {
    if (!addonsStr) return [];
    try {
      return JSON.parse(addonsStr) as SelectedAddon[];
    } catch {
      return [];
    }
  };

  // ======================================================
  // VIA 1 — COZINHA
  // ======================================================
  const ViaCozinha = () => (
    <div className="via">
      <div className="via-label">*** VIA COZINHA ***</div>

      <div className="center title">CHURRASCARIA ESTRELA</div>
      <div className="center title">DO SUL</div>
      <div className="center sub" style={{ marginTop: "3px" }}>
        Pedido #{order.orderNumber}
      </div>
      <div className="center sub">
        {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </div>

      <div className="line-solid" />

      {/* Tipo de pedido */}
      <div className="row">
        <span className="lbl">Tipo:</span>
        <span className="val">
          {order.orderType === "delivery" ? "DELIVERY" : "RETIRADA NO BALCAO"}
        </span>
      </div>
      <div className="row">
        <span className="lbl">Cliente:</span>
        <span className="val">{order.customerName}</span>
      </div>

      <div className="line-dash" />

      {/* ITENS COM COMPLEMENTOS */}
      <div className="section-title">ITENS DO PEDIDO:</div>
      {order.items?.map((item: any, idx: number) => {
        const addons = parseAddons(item.addons);
        return (
          <div key={item.id ?? idx} style={{ marginBottom: "6px" }}>
            {/* Item principal */}
            <div className="item-row">
              <span className="item-qty">{item.quantity}x</span>
              <span className="item-name">{item.menuItemName}</span>
            </div>
            {/* Complementos/adicionais */}
            {addons.length > 0 && (
              <div style={{ paddingLeft: "26px" }}>
                {addons.map((a, ai) => (
                  <div key={ai} className="addon-line">
                    {a.quantity && a.quantity > 1 ? `${a.quantity}x ` : ""}
                    {a.groupName}: {a.optionName}
                    {a.priceExtra > 0 ? ` (+${fmt(a.priceExtra)})` : ""}
                  </div>
                ))}
              </div>
            )}
            {/* Observações do item */}
            {item.observations && (
              <div className="obs">Obs: {item.observations}</div>
            )}
          </div>
        );
      })}

      {/* Observações gerais */}
      {order.customerNotes && (
        <>
          <div className="line-dash" />
          <div className="section-title">OBS. GERAIS:</div>
          <div style={{ marginTop: "3px", wordBreak: "break-word" }}>
            {order.customerNotes}
          </div>
        </>
      )}

      <div className="line-solid" style={{ marginTop: "8px" }} />
      <div className="center sub">Tempo estimado: {order.estimatedTime || 40} min</div>
    </div>
  );

  // ======================================================
  // VIA 2 — CAIXA
  // ======================================================
  const ViaCaixa = () => (
    <div className="via">
      <div className="via-label">*** VIA CAIXA ***</div>

      <div className="center title">CHURRASCARIA ESTRELA</div>
      <div className="center title">DO SUL</div>
      <div className="center sub" style={{ marginTop: "3px" }}>
        Pedido #{order.orderNumber}
      </div>
      <div className="center sub">
        {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
      </div>

      <div className="line-solid" />

      {/* CLIENTE */}
      <div className="row">
        <span className="lbl">Cliente:</span>
        <span className="val">{order.customerName}</span>
      </div>
      <div className="row">
        <span className="lbl">Telefone:</span>
        <span className="val">{order.customerPhone}</span>
      </div>
      <div className="row">
        <span className="lbl">Tipo:</span>
        <span className="val">
          {order.orderType === "delivery" ? "DELIVERY" : "RETIRADA"}
        </span>
      </div>
      {order.orderType === "delivery" && order.deliveryAddress && (
        <div style={{ marginTop: "3px" }}>
          <span className="lbl">Endereco:</span>
          <div style={{ paddingLeft: "4px", marginTop: "2px", wordBreak: "break-word" }}>
            {order.deliveryAddress}
          </div>
        </div>
      )}

      <div className="line-dash" />

      {/* RESUMO DOS ITENS (sem detalhes) */}
      <div className="section-title">RESUMO:</div>
      {order.items?.map((item: any, idx: number) => (
        <div key={item.id ?? idx} className="item-row">
          <span className="item-qty">{item.quantity}x</span>
          <span className="item-name">{item.menuItemName}</span>
          <span className="item-price">{fmt(item.unitPrice * item.quantity)}</span>
        </div>
      ))}

      <div className="line-dash" />

      {/* TOTAIS */}
      <div className="total-row">
        <span>Subtotal:</span>
        <span>{fmt(order.subtotal)}</span>
      </div>
      {order.orderType === "delivery" && (order.deliveryFee ?? 0) > 0 && (
        <div className="total-row">
          <span>Taxa de Entrega:</span>
          <span>{fmt(order.deliveryFee)}</span>
        </div>
      )}
      <div className="total-final">
        <span>TOTAL:</span>
        <span>{fmt(order.total)}</span>
      </div>

      <div className="line-dash" />

      {/* PAGAMENTO */}
      <div className="row">
        <span className="lbl">Pagamento:</span>
        <span className="val">
          {order.paymentMethod === "dinheiro" && "DINHEIRO"}
          {order.paymentMethod === "cartao" && "CARTAO"}
          {order.paymentMethod === "pix" && "PIX"}
        </span>
      </div>

      {/* TROCO */}
      {order.paymentMethod === "dinheiro" && changeFor && changeFor > 0 && (
        <div className="troco-box">
          <div className="troco-title">** TROCO NECESSARIO **</div>
          {trocoValor !== null ? (
            <>
              <div className="troco-valor">Mandar: {fmt(trocoValor)}</div>
              <div className="troco-para">(troco para {fmt(changeFor)})</div>
            </>
          ) : (
            <div>Pago exato - sem troco</div>
          )}
        </div>
      )}

      <div className="line-solid" style={{ marginTop: "8px" }} />
      <div className="center sub">Tempo estimado: {order.estimatedTime || 40} min</div>
      <div className="center sub" style={{ marginTop: "3px" }}>Obrigado pela preferencia!</div>
    </div>
  );

  return (
    <>
      <style>{`
        /* =====================================================
           COMANDA TÉRMICA — VIA COZINHA + VIA CAIXA
           Fonte mínima 13px, negrito em tudo
           Impressoras ESC/POS 80mm
        ===================================================== */

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #fff !important;
          color: #000 !important;
        }

        .print-page {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 4mm 2mm;
          font-family: 'Courier New', Courier, monospace;
          font-weight: bold;
          font-size: 13px;
          line-height: 1.55;
          color: #000;
          background: #fff;
        }

        .via { width: 100%; }

        .via-label {
          text-align: center;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
          margin-bottom: 5px;
          border: 2px solid #000;
          padding: 2px 0;
        }

        /* Separador entre vias */
        .corte {
          border: none;
          border-top: 2px dashed #000;
          margin: 10px 0;
        }
        .corte-label {
          text-align: center;
          font-size: 11px;
          font-weight: bold;
          margin: 4px 0 8px;
          letter-spacing: 2px;
        }

        .center  { text-align: center; }
        .title   { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .sub     { font-size: 12px; font-weight: bold; }
        .section-title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
        .lbl     { font-size: 13px; font-weight: bold; flex: 0 0 auto; margin-right: 4px; }
        .val     { font-size: 13px; font-weight: bold; flex: 1; word-break: break-word; }

        .line-solid {
          border: none;
          border-top: 2px solid #000;
          margin: 5px 0;
        }
        .line-dash {
          border: none;
          border-top: 1px dashed #000;
          margin: 5px 0;
        }

        .row {
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          margin: 2px 0;
        }

        /* Itens */
        .item-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 13px;
          font-weight: bold;
        }
        .item-qty  { flex: 0 0 26px; }
        .item-name { flex: 1; }
        .item-price { flex: 0 0 62px; text-align: right; white-space: nowrap; }

        /* Complementos/adicionais */
        .addon-line {
          font-size: 12px;
          font-weight: bold;
          margin: 1px 0;
          padding-left: 4px;
          border-left: 2px solid #000;
        }

        .obs {
          font-size: 12px;
          font-weight: bold;
          padding-left: 26px;
          margin-bottom: 2px;
        }

        /* Totais */
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: bold;
          margin: 2px 0;
        }
        .total-final {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: bold;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 2px solid #000;
        }

        /* Troco */
        .troco-box {
          border: 2px solid #000;
          padding: 5px 7px;
          margin: 6px 0;
        }
        .troco-title { font-size: 12px; font-weight: bold; margin-bottom: 3px; }
        .troco-valor { font-size: 15px; font-weight: bold; }
        .troco-para  { font-size: 12px; font-weight: bold; }

        .no-print { display: block; }

        /* ===== REGRAS DE IMPRESSÃO ===== */
        @media print {
          @page {
            margin: 2mm 1mm;
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

          * {
            color: #000 !important;
            background: transparent !important;
            border-color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            -webkit-filter: none !important;
            filter: none !important;
            font-weight: bold !important;
          }

          .print-page {
            width: 76mm !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Cada via ocupa uma página separada */
          .via {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            padding-bottom: 8mm;
          }

          /* Remover separador visual entre vias na impressão */
          .corte, .corte-label { display: none !important; }

          .no-print { display: none !important; }
        }
      `}</style>

      <div className="print-page">

        {/* === VIA 1 — COZINHA === */}
        <ViaCozinha />

        {/* === SEPARADOR DE CORTE === */}
        <div className="corte" />
        <div className="corte-label">- - - RECORTAR AQUI - - -</div>

        {/* === VIA 2 — CAIXA === */}
        <ViaCaixa />

        {/* Espaço para corte da bobina */}
        <div style={{ marginTop: "20px" }}>&nbsp;</div>
        <div style={{ marginTop: "8px" }}>&nbsp;</div>

      </div>

      {/* Botão fechar — só na tela */}
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
            fontWeight: "bold",
            fontSize: "13px",
          }}
        >
          Fechar
        </button>
      </div>
    </>
  );
}
