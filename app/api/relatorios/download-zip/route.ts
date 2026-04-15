import { prisma } from "@/lib/prisma";
import { generateOdt } from "@/lib/odt-generator";
import { requireSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import PizZip from "pizzip";

export async function POST(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { ids } = await req.json() as { ids: number[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Nenhum relatório selecionado" }, { status: 400 });
  }

  const [reports, church] = await Promise.all([
    prisma.report.findMany({
      where: { id: { in: ids }, churchId },
      include: { tithers: { orderBy: { order: "asc" } } },
      orderBy: { dataCulto: "asc" },
    }),
    prisma.church.findUnique({ where: { id: churchId } }),
  ]);

  if (!church) {
    return Response.json({ error: "Igreja não encontrada" }, { status: 404 });
  }

  const churchData = {
    igrejaComCidadeEBairro: church.city,
    CNPJ: church.cnpj ?? '',
    nomePastorTitular: church.pastorName ?? '',
    prontuarioTitular: church.pastorProntuario ?? '',
  };

  const archive = new PizZip();

  for (const report of reports) {
    const odt = generateOdt(report, churchData);
    const dateStr = new Date(report.dataCulto)
      .toLocaleDateString("pt-BR", { timeZone: "UTC" })
      .replace(/\//g, "-");
    archive.file(`REFC-${dateStr}.docx`, odt);
  }

  const zipBuf = archive.generate({ type: "nodebuffer", compression: "DEFLATE" });

  return new Response(new Uint8Array(zipBuf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="REFC-relatorios.zip"`,
    },
  });
}
