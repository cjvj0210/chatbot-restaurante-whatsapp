// Canvas é opcional - só funciona se instalado
let createCanvas: any = null;

async function loadCanvas() {
  if (createCanvas !== null) return createCanvas;
  try {
    const canvasModule = await import('canvas');
    createCanvas = canvasModule.createCanvas;
  } catch (e) {
    // Canvas não disponível - funcionalidade de imagem desabilitada
    console.warn('Canvas module not available - image generation disabled');
    createCanvas = false;
  }
  return createCanvas;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderData {
  orderId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  timestamp: Date;
  needsChange?: string;
}

export async function generateOrderImage(order: OrderData): Promise<Buffer> {
  const canvasFactory = await loadCanvas();
  if (!canvasFactory) {
    throw new Error('Canvas module not available. Install canvas package to enable image generation.');
  }
  // Canvas dimensions
  const width = 600;
  const headerHeight = 120;
  const itemHeight = 40;
  const footerHeight = 150;
  const padding = 20;
  
  const totalHeight = headerHeight + (order.items.length * itemHeight) + footerHeight + (padding * 4);
  
  const canvas = canvasFactory(width, totalHeight);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);
  
  // Header - Logo area (vermelho)
  ctx.fillStyle = '#c41e3a'; // Vermelho da Estrela do Sul
  ctx.fillRect(0, 0, width, headerHeight);
  
  // Título
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ESTRELA DO SUL', width / 2, 45);
  
  ctx.font = 'bold 20px Arial';
  ctx.fillText('Churrascaria', width / 2, 75);
  
  // Número do pedido
  ctx.font = '16px Arial';
  ctx.fillText(`Pedido #${order.orderId}`, width / 2, 105);
  
  let currentY = headerHeight + padding + 20;
  
  // Informações do cliente
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('DADOS DO CLIENTE', padding, currentY);
  currentY += 30;
  
  ctx.font = '14px Arial';
  ctx.fillText(`Nome: ${order.customerName}`, padding, currentY);
  currentY += 25;
  
  // Quebrar endereço em múltiplas linhas se necessário
  const maxWidth = width - (padding * 2);
  const addressLines = wrapText(ctx, `Endereço: ${order.address}`, maxWidth);
  addressLines.forEach(line => {
    ctx.fillText(line, padding, currentY);
    currentY += 20;
  });
  
  currentY += 15;
  
  // Linha separadora
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, currentY);
  ctx.lineTo(width - padding, currentY);
  ctx.stroke();
  
  currentY += 25;
  
  // Itens do pedido
  ctx.font = 'bold 18px Arial';
  ctx.fillText('ITENS DO PEDIDO', padding, currentY);
  currentY += 30;
  
  ctx.font = '14px Arial';
  order.items.forEach(item => {
    const itemText = `${item.quantity}x ${item.name}`;
    const priceText = `R$ ${item.price.toFixed(2)}`;
    
    ctx.fillText(itemText, padding, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(priceText, width - padding, currentY);
    ctx.textAlign = 'left';
    currentY += itemHeight;
  });
  
  currentY += 10;
  
  // Linha separadora
  ctx.beginPath();
  ctx.moveTo(padding, currentY);
  ctx.lineTo(width - padding, currentY);
  ctx.stroke();
  
  currentY += 30;
  
  // Total
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#c41e3a';
  ctx.fillText('TOTAL:', padding, currentY);
  ctx.textAlign = 'right';
  ctx.fillText(`R$ ${order.total.toFixed(2)}`, width - padding, currentY);
  ctx.textAlign = 'left';
  
  currentY += 35;
  
  // Forma de pagamento
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('PAGAMENTO', padding, currentY);
  currentY += 25;
  
  ctx.font = '14px Arial';
  ctx.fillText(`Forma: ${order.paymentMethod}`, padding, currentY);
  
  if (order.needsChange) {
    currentY += 20;
    ctx.fillText(`Troco para: ${order.needsChange}`, padding, currentY);
  }
  
  currentY += 30;
  
  // Horário do pedido
  ctx.font = '12px Arial';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  const timeStr = order.timestamp.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  ctx.fillText(`Pedido realizado em: ${timeStr}`, width / 2, currentY);
  
  // Converter canvas para buffer PNG
  return canvas.toBuffer('image/png');
}

// Função auxiliar para quebrar texto em múltiplas linhas
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  
  return lines;
}
