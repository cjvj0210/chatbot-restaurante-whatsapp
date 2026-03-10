import { useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Comanda térmica — Epson TM-T20X (80mm)
 * VIA 1 — COZINHA: itens + complementos (apenas valores) + observações
 * VIA 2 — CAIXA:   cliente + endereço + totais + pagamento + troco
 *
 * Corte automático: a impressora corta ao receber page-break (configurar
 * "Auto Cut" no driver Epson OPOS/CUPS como "Cut per page").
 * Sem 3ª página em branco: page-break-after apenas na Via Cozinha.
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
      setTimeout(() => window.print(), 700);
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

  // Parse addons — retorna apenas os valores (sem o nome do grupo/pergunta)
  const parseAddons = (addonsStr: string | null | undefined): SelectedAddon[] => {
    if (!addonsStr) return [];
    try {
      return JSON.parse(addonsStr) as SelectedAddon[];
    } catch {
      return [];
    }
  };

  const css = `
    /* ============================================
       COMANDA TÉRMICA — Epson TM-T20X 80mm
       Fonte bold em tudo, sem corte lateral
    ============================================ */

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      font-weight: bold;
      color: #000;
      background: #fff;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    body {
      background: #fff;
    }

    .print-wrap {
      width: 68mm;
      max-width: 68mm;
      margin: 0 auto;
      padding: 3mm 4mm 3mm 5mm;
      font-size: 13px;
      line-height: 1.6;
    }

    /* ---- Cabeçalho ---- */
    .c  { text-align: center; }
    .ttl { font-size: 15px; letter-spacing: 1px; }
    .sub { font-size: 12px; }

    /* ---- Separadores ---- */
    .ln-s { border: none; border-top: 2px solid #000; margin: 5px 0; }
    .ln-d { border: none; border-top: 1px dashed #000; margin: 4px 0; }

    /* ---- Rótulos ---- */
    .sec  { font-size: 13px; margin: 4px 0 2px; text-decoration: underline; }
    .lbl  { font-size: 13px; }
    .val  { font-size: 13px; }

    /* ---- Itens ---- */
    .item {
      display: flex;
      align-items: flex-start;
      margin: 3px 0;
      font-size: 13px;
    }
    .item-qty  { flex: 0 0 22px; }
    .item-name { flex: 1; min-width: 0; }
    .item-price { flex: 0 0 58px; text-align: right; white-space: nowrap; }

    /* ---- Complementos (apenas valores) ---- */
    .addon {
      font-size: 12px;
      margin: 1px 0 1px 22px;
      padding-left: 5px;
      border-left: 2px solid #000;
    }

    /* ---- Observações ---- */
    .obs {
      font-size: 12px;
      margin: 1px 0 2px 22px;
      font-style: italic;
    }

    /* ---- Totais ---- */
    .tot-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin: 2px 0;
    }
    .tot-final {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      margin-top: 5px;
      padding-top: 4px;
      border-top: 2px solid #000;
    }

    /* ---- Troco ---- */
    .troco {
      border: 2px solid #000;
      padding: 4px 6px;
      margin: 6px 0;
    }
    .troco-t { font-size: 12px; margin-bottom: 2px; }
    .troco-v { font-size: 15px; }
    .troco-p { font-size: 12px; }

    /* ---- Via label ---- */
    .via-lbl {
      text-align: center;
      font-size: 12px;
      letter-spacing: 1px;
      border: 2px solid #000;
      padding: 2px 0;
      margin-bottom: 5px;
    }

    /* ---- Separador de corte (só na tela) ---- */
    .corte-wrap {
      margin: 12px 0;
      text-align: center;
    }
    .corte-line {
      border: none;
      border-top: 2px dashed #000;
      margin: 4px 0;
    }
    .corte-txt {
      font-size: 11px;
      letter-spacing: 2px;
    }

    .no-print { display: block; }

    /* ============================================
       REGRAS DE IMPRESSÃO
    ============================================ */
    @media print {
      @page {
        size: 80mm auto;
        margin: 2mm 1mm;
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
        font-weight: bold !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
      }

      .print-wrap {
        width: 80mm !important;
        max-width: 80mm !important;
        /* padding-left: 5mm garante que o texto não seja cortado pela margem física da impressora */
        padding: 2mm 3mm 2mm 6mm !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }

      /*
       * Via Cozinha: page-break-after força corte automático
       * na Epson TM-T20X (configurar "Auto Cut" no driver).
       * Via Caixa: sem page-break para não gerar 3ª página em branco.
       */
      .via-cozinha {
        page-break-after: always;
        break-after: page;
      }

      /* Separador de corte não aparece na impressão */
      .corte-wrap { display: none !important; }

      .no-print { display: none !important; }
    }
  `;

  return (
    <>
      <style>{css}</style>

      <div className="print-wrap">

        {/* ======================================
            VIA 1 — COZINHA
        ====================================== */}
        <div className="via-cozinha">
          <div className="via-lbl">*** VIA COZINHA ***</div>

          <div className="c ttl">CHURRASCARIA ESTRELA</div>
          <div className="c ttl">DO SUL</div>
          <div className="c sub" style={{ marginTop: "3px" }}>
            Pedido #{order.orderNumber}
          </div>
          <div className="c sub">
            {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>

          <div className="ln-s" />

          <div className="lbl">
            Tipo: {order.orderType === "delivery" ? "DELIVERY" : "RETIRADA NO BALCAO"}
          </div>
          <div className="lbl">Cliente: {order.customerName}</div>

          <div className="ln-d" />

          <div className="sec">ITENS DO PEDIDO:</div>

          {order.items?.map((item: any, idx: number) => {
            const addons = parseAddons(item.addons);
            return (
              <div key={item.id ?? idx} style={{ marginBottom: "5px" }}>
                {/* Item principal */}
                <div className="item">
                  <span className="item-qty">{item.quantity}x</span>
                  <span className="item-name">{item.menuItemName}</span>
                </div>

                {/* Complementos — apenas o valor selecionado, sem o nome do grupo */}
                {addons.length > 0 && addons.map((a, ai) => (
                  <div key={ai} className="addon">
                    {a.quantity && a.quantity > 1 ? `${a.quantity}x ` : ""}
                    {a.optionName}
                    {a.priceExtra > 0 ? ` (+${fmt(a.priceExtra)})` : ""}
                  </div>
                ))}

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
              <div className="ln-d" />
              <div className="sec">OBS. GERAIS:</div>
              <div style={{ marginTop: "2px", fontSize: "13px" }}>
                {order.customerNotes}
              </div>
            </>
          )}

          <div className="ln-s" style={{ marginTop: "8px" }} />
        </div>

        {/* Separador visual entre vias (só na tela) */}
        <div className="corte-wrap">
          <div className="corte-line" />
          <div className="corte-txt">- - - RECORTAR AQUI - - -</div>
          <div className="corte-line" />
        </div>

        {/* ======================================
            VIA 2 — CAIXA
        ====================================== */}
        <div className="via-caixa">
          <div className="via-lbl">*** VIA CAIXA ***</div>

          <div className="c ttl">CHURRASCARIA ESTRELA</div>
          <div className="c ttl">DO SUL</div>
          <div className="c sub" style={{ marginTop: "3px" }}>
            Pedido #{order.orderNumber}
          </div>
          <div className="c sub">
            {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>

          <div className="ln-s" />

          <div className="lbl">Cliente: {order.customerName}</div>
          <div className="lbl">Telefone: {order.customerPhone}</div>
          <div className="lbl">
            Tipo: {order.orderType === "delivery" ? "DELIVERY" : "RETIRADA"}
          </div>

          {order.orderType === "delivery" && order.deliveryAddress && (
            <div style={{ marginTop: "3px" }}>
              <div className="lbl">Endereco:</div>
              <div style={{ fontSize: "13px", paddingLeft: "4px", marginTop: "2px" }}>
                {order.deliveryAddress}
              </div>
            </div>
          )}

          <div className="ln-d" />

          <div className="sec">RESUMO:</div>

          {order.items?.map((item: any, idx: number) => (
            <div key={item.id ?? idx} className="item">
              <span className="item-qty">{item.quantity}x</span>
              <span className="item-name">{item.menuItemName}</span>
              <span className="item-price">{fmt(item.unitPrice * item.quantity)}</span>
            </div>
          ))}

          <div className="ln-d" />

          <div className="tot-row">
            <span>Subtotal:</span>
            <span>{fmt(order.subtotal)}</span>
          </div>
          {order.orderType === "delivery" && (order.deliveryFee ?? 0) > 0 && (
            <div className="tot-row">
              <span>Taxa de Entrega:</span>
              <span>{fmt(order.deliveryFee)}</span>
            </div>
          )}
          <div className="tot-final">
            <span>TOTAL:</span>
            <span>{fmt(order.total)}</span>
          </div>

          <div className="ln-d" />

          <div className="lbl">
            Pagamento:{" "}
            {order.paymentMethod === "dinheiro" && "DINHEIRO"}
            {order.paymentMethod === "cartao" && "CARTAO"}
            {order.paymentMethod === "pix" && "PIX"}
          </div>

          {order.paymentMethod === "dinheiro" && changeFor && changeFor > 0 && (
            <div className="troco">
              <div className="troco-t">** TROCO NECESSARIO **</div>
              {trocoValor !== null ? (
                <>
                  <div className="troco-v">Mandar: {fmt(trocoValor)}</div>
                  <div className="troco-p">(troco para {fmt(changeFor)})</div>
                </>
              ) : (
                <div style={{ fontSize: "13px" }}>Pago exato - sem troco</div>
              )}
            </div>
          )}

          <div className="ln-s" style={{ marginTop: "8px" }} />
          <div className="c sub" style={{ marginTop: "3px" }}>Obrigado pela preferencia!</div>
        </div>

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
            fontSize: "14px",
          }}
        >
          Fechar
        </button>
      </div>
    </>
  );
}
