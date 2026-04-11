"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Download, Eye, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

interface ReportCardProps {
  id: number;
  dataCulto: string | Date;
  diaDaSemana: string;
  pregador: string;
  totalPresentes: number;
  horario: string;
  selected?: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
}

export default function ReportCard({
  id,
  dataCulto,
  diaDaSemana,
  pregador,
  totalPresentes,
  horario,
  selected,
  onToggle,
  onDelete,
}: ReportCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateStr = new Date(dataCulto).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/relatorios/${id}/download`);
      if (!res.ok) { toast.error("Erro ao baixar o relatório."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `REFC-${dateStr.replace(/\//g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar o relatório.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card
      className={cn(
        "hover:shadow-md transition-shadow",
        selected && "ring-2 ring-blue-500"
      )}
    >
      <CardContent className="flex items-center gap-3 py-4">
        {onToggle && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onToggle}
            className="w-4 h-4 shrink-0 accent-blue-600 cursor-pointer"
            aria-label={`Selecionar relatório de ${dateStr}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">
            {diaDaSemana}, {dateStr} — {horario}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            Pregador: {pregador} · {totalPresentes} presentes
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/culto/${id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="w-4 h-4 mr-1" />
            {downloading ? "..." : "DOCX"}
          </Button>
          {onDelete && (
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              size="sm"
              onClick={() => {
                if (confirmDelete) {
                  onDelete();
                } else {
                  setConfirmDelete(true);
                  setTimeout(() => setConfirmDelete(false), 3000);
                }
              }}
            >
              {confirmDelete ? "Confirmar?" : <Trash2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
