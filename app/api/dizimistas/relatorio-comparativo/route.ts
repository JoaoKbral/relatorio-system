import { prisma } from "@/lib/prisma";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const monthStart = searchParams.get("monthStart");
  const monthEnd = searchParams.get("monthEnd");

  if (!year || !monthStart || !monthEnd) {
    return Response.json({ error: "year, monthStart e monthEnd são obrigatórios" }, { status: 400 });
  }

  const y = Number(year);
  const ms = Number(monthStart);
  const me = Number(monthEnd);

  if (ms > me || ms < 1 || me > 12) {
    return Response.json({ error: "Intervalo de meses inválido" }, { status: 400 });
  }

  const start = new Date(y, ms - 1, 1);
  const end = new Date(y, me, 1);

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
      report: { select: { dataCulto: true } },
    },
  });

  const months = Array.from({ length: me - ms + 1 }, (_, i) => ms + i);

  // pivot: uppercase key → { displayName, values per month }
  const pivotMap = new Map<string, { displayName: string; byMonth: Map<number, number> }>();
  for (const r of titheRecords) {
    const key = r.personName.trim().toUpperCase();
    const month = new Date(r.report.dataCulto).getMonth() + 1;
    const val = Number(r.value);

    if (!pivotMap.has(key)) {
      pivotMap.set(key, { displayName: r.personName.trim(), byMonth: new Map() });
    }
    const entry = pivotMap.get(key)!;
    entry.byMonth.set(month, (entry.byMonth.get(month) ?? 0) + val);
  }

  const rows = Array.from(pivotMap.values())
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))
    .map((entry) => {
      const values = months.map((m) => entry.byMonth.get(m) ?? 0);
      const total = values.reduce((s, v) => s + v, 0);
      return {
        personName: entry.displayName,
        values: values.map((v) => v.toFixed(2)),
        total: total.toFixed(2),
      };
    });

  return Response.json({ months, rows });
}
