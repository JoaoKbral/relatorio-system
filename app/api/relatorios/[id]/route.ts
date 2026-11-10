import { prisma } from "@/lib/prisma";
import { requireChurchSession, requireChurchAdmin } from "@/lib/auth";
import { NextRequest } from "next/server";
import {
  checkReportPeople,
  deaconRows,
  ensurePeopleExist,
  parseReportInput,
  reportFields,
  reportWithPeople,
  titherRows,
} from "@/lib/reports";

type Params = { params: Promise<{ id: string }> };

const notFound = () => Response.json({ error: "Não encontrado" }, { status: 404 });

async function reportId(params: Params["params"]): Promise<number | null> {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const id = await reportId(params);
  if (!id) return notFound();

  const report = await prisma.report.findFirst({
    where: { id, churchId },
    include: reportWithPeople,
  });
  if (!report) return notFound();
  return Response.json(report);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const id = await reportId(params);
  if (!id) return notFound();

  const existing = await prisma.report.findFirst({
    where: { id, churchId },
    select: { treasurerId: true },
  });
  if (!existing) return notFound();

  const parsed = parseReportInput(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.data;

  const peopleError = await checkReportPeople(churchId, input, existing.treasurerId);
  if (peopleError) return Response.json({ error: peopleError }, { status: 400 });

  // Deacons and tithers are replaced wholesale, in one transaction.
  await prisma.report.update({
    where: { id },
    data: {
      ...reportFields(input),
      deacons: { deleteMany: {}, create: deaconRows(input) },
      tithers: { deleteMany: {}, create: titherRows(input) },
    },
  });

  await ensurePeopleExist(churchId, input);

  return Response.json({ id });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireChurchAdmin(req);
  if (!result.ok) return result.response;
  const { churchId } = result.data;

  const id = await reportId(params);
  if (!id) return notFound();

  const { count } = await prisma.report.deleteMany({ where: { id, churchId } });
  if (count === 0) return notFound();
  return new Response(null, { status: 204 });
}
