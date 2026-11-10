// Server-side report logic shared by POST /api/relatorios and PUT /api/relatorios/[id].
import "server-only";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";
import { prisma } from "@/lib/prisma";
import { reportInputSchema, type ValidReportInput } from "@/lib/report-schema";

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Validates a request body; the error is a pt-BR message for the user. */
export function parseReportInput(body: unknown): Result<ValidReportInput> {
  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Checks that the treasurer and deacons are people of this church.
 * The treasurer must be active and have the "tesoureiro" role, except when the
 * report already had that treasurer (editing an old report must not fail just
 * because the person later changed role).
 */
export async function checkReportPeople(
  churchId: number,
  input: ValidReportInput,
  currentTreasurerId?: number | null
): Promise<string | null> {
  const treasurer = await prisma.person.findFirst({
    where: { id: input.treasurerId, churchId },
    select: { id: true, active: true, roles: true },
  });
  if (!treasurer) return "Tesoureiro não encontrado.";
  const unchanged = treasurer.id === currentTreasurerId;
  if (!unchanged && (!treasurer.active || !treasurer.roles.includes("tesoureiro"))) {
    return "A pessoa selecionada não está cadastrada como tesoureiro.";
  }

  const deaconIds = input.deacons.map((d) => d.personId);
  const found = await prisma.person.count({ where: { id: { in: deaconIds }, churchId } });
  if (found !== deaconIds.length) return "Diácono não encontrado.";

  return null;
}

/** Report columns computed from the input (everything except relations). */
export function reportFields(input: ValidReportInput) {
  const toDecimal = (v: number) => new Decimal(v).toDecimalPlaces(2);

  const totalDizimos = input.tithers.reduce((sum, t) => sum.add(toDecimal(t.value)), new Decimal(0));
  const totalOfertasGerais = toDecimal(input.totalOfertasGerais);
  const totalOfertasEspeciais = toDecimal(input.totalOfertasEspeciais);
  const outrasEntradas = toDecimal(input.outrasEntradas);
  // Missions offering is recorded separately and is not part of the total.
  const arrecadacaoTotal = totalDizimos.add(totalOfertasGerais).add(totalOfertasEspeciais).add(outrasEntradas);

  // dataCulto is a plain date: store it as UTC midnight and derive the weekday in UTC.
  const dataCulto = new Date(`${input.dataCulto}T00:00:00.000Z`);

  return {
    dataCulto,
    diaDaSemana: DIAS[dataCulto.getUTCDay()],
    horario: input.horario,
    pregador: input.pregador,
    pastoresPresentes: input.pastoresPresentes,
    visitasEspeciais: input.visitasEspeciais,
    testemunhoCura: input.testemunhoCura,
    conversoes: input.conversoes,
    batizadosEspirito: input.batizadosEspirito,
    visitantes: input.visitantes,
    criancasApresentadas: input.criancasApresentadas,
    totalPresentes: input.totalPresentes,
    diaconosServico: input.deacons.length,
    totalOfertasGerais,
    totalOfertasEspeciais,
    outrasEntradas,
    totalOfertasMissoes: input.totalOfertasMissoes > 0 ? toDecimal(input.totalOfertasMissoes) : null,
    totalDizimos,
    arrecadacaoTotal,
    treasurerId: input.treasurerId,
  } satisfies Omit<Prisma.ReportUncheckedCreateInput, "churchId">;
}

export function deaconRows(input: ValidReportInput) {
  // Responsible deacons first so their order matches the signature slots
  // (stable sort keeps the order they were picked in).
  const sorted = [...input.deacons].sort((a, b) => Number(b.responsible) - Number(a.responsible));
  return sorted.map((d, i) => ({ personId: d.personId, responsible: d.responsible, order: i + 1 }));
}

export function titherRows(input: ValidReportInput) {
  return input.tithers.map((t, i) => ({
    personName: t.personName,
    paymentMethod: t.paymentMethod,
    value: new Decimal(t.value).toDecimalPlaces(2),
    order: i + 1,
  }));
}

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Creates a Person (role "membro") for every free-text name in the report that
 * does not exist yet in the church, matching accent- and case-insensitively.
 */
export async function ensurePeopleExist(churchId: number, input: ValidReportInput): Promise<void> {
  const rawNames = [
    input.pregador,
    ...input.pastoresPresentes,
    ...input.visitasEspeciais,
    ...input.tithers.map((t) => t.personName),
  ].filter(Boolean);

  const byKey = new Map<string, string>();
  for (const name of rawNames) {
    const key = stripAccents(name);
    if (!byKey.has(key)) byKey.set(key, name);
  }
  if (byKey.size === 0) return;

  const names = [...byKey.values()];
  const existing = await prisma.$queryRaw<{ name: string }[]>(
    Prisma.sql`SELECT name FROM "Person"
               WHERE "churchId" = ${churchId}
                 AND lower(unaccent(name)) IN (${Prisma.join(names.map((n) => Prisma.sql`lower(unaccent(${n}))`))})`
  );
  const existingKeys = new Set(existing.map((p) => stripAccents(p.name)));
  const toCreate = names.filter((n) => !existingKeys.has(stripAccents(n)));
  if (toCreate.length === 0) return;

  await prisma.person.createMany({
    data: toCreate.map((name) => ({ churchId, name, roles: ["membro"] })),
  });
}

/** Relations needed to render a report (view page and DOCX). */
export const reportWithPeople = {
  tithers: { orderBy: { order: "asc" } },
  treasurer: { select: { id: true, name: true } },
  deacons: {
    orderBy: { order: "asc" },
    select: { personId: true, responsible: true, person: { select: { name: true } } },
  },
} satisfies Prisma.ReportInclude;

export type ReportWithPeople = Prisma.ReportGetPayload<{ include: typeof reportWithPeople }>;
