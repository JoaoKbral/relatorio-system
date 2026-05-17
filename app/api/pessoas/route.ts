// TODO: ERP integration point
// When the ERP is ready, replace the local `pessoas` table as the source of
// names and roles (Membro, Pastor, Diacono, Lider, Pregador).
// The GET handler below should query the ERP API instead of (or in addition to)
// Prisma, and the POST handler can be removed or restricted to non-ERP records.
import { prisma } from "@/lib/prisma";
import { requireChurchSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

type PersonRow = {
  id: number;
  name: string;
  roles: string[];
  active: boolean;
  churchId: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(req: NextRequest) {
  const result = await requireChurchSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const role = searchParams.get("role");

  const conditions: Prisma.Sql[] = [
    Prisma.sql`"churchId" = ${churchId}`,
    Prisma.sql`active = true`,
  ];
  if (q) conditions.push(Prisma.sql`unaccent(name) ILIKE unaccent(${`%${q}%`})`);
  if (role) conditions.push(Prisma.sql`${role} = ANY(roles)`);

  const people = await prisma.$queryRaw<PersonRow[]>(
    Prisma.sql`SELECT id, name, roles, active, "churchId", "createdAt", "updatedAt" FROM "Person" WHERE ${Prisma.join(conditions, " AND ")} ORDER BY name ASC LIMIT 50`
  );

  return Response.json(people);
}

export async function POST(req: NextRequest) {
  const result = await requireChurchSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const body = await req.json();
  const { name, roles } = body as { name: string; roles: string[] };

  if (!name?.trim()) {
    return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const existing = await prisma.$queryRaw<PersonRow[]>(
    Prisma.sql`SELECT id, name, roles, active, "churchId", "createdAt", "updatedAt" FROM "Person" WHERE "churchId" = ${churchId} AND active = true AND unaccent(name) ILIKE unaccent(${name.trim()}) LIMIT 1`
  );
  if (existing.length > 0) return Response.json(existing[0]);

  const person = await prisma.person.create({
    data: { churchId, name: name.trim(), roles: roles ?? [] },
  });

  return Response.json(person, { status: 201 });
}
