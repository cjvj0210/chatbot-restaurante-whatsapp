import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UtensilsCrossed,
  Plus,
  Trash2,
  Clock,
  Tag,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  FolderOpen,
  Settings2,
  GripVertical,
  X,
  Check,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Estado para modal de complementos
  const [addonItemId, setAddonItemId] = useState<number | null>(null);
  const [addonItemName, setAddonItemName] = useState<string>("");
  const [addonDialogOpen, setAddonDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMin, setNewGroupMin] = useState(0);
  const [newGroupMax, setNewGroupMax] = useState(1);
  const [addingGroupId, setAddingGroupId] = useState<number | null>(null);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionDesc, setNewOptionDesc] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("");

  // Estado para edição inline de opção de complemento
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionDesc, setEditOptionDesc] = useState("");
  const [editOptionPrice, setEditOptionPrice] = useState("");

  const utils = trpc.useUtils();
  const { data: categories, isLoading: categoriesLoading } = trpc.menuCategories.list.useQuery();
  const { data: items, isLoading: itemsLoading } = trpc.menuItems.list.useQuery(
    selectedCategory ? { categoryId: selectedCategory } : undefined
  );

  const createCategory = trpc.menuCategories.create.useMutation({
    onSuccess: () => {
      utils.menuCategories.list.invalidate();
      setCategoryDialogOpen(false);
      toast.success("Categoria criada!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const createItem = trpc.menuItems.create.useMutation({
    onSuccess: () => {
      utils.menuItems.list.invalidate();
      setItemDialogOpen(false);
      setImagePreview(null);
      setImageUrl(null);
      toast.success("Item criado!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteItem = trpc.menuItems.delete.useMutation({
    onSuccess: () => {
      utils.menuItems.list.invalidate();
      toast.success("Item removido!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const uploadImage = trpc.upload.uploadMenuItemImage.useMutation({
    onSuccess: (data) => {
      setImageUrl(data.url);
      toast.success("Imagem enviada!");
      setUploadingImage(false);
    },
    onError: (error) => {
      toast.error(`Erro ao enviar imagem: ${error.message}`);
      setUploadingImage(false);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máx: 5MB"); return; }

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingImage(true);
    const base64 = await new Promise<string>((resolve) => {
      const r2 = new FileReader();
      r2.onload = () => resolve(r2.result as string);
      r2.readAsDataURL(file);
    });
    uploadImage.mutate({ fileName: file.name, fileData: base64, mimeType: file.type });
  };

  const handleCreateCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createCategory.mutate({
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      displayOrder: 0,
    });
  };

  const handleCreateItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCategory) { toast.error("Selecione uma categoria primeiro!"); return; }
    const fd = new FormData(e.currentTarget);
    const isAvailable = (e.currentTarget.querySelector("#isAvailable") as HTMLButtonElement)?.getAttribute("data-state") === "checked";
    createItem.mutate({
      categoryId: selectedCategory,
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      price: Math.round(parseFloat(fd.get("price") as string) * 100),
      imageUrl: imageUrl || undefined,
      preparationTime: parseInt(fd.get("preparationTime") as string) || 30,
    });
  };

  const selectedCategoryName = categories?.find((c) => c.id === selectedCategory)?.name;

  // Queries e mutations de complementos
  const { data: addonGroups, refetch: refetchAddons } = trpc.menuAddons.getByItem.useQuery(
    { menuItemId: addonItemId || 0 },
    { enabled: !!addonItemId && addonDialogOpen }
  );

  const createAddonGroup = trpc.menuAddons.createGroup.useMutation({
    onSuccess: () => { refetchAddons(); setNewGroupName(""); setNewGroupRequired(false); setNewGroupMin(0); setNewGroupMax(1); toast.success("Grupo criado!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteAddonGroup = trpc.menuAddons.deleteGroup.useMutation({
    onSuccess: () => { refetchAddons(); toast.success("Grupo removido!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const createAddonOption = trpc.menuAddons.createOption.useMutation({
    onSuccess: () => { refetchAddons(); setNewOptionName(""); setNewOptionDesc(""); setNewOptionPrice(""); setAddingGroupId(null); toast.success("Opção adicionada!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteAddonOption = trpc.menuAddons.deleteOption.useMutation({
    onSuccess: () => { refetchAddons(); toast.success("Opção removida!"); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateAddonOption = trpc.menuAddons.updateOption.useMutation({
    onSuccess: () => {
      refetchAddons();
      setEditingOptionId(null);
      setEditOptionName("");
      setEditOptionDesc("");
      setEditOptionPrice("");
      toast.success("Opção atualizada!");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const startEditOption = (opt: { id: number; name: string; description?: string | null; priceExtra: number }) => {
    setEditingOptionId(opt.id);
    setEditOptionName(opt.name);
    setEditOptionDesc(opt.description || "");
    setEditOptionPrice((opt.priceExtra / 100).toFixed(2));
  };

  const cancelEditOption = () => {
    setEditingOptionId(null);
    setEditOptionName("");
    setEditOptionDesc("");
    setEditOptionPrice("");
  };

  const openAddonDialog = (itemId: number, itemName: string) => {
    setAddonItemId(itemId);
    setAddonItemName(itemName);
    setAddonDialogOpen(true);
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-primary" />
            Cardápio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie categorias e itens do cardápio digital
          </p>
        </div>
        <button
          onClick={() => setCategoryDialogOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* ===== SIDEBAR DE CATEGORIAS ===== */}
        <div className="md:col-span-1">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categorias
              </p>
            </div>
            <div className="p-2">
              {categoriesLoading ? (
                <div className="space-y-1.5 p-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              ) : !categories?.length ? (
                <div className="py-8 text-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma categoria</p>
                  <button
                    onClick={() => setCategoryDialogOpen(true)}
                    className="text-xs text-primary font-medium mt-1 hover:underline"
                  >
                    Criar primeira
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedCategory === cat.id
                          ? "bg-primary text-white"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${selectedCategory === cat.id ? "text-white/70" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== ÁREA DE ITENS ===== */}
        <div className="md:col-span-3">
          <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {selectedCategoryName ? `Itens — ${selectedCategoryName}` : "Itens do Cardápio"}
                </p>
                {items && selectedCategory && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {selectedCategory && (
                <button
                  onClick={() => setItemDialogOpen(true)}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Novo Item
                </button>
              )}
            </div>

            <div className="p-4">
              {!selectedCategory ? (
                <div className="py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">Selecione uma categoria</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Clique em uma categoria à esquerda para ver os itens
                  </p>
                </div>
              ) : itemsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/50 p-4">
                      <div className="flex gap-3">
                        <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-28 mb-2" />
                          <Skeleton className="h-3 w-full mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !items?.length ? (
                <div className="py-16 text-center">
                  <Tag className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="font-semibold text-muted-foreground">Nenhum item ainda</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Clique em "Novo Item" para adicionar o primeiro
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 flex gap-3 transition-all hover:shadow-sm ${
                        item.isAvailable ? "border-border/50" : "border-border/30 opacity-60"
                      }`}
                    >
                      {/* Foto */}
                      <div className="w-16 h-16 rounded-xl bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">🍖</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openAddonDialog(item.id, item.name)}
                              title="Gerenciar complementos"
                              className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remover "${item.name}"?`)) {
                                  deleteItem.mutate({ id: item.id });
                                }
                              }}
                              className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-sm font-bold text-primary">
                            R$ {(item.price / 100).toFixed(2).replace(".", ",")}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {item.preparationTime}min
                          </span>
                          {!item.isAvailable && (
                            <span className="text-xs text-red-500 font-medium">Indisponível</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL NOVA CATEGORIA ===== */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name" className="text-sm font-medium">Nome da Categoria</Label>
              <Input id="cat-name" name="name" placeholder="Ex: Entradas, Pratos Principais..." className="rounded-xl" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc" className="text-sm font-medium">Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea id="cat-desc" name="description" placeholder="Breve descrição da categoria" className="rounded-xl resize-none" rows={2} />
            </div>
            <button
              type="submit"
              disabled={createCategory.isPending}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createCategory.isPending ? "Criando..." : "Criar Categoria"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL COMPLEMENTOS ===== */}
      <Dialog open={addonDialogOpen} onOpenChange={(open) => {
        setAddonDialogOpen(open);
        if (!open) { setAddonItemId(null); setAddingGroupId(null); setNewGroupName(""); }
      }}>
        <DialogContent className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Complementos — {addonItemName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Adicionar novo grupo */}
            <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
              <p className="text-sm font-semibold text-foreground mb-3">Novo Grupo de Complementos</p>
              <div className="space-y-3">
                <Input
                  placeholder="Nome do grupo (ex: Escolha o ponto da carne)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="rounded-xl text-sm"
                />
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mínimo</Label>
                    <Input type="number" min={0} value={newGroupMin} onChange={(e) => setNewGroupMin(parseInt(e.target.value) || 0)} className="rounded-xl text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Máximo</Label>
                    <Input type="number" min={1} value={newGroupMax} onChange={(e) => setNewGroupMax(parseInt(e.target.value) || 1)} className="rounded-xl text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Obrigatório?</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch checked={newGroupRequired} onCheckedChange={setNewGroupRequired} />
                      <span className="text-xs text-muted-foreground">{newGroupRequired ? "Sim" : "Não"}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!newGroupName.trim() || !addonItemId) return;
                    createAddonGroup.mutate({
                      menuItemId: addonItemId,
                      name: newGroupName.trim(),
                      isRequired: newGroupRequired,
                      minSelections: newGroupMin,
                      maxSelections: newGroupMax,
                      displayOrder: (addonGroups?.length || 0) + 1,
                    });
                  }}
                  disabled={!newGroupName.trim() || createAddonGroup.isPending}
                  className="w-full bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createAddonGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Criar Grupo
                </button>
              </div>
            </div>

            {/* Lista de grupos existentes */}
            {!addonGroups?.length ? (
              <div className="py-8 text-center text-muted-foreground">
                <Settings2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum grupo de complementos ainda</p>
                <p className="text-xs mt-1">Crie o primeiro grupo acima</p>
              </div>
            ) : (
              <div className="space-y-4">
                {addonGroups.map((group) => (
                  <div key={group.id} className="border border-border/50 rounded-xl overflow-hidden">
                    {/* Cabeçalho do grupo */}
                    <div className="bg-muted/30 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.isRequired ? "Obrigatório" : "Opcional"} · 
                            {group.maxSelections === 1 ? " 1 opção" : ` até ${group.maxSelections} opções`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAddingGroupId(addingGroupId === group.id ? null : group.id)}
                          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Adicionar opção"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Remover grupo "${group.name}" e todas as opções?`)) deleteAddonGroup.mutate({ id: group.id }); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Opções do grupo */}
                    <div className="divide-y divide-border/30">
                      {group.options.map((opt) => (
                        <div key={opt.id}>
                          {editingOptionId === opt.id ? (
                            /* Formulário de edição inline */
                            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 space-y-2">
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Editar Opção</p>
                              <Input
                                placeholder="Nome da opção"
                                value={editOptionName}
                                onChange={(e) => setEditOptionName(e.target.value)}
                                className="rounded-xl text-sm"
                              />
                              <Input
                                placeholder="Descrição (opcional)"
                                value={editOptionDesc}
                                onChange={(e) => setEditOptionDesc(e.target.value)}
                                className="rounded-xl text-sm"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Preço extra R$ (0 = gratuito)"
                                value={editOptionPrice}
                                onChange={(e) => setEditOptionPrice(e.target.value)}
                                className="rounded-xl text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (!editOptionName.trim()) return;
                                    updateAddonOption.mutate({
                                      id: opt.id,
                                      name: editOptionName.trim(),
                                      description: editOptionDesc.trim() || undefined,
                                      priceExtra: Math.round(parseFloat(editOptionPrice || "0") * 100),
                                    });
                                  }}
                                  disabled={!editOptionName.trim() || updateAddonOption.isPending}
                                  className="flex-1 bg-amber-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {updateAddonOption.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Salvar
                                </button>
                                <button
                                  onClick={cancelEditOption}
                                  className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Exibição normal com botões de editar e deletar */
                            <div className="px-4 py-3 flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{opt.name}</p>
                                {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
                                {opt.priceExtra > 0 && (
                                  <p className="text-xs text-primary font-semibold mt-0.5">+ R$ {(opt.priceExtra / 100).toFixed(2).replace(".", ",")}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-3 shrink-0">
                                <button
                                  onClick={() => startEditOption(opt)}
                                  className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-muted-foreground hover:text-amber-600 transition-colors"
                                  title="Editar opção"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { if (confirm(`Remover opção "${opt.name}"?`)) deleteAddonOption.mutate({ id: opt.id }); }}
                                  className="p-1 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                                  title="Remover opção"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Formulário de nova opção */}
                    {addingGroupId === group.id && (
                      <div className="px-4 py-3 bg-primary/5 border-t border-border/30 space-y-2">
                        <p className="text-xs font-semibold text-primary">Nova Opção</p>
                        <Input
                          placeholder="Nome da opção (ex: Bem passado)"
                          value={newOptionName}
                          onChange={(e) => setNewOptionName(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <Input
                          placeholder="Descrição (opcional)"
                          value={newOptionDesc}
                          onChange={(e) => setNewOptionDesc(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Preço extra R$ (0 = gratuito)"
                          value={newOptionPrice}
                          onChange={(e) => setNewOptionPrice(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!newOptionName.trim()) return;
                              createAddonOption.mutate({
                                groupId: group.id,
                                name: newOptionName.trim(),
                                description: newOptionDesc.trim() || undefined,
                                priceExtra: Math.round(parseFloat(newOptionPrice || "0") * 100),
                                displayOrder: group.options.length + 1,
                              });
                            }}
                            disabled={!newOptionName.trim() || createAddonOption.isPending}
                            className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {createAddonOption.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Adicionar
                          </button>
                          <button
                            onClick={() => { setAddingGroupId(null); setNewOptionName(""); setNewOptionDesc(""); setNewOptionPrice(""); }}
                            className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL NOVO ITEM ===== */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => {
        setItemDialogOpen(open);
        if (!open) { setImagePreview(null); setImageUrl(null); }
      }}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Item — {selectedCategoryName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateItem} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-name" className="text-sm font-medium">Nome do Item</Label>
              <Input id="item-name" name="name" placeholder="Ex: Picanha na Brasa" className="rounded-xl" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="item-desc" className="text-sm font-medium">Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea id="item-desc" name="description" placeholder="Ingredientes, modo de preparo..." className="rounded-xl resize-none" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-sm font-medium">Preço (R$)</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0" placeholder="0,00" className="rounded-xl" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preparationTime" className="text-sm font-medium">Preparo (min)</Label>
                <Input id="preparationTime" name="preparationTime" type="number" min="1" defaultValue="30" className="rounded-xl" />
              </div>
            </div>

            {/* Upload de imagem */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                Foto do Item <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <label className={`flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                imagePreview ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
              }`}>
                {uploadingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground">Clique para adicionar foto</span>
                    <span className="text-xs text-muted-foreground/60">JPG, PNG até 5MB</span>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
              </label>
            </div>

            {/* Disponibilidade */}
            <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Disponível no cardápio</p>
                <p className="text-xs text-muted-foreground">Exibir para clientes</p>
              </div>
              <Switch id="isAvailable" defaultChecked={true} />
            </div>

            <button
              type="submit"
              disabled={createItem.isPending || uploadingImage}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createItem.isPending ? "Criando..." : "Adicionar Item"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
