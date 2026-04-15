// TODO: ERP integration point
// When the ERP is ready, replace the local `pessoas` table as the source of
// names and roles (Membro, Pastor, Diacono, Lider, Pregador).
// The GET handler below should query the ERP API instead of (or in addition to)
// Prisma, and the POST handler can be removed or restricted to non-ERP records.
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const role = searchParams.get("role");

  const people = await prisma.person.findMany({
    where: {
      churchId,
      active: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(role ? { roles: { has: role } } : {}),
    },
    orderBy: { name: "asc" },
    ...(role === "diacono" ? {} : { take: 20 }),
  });

  return Response.json(people);
}

export async function POST(req: NextRequest) {
  const result = await requireSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const body = await req.json();
  const { name, roles } = body as { name: string; roles: string[] };

  if (!name?.trim()) {
    return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const person = await prisma.person.create({
    data: { churchId, name: name.trim(), roles: roles ?? [] },
  });

  return Response.json(person, { status: 201 });
}
