import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { Decimal } from "@prisma/client/runtime/client";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id: Number(id), churchId },
    include: { tithers: { orderBy: { order: "asc" } } },
  });
  if (!report) return Response.json({ error: "Não encontrado" }, { status: 404 });
  return Response.json(report);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;
  const body = await req.json();

  // Verify the report belongs to this church before mutating
  const existing = await prisma.report.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.churchId !== churchId) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const {
    dataCulto, diaDaSemana, horario, pregador,
    pastoresPresentes, visitasEspeciais,
    testemunhoCura, conversoes, batizadosEspirito, visitantes,
    diaconosServico, criancasApresentadas, totalPresentes,
    totalOfertasGerais, totalOfertasEspeciais, outrasEntradas,
    totalOfertasMissoes, diaconosResponsaveis, responsavelPeloRelatorio, tithers,
  } = body;

  const totalDizimos = (tithers as { value: number }[]).reduce(
    (sum, t) => sum.add(new Decimal(t.value || 0)),
    new Decimal(0)
  );
  const arrecadacaoTotal = totalDizimos
    .add(new Decimal(totalOfertasGerais || 0))
    .add(new Decimal(totalOfertasEspeciais || 0))
    .add(new Decimal(outrasEntradas || 0));

  const [, report] = await prisma.$transaction([
    prisma.titheRecord.deleteMany({ where: { reportId: Number(id) } }),
    prisma.report.update({
      where: { id: Number(id) },
      data: {
        dataCulto: new Date(dataCulto),
        diaDaSemana, horario, pregador,
        pastoresPresentes: Array.isArray(pastoresPresentes) ? pastoresPresentes.filter(Boolean) : [],
        visitasEspeciais: Array.isArray(visitasEspeciais) ? visitasEspeciais.filter(Boolean) : [],
        testemunhoCura: Number(testemunhoCura || 0),
        conversoes: Number(conversoes || 0),
        batizadosEspirito: Number(batizadosEspirito || 0),
        visitantes: Number(visitantes || 0),
        diaconosServico: Number(diaconosServico || 0),
        criancasApresentadas: Number(criancasApresentadas || 0),
        totalPresentes: Number(totalPresentes || 0),
        totalOfertasGerais: new Decimal(totalOfertasGerais || 0),
        totalOfertasEspeciais: new Decimal(totalOfertasEspeciais || 0),
        outrasEntradas: new Decimal(outrasEntradas || 0),
        arrecadacaoTotal: new Decimal(arrecadacaoTotal),
        totalOfertasMissoes: totalOfertasMissoes ? new Decimal(totalOfertasMissoes) : null,
        totalDizimos: new Decimal(totalDizimos),
        diaconosResponsaveis: Array.isArray(diaconosResponsaveis) ? diaconosResponsaveis.filter(Boolean) : [],
        responsavelPeloRelatorio: responsavelPeloRelatorio || null,
        tithers: {
          create: (tithers as { personName: string; chequeNumber?: string; bankNumber?: string; paymentMethod?: "DINHEIRO" | "PIX" | null; value: number; order: number }[])
            .filter((t) => t.personName?.trim())
            .map((t) => ({
              personName: t.personName.trim(),
              chequeNumber: t.chequeNumber || null,
              bankNumber: t.bankNumber || null,
              paymentMethod: t.paymentMethod ?? null,
              value: new Decimal(t.value || 0),
              order: t.order,
            })),
        },
      },
      include: { tithers: { orderBy: { order: "asc" } } },
    }),
  ]);

  return Response.json(report);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;

  const existing = await prisma.report.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.churchId !== churchId) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.report.delete({ where: { id: Number(id) } });
  return new Response(null, { status: 204 });
}
