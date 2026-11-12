import { prisma } from "@/lib/prisma";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
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
  const clientId = input.clientId ?? null;

  // A device resending a report whose first response was lost (offline sync):
  // answer with the report already saved instead of creating a duplicate.
  // Checked before the people checks, so it succeeds even if a person changed since.
  const existing = await findByClientId(churchId, clientId);
  if (existing) return Response.json(existing, { status: 200 });

  const peopleError = await checkReportPeople(churchId, input);
  if (peopleError) return Response.json({ error: peopleError }, { status: 400 });

  let report: { id: number };
  try {
    report = await prisma.report.create({
      data: {
        churchId,
        ...reportFields(input),
        clientId,
        deacons: { create: deaconRows(input) },
        tithers: { create: titherRows(input) },
      },
      select: { id: true },
    });
  } catch (e) {
    // Two copies of the same report arrived at the same time: the other one won.
    const winner = isUniqueViolation(e) ? await findByClientId(churchId, clientId) : null;
    if (winner) return Response.json(winner, { status: 200 });
    throw e;
  }

  await ensurePeopleExist(churchId, input);

  return Response.json(report, { status: 201 });
}

function findByClientId(churchId: number, clientId: string | null) {
  if (!clientId) return Promise.resolve(null);
  return prisma.report.findUnique({
    where: { churchId_clientId: { churchId, clientId } },
    select: { id: true },
  });
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
