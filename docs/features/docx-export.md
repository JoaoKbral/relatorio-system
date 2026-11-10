# DOCX export

## What it does
Turns a saved service report into the official REFC "Relatório Estatístico e Financeiro do Culto" Word document, filled with the church's details and the report data. Reports can be downloaded one at a time or several at once as a ZIP.

## Key files
- `lib/odt-generator.ts` - `generateOdt(report, churchData)`: builds the DOCX buffer (name is historical; output is DOCX)
- `public/template/REFC-template.docx` - the template actually used, with `{{tag}}` placeholders
- `public/template/REFC-RelatorioEstatisticoeFinanceirodoCulto.docx` - the original form, kept as source
- `app/api/relatorios/[id]/download/route.ts` - single download, filename `REFC-DD-MM-YYYY.docx`
- `app/api/relatorios/download-zip/route.ts` - POST `{ ids }` (max 100) returns `REFC-relatorios.zip`
- `components/DownloadButton.tsx`, `components/ReportCard.tsx`, `app/relatorios/page.tsx` - client triggers
- `next.config.ts` - `serverExternalPackages: ["docxtemplater", "pizzip"]`

## How it works
1. Read the template from `process.cwd()/public/template/REFC-template.docx` and take the `<w:body>` of `word/document.xml`.
2. The template page holds 10 tither slots (`{{nomeDizimista1..10}}`, `{{valorDizimo1..10}}`). Pages needed = ceil(tithers / 10), minimum 1.
3. The body is copied once per page with a page break between copies; the trailing `<w:sectPr>` is kept once at the end. On each copy, tither tags are renumbered (page 2 uses 11..20, etc.), and repeated un-numbered tags (`pastorPresente` x6, `visitaEspecial` x2, `diaconoResponsavel` x2) get unique numbers.
4. Docxtemplater renders with `{{ }}` delimiters and `nullGetter` returning "". Header, stats, pastors, visitors, and deacons repeat on every page; only tither slots differ.
5. All font sizes are forced to 9pt (`w:sz`/`w:szCs` = 18) after rendering.

## Decisions and gotchas
- Template placeholders must not be split across XML runs, or docxtemplater will not see them. Edit the template carefully in Word (type the tag in one go) and check the result.
- Only the first 6 pastors, 2 special visitors, and 2 responsible deacons are printed; extras are silently dropped. Deacons in service (`diaconosEmServico`) are not printed, only their count.
- Tag names are part of the contract between `lib/odt-generator.ts` and the template (e.g. `TestemunhoDeCura`, `QuantidadeDeDiaconosPresentes`, `presentes`). Renaming one side without the other leaves a blank field, not an error.
- `formatCurrency` returns "" for zero/null `Decimal`, so R$ 0,00 values print blank.
- `scripts/prepare-template.mjs` (`npm run prepare-template`) still targets the old `.odt` files, which no longer exist, so it fails. The DOCX template is maintained by hand. `DEPLOY.md` still mentions this step.

## How to verify it
Not run while writing this doc. Create a report with 12 tithers and download it: the DOCX has 2 pages, tithers 1-10 on page 1 and 11-12 on page 2, header filled on both. Select 3 reports in `/relatorios` and download: the ZIP has 3 `.docx` files.
