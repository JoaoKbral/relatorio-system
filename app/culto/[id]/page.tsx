export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { Decimal } from "@prisma/client/runtime/client";
import { cn } from "@/lib/utils";

function fmtCurrency(v: Decimal | null) {
  if (!v) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="font-medium text-sm text-right max-w-[55%]">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wide">
        {title}
      </div>
      <div className="px-3">{children}</div>
    </div>
  );
}

export default async function ViewReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id: Number(id) },
    include: { tithers: { orderBy: { order: "asc" } } },
  });

  if (!report) notFound();

  const dateStr = new Date(report.dataCulto).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/relatorios"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold flex-1">
          {report.diaDaSemana}, {dateStr}
        </h1>
        <Link
          href={`/culto/${report.id}/editar`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Pencil className="w-4 h-4 mr-1" />
          Editar
        </Link>
        <a
          href={`/api/relatorios/${report.id}/download`}
          download
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <Download className="w-4 h-4 mr-1" />
          ODT
        </a>
      </div>

      <Section title="Culto">
        <Row label="Data" value={dateStr} />
        <Row label="Dia da semana" value={report.diaDaSemana} />
        <Row label="Horário" value={report.horario} />
        <Row label="Pregador" value={report.pregador} />
        {report.pastoresPresentes.length > 0 && (
          <Row label="Pastor(es) presente(s)" value={report.pastoresPresentes.join(", ")} />
        )}
        {report.visitasEspeciais.length > 0 && (
          <Row label="Visita(s) especial(is)" value={report.visitasEspeciais.join(", ")} />
        )}
      </Section>

      <Section title="Estatísticas">
        <Row label="Total de presentes" value={report.totalPresentes} />
        <Row label="Conversões" value={report.conversoes} />
        <Row label="Batizados no Esp. Santo" value={report.batizadosEspirito} />
        <Row label="Visitantes" value={report.visitantes} />
        <Row label="Diáconos em serviço" value={report.diaconosServico} />
        <Row label="Testemunhos de cura" value={report.testemunhoCura} />
        <Row label="Crianças apresentadas" value={report.criancasApresentadas} />
      </Section>

      <Section title="Dízimos">
        {report.tithers.length === 0 ? (
          <p className="py-3 text-sm text-gray-400">Nenhum membro registrado.</p>
        ) : (
          report.tithers.map((t) => (
            <Row key={t.id} label={t.personName} value={fmtCurrency(t.value)} />
          ))
        )}
        <Row label="Total dízimos" value={fmtCurrency(report.totalDizimos)} />
        {report.diaconosResponsaveis.length > 0 && (
          <Row label="Diácono(s) responsável(is)" value={report.diaconosResponsaveis.join(", ")} />
        )}
      </Section>

      <Section title="Ofertas">
        <Row label="Ofertas gerais" value={fmtCurrency(report.totalOfertasGerais)} />
        <Row label="Ofertas especiais" value={fmtCurrency(report.totalOfertasEspeciais)} />
        <Row label="Outras entradas" value={fmtCurrency(report.outrasEntradas)} />
        {report.totalOfertasMissoes && (
          <Row label="Oferta de missões" value={fmtCurrency(report.totalOfertasMissoes)} />
        )}
        <Row label="Total arrecadação" value={fmtCurrency(report.arrecadacaoTotal)} />
      </Section>
    </div>
  );
}
