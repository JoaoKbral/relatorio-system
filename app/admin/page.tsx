"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { PlusCircle, Trash2, ChevronDown, ChevronUp, Pencil } from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "MEMBER" | "ADMIN" | "SUPER_ADMIN";
  active: boolean;
}

interface Church {
  id: number;
  name: string;
  city: string;
  cnpj: string | null;
  pastorName: string | null;
  pastorProntuario: string | null;
  plan: "FREE" | "PAID";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
  _count: { users: number; reports: number };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
};
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-red-100 text-red-700",
};
const ROLE_LABELS: Record<string, string> = {
  MEMBER: "Membro",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const EMPTY_CHURCH_FORM = {
  name: "", city: "", cnpj: "", pastorName: "", pastorProntuario: "",
  status: "ACTIVE", plan: "FREE",
  adminName: "", adminEmail: "", adminPassword: "",
};

const EMPTY_USER_FORM = { name: "", email: "", password: "", role: "MEMBER" };

export default function AdminPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);

  // Users loaded per-church on expand
  const [usersCache, setUsersCache] = useState<Record<number, User[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Church add/edit dialog
  const [churchDialog, setChurchDialog] = useState<{ open: boolean; editing: Church | null }>({ open: false, editing: null });
  const [churchForm, setChurchForm] = useState(EMPTY_CHURCH_FORM);
  const [churchSaving, setChurchSaving] = useState(false);

  // Delete church dialog
  const [deleteChurchTarget, setDeleteChurchTarget] = useState<Church | null>(null);
  const [deleteChurchPending, setDeleteChurchPending] = useState(false);

  // Add user dialog
  const [userDialog, setUserDialog] = useState<{ open: boolean; churchId: number | null }>({ open: false, churchId: null });
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userSaving, setUserSaving] = useState(false);

  // Delete user dialog
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ churchId: number; user: User } | null>(null);
  const [deleteUserPending, setDeleteUserPending] = useState(false);

  async function loadChurches() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/igrejas");
      if (!res.ok) { toast.error("Erro ao carregar igrejas."); return; }
      setChurches(await res.json());
    } catch { toast.error("Erro ao conectar."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadChurches(); }, []);

  async function loadUsers(churchId: number) {
    if (usersCache[churchId] !== undefined) return;
    setLoadingUsers(prev => new Set(prev).add(churchId));
    try {
      const res = await fetch(`/api/admin/igrejas/${churchId}/usuarios`);
      if (!res.ok) { toast.error("Erro ao carregar usuários."); return; }
      const users: User[] = await res.json();
      setUsersCache(prev => ({ ...prev, [churchId]: users }));
    } catch { toast.error("Erro ao conectar."); }
    finally {
      setLoadingUsers(prev => { const s = new Set(prev); s.delete(churchId); return s; });
    }
  }

  function toggleExpand(churchId: number) {
    const next = new Set(expanded);
    if (next.has(churchId)) {
      next.delete(churchId);
    } else {
      next.add(churchId);
      loadUsers(churchId);
    }
    setExpanded(next);
  }

  function openAddChurch() {
    setChurchForm(EMPTY_CHURCH_FORM);
    setChurchDialog({ open: true, editing: null });
  }

  function openEditChurch(church: Church) {
    setChurchForm({
      name: church.name,
      city: church.city,
      cnpj: church.cnpj ?? "",
      pastorName: church.pastorName ?? "",
      pastorProntuario: church.pastorProntuario ?? "",
      status: church.status,
      plan: church.plan,
      adminName: "", adminEmail: "", adminPassword: "",
    });
    setChurchDialog({ open: true, editing: church });
  }

  async function saveChurch(e: React.FormEvent) {
    e.preventDefault();

    // Validate partial admin form
    if (!churchDialog.editing) {
      const hasName = !!churchForm.adminName.trim();
      const hasEmail = !!churchForm.adminEmail.trim();
      const hasPassword = !!churchForm.adminPassword;
      const partial = [hasName, hasEmail, hasPassword].some(Boolean) && ![hasName, hasEmail, hasPassword].every(Boolean);
      if (partial) {
        toast.error("Preencha todos os campos do administrador ou deixe todos em branco.");
        return;
      }
    }

    setChurchSaving(true);
    const { editing } = churchDialog;

    try {
      if (editing) {
        const res = await fetch(`/api/admin/igrejas/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: churchForm.name,
            city: churchForm.city,
            cnpj: churchForm.cnpj || null,
            pastorName: churchForm.pastorName || null,
            pastorProntuario: churchForm.pastorProntuario || null,
            status: churchForm.status,
            plan: churchForm.plan,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setChurches(prev => prev.map(c => c.id === editing.id ? { ...c, ...data } : c));
          toast.success("Igreja atualizada.");
          setChurchDialog({ open: false, editing: null });
        } else {
          toast.error(data.error ?? "Erro ao salvar.");
        }
      } else {
        const body: Record<string, string | undefined> = {
          churchName: churchForm.name,
          city: churchForm.city,
          cnpj: churchForm.cnpj || undefined,
          pastorName: churchForm.pastorName || undefined,
          pastorProntuario: churchForm.pastorProntuario || undefined,
        };
        if (churchForm.adminName && churchForm.adminEmail && churchForm.adminPassword) {
          body.adminName = churchForm.adminName;
          body.adminEmail = churchForm.adminEmail;
          body.adminPassword = churchForm.adminPassword;
        }
        const res = await fetch("/api/admin/igrejas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success("Igreja cadastrada.");
          setChurchDialog({ open: false, editing: null });
          loadChurches();
        } else {
          toast.error(data.error ?? "Erro ao cadastrar.");
        }
      }
    } catch { toast.error("Erro ao conectar."); }
    finally { setChurchSaving(false); }
  }

  async function confirmDeleteChurch() {
    if (!deleteChurchTarget) return;
    setDeleteChurchPending(true);
    try {
      const res = await fetch(`/api/admin/igrejas/${deleteChurchTarget.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast.success("Igreja excluída.");
        setChurches(prev => prev.filter(c => c.id !== deleteChurchTarget.id));
        setDeleteChurchTarget(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao excluir.");
      }
    } catch { toast.error("Erro ao conectar."); }
    finally { setDeleteChurchPending(false); }
  }

  async function saveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userDialog.churchId) return;
    setUserSaving(true);
    try {
      const res = await fetch(`/api/admin/igrejas/${userDialog.churchId}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.name} adicionado(a).`);
        const cid = userDialog.churchId;
        setUsersCache(prev => ({ ...prev, [cid]: [...(prev[cid] ?? []), data] }));
        setChurches(prev => prev.map(c =>
          c.id === cid ? { ...c, _count: { ...c._count, users: c._count.users + 1 } } : c
        ));
        setUserForm(EMPTY_USER_FORM);
        setUserDialog({ open: false, churchId: null });
      } else {
        toast.error(data.error ?? "Erro ao adicionar usuário.");
      }
    } catch { toast.error("Erro ao conectar."); }
    finally { setUserSaving(false); }
  }

  async function confirmDeleteUser() {
    if (!deleteUserTarget) return;
    setDeleteUserPending(true);
    const { churchId, user } = deleteUserTarget;
    try {
      const res = await fetch(`/api/admin/igrejas/${churchId}/usuarios/${user.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        toast.success(`${user.name} removido(a).`);
        setUsersCache(prev => ({ ...prev, [churchId]: (prev[churchId] ?? []).filter(u => u.id !== user.id) }));
        setChurches(prev => prev.map(c =>
          c.id === churchId ? { ...c, _count: { ...c._count, users: Math.max(0, c._count.users - 1) } } : c
        ));
        setDeleteUserTarget(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Erro ao remover.");
        setDeleteUserTarget(null);
      }
    } catch { toast.error("Erro ao conectar."); }
    finally { setDeleteUserPending(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Igrejas Cadastradas</h1>
        <Button size="sm" onClick={openAddChurch}>
          <PlusCircle className="w-4 h-4 mr-1" />
          Nova Igreja
        </Button>
      </div>

      {/* Church list */}
      {loading ? (
        <p className="text-center text-gray-400 py-12">Carregando...</p>
      ) : churches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <p>Nenhuma igreja cadastrada.</p>
          <Button variant="outline" size="sm" onClick={openAddChurch}>
            Cadastrar primeira igreja
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {churches.map(church => {
            const isExpanded = expanded.has(church.id);
            const isLoadingUsers = loadingUsers.has(church.id);
            const users = usersCache[church.id];

            return (
              <div key={church.id} className="border rounded-lg bg-white overflow-hidden">
                {/* Church info */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{church.name}</p>
                      <p className="text-xs text-gray-500 truncate">{church.city}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[church.status]}`}>
                        {STATUS_LABELS[church.status]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                        {church.plan === "FREE" ? "Gratuito" : "Pago"}
                      </span>
                    </div>
                  </div>

                  {(church.cnpj || church.pastorName) && (
                    <div className="text-xs text-gray-400 flex flex-col gap-0.5">
                      {church.cnpj && <span>CNPJ: {church.cnpj}</span>}
                      {church.pastorName && (
                        <span>
                          Pastor: {church.pastorName}
                          {church.pastorProntuario && ` · ${church.pastorProntuario}`}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 text-xs text-gray-400">
                    <span>{church._count.users} usuário{church._count.users !== 1 ? "s" : ""}</span>
                    <span>{church._count.reports} relatório{church._count.reports !== 1 ? "s" : ""}</span>
                    <span>
                      {new Date(church.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => openEditChurch(church)}>
                      <Pencil className="w-3 h-3" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1 text-red-500 hover:text-red-700 hover:border-red-300"
                      onClick={() => setDeleteChurchTarget(church)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Excluir
                    </Button>
                    <button
                      className="ml-auto flex items-center gap-1 text-xs text-blue-700 hover:underline"
                      onClick={() => toggleExpand(church.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Usuários ({church._count.users})
                    </button>
                  </div>
                </div>

                {/* Expanded users section */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-3 flex flex-col gap-2">
                    {isLoadingUsers ? (
                      <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>
                    ) : !users || users.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Nenhum usuário cadastrado.</p>
                    ) : (
                      <div className="flex flex-col divide-y border rounded-md overflow-hidden bg-white">
                        {users.map(user => (
                          <div key={user.id} className="flex items-center gap-2 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${!user.active ? "text-gray-400 line-through" : ""}`}>
                                {user.name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0">
                              {ROLE_LABELS[user.role] ?? user.role}
                            </span>
                            <button
                              className="text-red-400 hover:text-red-600 shrink-0 p-0.5"
                              title="Remover usuário"
                              onClick={() => setDeleteUserTarget({ churchId: church.id, user })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs self-start gap-1"
                      onClick={() => {
                        setUserForm(EMPTY_USER_FORM);
                        setUserDialog({ open: true, churchId: church.id });
                      }}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Adicionar Usuário
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Add / Edit Church ── */}
      <Dialog open={churchDialog.open} onOpenChange={() => setChurchDialog({ open: false, editing: null })}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{churchDialog.editing ? "Editar Igreja" : "Nova Igreja"}</DialogTitle>
            {!churchDialog.editing && (
              <DialogDescription>Preencha os dados da congregação.</DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={saveChurch} className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Nome da Igreja *</Label>
              <Input
                id="c-name"
                value={churchForm.name}
                onChange={e => setChurchForm(p => ({ ...p, name: e.target.value }))}
                required
                disabled={churchSaving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-city">Cidade / Bairro *</Label>
              <Input
                id="c-city"
                value={churchForm.city}
                onChange={e => setChurchForm(p => ({ ...p, city: e.target.value }))}
                required
                disabled={churchSaving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-cnpj">CNPJ <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                id="c-cnpj"
                value={churchForm.cnpj}
                onChange={e => setChurchForm(p => ({ ...p, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                disabled={churchSaving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-pastor">Pastor Titular <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                id="c-pastor"
                value={churchForm.pastorName}
                onChange={e => setChurchForm(p => ({ ...p, pastorName: e.target.value }))}
                disabled={churchSaving}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-prontuario">Prontuário <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Input
                id="c-prontuario"
                value={churchForm.pastorProntuario}
                onChange={e => setChurchForm(p => ({ ...p, pastorProntuario: e.target.value }))}
                disabled={churchSaving}
              />
            </div>

            {/* Status & Plan — edit only */}
            {churchDialog.editing && (
              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label>Status</Label>
                  <select
                    value={churchForm.status}
                    onChange={e => setChurchForm(p => ({ ...p, status: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={churchSaving}
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="ACTIVE">Ativa</option>
                    <option value="SUSPENDED">Suspensa</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label>Plano</Label>
                  <select
                    value={churchForm.plan}
                    onChange={e => setChurchForm(p => ({ ...p, plan: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={churchSaving}
                  >
                    <option value="FREE">Gratuito</option>
                    <option value="PAID">Pago</option>
                  </select>
                </div>
              </div>
            )}

            {/* First admin — new church only */}
            {!churchDialog.editing && (
              <div className="border-t pt-3 mt-1 flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-700">
                  Primeiro Administrador{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-name">Nome</Label>
                  <Input
                    id="a-name"
                    value={churchForm.adminName}
                    onChange={e => setChurchForm(p => ({ ...p, adminName: e.target.value }))}
                    placeholder="Nome completo"
                    disabled={churchSaving}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-email">E-mail</Label>
                  <Input
                    id="a-email"
                    type="email"
                    value={churchForm.adminEmail}
                    onChange={e => setChurchForm(p => ({ ...p, adminEmail: e.target.value }))}
                    placeholder="admin@igreja.com"
                    disabled={churchSaving}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="a-password">
                    Senha <span className="text-gray-400 font-normal">(mín. 8 caracteres)</span>
                  </Label>
                  <Input
                    id="a-password"
                    type="password"
                    value={churchForm.adminPassword}
                    onChange={e => setChurchForm(p => ({ ...p, adminPassword: e.target.value }))}
                    disabled={churchSaving}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setChurchDialog({ open: false, editing: null })}
                disabled={churchSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={churchSaving}>
                {churchSaving ? "Salvando…" : churchDialog.editing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Delete Church ── */}
      <Dialog open={!!deleteChurchTarget} onOpenChange={() => setDeleteChurchTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Igreja</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteChurchTarget?.name}</strong>? Esta ação excluirá
              permanentemente todos os usuários, pessoas e relatórios associados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteChurchTarget(null)}
              disabled={deleteChurchPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDeleteChurch}
              disabled={deleteChurchPending}
            >
              {deleteChurchPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Add User ── */}
      <Dialog open={userDialog.open} onOpenChange={() => setUserDialog({ open: false, churchId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Usuário</DialogTitle>
            <DialogDescription>
              {userDialog.churchId != null &&
                churches.find(c => c.id === userDialog.churchId)?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveUser} className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-name">Nome *</Label>
              <Input
                id="u-name"
                value={userForm.name}
                onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                required
                disabled={userSaving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-email">E-mail *</Label>
              <Input
                id="u-email"
                type="email"
                value={userForm.email}
                onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))}
                required
                disabled={userSaving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-password">
                Senha * <span className="text-gray-400 font-normal">(mín. 8 caracteres)</span>
              </Label>
              <Input
                id="u-password"
                type="password"
                value={userForm.password}
                onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                required
                disabled={userSaving}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="u-role">Permissão</Label>
              <select
                id="u-role"
                value={userForm.role}
                onChange={e => setUserForm(p => ({ ...p, role: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={userSaving}
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
                onClick={() => setUserDialog({ open: false, churchId: null })}
                disabled={userSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={userSaving}>
                {userSaving ? "Salvando…" : "Adicionar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Delete User ── */}
      <Dialog open={!!deleteUserTarget} onOpenChange={() => setDeleteUserTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover{" "}
              <strong>{deleteUserTarget?.user.name}</strong>? O acesso será
              revogado permanentemente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteUserTarget(null)}
              disabled={deleteUserPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={confirmDeleteUser}
              disabled={deleteUserPending}
            >
              {deleteUserPending ? "Removendo…" : "Remover"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
