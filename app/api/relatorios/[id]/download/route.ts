import { prisma } from "@/lib/prisma";
import { churchDocxData, generateReportDocx, reportForDocx } from "@/lib/report-docx";
import { reportFileName } from "@/lib/report-filename";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const [report, church] = await Promise.all([
    prisma.report.findFirst({ where: { id, churchId }, include: reportForDocx }),
    prisma.church.findUnique({ where: { id: churchId } }),
  ]);
  if (!report) return Response.json({ error: "Não encontrado" }, { status: 404 });
  if (!church) return Response.json({ error: "Igreja não encontrada" }, { status: 404 });

  const buf = generateReportDocx(report, churchDocxData(church));

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${reportFileName(report.dataCulto, report.horario)}"`,
    },
  });
}
