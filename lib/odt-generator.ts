import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Decimal } from "@prisma/client/runtime/client";

// NOTE: Template must be REFC-template.docx (DOCX format).
// To convert: open REFC-template.odt in LibreOffice → File → Save As → .docx

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
  responsavelPeloRelatorio?: string | null;
  tithers: TitheRecord[];
}

// Replaces repeated occurrences of {{tag}} with {{tag1}}, {{tag2}}, etc.
// so each table row slot can receive a different value.
function indexDuplicateTags(xml: string, tagName: string): string {
  let i = 0;
  return xml.replace(new RegExp(`\\{\\{${tagName}\\}\\}`, "g"), () => `{{${tagName}${++i}}}`);
}

export function generateOdt(report: ReportData): Buffer {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "template",
    "REFC-template.docx"
  );
  const templateBuf = fs.readFileSync(templatePath);

  const zip = new PizZip(templateBuf);

  // Number duplicate list tags so each row gets a distinct value
  let xml = zip.file("word/document.xml")!.asText();
  xml = indexDuplicateTags(xml, "pastorPresente");     // 6 slots
  xml = indexDuplicateTags(xml, "visitaEspecial");     // 2 slots
  xml = indexDuplicateTags(xml, "diaconoResponsavel"); // 2 slots
  zip.file("word/document.xml", xml);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  // Build tither data (slots 1-10 for template)
  const titherData: Record<string, string> = {};
  const sorted = [...report.tithers].sort((a, b) => a.order - b.order);
  for (let i = 1; i <= Math.max(10, sorted.length); i++) {
    const t = sorted[i - 1];
    titherData[`nomeDizimista${i}`] = t?.personName ?? "";
    titherData[`valorDizimo${i}`] = t ? formatCurrency(t.value) : "";
  }

  // Build pastor/deacon/visit slot data (one name per numbered slot)
  const pastorData: Record<string, string> = {};
  for (let i = 1; i <= 6; i++) {
    pastorData[`pastorPresente${i}`] = report.pastoresPresentes[i - 1] ?? "";
  }

  const visitaData: Record<string, string> = {
    visitaEspecial1: report.visitasEspeciais[0] ?? "",
    visitaEspecial2: report.visitasEspeciais[1] ?? "",
  };

  const diaconoData: Record<string, string> = {
    diaconoResponsavel1: report.diaconosResponsaveis[0] ?? "",
    diaconoResponsavel2: report.diaconosResponsaveis[1] ?? "",
  };

  doc.render({
    ...CHURCH_DATA,
    dataCulto: formatDate(report.dataCulto),
    diaDaSemana: report.diaDaSemana,
    horario: report.horario,
    pregador: report.pregador,
    ...pastorData,
    ...visitaData,
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
    ...diaconoData,
    responsavelPeloRelatorio: report.responsavelPeloRelatorio ?? "",
    ...titherData,
  });

  // Normalize all font sizes to 10pt (20 half-points) in the generated document
  const outZip = doc.getZip();
  let docXml = outZip.file("word/document.xml")!.asText();
  docXml = docXml.replace(/<w:sz w:val="\d+"\s*\/>/g, '<w:sz w:val="18"/>');
  docXml = docXml.replace(/<w:szCs w:val="\d+"\s*\/>/g, '<w:szCs w:val="18"/>');
  outZip.file("word/document.xml", docXml);

  return outZip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
