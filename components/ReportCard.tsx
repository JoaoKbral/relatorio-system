import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  id: number;
  dataCulto: string | Date;
  diaDaSemana: string;
  pregador: string;
  totalPresentes: number;
  horario: string;
}

export default function ReportCard({
  id,
  dataCulto,
  diaDaSemana,
  pregador,
  totalPresentes,
  horario,
}: ReportCardProps) {
  const dateStr = new Date(dataCulto).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center justify-between gap-4 py-4">
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
          <a
            href={`/api/relatorios/${id}/download`}
            download
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="w-4 h-4 mr-1" />
            ODT
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
