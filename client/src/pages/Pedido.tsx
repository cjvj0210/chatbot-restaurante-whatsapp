import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Search, X, Plus, Minus, Trash2, ChevronRight, MapPin, Clock, ChevronDown, ChevronUp, Bike, Store } from "lucide-react";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663208695668/hEsNGYEonud5ngJEe9CdHq/logo-estrela-do-sul_aa66ec3f.png";

interface AddonOption {
  id: number;
  groupId: number;
  name: string;
  description: string | null;
  priceExtra: number;
  displayOrder: number;
}

interface AddonGroup {
  id: number;
  menuItemId: number;
  name: string;
  description: string | null;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  displayOrder: number;
  options: AddonOption[];
}

interface SelectedAddon {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  priceExtra: number;
}

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  basePrice: number;
  quantity: number;
  observations?: string;
  imageUrl?: string;
  addons?: SelectedAddon[];
}

type Tab = "menu" | "cart";
type DeliveryType = "delivery" | "pickup";

// Drawer de detalhes do item (desliza de baixo para cima)
function ItemDrawer({
  item,
  addonGroups,
  loadingAddons,
  onClose,
  onAdd,
}: {
  item: any;
  addonGroups: AddonGroup[];
  loadingAddons: boolean;
  onClose: () => void;
  onAdd: (qty: number, obs: string, addons: SelectedAddon[]) => void;
}) {
  const [qty, setQty] = useState(1);
  const [obs, setObs] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<number, SelectedAddon[]>>({});
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  const toggleAddon = (group: AddonGroup, option: AddonOption) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.some((a) => a.optionId === option.id);
      if (group.maxSelections === 1) {
        if (isSelected) return { ...prev, [group.id]: [] };
        return {
          ...prev,
          [group.id]: [{ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, priceExtra: option.priceExtra }],
        };
      } else {
        if (isSelected) {
          return { ...prev, [group.id]: current.filter((a) => a.optionId !== option.id) };
        }
        if (current.length >= group.maxSelections) return prev;
        return {
          ...prev,
          [group.id]: [...current, { groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, priceExtra: option.priceExtra }],
        };
      }
    });
    setError(null);
  };

  const allAddons = Object.values(selectedAddons).flat();
  const addonsExtra = allAddons.reduce((sum, a) => sum + a.priceExtra, 0);
  const totalPrice = (item.price + addonsExtra) * qty;

  const handleAdd = () => {
    for (const group of addonGroups) {
      const selected = selectedAddons[group.id] || [];
      if (group.isRequired && selected.length < group.minSelections) {
        setError(`Escolha ${group.minSelections === 1 ? "uma opção" : `${group.minSelections} opções`} em "${group.name}"`);
        return;
      }
    }
    onAdd(qty, obs, allAddons);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Overlay escuro */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Drawer */}
      <div
        className="relative bg-white rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1">
          {/* Imagem ou placeholder */}
          {item.imageUrl ? (
            <div className="w-full h-48 overflow-hidden">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-36 bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center text-5xl">
              🍖
            </div>
          )}

          {/* Nome e preço */}
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{item.name}</h2>
            <p className="text-red-600 font-bold text-lg mt-1">{formatPrice(item.price)}</p>
            {item.description && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">{item.description}</p>
            )}
          </div>

          {/* Complementos */}
          {loadingAddons ? (
            <div className="px-5 py-3 text-sm text-gray-400">Carregando opções...</div>
          ) : (
            addonGroups.map((group) => {
              const selected = selectedAddons[group.id] || [];
              const isMaxReached = selected.length >= group.maxSelections;
              return (
                <div key={group.id} className="border-t border-gray-100">
                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{group.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {group.maxSelections === 1
                          ? "Escolha 1 opção"
                          : group.minSelections > 0
                          ? `Escolha de ${group.minSelections} a ${group.maxSelections} opções`
                          : `Escolha até ${group.maxSelections} opções`}
                      </p>
                    </div>
                    {group.isRequired && (
                      <span className="text-xs font-bold bg-gray-800 text-white px-2 py-0.5 rounded">
                        OBRIGATÓRIO
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.options.map((option) => {
                      const isSelected = selected.some((a) => a.optionId === option.id);
                      const isDisabled = !isSelected && isMaxReached;
                      return (
                        <button
                          key={option.id}
                          onClick={() => !isDisabled && toggleAddon(group, option)}
                          disabled={isDisabled}
                          className={`w-full px-5 py-3.5 flex items-center justify-between text-left transition-colors ${
                            isDisabled ? "opacity-40" : "active:bg-gray-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{option.name}</p>
                            {option.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                            )}
                            {option.priceExtra > 0 && (
                              <p className="text-sm text-red-600 font-semibold mt-0.5">+ {formatPrice(option.priceExtra)}</p>
                            )}
                          </div>
                          {group.maxSelections === 1 ? (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                              isSelected ? "border-red-600" : "border-gray-300"
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-red-600" />}
                            </div>
                          ) : (
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                              isSelected ? "border-red-600 bg-red-600" : "border-gray-300"
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Observações */}
          <div className="px-5 pt-4 pb-3 border-t border-gray-100">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Alguma observação?</label>
            <Textarea
              placeholder="Ex: sem cebola, ponto da carne, etc."
              value={obs}
              onChange={(e) => setObs(e.target.value.slice(0, 140))}
              className="resize-none text-sm rounded-xl border-gray-200 focus:border-red-400 focus:ring-red-100"
              rows={2}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{obs.length}/140</p>
          </div>

          {/* Espaço para o botão fixo */}
          <div className="h-24" />
        </div>

        {/* Erro de validação */}
        {error && (
          <div className="px-5 py-2 bg-red-50 border-t border-red-100 flex-shrink-0">
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Botão adicionar - fixo no fundo */}
        <div className="px-5 py-4 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Controle de quantidade */}
            <div className="flex items-center gap-3 bg-gray-100 rounded-full px-3 py-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center"
              >
                <Minus className="w-3.5 h-3.5 text-gray-700" />
              </button>
              <span className="w-5 text-center font-bold text-gray-800">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center"
              >
                <Plus className="w-3.5 h-3.5 text-gray-700" />
              </button>
            </div>

            {/* Botão adicionar */}
            <button
              onClick={handleAdd}
              className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-between px-5 active:bg-red-700 transition-colors"
            >
              <span>Adicionar</span>
              <span>{formatPrice(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pedido() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("menu");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);
  const categoryBarRef = useRef<HTMLDivElement | null>(null);

  // ===== HISTORY API: suporte ao botão voltar do celular =====
  // Quando um drawer/modal abre, empurra uma entrada no histórico.
  // O evento popstate (botão voltar) fecha o estado ativo em vez de sair do app.
  const historyStateRef = useRef<string | null>(null);

  const pushHistoryState = useCallback((state: string) => {
    historyStateRef.current = state;
    window.history.pushState({ modal: state }, "");
  }, []);

  const popHistoryState = useCallback(() => {
    historyStateRef.current = null;
  }, []);

  // Abre o drawer de item e registra no histórico
  const openItem = useCallback((item: any) => {
    setSelectedItem(item);
    pushHistoryState("item-drawer");
  }, [pushHistoryState]);

  // Fecha o drawer de item sem disparar popstate (chamado pelo botão X ou fundo)
  const closeItem = useCallback(() => {
    setSelectedItem(null);
    if (historyStateRef.current === "item-drawer") {
      popHistoryState();
      window.history.back();
    }
  }, [popHistoryState]);

  // Muda para aba carrinho e registra no histórico (apenas se ainda não estiver no carrinho)
  const openCart = useCallback(() => {
    setActiveTab((prev) => {
      if (prev !== "cart") {
        pushHistoryState("cart-tab");
      }
      return "cart";
    });
  }, [pushHistoryState]);

  // Volta para aba menu sem disparar popstate (apenas se estiver no carrinho)
  const closeCart = useCallback(() => {
    setActiveTab((prev) => {
      if (prev === "cart" && historyStateRef.current === "cart-tab") {
        popHistoryState();
        window.history.back();
      }
      return "menu";
    });
  }, [popHistoryState]);

  // Captura o evento popstate (botão voltar físico/gesto do celular)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Se havia um drawer de item aberto, fecha-o
      if (selectedItem) {
        setSelectedItem(null);
        historyStateRef.current = null;
        return;
      }
      // Se estava na aba carrinho, volta para o menu
      if (activeTab === "cart") {
        setActiveTab("menu");
        historyStateRef.current = null;
        return;
      }
      // Nenhum estado modal ativo: deixa o navegador agir normalmente
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedItem, activeTab]);

  // Buscar complementos do item selecionado
  const { data: addonGroups = [], isLoading: loadingAddons } = trpc.menuAddons.getByItem.useQuery(
    { menuItemId: selectedItem?.id || 0 },
    { enabled: !!selectedItem?.id }
  );

  // Validar sessão
  const { data: validation, isLoading: validating } = trpc.orderLink.validate.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  // Buscar categorias e itens do menu
  const { data: categories, isLoading: loadingCategories } = trpc.menu.listCategories.useQuery();
  const { data: menuItems, isLoading: loadingItems } = trpc.menu.listItems.useQuery();
  const { data: featuredItems = [] } = trpc.menu.listFeatured.useQuery();

  useEffect(() => {
    if (validation && !validation.valid) {
      setTimeout(() => setLocation("/"), 3000);
    }
  }, [validation, setLocation]);

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const categorizedItems = (categories || []).map((category) => ({
    ...category,
    items: (menuItems || []).filter((item) => item.categoryId === category.id && item.isAvailable),
  })).filter((c) => c.items.length > 0);

  const filteredCategories = searchQuery.trim()
    ? categorizedItems.map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description || "").toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((cat) => cat.items.length > 0)
    : categorizedItems;

  const scrollToCategory = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    const el = categoryRefs.current[categoryId];
    if (el && contentRef.current) {
      const headerHeight = 56 + 52 + 44; // header + tabs + category bar
      const offset = el.offsetTop - headerHeight - 8;
      contentRef.current.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const headerHeight = 56 + 52 + 44;
    const scrollTop = contentRef.current.scrollTop + headerHeight + 16;
    let current = activeCategoryId;
    for (const cat of filteredCategories) {
      const el = categoryRefs.current[cat.id];
      if (el && el.offsetTop <= scrollTop) {
        current = cat.id;
      }
    }
    if (current !== activeCategoryId) setActiveCategoryId(current);
  }, [filteredCategories, activeCategoryId]);

  useEffect(() => {
    const container = contentRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const addToCart = (qty: number, obs: string, addons: SelectedAddon[]) => {
    if (!selectedItem) return;
    const addonsExtra = addons.reduce((sum, a) => sum + a.priceExtra, 0);
    const totalPrice = selectedItem.price + addonsExtra;
    setCart((prev) => [
      ...prev,
      {
        menuItemId: selectedItem.id,
        name: selectedItem.name,
        price: totalPrice,
        basePrice: selectedItem.price,
        quantity: qty,
        observations: obs || undefined,
        imageUrl: selectedItem.imageUrl || undefined,
        addons: addons.length > 0 ? addons : undefined,
      },
    ]);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) => i === index ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = deliveryType === "delivery" ? 850 : 0;
  const total = subtotal + deliveryFee;

  const formatPrice = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  // ===== TELA DE SELEÇÃO ENTREGA/RETIRADA =====
  if (!deliveryType) {
    return (
      <div
        className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header */}
        <div className="bg-red-700 text-white px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
              <img src={LOGO_URL} alt="Estrela do Sul" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Churrascaria Estrela do Sul</h1>
              <p className="text-xs text-red-200 mt-0.5">Desde 1998 · Barretos/SP</p>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 flex flex-col justify-center px-5 py-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🥩</div>
            <h2 className="text-xl font-bold text-gray-900">Bem-vindo ao nosso cardápio!</h2>
            <p className="text-gray-500 text-sm mt-2">Como você prefere receber seu pedido?</p>
          </div>

          <div className="space-y-3">
            {/* Opção Delivery */}
            <button
              onClick={() => setDeliveryType("delivery")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 bg-white shadow-sm active:scale-[0.98] transition-all active:border-red-300"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <Bike className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-gray-900 text-base">Entrega (Delivery)</p>
                <p className="text-sm text-gray-500 mt-0.5">Receba no seu endereço · Taxa R$ 8,50</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </button>

            {/* Opção Retirada */}
            <button
              onClick={() => setDeliveryType("pickup")}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 bg-white shadow-sm active:scale-[0.98] transition-all active:border-red-300"
            >
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Store className="w-6 h-6 text-orange-500" />
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-gray-900 text-base">Retirada no local</p>
                <p className="text-sm text-gray-500 mt-0.5">Retire no restaurante · Grátis</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </button>
          </div>

          {/* Endereço do restaurante */}
          <div className="mt-8 flex items-start gap-2 text-xs text-gray-400 justify-center">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Av. 7 nº 1885 · Barretos/SP · (17) 9 8222-2790</span>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (validating || loadingCategories || loadingItems) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto">
        <div className="h-14 bg-red-700" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-full" />
          <Skeleton className="h-8 w-full" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h2>
          <p className="text-gray-500 text-sm">
            Este link de pedido não é mais válido. Solicite um novo link pelo WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white max-w-md mx-auto relative"
      style={{ height: "100dvh", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ===== HEADER FIXO ===== */}
      <div className="bg-red-700 text-white flex-shrink-0" style={{ zIndex: 30 }}>
        {/* Linha principal: logo + nome + carrinho */}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ minHeight: 56 }}>
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <div className="w-9 h-9 rounded-full bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
              <img
                src={LOGO_URL}
                alt="Estrela do Sul"
                className="w-full h-full object-contain p-0.5"
              />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Churrascaria Estrela do Sul</h1>
              <div className="flex items-center gap-1 text-xs text-red-200 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block flex-shrink-0" />
                <span>Aberto</span>
                <span className="mx-1 opacity-50">·</span>
                <span>Mín. {formatPrice(3000)}</span>
              </div>
            </div>
          </div>

          {/* Botão tipo de pedido + carrinho */}
          <div className="flex items-center gap-2">
          {/* Badge tipo de pedido */}
          <button
            onClick={() => setShowDeliveryModal(true)}
            className="flex items-center gap-1.5 bg-white/15 active:bg-white/25 transition-colors rounded-full px-3 py-1.5"
          >
            {deliveryType === "delivery" ? (
              <Bike className="w-3.5 h-3.5" />
            ) : (
              <Store className="w-3.5 h-3.5" />
            )}
            <span className="text-xs font-semibold">
              {deliveryType === "delivery" ? "Entrega" : "Retirada"}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {/* Botão carrinho */}
          <button
            onClick={openCart}
            className="relative p-2 rounded-full bg-white/15 active:bg-white/25 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-800 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                {cartCount}
              </span>
            )}
          </button>
          </div>
        </div>

        {/* Barra de busca */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar no cardápio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-full bg-white text-gray-800 text-sm placeholder-gray-400 outline-none"
              style={{ fontSize: 14 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== TABS: CARDÁPIO / CARRINHO ===== */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0" style={{ zIndex: 20 }}>
        <div className="flex">
          <button
            onClick={closeCart}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "menu"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-400"
            }`}
          >
            Cardápio
          </button>
          <button
            onClick={openCart}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "cart"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-400"
            }`}
          >
            Carrinho
            {cartCount > 0 && (
              <span className="bg-red-600 text-white text-xs rounded-full w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center text-[11px] font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      {activeTab === "menu" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navegação por categorias - sticky */}
          {!searchQuery && filteredCategories.length > 1 && (
            <div
              ref={categoryBarRef}
              className="bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto"
              style={{ zIndex: 10, scrollbarWidth: "none" }}
            >
              <div className="flex px-3 py-2 gap-2" style={{ minWidth: "max-content" }}>
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      activeCategoryId === cat.id
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 active:bg-gray-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de itens - scrollável */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto bg-gray-50"
            style={{ overscrollBehavior: "contain" }}
          >
            {filteredCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Search className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-base font-medium text-gray-500">Nenhum item encontrado</p>
                <p className="text-sm mt-1">Tente outro termo de busca</p>
              </div>
            )}

            {/* ===== SEÇÃO MAIS PEDIDOS ===== */}
            {!searchQuery && featuredItems.length > 0 && (
              <div className="mb-2">
                <div className="bg-white px-4 pt-5 pb-3">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-lg">🔥</span> Mais Pedidos
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Os favoritos dos nossos clientes</p>
                </div>
                <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  <div className="flex gap-3 px-4 pb-4" style={{ minWidth: "max-content" }}>
                    {featuredItems.map((item) => {
                      const cartEntries = cart.filter((c) => c.menuItemId === item.id);
                      const totalQty = cartEntries.reduce((s, c) => s + c.quantity, 0);
                      return (
                        <button
                          key={item.id}
                          onClick={() => openItem(item)}
                          className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-95 transition-transform text-left"
                        >
                          {/* Imagem */}
                          <div className="relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-28 object-cover"
                              />
                            ) : (
                              <div className="w-full h-28 bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center text-4xl">
                                🍖
                              </div>
                            )}
                            {totalQty > 0 && (
                              <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {totalQty}
                              </span>
                            )}
                          </div>
                          {/* Info */}
                          <div className="p-2.5">
                            <p className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2">{item.name}</p>
                            <p className="text-red-600 font-bold text-xs mt-1.5">{formatPrice(item.price)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {filteredCategories.map((category) => (
              <div
                key={category.id}
                ref={(el) => { categoryRefs.current[category.id] = el; }}
              >
                {/* Cabeçalho da categoria */}
                <div className="bg-white px-4 pt-5 pb-3 mt-2 first:mt-0">
                  <h2 className="text-base font-bold text-gray-900">{category.name}</h2>
                  {category.description && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{category.description}</p>
                  )}
                </div>

                {/* Cards de itens */}
                <div className="bg-white divide-y divide-gray-50">
                  {category.items.map((item) => {
                    const cartEntries = cart.filter((c) => c.menuItemId === item.id);
                    const totalQty = cartEntries.reduce((s, c) => s + c.quantity, 0);
                    return (
                      <button
                        key={item.id}
                        onClick={() => openItem(item)}
                        className="w-full px-4 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors text-left"
                      >
                        {/* Info do item */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-red-600 font-bold text-sm">
                              {formatPrice(item.price)}
                            </span>
                            {totalQty > 0 && (
                              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                                {totalQty}x
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Imagem + botão + */}
                        <div className="relative flex-shrink-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center text-3xl">
                              🍖
                            </div>
                          )}
                          {/* Botão + sobreposto */}
                          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                            <Plus className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Espaço para botão flutuante */}
            <div className="h-24" />
          </div>
        </div>
      ) : (
        /* ===== ABA CARRINHO ===== */
        <div className="flex-1 overflow-y-auto bg-gray-50 pb-32">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-semibold text-gray-600">Carrinho vazio</p>
              <p className="text-sm mt-1 text-center text-gray-400">Adicione itens do cardápio para continuar</p>
              <button
                onClick={closeCart}
                className="mt-6 px-6 py-3 bg-red-600 text-white rounded-full font-semibold text-sm active:bg-red-700 transition-colors"
              >
                Ver Cardápio
              </button>
            </div>
          ) : (
            <div>
              {/* Itens do carrinho */}
              <div className="bg-white mx-0 mt-0">
                <div className="px-4 pt-4 pb-2">
                  <h2 className="font-bold text-gray-900 text-base">Seu Pedido</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {cart.map((item, index) => (
                    <div
                      key={`${item.menuItemId}-${index}`}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center text-2xl flex-shrink-0">
                          🍖
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug">{item.name}</p>
                        {item.addons && item.addons.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                            {item.addons.map((a) => a.optionName).join(", ")}
                          </p>
                        )}
                        {item.observations && (
                          <p className="text-xs text-orange-500 mt-0.5 italic">{item.observations}</p>
                        )}
                        <p className="text-red-600 font-bold text-sm mt-1.5">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                      {/* Controles de quantidade */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center active:bg-gray-100"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                          )}
                        </button>
                        <span className="w-5 text-center font-bold text-sm text-gray-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center active:bg-red-700"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar mais */}
              <div className="px-4 mt-3">
                <button
                  onClick={closeCart}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium active:border-red-300 active:text-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar mais itens
                </button>
              </div>

              {/* Resumo de valores */}
              <div className="mx-4 mt-4 bg-white rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span className="text-gray-700 font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    {deliveryType === "delivery" ? <MapPin className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                    {deliveryType === "delivery" ? "Taxa de entrega" : "Retirada no local"}
                  </span>
                  <span className={deliveryType === "pickup" ? "text-green-600 font-medium" : "text-gray-700 font-medium"}>
                    {deliveryType === "pickup" ? "Grátis" : formatPrice(deliveryFee)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900">
                  <span>Total</span>
                  <span className="text-red-600 text-base">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Info de entrega */}
              <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Tempo estimado: 30–50 minutos</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== BOTÃO FLUTUANTE: VER CARRINHO (aba menu) ===== */}
      {activeTab === "menu" && cartCount > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-2 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" style={{ zIndex: 25 }}>
          <button
            onClick={openCart}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-xl flex items-center justify-between px-5 active:bg-red-700 transition-colors pointer-events-auto"
          >
            <span className="bg-red-500 rounded-lg px-2.5 py-1 font-bold text-sm min-w-[32px] text-center">
              {cartCount}
            </span>
            <span className="font-bold text-base">Ver Carrinho</span>
            <span className="font-bold text-base">{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      {/* ===== BOTÃO FINALIZAR PEDIDO (aba carrinho) ===== */}
      {activeTab === "cart" && cart.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 pt-2 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" style={{ zIndex: 25 }}>
          <button
            onClick={() => {
              localStorage.setItem(`cart_${sessionId}`, JSON.stringify(cart));
              localStorage.setItem(`deliveryType_${sessionId}`, deliveryType || "delivery");
              setLocation(`/pedido/${sessionId}/checkout`);
            }}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-xl flex items-center justify-between px-5 active:bg-red-700 transition-colors pointer-events-auto"
          >
            <ChevronRight className="w-5 h-5 opacity-0" />
            <span className="font-bold text-base">Finalizar Pedido</span>
            <span className="font-bold text-base">{formatPrice(total)}</span>
          </button>
        </div>
      )}

      {/* ===== MODAL ALTERAR TIPO DE PEDIDO ===== */}
      {showDeliveryModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowDeliveryModal(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h3 className="font-bold text-gray-900 text-base mb-4 text-center">Como quer receber seu pedido?</h3>

            <div className="space-y-3">
              {/* Delivery */}
              <button
                onClick={() => { setDeliveryType("delivery"); setShowDeliveryModal(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                  deliveryType === "delivery"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 active:border-gray-200"
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                  deliveryType === "delivery" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  <Bike className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-sm">Entrega (Delivery)</p>
                  <p className="text-xs text-gray-500 mt-0.5">Receba no seu endereço · Taxa R$ 8,50</p>
                </div>
                {deliveryType === "delivery" && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Retirada */}
              <button
                onClick={() => { setDeliveryType("pickup"); setShowDeliveryModal(false); }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                  deliveryType === "pickup"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-100 bg-gray-50 active:border-gray-200"
                }`}
              >
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                  deliveryType === "pickup" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900 text-sm">Retirada no local</p>
                  <p className="text-xs text-gray-500 mt-0.5">Retire no restaurante · Grátis</p>
                </div>
                {deliveryType === "pickup" && (
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DRAWER DE DETALHES DO ITEM ===== */}
      {selectedItem && (
        <ItemDrawer
          item={selectedItem}
          addonGroups={addonGroups as AddonGroup[]}
          loadingAddons={loadingAddons}
          onClose={closeItem}
          onAdd={addToCart}
        />
      )}
    </div>
  );
}
