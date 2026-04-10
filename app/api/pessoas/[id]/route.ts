import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/session";
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await decrypt(req.cookies.get("session")?.value)) return Response.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id: Number(id) } });
  if (!person) return Response.json({ error: "Não encontrado" }, { status: 404 });
  return Response.json(person);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await decrypt(req.cookies.get("session")?.value)) return Response.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params;
  const body = await req.json();
  const { name, roles, active } = body as {
    name?: string;
    roles?: string[];
    active?: boolean;
  };

  if (name !== undefined && !name.trim()) {
    return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
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
  if (!await decrypt(req.cookies.get("session")?.value)) return Response.json({ error: "Não autorizado" }, { status: 401 })
  const { id } = await params;
  // Soft delete
  await prisma.person.update({
    where: { id: Number(id) },
    data: { active: false },
  });
  return new Response(null, { status: 204 });
}
