import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";

export async function GET(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = { churchId };
  if (year) {
    const y = Number(year);
    const m = month ? Number(month) - 1 : 0;
    const start = month ? new Date(y, m, 1) : new Date(y, 0, 1);
    const end = month ? new Date(y, m + 1, 1) : new Date(y + 1, 0, 1);
    where.dataCulto = { gte: start, lt: end };
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: { dataCulto: "desc" },
    include: { tithers: { orderBy: { order: "asc" } } },
  });

  return Response.json(reports);
}

export async function POST(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const body = await req.json();

  const {
    dataCulto,
    diaDaSemana,
    horario,
    pregador,
    pastoresPresentes,
    visitasEspeciais,
    testemunhoCura,
    conversoes,
    batizadosEspirito,
    visitantes,
    diaconosServico,
    criancasApresentadas,
    totalPresentes,
    totalOfertasGerais,
    totalOfertasEspeciais,
    outrasEntradas,
    totalOfertasMissoes,
    diaconosResponsaveis,
    responsavelPeloRelatorio,
    tithers,
  } = body;

  // Calculate totals using Decimal arithmetic to avoid float rounding errors
  const totalDizimos = (tithers as { value: number }[]).reduce(
    (sum, t) => sum.add(new Decimal(t.value || 0)),
    new Decimal(0)
  );
  const arrecadacaoTotal = totalDizimos
    .add(new Decimal(totalOfertasGerais || 0))
    .add(new Decimal(totalOfertasEspeciais || 0))
    .add(new Decimal(outrasEntradas || 0));

  const report = await prisma.report.create({
    data: {
      churchId,
      dataCulto: new Date(dataCulto),
      diaDaSemana,
      horario,
      pregador,
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
      totalOfertasMissoes: totalOfertasMissoes
        ? new Decimal(totalOfertasMissoes)
        : null,
      totalDizimos: new Decimal(totalDizimos),
      diaconosResponsaveis: Array.isArray(diaconosResponsaveis) ? diaconosResponsaveis.filter(Boolean) : [],
      responsavelPeloRelatorio: responsavelPeloRelatorio || null,
      tithers: {
        create: (tithers as {
          personName: string;
          chequeNumber?: string;
          bankNumber?: string;
          paymentMethod?: "DINHEIRO" | "PIX" | null;
          value: number;
          order: number;
        }[])
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
  });

  // Auto-create Pessoa for every new name encountered in this report
  const allNames = [...new Set(
    [
      body.pregador,
      ...(body.pastoresPresentes ?? []),
      ...(body.visitasEspeciais ?? []),
      ...(body.diaconosResponsaveis ?? []),
      ...(tithers as { personName: string }[])
        .filter((t) => t.personName?.trim())
        .map((t) => t.personName.trim()),
    ]
      .filter(Boolean)
      .map((n: string) => n.trim().toUpperCase())
  )];

  if (allNames.length > 0) {
    const existing = await prisma.person.findMany({
      where: { churchId, name: { in: allNames, mode: "insensitive" } },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((p) => p.name.toUpperCase()));
    const toCreate = allNames.filter((n) => !existingNames.has(n));
    if (toCreate.length > 0) {
      await prisma.person.createMany({
        data: toCreate.map((name) => ({ churchId, name, roles: ["membro"] })),
        skipDuplicates: true,
      });
    }
  }

  return Response.json(report, { status: 201 });
}
