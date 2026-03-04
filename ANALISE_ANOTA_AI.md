# Análise Completa do Cardápio Digital Anota.ai

## Estrutura Visual (baseado em screenshots e interface real)

### 1. HEADER / TOPO DA PÁGINA
- Barra azul no topo (cor primária da marca)
- Ícone de busca (lupa) e compartilhar no canto direito
- Nome do restaurante com logo circular
- Status da loja (Aberto/Fechado) com indicador verde/vermelho
- Pedido mínimo exibido logo abaixo do nome
- Link "Perfil da loja" para ver mais informações

### 2. BARRA DE BUSCA
- Campo de busca proeminente: "O que você quer comer hoje?"
- Busca em tempo real nos itens do cardápio

### 3. NAVEGAÇÃO POR CATEGORIAS (tabs horizontais com scroll)
- Categorias fixas em linha horizontal com scroll
- Categoria ativa destacada com underline azul
- Clicar na categoria faz scroll suave até a seção
- Exemplos: "Seja o próprio Chef Burguer", "COMBOS - CAMPEÕES"

### 4. SEÇÃO "PEÇA DE NOVO" (para clientes recorrentes)
- Cards horizontais com scroll
- Mostra pedidos anteriores do cliente
- Botão "Adicionar ao carrinho" direto

### 5. CARDS DE PRODUTOS
Layout do card:
- Foto à DIREITA (quadrada, ~80x80px)
- Nome do produto à esquerda (negrito)
- Descrição curta (2-3 linhas, cinza)
- Preço em ROSA/VERMELHO destacado (ex: R$ 26,90)
- Botão + azul no canto inferior direito da foto
- Ao clicar no card: abre modal de detalhes

### 6. MODAL DE DETALHES DO PRODUTO
- Foto grande no topo (full-width)
- Nome e preço
- Descrição completa
- Seção "Adicionais" com checkboxes (ex: hambúrguer extra, queijo)
- Contador de quantidade (- 1 +)
- Botão "Adicionar R$ 18,90" em ROSA/VERMELHO na parte inferior

### 7. CARRINHO (tela separada)
- Aba "Carrinho" na navegação inferior
- Lista de itens com foto, nome, preço
- Botões - e + para quantidade
- Ícone de lixeira para remover
- Seção "Peça também" (upsell) com produtos sugeridos
- Subtotal e taxa de entrega
- Botão "Finalizar Pedido" em rosa/vermelho

### 8. CHECKOUT / "CONFIRME SEUS DADOS"
- Nome do cliente (editável)
- Telefone
- Seção "Entrega" (endereço ou retirada)
- Seção "Formas de pagamento" (dropdown)
- Campo "Cupom de desconto"
- Resumo: Subtotal + Taxa de entrega = Total
- Botão "Finalizar Pedido" em rosa/vermelho

### 9. NAVEGAÇÃO INFERIOR (Bottom Navigation)
- 3 abas fixas no rodapé:
  - 🏠 Início
  - 📋 Pedidos  
  - 🛒 Carrinho (com badge de quantidade)

## Padrões de Design Identificados

### Cores
- Primária: Azul (#1a73e8 ou similar) - header, botões secundários
- Ação/CTA: Rosa/Vermelho (#e91e63 ou similar) - preços, botões principais
- Texto: Preto/Cinza escuro
- Fundo: Branco puro
- Cards: Branco com sombra suave

### Tipografia
- Nome do produto: Bold, ~16px
- Descrição: Regular, ~13px, cinza
- Preço: Bold, ~16px, rosa/vermelho
- Categoria: Medium, ~14px

### Layout
- Mobile-first (320px-480px)
- Cards de produto: foto à direita, texto à esquerda
- Categorias: scroll horizontal
- Carrinho: tela separada via tab

## Funcionalidades Principais

1. **Busca em tempo real** - filtra itens enquanto digita
2. **Navegação por categorias** - tabs com scroll horizontal
3. **Modal de produto** - foto grande + adicionais + quantidade
4. **Carrinho persistente** - mantém itens entre sessões
5. **Upsell "Peça também"** - sugestões no carrinho
6. **Status da loja** - Aberto/Fechado em tempo real
7. **Pedido mínimo** - exibido no header
8. **"Peça de novo"** - recompra rápida para clientes recorrentes
9. **Pagamento online** - PIX, cartão, carteiras digitais
10. **Cupom de desconto** - campo no checkout

## O que implementar no nosso projeto

### PRIORIDADE ALTA (redesign completo):
1. Header com logo, status, pedido mínimo
2. Barra de busca
3. Categorias em tabs horizontais com scroll
4. Cards com foto à direita, preço em destaque
5. Modal de produto com foto grande
6. Bottom navigation (Início / Carrinho)
7. Botão flutuante do carrinho com contador

### PRIORIDADE MÉDIA:
8. Status aberto/fechado
9. Upsell "Peça também" no carrinho
10. Redesign do checkout (mais limpo)

### PRIORIDADE BAIXA (futuro):
11. "Peça de novo" (requer histórico de cliente)
12. Cupom de desconto
13. Pagamento online integrado
