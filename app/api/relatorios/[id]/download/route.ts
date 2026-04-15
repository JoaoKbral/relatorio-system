import { prisma } from "@/lib/prisma";
import { generateOdt } from "@/lib/odt-generator";
import { requireSession } from "@/lib/auth";
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

  if (!report) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const church = await prisma.church.findUnique({ where: { id: churchId } });
  if (!church) {
    return Response.json({ error: "Igreja não encontrada" }, { status: 404 });
  }

  const buf = generateOdt(report, {
    igrejaComCidadeEBairro: church.city,
    CNPJ: church.cnpj ?? '',
    nomePastorTitular: church.pastorName ?? '',
    prontuarioTitular: church.pastorProntuario ?? '',
  });

  const dateStr = new Date(report.dataCulto)
    .toLocaleDateString("pt-BR", { timeZone: "UTC" })
    .replace(/\//g, "-");
  const filename = `REFC-${dateStr}.docx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
