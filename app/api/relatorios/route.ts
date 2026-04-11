import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/session";
import { NextRequest } from "next/server";
import { Decimal } from "@prisma/client/runtime/client";

async function authed(req: NextRequest) {
  return await decrypt(req.cookies.get("session")?.value)
}

export async function GET(req: NextRequest) {
  if (!await authed(req)) return Response.json({ error: "Não autorizado" }, { status: 401 })
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (year) {
    const y = Number(year);
    const m = month ? Number(month) - 1 : 0;
    const start = month
      ? new Date(y, m, 1)
      : new Date(y, 0, 1);
    const end = month
      ? new Date(y, m + 1, 0, 23, 59, 59)
      : new Date(y, 11, 31, 23, 59, 59);
    where.dataCulto = { gte: start, lte: end };
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: { dataCulto: "desc" },
    include: { tithers: { orderBy: { order: "asc" } } },
  });

  return Response.json(reports);
}

export async function POST(req: NextRequest) {
  if (!await authed(req)) return Response.json({ error: "Não autorizado" }, { status: 401 })
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

  // Calculate totals
  const totalDizimos = (tithers as { value: number }[]).reduce(
    (sum, t) => sum + Number(t.value || 0),
    0
  );
  const arrecadacaoTotal =
    totalDizimos +
    Number(totalOfertasGerais || 0) +
    Number(totalOfertasEspeciais || 0) +
    Number(outrasEntradas || 0);

  const report = await prisma.report.create({
    data: {
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
  const allNames = [
    body.pregador,
    ...(body.pastoresPresentes ?? []),
    ...(body.visitasEspeciais ?? []),
    ...(body.diaconosResponsaveis ?? []),
    ...(tithers as { personName: string }[])
      .filter((t) => t.personName?.trim())
      .map((t) => t.personName.trim()),
  ]
    .filter(Boolean)
    .map((n: string) => n.trim().toUpperCase());

  for (const name of [...new Set(allNames)]) {
    const exists = await prisma.person.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (!exists) {
      await prisma.person.create({ data: { name, roles: ["membro"] } });
    }
  }

  return Response.json(report, { status: 201 });
}
