import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Search, X, Plus, Minus, Trash2, ChevronRight, MapPin, Clock, Star } from "lucide-react";

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
  price: number; // preço base + addons
  basePrice: number; // preço base sem addons
  quantity: number;
  observations?: string;
  imageUrl?: string;
  addons?: SelectedAddon[];
}

type Tab = "menu" | "cart";

export default function Pedido() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("menu");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemObservations, setItemObservations] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Record<number, SelectedAddon[]>>({}); // groupId -> selected options

  // Buscar complementos do item selecionado
  const { data: addonGroups, isLoading: loadingAddons } = trpc.menuAddons.getByItem.useQuery(
    { menuItemId: selectedItem?.id || 0 },
    { enabled: !!selectedItem?.id }
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const categoryRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Validar sessão
  const { data: validation, isLoading: validating } = trpc.orderLink.validate.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  // Buscar categorias e itens do menu
  const { data: categories, isLoading: loadingCategories } = trpc.menu.listCategories.useQuery();
  const { data: menuItems, isLoading: loadingItems } = trpc.menu.listItems.useQuery();

  // Buscar configurações do restaurante
  const { data: settings } = trpc.restaurant.getSettings.useQuery();

  useEffect(() => {
    if (validation && !validation.valid) {
      setTimeout(() => setLocation("/"), 3000);
    }
  }, [validation, setLocation]);

  // Definir categoria ativa inicial
  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const categorizedItems = (categories || []).map((category) => ({
    ...category,
    items: (menuItems || []).filter((item) => item.categoryId === category.id && item.isAvailable),
  })).filter((c) => c.items.length > 0);

  // Filtro de busca
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
    if (el && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const offset = el.offsetTop - 130; // header + tabs height
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  // Detectar categoria ativa ao scrollar
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const scrollTop = scrollContainerRef.current.scrollTop + 140;
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
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const addToCart = (item: any, qty: number, obs?: string, addons?: SelectedAddon[]) => {
    const addonsExtra = (addons || []).reduce((sum, a) => sum + a.priceExtra, 0);
    const totalPrice = item.price + addonsExtra;
    setCart((prev) => [
      ...prev,
      {
        menuItemId: item.id,
        name: item.name,
        price: totalPrice,
        basePrice: item.price,
        quantity: qty,
        observations: obs || undefined,
        imageUrl: item.imageUrl || undefined,
        addons: addons && addons.length > 0 ? addons : undefined,
      },
    ]);
  };

  // Validar se todos os grupos obrigatórios foram preenchidos
  const validateAddons = (groups: AddonGroup[]): string | null => {
    for (const group of groups) {
      const selected = selectedAddons[group.id] || [];
      if (group.isRequired && selected.length < group.minSelections) {
        return `Escolha ${group.minSelections === 1 ? 'uma opção' : `${group.minSelections} opções`} em "${group.name}"`;
      }
    }
    return null;
  };

  const toggleAddon = (group: AddonGroup, option: AddonOption) => {
    setSelectedAddons((prev) => {
      const current = prev[group.id] || [];
      const isSelected = current.some((a) => a.optionId === option.id);

      if (group.maxSelections === 1) {
        // Radio: substitui a seleção
        if (isSelected) return { ...prev, [group.id]: [] };
        return {
          ...prev,
          [group.id]: [{ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, priceExtra: option.priceExtra }],
        };
      } else {
        // Checkbox: adiciona/remove, respeitando o máximo
        if (isSelected) {
          return { ...prev, [group.id]: current.filter((a) => a.optionId !== option.id) };
        }
        if (current.length >= group.maxSelections) return prev; // já no máximo
        return {
          ...prev,
          [group.id]: [...current, { groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, priceExtra: option.priceExtra }],
        };
      }
    });
  };

  const removeFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 850; // R$ 8,50
  const total = subtotal + deliveryFee;

  const formatPrice = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

  // Loading
  if (validating || loadingCategories || loadingItems) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto">
        <div className="h-14 bg-red-600" />
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

  const restaurantName = settings?.name || "Churrascaria Estrela do Sul";

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto relative flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ===== HEADER ===== */}
      <div className="bg-red-700 text-white sticky top-0 z-30 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
              🥩
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">{restaurantName}</h1>
              <div className="flex items-center gap-1 text-xs text-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                <span>Aberto agora</span>
                <span className="mx-1">·</span>
                <span>Pedido mín. {formatPrice(3000)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("cart")}
              className="relative p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-red-800 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Barra de busca */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="O que você quer comer hoje?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-full bg-white text-gray-800 text-sm placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-300"
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

      {/* ===== TABS: MENU / CARRINHO ===== */}
      <div className="sticky top-[108px] z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex">
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "menu"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-500"
            }`}
          >
            Cardápio
          </button>
          <button
            onClick={() => setActiveTab("cart")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === "cart"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-500"
            }`}
          >
            Carrinho
            {cartCount > 0 && (
              <span className="bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      {activeTab === "menu" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navegação por categorias */}
          {!searchQuery && (
            <div className="bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide sticky top-[152px] z-10">
              <div className="flex px-4 py-2 gap-2 min-w-max">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                      activeCategoryId === cat.id
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de itens */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto pb-24"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            {filteredCategories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-base font-medium">Nenhum item encontrado</p>
                <p className="text-sm mt-1">Tente outro termo de busca</p>
              </div>
            )}

            {filteredCategories.map((category) => (
              <div
                key={category.id}
                ref={(el) => { categoryRefs.current[category.id] = el; }}
              >
                {/* Título da categoria */}
                <div className="px-4 pt-5 pb-2">
                  <h2 className="text-base font-bold text-gray-800">{category.name}</h2>
                  {category.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{category.description}</p>
                  )}
                </div>

                {/* Cards de itens */}
                <div className="divide-y divide-gray-50">
                  {category.items.map((item) => {
                    const inCart = cart.find((c) => c.menuItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setItemObservations("");
                          setItemQty(1);
                        }}
                        className="w-full px-4 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {/* Texto */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-red-600 font-bold text-sm">
                              {formatPrice(item.price)}
                            </span>
                            {inCart && (
                              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                                {inCart.quantity}x no carrinho
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Foto + botão adicionar */}
                        <div className="relative flex-shrink-0">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-24 h-24 object-cover rounded-xl"
                            />
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-3xl">
                              🍖
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center shadow-md">
                            <Plus className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Espaço extra no final */}
            <div className="h-8" />
          </div>
        </div>
      ) : (
        /* ===== ABA CARRINHO ===== */
        <div className="flex-1 overflow-y-auto pb-32">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 px-6">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-semibold text-gray-600">Seu carrinho está vazio</p>
              <p className="text-sm mt-1 text-center">Adicione itens do cardápio para continuar</p>
              <button
                onClick={() => setActiveTab("menu")}
                className="mt-6 px-6 py-3 bg-red-600 text-white rounded-full font-semibold text-sm hover:bg-red-700 transition-colors"
              >
                Ver Cardápio
              </button>
            </div>
          ) : (
            <div>
              {/* Itens do carrinho */}
              <div className="px-4 pt-4 pb-2">
                <h2 className="font-bold text-gray-800 text-base mb-3">Seu Pedido</h2>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={`${item.menuItemId}-${item.observations}`}
                      className="flex items-start gap-3 bg-gray-50 rounded-xl p-3"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-2xl flex-shrink-0">
                          🍖
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                        {item.addons && item.addons.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {item.addons.map((a) => (
                              <p key={a.optionId} className="text-xs text-gray-500">
                                • {a.optionName}{a.priceExtra > 0 ? ` (+${formatPrice(a.priceExtra)})` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.observations && (
                          <p className="text-xs text-orange-600 mt-0.5 italic">Obs: {item.observations}</p>
                        )}
                        <p className="text-red-600 font-bold text-sm mt-1">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateQuantity(item.menuItemId, -1)}
                          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                        >
                          {item.quantity === 1 ? (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                          )}
                        </button>
                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, 1)}
                          className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700"
                        >
                          <Plus className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Adicionar mais itens */}
              <div className="px-4 mt-2">
                <button
                  onClick={() => setActiveTab("menu")}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm font-medium hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar mais itens
                </button>
              </div>

              {/* Resumo de valores */}
              <div className="mx-4 mt-4 bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Taxa de entrega
                  </span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-800">
                  <span>Total</span>
                  <span className="text-red-600 text-lg">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Info de entrega */}
              <div className="mx-4 mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Tempo estimado: 30-50 minutos</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== BOTÃO FLUTUANTE CARRINHO (na aba menu) ===== */}
      {activeTab === "menu" && cartCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40">
          <button
            onClick={() => setActiveTab("cart")}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-5 hover:bg-red-700 transition-colors"
          >
            <span className="bg-red-500 rounded-lg px-2.5 py-1 font-bold text-sm">
              {cartCount} {cartCount === 1 ? "item" : "itens"}
            </span>
            <span className="font-bold text-base">Ver Carrinho</span>
            <span className="font-bold text-base">{formatPrice(subtotal)}</span>
          </button>
        </div>
      )}

      {/* ===== BOTÃO FINALIZAR PEDIDO (na aba carrinho) ===== */}
      {activeTab === "cart" && cart.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40">
          <button
            onClick={() => {
              localStorage.setItem(`cart_${sessionId}`, JSON.stringify(cart));
              setLocation(`/pedido/${sessionId}/checkout`);
            }}
            className="w-full bg-red-600 text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-5 hover:bg-red-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5 opacity-0" />
            <span className="font-bold text-base">Finalizar Pedido</span>
            <span className="font-bold text-base">{formatPrice(total)}</span>
          </button>
        </div>
      )}

      {/* ===== MODAL DE DETALHES DO ITEM ===== */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => {
        if (!open) {
          setSelectedItem(null);
          setSelectedAddons({});
          setItemObservations("");
          setItemQty(1);
        }
      }}>
        <DialogContent className="p-0 max-w-md w-full overflow-hidden rounded-2xl" style={{ maxHeight: "92vh", overflowY: "auto" }}>
          {selectedItem && (() => {
            const groups: AddonGroup[] = addonGroups || [];
            const addonsExtra = Object.values(selectedAddons).flat().reduce((sum, a) => sum + a.priceExtra, 0);
            const totalItemPrice = (selectedItem.price + addonsExtra) * itemQty;

            return (
              <div>
                {/* Foto do item */}
                {selectedItem.imageUrl ? (
                  <div className="w-full h-52 overflow-hidden">
                    <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-orange-100 to-red-200 flex items-center justify-center text-6xl">
                    🍖
                  </div>
                )}

                {/* Nome, preço e descrição */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-800 leading-tight flex-1">{selectedItem.name}</h2>
                    <span className="text-red-600 font-bold text-xl whitespace-nowrap">{formatPrice(selectedItem.price)}</span>
                  </div>
                  {selectedItem.description && (
                    <p className="text-gray-500 text-sm leading-relaxed">{selectedItem.description}</p>
                  )}
                </div>

                {/* Grupos de complementos - estilo iFood */}
                {loadingAddons ? (
                  <div className="px-5 py-4 text-sm text-gray-400">Carregando opções...</div>
                ) : (
                  groups.map((group) => {
                    const selected = selectedAddons[group.id] || [];
                    const isMaxReached = selected.length >= group.maxSelections;
                    return (
                      <div key={group.id}>
                        {/* Cabeçalho do grupo */}
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

                        {/* Opções do grupo */}
                        <div className="divide-y divide-gray-100">
                          {group.options.map((option) => {
                            const isSelected = selected.some((a) => a.optionId === option.id);
                            const isDisabled = !isSelected && isMaxReached;
                            return (
                              <button
                                key={option.id}
                                onClick={() => !isDisabled && toggleAddon(group, option)}
                                disabled={isDisabled}
                                className={`w-full px-5 py-4 flex items-center justify-between text-left transition-colors ${
                                  isDisabled ? "opacity-40" : "hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800">{option.name}</p>
                                  {option.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{option.description}</p>
                                  )}
                                  {option.priceExtra > 0 && (
                                    <p className="text-sm text-red-600 font-semibold mt-0.5">+ {formatPrice(option.priceExtra)}</p>
                                  )}
                                </div>
                                {/* Radio ou Checkbox visual */}
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
                <div className="px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💬</span>
                    <label className="text-sm font-semibold text-gray-700">Alguma observação?</label>
                    <span className="text-xs text-gray-400 ml-auto">{itemObservations.length}/140</span>
                  </div>
                  <Textarea
                    placeholder="Ex: tirar a cebola, maionese à parte etc."
                    value={itemObservations}
                    onChange={(e) => setItemObservations(e.target.value.slice(0, 140))}
                    rows={2}
                    className="resize-none text-sm border-gray-200 focus:border-red-400 focus:ring-red-100"
                  />
                </div>

                {/* Quantidade + Botão adicionar - fixo no bottom */}
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 py-2">
                      <button
                        onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                        className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
                      >
                        <Minus className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <span className="w-6 text-center font-bold text-gray-800">{itemQty}</span>
                      <button
                        onClick={() => setItemQty((q) => q + 1)}
                        className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const error = validateAddons(groups);
                        if (error) { alert(error); return; }
                        const allAddons = Object.values(selectedAddons).flat();
                        addToCart(selectedItem, itemQty, itemObservations || undefined, allAddons);
                        setSelectedItem(null);
                        setSelectedAddons({});
                        setItemObservations("");
                        setItemQty(1);
                      }}
                      className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition-colors"
                    >
                      Adicionar · {formatPrice(totalItemPrice)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
