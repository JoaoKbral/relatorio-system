// Client-side state of the report form and its conversion to/from the API.
import type { ReportInput } from "@/lib/report-schema";

export type PaymentMethod = "DINHEIRO" | "PIX";

export interface PersonOption {
  id: number;
  name: string;
}

export interface TitherRow {
  /** Stable React key; not sent to the server. */
  key: number;
  personName: string;
  paymentMethod: PaymentMethod;
  value: number;
}

export interface FormValues {
  dataCulto: string; // YYYY-MM-DD
  horario: string; // HH:MM
  pregador: string;
  testemunhoCura: number;
  conversoes: number;
  batizadosEspirito: number;
  visitantes: number;
  criancasApresentadas: number;
  totalPresentes: number;
  /** Registered pastors ticked in the checklist. */
  pastoresCheckbox: string[];
  /** Free-text pastors not in the registry; always ends with an empty slot. */
  pastoresExtras: string[];
  visitasEspeciais: string[];
  tithers: TitherRow[];
  deaconsInService: number[];
  /** Subset of deaconsInService, max 2, in the order they were picked. */
  responsibleDeacons: number[];
  treasurerId: number | null;
  totalOfertasGerais: number;
  totalOfertasEspeciais: number;
  totalOfertasMissoes: number;
}

export const STAT_FIELDS = [
  { key: "testemunhoCura", label: "Testemunhos de Cura" },
  { key: "conversoes", label: "Conversões" },
  { key: "batizadosEspirito", label: "Batizados no Esp. Santo" },
  { key: "visitantes", label: "Visitantes" },
  { key: "criancasApresentadas", label: "Crianças Apresentadas" },
  { key: "totalPresentes", label: "Total de Presentes" },
] as const satisfies readonly { key: keyof FormValues; label: string }[];

export const OFFER_FIELDS = [
  { key: "totalOfertasGerais", label: "Ofertas Gerais" },
  { key: "totalOfertasEspeciais", label: "Ofertas Especiais" },
  { key: "totalOfertasMissoes", label: "Oferta de Missões (3º Domingo)" },
] as const satisfies readonly { key: keyof FormValues; label: string }[];

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

