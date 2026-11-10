import { prisma } from "@/lib/prisma";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  checkReportPeople,
  deaconRows,
  ensurePeopleExist,
  parseReportInput,
  reportFields,
  titherRows,
} from "@/lib/reports";

export async function GET(req: NextRequest) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 1-12, absent = whole year

  const where: { churchId: number; dataCulto?: { gte: Date; lt: Date } } = { churchId };
  if (Number.isInteger(year) && year > 0) {
    // dataCulto is stored as UTC midnight, so the range must be in UTC too.
    const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12;
    where.dataCulto = hasMonth
      ? { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) }
      : { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ dataCulto: "desc" }, { horario: "desc" }],
    select: {
      id: true,
      dataCulto: true,
      diaDaSemana: true,
      pregador: true,
      totalPresentes: true,
      horario: true,
    },
  });

  return Response.json(reports);
}

export async function POST(req: NextRequest) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const parsed = parseReportInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data;

  const peopleError = await checkReportPeople(churchId, input);
  if (peopleError) return Response.json({ error: peopleError }, { status: 400 });

  const report = await prisma.report.create({
    data: {
      churchId,
      ...reportFields(input),
      deacons: { create: deaconRows(input) },
      tithers: { create: titherRows(input) },
    },
    select: { id: true },
  });

  await ensurePeopleExist(churchId, input);

  return Response.json(report, { status: 201 });
}
