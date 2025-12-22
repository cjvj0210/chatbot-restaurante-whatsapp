import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Plus, Minus, X, Clock, MapPin } from "lucide-react";


interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  observations?: string;
}

export default function Pedido() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();

  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemObservations, setItemObservations] = useState("");

  // Validar sessão
  const { data: validation, isLoading: validating } = trpc.orderLink.validate.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  // Buscar categorias e itens do menu
  const { data: categories, isLoading: loadingCategories } = trpc.menu.listCategories.useQuery();
  const { data: menuItems, isLoading: loadingItems } = trpc.menu.listItems.useQuery();

  // Verificar se sessão é válida
  useEffect(() => {
    if (validation && !validation.valid) {
      // Link inválido - redirecionar para home
      setTimeout(() => setLocation("/"), 3000);
    }
  }, [validation, setLocation]);

  const addToCart = (item: { id: number; name: string; price: number; observations?: string }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, observations: item.observations }];
    });
    // Item adicionado ao carrinho
  };

  const removeFromCart = (menuItemId: number) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.menuItemId === menuItemId) {
          const newQuantity = i.quantity + delta;
          return newQuantity > 0 ? { ...i, quantity: newQuantity } : i;
        }
        return i;
      }).filter((i) => i.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 700; // R$ 7,00
  const total = subtotal + deliveryFee;

  if (validating || loadingCategories || loadingItems) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!validation?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>Este link de pedido não é mais válido.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Solicite um novo link de pedido através do nosso WhatsApp.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categorizedItems = categories?.map((category) => ({
    ...category,
    items: menuItems?.filter((item) => item.categoryId === category.id && item.isAvailable) || [],
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">🥩 Churrascaria Estrela do Sul</h1>
          <p className="text-orange-100">Escolha seus itens favoritos e finalize seu pedido!</p>
        </div>
      </div>

      {/* Cardápio */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {categorizedItems.map((category) => (
          category.items.length > 0 && (
            <div key={category.id} className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {category.name}
                <Badge variant="secondary">{category.items.length} itens</Badge>
              </h2>
              {category.description && (
                <p className="text-gray-600">{category.description}</p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {category.items.map((item) => (
                  <Card 
                    key={item.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedItem(item);
                      setItemObservations("");
                    }}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          {item.description && (
                            <CardDescription className="mt-1">{item.description}</CardDescription>
                          )}
                        </div>
                        <Badge className="ml-2 bg-green-600">
                          R$ {(item.price / 100).toFixed(2)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {item.preparationTime || 30} min
                      </div>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                          setItemObservations("");
                        }}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Carrinho Flutuante */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
                <span className="font-semibold">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCart(!showCart)}
              >
                {showCart ? 'Ocultar' : 'Ver carrinho'}
              </Button>
            </div>

            {showCart && (
              <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.menuItemId} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-600">R$ {(item.price / 100).toFixed(2)}</p>
                      {item.observations && (
                        <p className="text-xs text-orange-600 italic mt-1">Obs: {item.observations}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-red-600"
                        onClick={() => removeFromCart(item.menuItemId)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-orange-600">R$ {(total / 100).toFixed(2)}</p>
              </div>
              <Button 
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  // Salvar carrinho no localStorage antes de ir para checkout
                  localStorage.setItem(`cart_${sessionId}`, JSON.stringify(cart));
                  setLocation(`/pedido/${sessionId}/checkout`);
                }}
              >
                Finalizar Pedido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Item */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedItem.name}</DialogTitle>
                <DialogDescription>
                  {selectedItem.description || "Delicioso prato da nossa churrascaria"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Preço e tempo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5" />
                    <span>Tempo de preparo: {selectedItem.preparationTime || 30} min</span>
                  </div>
                  <Badge className="text-lg px-4 py-2 bg-green-600">
                    R$ {(selectedItem.price / 100).toFixed(2)}
                  </Badge>
                </div>

                {/* Campo de observações */}
                <div className="space-y-2">
                  <Label htmlFor="observations">Observações (opcional)</Label>
                  <Textarea
                    id="observations"
                    placeholder="Ex: Sem cebola, mal passado, ponto da carne, etc..."
                    value={itemObservations}
                    onChange={(e) => setItemObservations(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    Adicione aqui preferências sobre o preparo, ingredientes que deseja remover, ponto da carne, etc.
                  </p>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedItem(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-orange-600 hover:bg-orange-700"
                  onClick={() => {
                    addToCart({ 
                      id: selectedItem.id, 
                      name: selectedItem.name, 
                      price: selectedItem.price,
                      observations: itemObservations || undefined
                    });
                    setSelectedItem(null);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar ao Carrinho
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
