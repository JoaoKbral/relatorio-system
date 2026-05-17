import { prisma } from "@/lib/prisma";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!month || !year) {
    return Response.json({ error: "month e year são obrigatórios" }, { status: 400 });
  }

  const y = Number(year);
  const m = Number(month) - 1;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);

  const titheRecords = await prisma.titheRecord.findMany({
    where: {
      report: {
        churchId,
        dataCulto: { gte: start, lt: end },
      },
    },
    select: {
      personName: true,
      value: true,
    },
  });

  const map = new Map<string, { displayName: string; totalValue: number; titheCount: number }>();
  for (const r of titheRecords) {
    const key = r.personName.trim().toUpperCase();
    const val = Number(r.value);
    const existing = map.get(key);
    if (existing) {
      existing.totalValue += val;
      existing.titheCount += 1;
    } else {
      map.set(key, { displayName: r.personName.trim(), totalValue: val, titheCount: 1 });
    }
  }

  const data = Array.from(map.values())
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))
    .map((d) => ({
      personName: d.displayName,
      totalValue: d.totalValue.toFixed(2),
      titheCount: d.titheCount,
    }));

  return Response.json(data);
}
