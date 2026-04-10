/**
 * Este script prepara o template ODT para uso com o docxtemplater.
 * Problema: o ODT original tem {{nomeDizimista}} e {{valorDizimo}} repetidos
 * 10 vezes (uma por linha de dizimista). O docxtemplater substitui chaves
 * iguais com o mesmo valor, então precisamos indexá-las:
 * {{nomeDizimista}} → {{nomeDizimista1}} … {{nomeDizimista10}}
 * {{valorDizimo}}   → {{valorDizimo1}}   … {{valorDizimo10}}
 *
 * Também lida com fragmentação XML (ex: {{nome<tag>Dizimista}}).
 *
 * Uso: node scripts/prepare-template.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PizZip = require("pizzip");

const SRC = path.join(__dirname, "../public/template/REFC-RelatorioEstatisticoeFinanceirodoCulto.odt");
const DEST = path.join(__dirname, "../public/template/REFC-template.odt");

const buf = fs.readFileSync(SRC);
const zip = new PizZip(buf);

let content = zip.file("content.xml").asText();

// --- Normalize fragmented placeholders ---
// Sometimes LibreOffice splits a placeholder across XML tags, e.g.
// {{nome<text:span>Dizimista}} → join them back to {{nomeDizimista}}
// Strategy: remove XML tags that appear INSIDE {{ … }} spans.
// We do this by collapsing all tags between {{ and }} first.
content = content.replace(/\{\{([^}]*?)\}\}/gs, (match) => {
  // Strip XML tags inside the placeholder
  return match.replace(/<[^>]+>/g, "");
});

// Re-do with full content: find {{ … }} that may span across tags more broadly
// (handles cases where {{ and }} are in different spans)
// Replace the fragmented pattern: {{ ... xml tags ... }}
content = content.replace(/\{\{[\s\S]*?\}\}/g, (match) => {
  return match.replace(/<[^>]+>/g, "");
});

// --- Index repeated placeholders ---
let nomeCount = 0;
let valorCount = 0;

content = content.replace(/\{\{nomeDizimista\}\}/g, () => {
  nomeCount++;
  return `{{nomeDizimista${nomeCount}}}`;
});

content = content.replace(/\{\{valorDizimo\}\}/g, () => {
  valorCount++;
  return `{{valorDizimo${valorCount}}}`;
});

console.log(`Indexed ${nomeCount} nomeDizimista and ${valorCount} valorDizimo placeholders.`);

// Fix known typo in original template: pregrador → pregador
content = content.replace(/\{\{pregrador\}\}/g, "{{pregador}}");
// Normalize criançasApresentadas to ASCII key
content = content.replace(/\{\{criançasApresentadas\}\}/g, "{{criancasApresentadas}}");

// Verify other key placeholders are present
const expected = [
  "igrejaComCidadeEBairro", "CNPJ", "dataCulto", "nomePastorTitular",
  "prontuarioTitular", "diaDaSemana", "horario", "pregador",
  "pastorPresente", "totalDizimos", "arrecadacaoTotal", "criancasApresentadas",
];
for (const key of expected) {
  if (!content.includes(`{{${key}}}`)) {
    console.warn(`⚠ Placeholder {{${key}}} not found – check template.`);
  }
}

zip.file("content.xml", content);
const out = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(DEST, out);
console.log(`✓ Template salvo em: ${DEST}`);
