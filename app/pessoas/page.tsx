"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Person {
  id: number;
  name: string;
  roles: string[];
  active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  pastor: "Pastor",
  diacono: "Diácono",
  membro: "Membro",
  lider: "Líder",
};

const ROLE_COLORS: Record<string, string> = {
  pastor: "bg-purple-100 text-purple-700",
  diacono: "bg-blue-100 text-blue-700",
  membro: "bg-yellow-100 text-yellow-700",
  lider: "bg-orange-100 text-orange-700",
};

const ROLE_BUTTONS = [
  { id: "diacono", label: "Diácono" },
  { id: "lider", label: "Líder" },
  { id: "pastor", label: "Pastor" },
];

export default function PessoasPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  async function load(role: string | null, name: string) {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (name) params.set("q", name);
    if (role) params.set("role", role);
    const res = await fetch(`/api/pessoas?${params}`);
    setPeople(await res.json());
    setLoading(false);
  }

  function handleRoleClick(roleId: string) {
    const next = activeRole === roleId ? null : roleId;
    setActiveRole(next);
    load(next, query);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") load(activeRole, query);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/pessoas/${deleteTarget.id}`, { method: "DELETE" });
    toast.success(`${deleteTarget.name} removido(a).`);
    setDeleteTarget(null);
    load(activeRole, query);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold flex-1">Gerenciar Pessoas</h1>
        <Link
          href="/pessoas/nova"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <PlusCircle className="w-4 h-4 mr-1" />
          Adicionar
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nome e pressionar Enter..."
          className="pl-9"
        />
      </div>

      {/* Role filter buttons */}
      <div className="flex gap-2">
        {ROLE_BUTTONS.map((r) => (
          <Button
            key={r.id}
            variant={activeRole === r.id ? "default" : "outline"}
            size="sm"
            onClick={() => handleRoleClick(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* List */}
      {!searched ? (
        <p className="text-center text-gray-400 py-8">
          Selecione uma categoria ou busque por nome.
        </p>
      ) : loading ? (
        <p className="text-center text-gray-400 py-8">Carregando...</p>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-gray-400">Nenhuma pessoa encontrada.</p>
          {query && (
            <Link
              href={`/pessoas/nova?name=${encodeURIComponent(query.toUpperCase())}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Adicionar &ldquo;{query.toUpperCase()}&rdquo;
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.roles.map((r) => (
                    <span
                      key={r}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                  {p.roles.length === 0 && (
                    <span className="text-xs text-gray-400">Sem categoria</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/pessoas/${p.id}/editar`}
                  className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                >
                  <Pencil className="w-4 h-4" />
                </Link>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setDeleteTarget(p)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover pessoa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>?
              Ela não aparecerá mais nas sugestões.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
