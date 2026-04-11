"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  id: number;
  dataCulto: Date;
}

export default function DownloadButton({ id, dataCulto }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/relatorios/${id}/download`);
      if (!res.ok) { toast.error("Erro ao baixar o relatório."); return; }
      const blob = await res.blob();
      const dateStr = new Date(dataCulto)
        .toLocaleDateString("pt-BR", { timeZone: "UTC" })
        .replace(/\//g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `REFC-${dateStr}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar o relatório.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button size="sm" onClick={handleDownload} disabled={downloading}>
      {downloading
        ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        : <Download className="w-4 h-4 mr-1" />}
      DOCX
    </Button>
  );
}
