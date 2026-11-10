import { prisma } from "@/lib/prisma";
import { requireChurchSession, requireChurchAdmin } from "@/lib/auth";
import { NextRequest } from "next/server";
import { isPersonRole } from "@/lib/roles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireChurchSession(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;
  const person = await prisma.person.findFirst({
    where: { id: Number(id) || 0, churchId },
    include: { signature: { select: { updatedAt: true } } },
  });
  if (!person) return Response.json({ error: "Não encontrado" }, { status: 404 });
  const { signature, ...rest } = person;
  return Response.json({ ...rest, signatureUpdatedAt: signature?.updatedAt ?? null });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireChurchAdmin(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;

  const existing = await prisma.person.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.churchId !== churchId) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) ?? {};
  const { name, roles, active } = body as {
    name?: string;
    roles?: string[];
    active?: boolean;
  };

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
  }
  if (roles !== undefined && (!Array.isArray(roles) || !roles.every((r) => typeof r === "string" && isPersonRole(r)))) {
    return Response.json({ error: "Categoria inválida" }, { status: 400 });
  }

  const person = await prisma.person.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(roles !== undefined ? { roles } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });

  return Response.json(person);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireChurchAdmin(req)
  if (!result.ok) return result.response
  const { churchId } = result.data

  const { id } = await params;

  const existing = await prisma.person.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.churchId !== churchId) {
    return Response.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.person.update({
    where: { id: Number(id) },
    data: { active: false },
  });
  return new Response(null, { status: 204 });
}
