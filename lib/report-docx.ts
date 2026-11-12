// Fills the REFC Word template (public/template/REFC-template.docx) for one report.
//
// The template is edited by hand in Word. Its {{tag}} names are a contract with
// this file: renaming a tag on one side only leaves a blank field, not an error.
import "server-only";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Decimal } from "@prisma/client/runtime/client";
import { Prisma } from "@prisma/client";

// ─── Input ───────────────────────────────────────────────────────────────────

export interface ChurchData {
  igrejaComCidadeEBairro: string;
  CNPJ: string;
  nomePastorTitular: string;
  prontuarioTitular: string;
}

export function churchDocxData(church: {
  city: string;
  cnpj: string | null;
  pastorName: string | null;
  pastorProntuario: string | null;
}): ChurchData {
  return {
    igrejaComCidadeEBairro: church.city,
    CNPJ: church.cnpj ?? "",
    nomePastorTitular: church.pastorName ?? "",
    prontuarioTitular: church.pastorProntuario ?? "",
  };
}

export interface DocxSignature {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface DocxPerson {
  name: string;
  signature: DocxSignature | null;
}

const signatureSelect = { select: { data: true, width: true, height: true } } as const;

/** Prisma include for everything the DOCX needs, signatures included. */
export const reportForDocx = {
  tithers: { orderBy: { order: "asc" } },
  treasurer: { select: { name: true, signature: signatureSelect } },
  deacons: {
    where: { responsible: true },
    orderBy: { order: "asc" },
    select: { person: { select: { name: true, signature: signatureSelect } } },
  },
} satisfies Prisma.ReportInclude;

export type ReportForDocx = Prisma.ReportGetPayload<{ include: typeof reportForDocx }>;

// ─── Layout constants ────────────────────────────────────────────────────────

const TEMPLATE_PATH = path.join(process.cwd(), "public", "template", "REFC-template.docx");

// Tither slots are numbered in the template ({{nomeDizimista1}}…{{nomeDizimista10}}).
const TITHERS_PER_PAGE = 10;
// Pastor and special-visitor slots are repeated un-numbered tags; how many there
// are is counted from the template, so editing the template needs no code change.
const REPEATED_TAGS = ["pastorPresente", "visitaEspecial"] as const;

// Box a signature is scaled into (keeping its proportions), in EMU (1 cm = 360000).
const SIGNATURE_MAX_WIDTH = 4.5 * 360000;
const SIGNATURE_MAX_HEIGHT = 1.3 * 360000;
// Approximate height of a 9pt text line, used to centre the image on the line,
// plus a small downward nudge so tall signatures clear the row above.
const LINE_HEIGHT = 0.4 * 360000;
const SIGNATURE_NUDGE_DOWN = 0.1 * 360000;

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatCurrency(value: Decimal | null | undefined): string {
  if (!value) return "";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// ─── Template XML helpers ────────────────────────────────────────────────────

/**
 * Word often splits a typed tag over several runs, e.g. `{{` / `pastorPresente` /
 * `}}` after a spell-check mark. Docxtemplater copes with that, but the string
 * processing below does not, so first move each tag's text into the run where
 * the tag starts.
 */
function mergeSplitTags(xml: string): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    if (!para.includes("{")) return para;

    const nodes: { start: number; end: number; text: string }[] = [];
    for (const m of para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) {
      nodes.push({ start: m.index, end: m.index + m[0].length, text: m[1] });
    }
    const full = nodes.map((n) => n.text).join("");
    if (!full.includes("{{")) return para;

    // owner[k] = index of the node holding character k of the paragraph text
    const owner: number[] = [];
    nodes.forEach((n, i) => {
      for (let k = 0; k < n.text.length; k++) owner.push(i);
    });
    const assigned = [...owner];
    let changed = false;
    for (const tag of full.matchAll(/\{\{[^{}]*\}\}/g)) {
      const first = owner[tag.index];
      for (let k = tag.index; k < tag.index + tag[0].length; k++) {
        if (assigned[k] !== first) changed = true;
        assigned[k] = first;
      }
    }
    if (!changed) return para;

    const texts = nodes.map(() => "");
    for (let k = 0; k < full.length; k++) texts[assigned[k]] += full[k];

    let out = para;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = `<w:t xml:space="preserve">${texts[i]}</w:t>`;
      out = out.slice(0, nodes[i].start) + node + out.slice(nodes[i].end);
    }
    return out;
  });
}

