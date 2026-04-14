"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: number;
}

export default function DeleteButton({ id }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/relatorios/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao excluir relatório."); return; }
      toast.success("Relatório excluído.");
      router.push("/relatorios");
    } catch {
      toast.error("Erro ao excluir relatório.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant={confirm ? "destructive" : "outline"}
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
    >
      <Trash2 className="w-4 h-4 mr-1" />
      {confirm ? "Confirmar?" : "Excluir"}
    </Button>
  );
}
