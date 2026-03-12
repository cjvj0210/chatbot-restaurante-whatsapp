import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Users, Search, Phone, MapPin, Calendar, ShoppingBag, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    // 5517988112791 → (17) 9 8811-2791
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Customers() {
  const { data: customers, isLoading } = trpc.customers.list.useQuery();
  const [search, setSearch] = useState("");

  const filtered = (customers ?? []).filter((c) => {
    const q = search.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.address ?? "").toLowerCase().includes(q)
    );
  });

  const totalCustomers = customers?.length ?? 0;
  const totalRevenue = customers?.reduce((sum, c) => sum + c.totalSpent, 0) ?? 0;
  const totalOrders = customers?.reduce((sum, c) => sum + c.totalOrders, 0) ?? 0;
  const withBirthday = customers?.filter((c) => c.birthDate).length ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todos os clientes cadastrados no sistema
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Total</p>
          <p className="text-2xl font-bold">{totalCustomers}</p>
          <p className="text-xs text-muted-foreground mt-1">Clientes cadastrados</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pedidos</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de pedidos</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Faturamento</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total acumulado</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Aniversários</p>
          <p className="text-2xl font-bold text-cyan-600">{withBirthday}</p>
          <p className="text-xs text-muted-foreground mt-1">Com data cadastrada</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou endereço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Telefone</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Endereço</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Aniversário</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Pedidos</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Total Gasto</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-8 ml-auto" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                      <td className="px-5 py-3 text-right hidden lg:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{search ? "Nenhum cliente encontrado para esta busca" : "Nenhum cliente cadastrado ainda"}</p>
                      </td>
                    </tr>
                  )
                : filtered.map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {(customer.name ?? "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{customer.name ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{formatPhone(customer.phone)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {customer.address ? (
                          <div className="flex items-start gap-1.5 text-muted-foreground max-w-xs">
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="truncate text-xs">{customer.address}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {customer.birthDate ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{customer.birthDate}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                          <span className="font-medium">{customer.totalOrders}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${customer.totalSpent > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                          {formatCurrency(customer.totalSpent)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatDate(customer.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Exibindo {filtered.length} de {totalCustomers} cliente{totalCustomers !== 1 ? "s" : ""}
              {search && ` para "${search}"`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