/** Gives every drawing in the document a unique id (pages repeat the template's images). */
function renumberDrawingIds(xml: string): string {
  let id = 0;
  return xml.replace(/(<wp:docPr\b[^>]*?\bid=")\d+"/g, (_, start: string) => `${start}${++id}"`);
}

/** Replaces each `{{tag}}` with `{{tag1}}`, `{{tag2}}`, … starting at offset + 1. */
function numberRepeatedTag(xml: string, tagName: string, offset: number): string {
  let i = offset;
  return xml.replace(new RegExp(`\\{\\{${tagName}\\}\\}`, "g"), () => `{{${tagName}${++i}}}`);
}

/** Shifts `{{tag1}}`…`{{tagN}}` to page-specific numbers on pages after the first. */
function shiftNumberedTag(xml: string, tagName: string, pageIndex: number, slotsPerPage: number): string {
  if (pageIndex === 0) return xml;
  for (let slot = slotsPerPage; slot >= 1; slot--) {
    xml = xml.replaceAll(`{{${tagName}${slot}}}`, `{{${tagName}${pageIndex * slotsPerPage + slot}}}`);
  }
  return xml;
}

// ─── Signatures ──────────────────────────────────────────────────────────────

const signatureMarker = (key: string) => `[[SIG:${key}]]`;

/**
 * A picture floating in front of the text, centred in its table cell and on the
 * text line. It does not take up space, so the fixed row heights are untouched.
 */
function signatureDrawing(relId: string, sig: DocxSignature, drawingId: number): string {
  const scale = Math.min(SIGNATURE_MAX_WIDTH / sig.width, SIGNATURE_MAX_HEIGHT / sig.height);
  const cx = Math.round(sig.width * scale);
  const cy = Math.round(sig.height * scale);
  const offsetY = Math.round((LINE_HEIGHT - cy) / 2 + SIGNATURE_NUDGE_DOWN);
  return (
    `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" ` +
    `relativeHeight="${251660000 + drawingId}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${offsetY}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${drawingId}" name="Assinatura ${drawingId}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${drawingId}" name="assinatura-${drawingId}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`
  );
}

/** Adds the signature images to the package and swaps their markers for drawings. */
function insertSignatures(zip: PizZip, signatures: Map<string, DocxSignature>): void {
  if (signatures.size === 0) return;

  const relsPath = "word/_rels/document.xml.rels";
  let rels = zip.file(relsPath)!.asText();
  const relIds = new Map<string, string>();
  let n = 0;
  for (const [key, sig] of signatures) {
    n++;
    const relId = `rIdSignature${n}`;
    const target = `media/signature${n}.png`;
    zip.file(`word/${target}`, sig.data);
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`
    );
    relIds.set(key, relId);
  }
  zip.file(relsPath, rels);

  const typesPath = "[Content_Types].xml";
  const types = zip.file(typesPath)!.asText();
  if (!/Extension="png"/i.test(types)) {
    zip.file(typesPath, types.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>'));
  }

  let docXml = zip.file("word/document.xml")!.asText();
  // Temporary ids; renumberDrawingIds() makes all of them unique afterwards.
  let drawingId = 100000;
  // The marker sits inside a <w:t>; close it, add the drawing to the same run, reopen it.
  docXml = docXml.replace(/\[\[SIG:([\w-]+)\]\]/g, (_, key: string) => {
    const sig = signatures.get(key);
    const relId = relIds.get(key);
    if (!sig || !relId) return "";
    return `</w:t>${signatureDrawing(relId, sig, drawingId++)}<w:t xml:space="preserve">`;
  });
  zip.file("word/document.xml", docXml);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function generateReportDocx(report: ReportForDocx, churchData: ChurchData): Buffer {
  const zip = new PizZip(fs.readFileSync(TEMPLATE_PATH));

  const tithers = [...report.tithers].sort((a, b) => a.order - b.order);
  const numPages = Math.max(1, Math.ceil(tithers.length / TITHERS_PER_PAGE));

  // Responsible deacons and treasurer. Old reports that could not be linked to
  // people during the migration still have the names in the deprecated columns.
  const deacons: DocxPerson[] = report.deacons.length
    ? report.deacons.map((d) => d.person)
    : report.diaconosResponsaveis.map((name) => ({ name, signature: null }));
  const treasurer: DocxPerson | null =
    report.treasurer ??
    (report.responsavelPeloRelatorio ? { name: report.responsavelPeloRelatorio, signature: null } : null);

  // --- Split the template body and repeat it once per page of tithers ---
  const rawXml = mergeSplitTags(zip.file("word/document.xml")!.asText());
  const bodyStart = rawXml.indexOf("<w:body>") + "<w:body>".length;
  const bodyEnd = rawXml.lastIndexOf("</w:body>");
  let body = rawXml.slice(bodyStart, bodyEnd);

  // The trailing <w:sectPr> (page setup) must appear only once, at the end.
  const sectPrMatch = body.match(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/);
  const sectPr = sectPrMatch?.[0] ?? "";
  if (sectPrMatch) body = body.slice(0, body.length - sectPr.length);

  const slots = Object.fromEntries(
    REPEATED_TAGS.map((tag) => [tag, body.split(`{{${tag}}}`).length - 1])
  ) as Record<(typeof REPEATED_TAGS)[number], number>;

  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const pages: string[] = [];
  for (let page = 0; page < numPages; page++) {
    let xml = body;
    for (const tag of REPEATED_TAGS) xml = numberRepeatedTag(xml, tag, page * slots[tag]);
    xml = shiftNumberedTag(xml, "nomeDizimista", page, TITHERS_PER_PAGE);
    xml = shiftNumberedTag(xml, "valorDizimo", page, TITHERS_PER_PAGE);
    pages.push(xml);
  }
  zip.file(
    "word/document.xml",
    rawXml.slice(0, bodyStart) + pages.join(pageBreak) + sectPr + rawXml.slice(bodyEnd)
  );

  // --- Render data ---
  const data: Record<string, string> = {
    ...churchData,
    dataCulto: formatDate(report.dataCulto),
    diaDaSemana: report.diaDaSemana,
    horario: report.horario,
    pregador: report.pregador,
    TestemunhoDeCura: String(report.testemunhoCura),
    conversoes: String(report.conversoes),
    batizadosNoEspiritoSanto: String(report.batizadosEspirito),
    visitantes: String(report.visitantes),
    QuantidadeDeDiaconosPresentes: String(report.diaconosServico),
    criancasApresentadas: String(report.criancasApresentadas),
    presentes: String(report.totalPresentes),
    totalOfertasGerais: formatCurrency(report.totalOfertasGerais),
    totalOfertasEspeciais: formatCurrency(report.totalOfertasEspeciais),
    // The field was removed (values folded into special offerings), but the
    // official REFC template still has the row: print it as zero.
    outrasEntradas: formatCurrency(new Decimal(0)),
    arrecadacaoTotal: formatCurrency(report.arrecadacaoTotal),
    totalOfertasMissoes: formatCurrency(report.totalOfertasMissoes),
    totalDizimos: formatCurrency(report.totalDizimos),
    responsavelPeloRelatorio: treasurer?.name ?? "",
  };

  for (let i = 1; i <= numPages * TITHERS_PER_PAGE; i++) {
    const t = tithers[i - 1];
    data[`nomeDizimista${i}`] = t?.personName ?? "";
    data[`valorDizimo${i}`] = t ? formatCurrency(t.value) : "";
  }
  // Pastors and special visitors repeat on every page. Names beyond the
  // template's slots are not printed.
  const repeatedValues = { pastorPresente: report.pastoresPresentes, visitaEspecial: report.visitasEspeciais };
  for (const tag of REPEATED_TAGS) {
    for (let page = 0; page < numPages; page++) {
      for (let i = 1; i <= slots[tag]; i++) {
        data[`${tag}${page * slots[tag] + i}`] = repeatedValues[tag][i - 1] ?? "";
      }
    }
  }

  // Signature tags render as markers, replaced by images after rendering.
  const signatures = new Map<string, DocxSignature>();
  const signatureSlot = (tag: string, person: DocxPerson | null | undefined) => {
    if (person?.signature) {
      signatures.set(tag, person.signature);
      data[tag] = signatureMarker(tag);
    } else {
      data[tag] = "";
    }
  };
  [1, 2].forEach((n) => {
    data[`diaconoResponsavel${n}`] = deacons[n - 1]?.name ?? "";
    signatureSlot(`assinaturaDiaconoResponsavel${n}`, deacons[n - 1]);
  });
  signatureSlot("assinaturaResponsavelPeloRelatorio", treasurer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
    nullGetter: () => "",
  });
  doc.render(data);

  const outZip = doc.getZip();

  // Normalize all font sizes to 9pt (18 half-points).
  let docXml = outZip.file("word/document.xml")!.asText();
  docXml = docXml.replace(/<w:sz w:val="\d+"\s*\/>/g, '<w:sz w:val="18"/>');
  docXml = docXml.replace(/<w:szCs w:val="\d+"\s*\/>/g, '<w:szCs w:val="18"/>');
  outZip.file("word/document.xml", docXml);

  insertSignatures(outZip, signatures);
  outZip.file("word/document.xml", renumberDrawingIds(outZip.file("word/document.xml")!.asText()));

  return outZip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
