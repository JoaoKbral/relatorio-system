// The signature image of one person, printed on the REFC report.
// The browser processes the upload (transparent background, trimmed, resized)
// and sends the resulting PNG as the raw request body.
import { prisma } from "@/lib/prisma";
import { requireChurchAdmin, requireChurchSession } from "@/lib/auth";
import { readPngSize } from "@/lib/png";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 300 * 1024;
const MAX_SIDE = 2000;

const notFound = () => Response.json({ error: "Não encontrado" }, { status: 404 });

/** The person id if it belongs to the church, else null. */
async function churchPersonId(params: Params["params"], churchId: number): Promise<number | null> {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const person = await prisma.person.findFirst({ where: { id, churchId }, select: { id: true } });
  return person?.id ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  const result = await requireChurchSession(req);
  if (!result.ok) return result.response;

  const personId = await churchPersonId(params, result.data.churchId);
  if (!personId) return notFound();

  const signature = await prisma.personSignature.findUnique({ where: { personId } });
  if (!signature) return notFound();

  return new Response(new Uint8Array(signature.data), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const result = await requireChurchAdmin(req);
  if (!result.ok) return result.response;

  const personId = await churchPersonId(params, result.data.churchId);
  if (!personId) return notFound();

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) {
    return Response.json({ error: "Imagem muito grande (máx. 300 KB)." }, { status: 413 });
  }
  const data = new Uint8Array(await req.arrayBuffer());
  if (data.length > MAX_BYTES) {
    return Response.json({ error: "Imagem muito grande (máx. 300 KB)." }, { status: 413 });
  }
  const size = readPngSize(data);
  if (!size) return Response.json({ error: "Envie uma imagem PNG." }, { status: 400 });
  if (size.width > MAX_SIDE || size.height > MAX_SIDE) {
    return Response.json({ error: "Imagem com dimensões muito grandes." }, { status: 400 });
  }

  const signature = await prisma.personSignature.upsert({
    where: { personId },
    create: { personId, data, ...size },
    update: { data, ...size },
    select: { updatedAt: true },
  });
  return Response.json({ updatedAt: signature.updatedAt });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const result = await requireChurchAdmin(req);
  if (!result.ok) return result.response;

  const personId = await churchPersonId(params, result.data.churchId);
  if (!personId) return notFound();

  await prisma.personSignature.deleteMany({ where: { personId } });
  return new Response(null, { status: 204 });
}
