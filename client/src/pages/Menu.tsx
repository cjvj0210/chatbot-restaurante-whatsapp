import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: categories, isLoading: categoriesLoading } = trpc.menuCategories.list.useQuery();
  const { data: items, isLoading: itemsLoading } = trpc.menuItems.list.useQuery(
    selectedCategory ? { categoryId: selectedCategory } : undefined
  );

  const createCategory = trpc.menuCategories.create.useMutation({
    onSuccess: () => {
      utils.menuCategories.list.invalidate();
      setCategoryDialogOpen(false);
      toast.success("Categoria criada com sucesso!");
    },
  });

  const createItem = trpc.menuItems.create.useMutation({
    onSuccess: () => {
      utils.menuItems.list.invalidate();
      setItemDialogOpen(false);
      toast.success("Item criado com sucesso!");
    },
  });

  const deleteItem = trpc.menuItems.delete.useMutation({
    onSuccess: () => {
      utils.menuItems.list.invalidate();
      toast.success("Item removido com sucesso!");
    },
  });

  const handleCreateCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCategory.mutate({
      name: formData.get("name") as string,
      description: formData.get("description") as string || undefined,
      displayOrder: 0,
    });
  };

  const handleCreateItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCategory) {
      toast.error("Selecione uma categoria primeiro!");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const priceInCents = Math.round(parseFloat(formData.get("price") as string) * 100);
    
    createItem.mutate({
      categoryId: selectedCategory,
      name: formData.get("name") as string,
      description: formData.get("description") as string || undefined,
      price: priceInCents,
      preparationTime: parseInt(formData.get("preparationTime") as string) || 30,
    });
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Cardápio</h1>
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Categoria</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" name="description" />
              </div>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Criando..." : "Criar Categoria"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Categorias */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {categories?.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Itens */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Itens do Cardápio</CardTitle>
              {selectedCategory && (
                <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Item</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateItem} className="space-y-4">
                      <div>
                        <Label htmlFor="item-name">Nome</Label>
                        <Input id="item-name" name="name" required />
                      </div>
                      <div>
                        <Label htmlFor="item-description">Descrição</Label>
                        <Textarea id="item-description" name="description" />
                      </div>
                      <div>
                        <Label htmlFor="price">Preço (R$)</Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="preparationTime">Tempo de Preparo (minutos)</Label>
                        <Input
                          id="preparationTime"
                          name="preparationTime"
                          type="number"
                          min="1"
                          defaultValue="30"
                        />
                      </div>
                      <Button type="submit" disabled={createItem.isPending}>
                        {createItem.isPending ? "Criando..." : "Criar Item"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!selectedCategory ? (
                <p className="text-muted-foreground text-center py-8">
                  Selecione uma categoria para ver os itens
                </p>
              ) : itemsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : items && items.length > 0 ? (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        <p className="text-sm font-medium mt-1">
                          R$ {(item.price / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Preparo: {item.preparationTime} min
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteItem.mutate({ id: item.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum item nesta categoria. Clique em "Novo Item" para adicionar.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
