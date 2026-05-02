"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface ChurchConfig {
  name: string;
  city: string;
  cnpj: string | null;
  pastorName: string | null;
  pastorProntuario: string | null;
}

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ChurchConfig>({
    name: "",
    city: "",
    cnpj: "",
    pastorName: "",
    pastorProntuario: "",
  });

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch("/api/auth/me");
        const me = await meRes.json();
        setRole(me.role ?? null);

        if (me.role === "ADMIN") {
          const configRes = await fetch("/api/igreja/config");
          if (configRes.ok) {
            const data: ChurchConfig = await configRes.json();
            setForm({
              name: data.name ?? "",
              city: data.city ?? "",
              cnpj: data.cnpj ?? "",
              pastorName: data.pastorName ?? "",
              pastorProntuario: data.pastorProntuario ?? "",
            });
          }
        }
      } catch {
        toast.error("Erro ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function set(field: keyof ChurchConfig, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/igreja/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          cnpj: form.cnpj || null,
          pastorName: form.pastorName || null,
          pastorProntuario: form.pastorProntuario || null,
        }),
      });

      if (res.ok) {
        toast.success("Configurações salvas.");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao salvar.");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Senha alterada com sucesso.");
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Erro ao alterar senha.");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
    } finally {
      setSavingPw(false);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-12">Carregando...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Configurações</h1>
        {role === "ADMIN" && (
          <Link
            href="/configuracoes/usuarios"
            className="flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
          >
            <Users className="w-4 h-4" />
            Gerenciar usuários
          </Link>
        )}
      </div>

      {role === "ADMIN" && (
        <form onSubmit={handleSubmit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Igreja</CardTitle>
              <CardDescription>
                Estas informações aparecem nos relatórios exportados
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome da Igreja *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="city">Cidade / Bairro *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cnpj">
                  CNPJ <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="cnpj"
                  value={form.cnpj ?? ""}
                  onChange={(e) => set("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
                  disabled={saving}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pastorName">
                  Nome do Pastor Titular <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="pastorName"
                  value={form.pastorName ?? ""}
                  onChange={(e) => set("pastorName", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pastorProntuario">
                  Prontuário do Pastor <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  id="pastorProntuario"
                  value={form.pastorProntuario ?? ""}
                  onChange={(e) => set("pastorProntuario", e.target.value)}
                  disabled={saving}
                />
              </div>

              <Button type="submit" className="mt-2 w-full" disabled={saving}>
                {saving ? "Salvando…" : "Salvar Alterações"}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}

      <form onSubmit={handlePasswordChange} noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alterar Senha</CardTitle>
            <CardDescription>
              Use uma senha forte com no mínimo 8 caracteres
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={pwForm.currentPassword}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, currentPassword: e.target.value }))
                }
                required
                disabled={savingPw}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                required
                disabled={savingPw}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                required
                disabled={savingPw}
              />
            </div>

            <Button type="submit" variant="outline" className="mt-2 w-full" disabled={savingPw}>
              {savingPw ? "Salvando…" : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
