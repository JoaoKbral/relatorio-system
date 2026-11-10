# DOCX export

## What it does
Turns a saved service report into the official REFC "Relatório Estatístico e Financeiro do Culto" Word document, filled with the church's details, the report data and the signatures of the responsible deacons and the treasurer. Reports download one at a time or several at once as a ZIP.

## Key files
- `lib/report-docx.ts` - `generateReportDocx(report, churchData)`, the `reportForDocx` Prisma include, `churchDocxData`
- `lib/report-filename.ts` - `reportFileName` (`REFC-08-11-2026-19h30.docx`) and `uniqueFileNames`, used by server and client
- `lib/download.ts` - browser download helpers used by `DownloadButton`, `ReportCard`, the new-report page and `/relatorios`
- `public/template/REFC-template.docx` - the template actually used, edited by hand in Word
- `public/template/REFC-RelatorioEstatisticoeFinanceirodoCulto.docx` - the original form, kept as source
- `app/api/relatorios/[id]/download/route.ts` - single download
- `app/api/relatorios/download-zip/route.ts` - POST `{ ids }` (1-100) returns `REFC-relatorios.zip`

## How it works
1. `mergeSplitTags` moves each `{{tag}}`'s text into the run where it starts. Word splits typed tags across runs (for example around spell-check marks), and the string processing below needs whole tags.
2. The template body has 10 tither slots (`{{nomeDizimista1..10}}`, `{{valorDizimo1..10}}`). Pages = ceil(tithers / 10), minimum 1. The body is repeated per page with a page break; the trailing `<w:sectPr>` is kept once.
3. Per page, tither tags are shifted (page 2 uses 11..20). The repeated un-numbered tags `{{pastorPresente}}` and `{{visitaEspecial}}` are numbered; their slots per page are counted from the template (currently 4 and 3).
4. Docxtemplater renders with `{{ }}` delimiters and a `nullGetter` that returns "". Font sizes are then forced to 9pt.
5. Signature tags (`assinaturaDiaconoResponsavel1/2`, `assinaturaResponsavelPeloRelatorio`) render as `[[SIG:tag]]` markers. `insertSignatures` adds each PNG to `word/media` with a relationship and replaces the marker with a floating `<wp:anchor>` (in front of text, `wrapNone`, centred in the cell, scaled to fit 4.5 × 1.3 cm). It takes no space, so the template's fixed row heights are unchanged.
6. `renumberDrawingIds` makes every `wp:docPr` id unique, because repeated pages copy the template's logo.

## Decisions and gotchas
- Tag names are a contract between `lib/report-docx.ts` and the template. Renaming one side only leaves a blank field, not an error. `responsavelPeloRelatorio` prints the treasurer's name.
- Names beyond the template's pastor/visitor slots are not printed. Deacons in service are printed only as a count.
- A person without a signature leaves that cell blank. Old unlinked reports fall back to the deprecated name columns, without signatures.
- `formatCurrency` returns "" only for null; zero `Decimal` values print "R$ 0,00".
- `lib/report-docx.ts` imports `server-only`; run it from scripts with `npx tsx --conditions=react-server`.
- Inside the ZIP, two reports with the same date and time get `-2`, `-3`, and so on.

## How to verify it
Run on 2026-11-10: a generated report with 12 tithers and signatures for one deacon and the treasurer, converted to PDF with Word (COM `SaveAs2` format 17), showed 2 pages with the pastors, the visitors and both signatures over their lines on each page, and no leftover `{{` or `[[SIG` text. A ZIP of reports at 10:00, 19:30 and 19:30 on 08/11/2026 contained `REFC-08-11-2026-10h.docx`, `REFC-08-11-2026-19h30.docx` and `REFC-08-11-2026-19h30-2.docx`.
