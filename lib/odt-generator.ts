import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Decimal } from "@prisma/client/runtime/client";

// Fixed church data — sourced from environment variables
const CHURCH_DATA = {
  igrejaComCidadeEBairro: process.env.CHURCH_CITY ?? "",
  CNPJ: process.env.CHURCH_CNPJ ?? "",
  nomePastorTitular: process.env.CHURCH_PASTOR ?? "",
  prontuarioTitular: process.env.CHURCH_PRONTUARIO ?? "",
};

function formatCurrency(value: Decimal | null | undefined): string {
  if (!value) return "";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

interface TitheRecord {
  personName: string;
  chequeNumber: string | null;
  bankNumber: string | null;
  value: Decimal;
  order: number;
}

interface ReportData {
  dataCulto: Date;
  diaDaSemana: string;
  horario: string;
  pregador: string;
  pastoresPresentes: string[];
  visitasEspeciais: string[];
  testemunhoCura: number;
  conversoes: number;
  batizadosEspirito: number;
  visitantes: number;
  diaconosServico: number;
  criancasApresentadas: number;
  totalPresentes: number;
  totalOfertasGerais: Decimal;
  totalOfertasEspeciais: Decimal;
  outrasEntradas: Decimal;
  arrecadacaoTotal: Decimal;
  totalOfertasMissoes: Decimal | null;
  totalDizimos: Decimal;
  diaconosResponsaveis: string[];
  tithers: TitheRecord[];
}

export function generateOdt(report: ReportData): Buffer {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "template",
    "REFC-template.odt"
  );
  const templateBuf = fs.readFileSync(templatePath);

  const zip = new PizZip(templateBuf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Build tither data (slots 1-10 for template page 1; 11-20 for page 2 if template supports it)
  const titherData: Record<string, string> = {};
  const sorted = [...report.tithers].sort((a, b) => a.order - b.order);
  for (let i = 1; i <= Math.max(20, sorted.length); i++) {
    const t = sorted[i - 1];
    titherData[`nomeDizimista${i}`] = t?.personName ?? "";
    titherData[`valorDizimo${i}`] = t ? formatCurrency(t.value) : "";
  }

  doc.render({
    ...CHURCH_DATA,
    dataCulto: formatDate(report.dataCulto),
    diaDaSemana: report.diaDaSemana,
    horario: report.horario,
    pregador: report.pregador,
    pastorPresente: report.pastoresPresentes.join(", "),
    visitaEspecial1: report.visitasEspeciais[0] ?? "",
    visitaEspecial2: report.visitasEspeciais[1] ?? "",
    TestemunhoDeCura: String(report.testemunhoCura),
    conversoes: String(report.conversoes),
    batizadosNoEspiritoSanto: String(report.batizadosEspirito),
    visitantes: String(report.visitantes),
    QuantidadeDeDiaconosPresentes: String(report.diaconosServico),
    criancasApresentadas: String(report.criancasApresentadas),
    presentes: String(report.totalPresentes),
    totalOfertasGerais: formatCurrency(report.totalOfertasGerais),
    totalOfertasEspeciais: formatCurrency(report.totalOfertasEspeciais),
    outrasEntradas: formatCurrency(report.outrasEntradas),
    arrecadacaoTotal: formatCurrency(report.arrecadacaoTotal),
    totalOfertasMissoes: formatCurrency(report.totalOfertasMissoes),
    totalDizimos: formatCurrency(report.totalDizimos),
    diaconoResponsavel: report.diaconosResponsaveis.join(", "),
    ...titherData,
  });

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
