"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "pastor", label: "Pastor" },
  { id: "diacono", label: "Diácono" },
  { id: "membro", label: "Membro" },
  { id: "lider", label: "Líder" },
];

export default function EditarPessoaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/pessoas/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name);
        setRoles(data.roles);
        setLoading(false);
      });
  }, [id]);

  function toggleRole(roleId: string) {
    setRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome da pessoa.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pessoas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roles }),
      });
      if (!res.ok) throw new Error();
      toast.success("Pessoa atualizada!");
      router.push("/pessoas");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center py-10 text-gray-400">Carregando...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/pessoas"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Editar Pessoa</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Pessoa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categorias</Label>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={roles.includes(r.id)}
                    onCheckedChange={() => toggleRole(r.id)}
                  />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
