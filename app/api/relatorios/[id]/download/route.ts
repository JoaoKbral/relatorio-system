import { prisma } from "@/lib/prisma";
import { generateOdt } from "@/lib/odt-generator";
import { decrypt } from "@/lib/session";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await decrypt(req.cookies.get("session")?.value)) return Response.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id: Number(id) },
    include: { tithers: { orderBy: { order: "asc" } } },
  });

  if (!report) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const buf = generateOdt(report);
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
