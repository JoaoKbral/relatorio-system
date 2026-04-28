"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PlusCircle, Trash2 } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "MEMBER" | "ADMIN";
  active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  MEMBER: "Membro",
  ADMIN: "Administrador",
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "MEMBER" as "MEMBER" | "ADMIN",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/usuarios");
      if (res.status === 403) {
        toast.error("Acesso restrito a administradores.");
        return;
      }
      setUsers(await res.json());
    } catch {
      toast.error("Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.name} adicionado(a).`);
        setNewForm({ name: "", email: "", password: "", role: "MEMBER" });
        setShowNew(false);
        load();
      } else {
        toast.error(data.error ?? "Erro ao criar usuário.");
      }
    } catch {
      toast.error("Erro ao conectar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user: User, role: "MEMBER" | "ADMIN") {
    const res = await fetch(`/api/usuarios/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      toast.success("Permissão atualizada.");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    } else {
      toast.error("Erro ao atualizar permissão.");
    }
  }

  async function handleToggleActive(user: User) {
    const res = await fetch(`/api/usuarios/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      const label = user.active ? "desativado(a)" : "ativado(a)";
      toast.success(`${user.name} ${label}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u))
      );
    } else {
      toast.error("Erro ao atualizar status.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/usuarios/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      toast.success(`${deleteTarget.name} removido(a).`);
      setDeleteTarget(null);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Erro ao remover usuário.");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold flex-1">Usuários</h1>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <PlusCircle className="w-4 h-4 mr-1" />
          Novo usuário
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Carregando...</p>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Nenhum usuário encontrado.</p>
      ) : (
        <div className="flex flex-col divide-y border rounded-lg overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${!u.active ? "text-gray-400 line-through" : ""}`}>
                  {u.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u, e.target.value as "MEMBER" | "ADMIN")}
                  className="text-xs border rounded px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="MEMBER">Membro</option>
                  <option value="ADMIN">Administrador</option>
                </select>

                <Button
                  variant="outline"
                  size="sm"
                  className={u.active ? "text-yellow-600" : "text-green-600"}
                  onClick={() => handleToggleActive(u)}
                >
                  {u.active ? "Desativar" : "Ativar"}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setDeleteTarget(u)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New user dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um membro ou administrador à sua igreja
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="flex flex-col gap-3 mt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newName">Nome *</Label>
              <Input
                id="newName"
                value={newForm.name}
                onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newEmail">E-mail *</Label>
              <Input
                id="newEmail"
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">Senha *</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={newForm.password}
                onChange={(e) => setNewForm((p) => ({ ...p, password: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newRole">Permissão</Label>
              <select
                id="newRole"
                value={newForm.role}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, role: e.target.value as "MEMBER" | "ADMIN" }))
                }
                className="border rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={saving}
              >
                <option value="MEMBER">Membro</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowNew(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Salvando…" : "Adicionar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar{" "}
              <strong>{deleteTarget?.name}</strong>? O acesso será revogado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
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
