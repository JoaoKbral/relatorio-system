import { prisma } from "@/lib/prisma";
import { generateOdt } from "@/lib/odt-generator";
import { decrypt } from "@/lib/session";
import { NextRequest } from "next/server";
import PizZip from "pizzip";

export async function POST(req: NextRequest) {
  if (!await decrypt(req.cookies.get("session")?.value)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { ids } = await req.json() as { ids: number[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Nenhum relatório selecionado" }, { status: 400 });
  }

  const reports = await prisma.report.findMany({
    where: { id: { in: ids } },
    include: { tithers: { orderBy: { order: "asc" } } },
    orderBy: { dataCulto: "asc" },
  });

  const archive = new PizZip();

  for (const report of reports) {
    const odt = generateOdt(report);
    const dateStr = new Date(report.dataCulto)
      .toLocaleDateString("pt-BR", { timeZone: "UTC" })
      .replace(/\//g, "-");
    archive.file(`REFC-${dateStr}.odt`, odt);
  }

  const zipBuf = archive.generate({ type: "nodebuffer", compression: "DEFLATE" });

  return new Response(new Uint8Array(zipBuf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="REFC-relatorios.zip"`,
    },
  });
}