export function diaDaSemana(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  return DIAS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

let nextKey = 1;
export function emptyTither(paymentMethod: PaymentMethod = "PIX"): TitherRow {
  return { key: nextKey++, personName: "", paymentMethod, value: 0 };
}

function todayISO(): string {
  // Local date, not UTC: late-evening services must not jump to tomorrow.
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function emptyFormValues(): FormValues {
  return {
    dataCulto: todayISO(),
    horario: "",
    pregador: "",
    testemunhoCura: 0,
    conversoes: 0,
    batizadosEspirito: 0,
    visitantes: 0,
    criancasApresentadas: 0,
    totalPresentes: 0,
    pastoresCheckbox: [],
    pastoresExtras: [""],
    visitasEspeciais: [""],
    tithers: [emptyTither()],
    deaconsInService: [],
    responsibleDeacons: [],
    treasurerId: null,
    totalOfertasGerais: 0,
    totalOfertasEspeciais: 0,
    totalOfertasMissoes: 0,
  };
}

/** Report as returned by GET /api/relatorios/[id]. */
export interface ReportResponse {
  dataCulto: string;
  horario: string;
  pregador: string;
  pastoresPresentes: string[];
  visitasEspeciais: string[];
  testemunhoCura: number;
  conversoes: number;
  batizadosEspirito: number;
  visitantes: number;
  criancasApresentadas: number;
  totalPresentes: number;
  totalOfertasGerais: string;
  totalOfertasEspeciais: string;
  totalOfertasMissoes: string | null;
  treasurer: PersonOption | null;
  deacons: { personId: number; responsible: boolean; person: { name: string } }[];
  tithers: { personName: string; paymentMethod: PaymentMethod | null; value: string }[];
}

export function formValuesFromReport(report: ReportResponse, knownPastors: string[]): FormValues {
  const known = new Set(knownPastors);
  const extras = report.pastoresPresentes.filter((p) => !known.has(p));
  return {
    dataCulto: report.dataCulto.slice(0, 10),
    horario: report.horario,
    pregador: report.pregador,
    testemunhoCura: report.testemunhoCura,
    conversoes: report.conversoes,
    batizadosEspirito: report.batizadosEspirito,
    visitantes: report.visitantes,
    criancasApresentadas: report.criancasApresentadas,
    totalPresentes: report.totalPresentes,
    pastoresCheckbox: report.pastoresPresentes.filter((p) => known.has(p)),
    pastoresExtras: [...extras, ""],
    visitasEspeciais: [...report.visitasEspeciais, ""],
    tithers: [
      ...report.tithers.map((t) => ({
        key: nextKey++,
        personName: t.personName,
        paymentMethod: t.paymentMethod ?? "PIX",
        value: Number(t.value),
      })),
      emptyTither(report.tithers.at(-1)?.paymentMethod ?? "PIX"),
    ],
    deaconsInService: report.deacons.map((d) => d.personId),
    responsibleDeacons: report.deacons.filter((d) => d.responsible).map((d) => d.personId),
    treasurerId: report.treasurer?.id ?? null,
    totalOfertasGerais: Number(report.totalOfertasGerais),
    totalOfertasEspeciais: Number(report.totalOfertasEspeciais),
    totalOfertasMissoes: Number(report.totalOfertasMissoes ?? 0),
  };
}

export function allPastors(values: FormValues): string[] {
  return [...values.pastoresCheckbox, ...values.pastoresExtras.map((p) => p.trim()).filter(Boolean)];
}

export function filledTithers(values: FormValues): TitherRow[] {
  return values.tithers.filter((t) => t.personName.trim());
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function totals(values: FormValues) {
  const totalDizimos = values.tithers.reduce((sum, t) => sum + t.value, 0);
  const arrecadacaoTotal =
    totalDizimos + values.totalOfertasGerais + values.totalOfertasEspeciais;
  return { totalDizimos, arrecadacaoTotal };
}

export function toPayload(values: FormValues): ReportInput {
  return {
    dataCulto: values.dataCulto,
    horario: values.horario,
    pregador: values.pregador,
    pastoresPresentes: allPastors(values),
    visitasEspeciais: values.visitasEspeciais,
    testemunhoCura: values.testemunhoCura,
    conversoes: values.conversoes,
    batizadosEspirito: values.batizadosEspirito,
    visitantes: values.visitantes,
    criancasApresentadas: values.criancasApresentadas,
    totalPresentes: values.totalPresentes,
    treasurerId: values.treasurerId ?? 0,
    // Responsible deacons first, in the order picked: that is their slot order
    // in the printed report.
    deacons: [
      ...values.responsibleDeacons.map((personId) => ({ personId, responsible: true })),
      ...values.deaconsInService
        .filter((id) => !values.responsibleDeacons.includes(id))
        .map((personId) => ({ personId, responsible: false })),
    ],
    tithers: filledTithers(values).map((t) => ({
      personName: t.personName.trim(),
      paymentMethod: t.paymentMethod,
      value: t.value,
    })),
    totalOfertasGerais: values.totalOfertasGerais,
    totalOfertasEspeciais: values.totalOfertasEspeciais,
    totalOfertasMissoes: values.totalOfertasMissoes,
  };
}

/** Back from a payload saved on the device (editing a pending offline report). */
export function formValuesFromPayload(p: ReportInput, knownPastors: string[]): FormValues {
  const known = new Set(knownPastors);
  const num = (v: unknown) => Number(v) || 0;
  const tithers: TitherRow[] = p.tithers.map((t) => ({
    key: nextKey++,
    personName: t.personName,
    paymentMethod: t.paymentMethod ?? "PIX",
    value: num(t.value),
  }));
  return {
    dataCulto: p.dataCulto,
    horario: p.horario,
    pregador: p.pregador,
    testemunhoCura: num(p.testemunhoCura),
    conversoes: num(p.conversoes),
    batizadosEspirito: num(p.batizadosEspirito),
    visitantes: num(p.visitantes),
    criancasApresentadas: num(p.criancasApresentadas),
    totalPresentes: num(p.totalPresentes),
    pastoresCheckbox: p.pastoresPresentes.filter((n) => known.has(n)),
    pastoresExtras: [...p.pastoresPresentes.filter((n) => n && !known.has(n)), ""],
    visitasEspeciais: [...p.visitasEspeciais.filter(Boolean), ""],
    tithers: [...tithers, emptyTither(tithers.at(-1)?.paymentMethod ?? "PIX")],
    deaconsInService: p.deacons.map((d) => d.personId),
    responsibleDeacons: p.deacons.filter((d) => d.responsible).map((d) => d.personId),
    treasurerId: p.treasurerId || null,
    totalOfertasGerais: num(p.totalOfertasGerais),
    // Payloads queued before "outras entradas" was removed may still carry it:
    // fold it into the special offerings so the value is not lost.
    totalOfertasEspeciais: num(p.totalOfertasEspeciais) + num(p.outrasEntradas),
    totalOfertasMissoes: num(p.totalOfertasMissoes),
  };
}
