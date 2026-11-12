// Shape of a report as sent by the form to POST/PUT /api/relatorios.
// Shared by the client (payload type) and the server (validation).
import { z } from "zod";

export const MAX_RESPONSIBLE_DEACONS = 2;
const TREASURER_REQUIRED = "Selecione o tesoureiro responsável pelo relatório.";

const count = z.coerce.number().int().min(0, "Valores não podem ser negativos.");
const money = z.coerce
  .number()
  .min(0, "Valores não podem ser negativos.")
  .max(99_999_999.99, "Valor muito alto.");
const name = z.string().trim().max(200, "Nome muito longo.");
const nameList = z
  .array(name)
  .max(50)
  .transform((names) => names.filter(Boolean));

export const titherInputSchema = z.object({
  personName: name,
  paymentMethod: z.enum(["DINHEIRO", "PIX"]).nullable(),
  value: money,
});

export const reportDeaconInputSchema = z.object({
  personId: z.int().positive(),
  responsible: z.boolean(),
});

export const reportInputSchema = z
  .object({
    dataCulto: z.iso.date("Data do culto inválida."),
    horario: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
    pregador: name.min(1, "Informe o nome do pregador."),
    pastoresPresentes: nameList,
    visitasEspeciais: nameList,
    testemunhoCura: count,
    conversoes: count,
    batizadosEspirito: count,
    visitantes: count,
    criancasApresentadas: count,
    totalPresentes: count,
    treasurerId: z.int(TREASURER_REQUIRED).positive(TREASURER_REQUIRED),
    deacons: z
      .array(reportDeaconInputSchema)
      .min(1, "Selecione ao menos um diácono em serviço.")
      .max(100),
    tithers: z
      .array(titherInputSchema)
      .max(500)
      // Rows without a name are empty form rows; drop them.
      .transform((rows) => rows.filter((t) => t.personName)),
    totalOfertasGerais: money,
    totalOfertasEspeciais: money,
    /**
     * Removed field. Offline payloads queued before the removal may still send
     * it; it is added to totalOfertasEspeciais below so the value is kept.
     */
    outrasEntradas: money.optional(),
    totalOfertasMissoes: money,
    /** Device-generated id (offline sync). Used only on create; PUT ignores it. */
    clientId: z.uuid("Identificador do relatório inválido.").optional(),
  })
  .superRefine((data, ctx) => {
    const ids = data.deacons.map((d) => d.personId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["deacons"], message: "Diácono repetido." });
    }
    const responsible = data.deacons.filter((d) => d.responsible).length;
    if (responsible === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["deacons"],
        message: "Selecione ao menos um diácono responsável.",
      });
    }
    if (responsible > MAX_RESPONSIBLE_DEACONS) {
      ctx.addIssue({
        code: "custom",
        path: ["deacons"],
        message: `No máximo ${MAX_RESPONSIBLE_DEACONS} diáconos responsáveis.`,
      });
    }
  })
  .transform(({ outrasEntradas, ...data }) => ({
    ...data,
    totalOfertasEspeciais: data.totalOfertasEspeciais + (outrasEntradas ?? 0),
  }));

/** What the form sends. */
export type ReportInput = z.input<typeof reportInputSchema>;
/** What the server works with after validation. */
export type ValidReportInput = z.output<typeof reportInputSchema>;
