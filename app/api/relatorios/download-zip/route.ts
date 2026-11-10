import { prisma } from "@/lib/prisma";
import { churchDocxData, generateReportDocx, reportForDocx } from "@/lib/report-docx";
import { reportFileName, uniqueFileNames } from "@/lib/report-filename";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import PizZip from "pizzip";
import { z } from "zod";

const MAX_REPORTS = 100;

const bodySchema = z.object({
  ids: z
    .array(z.int().positive())
    .min(1, "Nenhum relatório selecionado")
    .max(MAX_REPORTS, `Máximo de ${MAX_REPORTS} relatórios por download`),
});

export async function POST(req: NextRequest) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const [reports, church] = await Promise.all([
    prisma.report.findMany({
      where: { id: { in: parsed.data.ids }, churchId },
      include: reportForDocx,
      orderBy: [{ dataCulto: "asc" }, { horario: "asc" }],
    }),
    prisma.church.findUnique({ where: { id: churchId } }),
  ]);
  if (!church) return Response.json({ error: "Igreja não encontrada" }, { status: 404 });

  const churchData = churchDocxData(church);
  // Two services on the same day get different times in their names; the
  // suffix only guards against two reports with the same date and time.
  const names = uniqueFileNames(reports.map((r) => reportFileName(r.dataCulto, r.horario)));

  const archive = new PizZip();
  reports.forEach((report, i) => archive.file(names[i], generateReportDocx(report, churchData)));
  const zipBuf = archive.generate({ type: "nodebuffer", compression: "DEFLATE" });

  return new Response(new Uint8Array(zipBuf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="REFC-relatorios.zip"`,
    },
  });
}
