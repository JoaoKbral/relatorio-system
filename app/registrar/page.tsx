"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Church } from "lucide-react";
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

export default function RegistrarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    churchName: "",
    city: "",
    cnpj: "",
    pastorName: "",
    pastorProntuario: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (form.adminPassword !== form.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (form.adminPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchName: form.churchName,
          city: form.city,
          cnpj: form.cnpj || undefined,
          pastorName: form.pastorName || undefined,
          pastorProntuario: form.pastorProntuario || undefined,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Igreja cadastrada com sucesso! Faça login para continuar.");
        router.push("/login");
      } else {
        toast.error(data.error ?? "Erro ao cadastrar. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="bg-blue-700 text-white rounded-full p-3">
            <Church className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 text-center">
            Cadastrar Igreja
          </h1>
          <p className="text-sm text-gray-500">Crie a conta da sua igreja no sistema</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">
            {/* Church info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados da Igreja</CardTitle>
                <CardDescription>Informações gerais da congregação</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="churchName">Nome da Igreja *</Label>
                  <Input
                    id="churchName"
                    placeholder="Ex: IEQ Canto do Mar"
                    value={form.churchName}
                    onChange={(e) => set("churchName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="city">Cidade / Bairro *</Label>
                  <Input
                    id="city"
                    placeholder="Ex: São Sebastião – Canto do Mar"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cnpj">CNPJ <span className="text-gray-400 font-normal">(opcional)</span></Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pastorName">Nome do Pastor Titular <span className="text-gray-400 font-normal">(opcional)</span></Label>
                  <Input
                    id="pastorName"
                    placeholder="Ex: Fábio Cabral"
                    value={form.pastorName}
                    onChange={(e) => set("pastorName", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pastorProntuario">Prontuário do Pastor <span className="text-gray-400 font-normal">(opcional)</span></Label>
                  <Input
                    id="pastorProntuario"
                    placeholder="Ex: 34292"
                    value={form.pastorProntuario}
                    onChange={(e) => set("pastorProntuario", e.target.value)}
                    disabled={loading}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Admin account */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conta do Administrador</CardTitle>
                <CardDescription>Credenciais de acesso ao sistema</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="adminName">Seu Nome *</Label>
                  <Input
                    id="adminName"
                    placeholder="Ex: Maria Silva"
                    value={form.adminName}
                    onChange={(e) => set("adminName", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="adminEmail">E-mail *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={form.adminEmail}
                    onChange={(e) => set("adminEmail", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="adminPassword">Senha *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.adminPassword}
                    onChange={(e) => set("adminPassword", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Cadastrando…" : "Cadastrar Igreja"}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-700 underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
