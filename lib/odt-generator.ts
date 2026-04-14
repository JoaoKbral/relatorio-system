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
// starting from (offset + 1) so multi-page copies don't collide.
function indexDuplicateTagsWithOffset(xml: string, tagName: string, offset: number): string {
  let i = offset;
  return xml.replace(new RegExp(`\\{\\{${tagName}\\}\\}`, "g"), () => `{{${tagName}${++i}}}`);
}

// For tags already numbered in the template (e.g. {{nomeDizimista1}} … {{nomeDizimista10}}),
// shift each number by (pageIndex * slotsPerPage) so pages don't share tag names.
function reindexNumberedTags(
  xml: string,
  tagName: string,
  pageIndex: number,
  slotsPerPage: number
): string {
  if (pageIndex === 0) return xml; // first page: keep original numbers
  for (let slot = 1; slot <= slotsPerPage; slot++) {
    const newIndex = pageIndex * slotsPerPage + slot;
    xml = xml.replaceAll(`{{${tagName}${slot}}}`, `{{${tagName}${newIndex}}}`);
  }
  return xml;
}

const TITHERS_PER_PAGE = 10;
const PASTORS_PER_PAGE = 6;
const VISITAS_PER_PAGE = 2;
const DIACONOS_PER_PAGE = 2;

export function generateOdt(report: ReportData): Buffer {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "template",
    "REFC-template.docx"
  );
  const templateBuf = fs.readFileSync(templatePath);

  const zip = new PizZip(templateBuf);

  const sorted = [...report.tithers].sort((a, b) => a.order - b.order);
  const numPages = Math.max(1, Math.ceil(sorted.length / TITHERS_PER_PAGE));

  // --- Extract raw body content from the template XML ---
  const bodyOpenTag = "<w:body>";
  const bodyCloseTag = "</w:body>";
  const rawXml = zip.file("word/document.xml")!.asText();
  const bodyStart = rawXml.indexOf(bodyOpenTag) + bodyOpenTag.length;
  const bodyEnd = rawXml.lastIndexOf(bodyCloseTag);

  const beforeBody = rawXml.slice(0, bodyStart);
  const afterBody = rawXml.slice(bodyEnd); // includes </w:body></w:document>
  let rawBodyContent = rawXml.slice(bodyStart, bodyEnd);

  // Separate trailing <w:sectPr> (page/section properties) — must appear only once at the end
  const sectPrMatch = rawBodyContent.match(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/);
  let sectPr = "";
  if (sectPrMatch) {
    sectPr = sectPrMatch[0];
    rawBodyContent = rawBodyContent.slice(0, rawBodyContent.length - sectPrMatch[0].length);
  }

  // Page break paragraph inserted between duplicated pages
  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // --- Build the full body XML, duplicating the template per page needed ---
  let fullBodyContent = "";
  for (let page = 0; page < numPages; page++) {
    let pageContent = rawBodyContent;

    // Index unnumbered repeated tags (each occurrence gets a unique number)
    pageContent = indexDuplicateTagsWithOffset(pageContent, "pastorPresente", page * PASTORS_PER_PAGE);
    pageContent = indexDuplicateTagsWithOffset(pageContent, "visitaEspecial", page * VISITAS_PER_PAGE);
    pageContent = indexDuplicateTagsWithOffset(pageContent, "diaconoResponsavel", page * DIACONOS_PER_PAGE);

    // Shift already-numbered tithe tags so pages don't clash
    pageContent = reindexNumberedTags(pageContent, "nomeDizimista", page, TITHERS_PER_PAGE);
    pageContent = reindexNumberedTags(pageContent, "valorDizimo", page, TITHERS_PER_PAGE);

    if (page > 0) fullBodyContent += pageBreak;
    fullBodyContent += pageContent;
  }

  fullBodyContent += sectPr;
  zip.file("word/document.xml", beforeBody + fullBodyContent + afterBody);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });

  // --- Build render data ---

  // Tither slots across all pages
  const titherData: Record<string, string> = {};
  for (let i = 1; i <= numPages * TITHERS_PER_PAGE; i++) {
    const t = sorted[i - 1];
    titherData[`nomeDizimista${i}`] = t?.personName ?? "";
    titherData[`valorDizimo${i}`] = t ? formatCurrency(t.value) : "";
  }

  // Pastor slots — same names repeated for every page
  const pastorData: Record<string, string> = {};
  for (let page = 0; page < numPages; page++) {
    for (let i = 1; i <= PASTORS_PER_PAGE; i++) {
      pastorData[`pastorPresente${page * PASTORS_PER_PAGE + i}`] =
        report.pastoresPresentes[i - 1] ?? "";
    }
  }

  // Visita especial slots — same values per page
  const visitaData: Record<string, string> = {};
  for (let page = 0; page < numPages; page++) {
    visitaData[`visitaEspecial${page * VISITAS_PER_PAGE + 1}`] = report.visitasEspeciais[0] ?? "";
    visitaData[`visitaEspecial${page * VISITAS_PER_PAGE + 2}`] = report.visitasEspeciais[1] ?? "";
  }

  // Diacono slots — same values per page
  const diaconoData: Record<string, string> = {};
  for (let page = 0; page < numPages; page++) {
    diaconoData[`diaconoResponsavel${page * DIACONOS_PER_PAGE + 1}`] =
      report.diaconosResponsaveis[0] ?? "";
    diaconoData[`diaconoResponsavel${page * DIACONOS_PER_PAGE + 2}`] =
      report.diaconosResponsaveis[1] ?? "";
  }

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

  // Normalize all font sizes to 9pt (18 half-points) in the generated document
  const outZip = doc.getZip();
  let docXml = outZip.file("word/document.xml")!.asText();
  docXml = docXml.replace(/<w:sz w:val="\d+"\s*\/>/g, '<w:sz w:val="18"/>');
  docXml = docXml.replace(/<w:szCs w:val="\d+"\s*\/>/g, '<w:szCs w:val="18"/>');
  outZip.file("word/document.xml", docXml);

  return outZip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
