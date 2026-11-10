"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadReportDocx } from "@/lib/download";

interface Props {
  id: number;
  dataCulto: string | Date;
  horario: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  className?: string;
}

export default function DownloadButton({
  id,
  dataCulto,
  horario,
  label = "DOCX",
  size = "sm",
  variant = "default",
  className,
}: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadReportDocx(id, dataCulto, horario);
    } catch {
      toast.error("Erro ao baixar o relatório.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button size={size} variant={variant} className={className} onClick={handleDownload} disabled={downloading}>
      {downloading
        ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        : <Download className="w-4 h-4 mr-1" />}
      {label}
    </Button>
  );
}
