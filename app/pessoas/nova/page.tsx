"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ROLES = [
  { id: "pastor", label: "Pastor" },
  { id: "diacono", label: "Diácono" },
  { id: "membro", label: "Membro" },
  { id: "lider", label: "Líder" },
];

export default function NovaPessoaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState((searchParams.get("name") ?? "").toUpperCase());
  const [roles, setRoles] = useState<string[]>(["membro"]);
  const [saving, setSaving] = useState(false);

  function toggleRole(id: string) {
    setRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome da pessoa.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pessoas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roles }),
      });
      if (!res.ok) throw new Error();
      toast.success("Pessoa adicionada!");
      router.push("/pessoas");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-xl font-bold">Adicionar Pessoa</h1>
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
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="Ex: JOÃO DA SILVA"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categorias (marque todas que se aplicam)</Label>
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
            <p className="text-xs text-gray-400">
              As categorias definem onde o nome aparece como sugestão nos formulários.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
