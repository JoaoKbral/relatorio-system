# SGAF upload

Uploads service reports from the app database (Neon) to SGAF Conecta
(`https://conecta.sgaf.org.br/Cadastros/Relatorios/Culto/Upsert`). SGAF has no API,
so this fills its web form with Playwright.

This is a standalone tool with its own `node_modules`, separate from the Next.js app.
It reads `DATABASE_URL` from the project's `.env` and only reads from the database
(read-only transaction).

## Setup (once)

```sh
cd tools/sgaf-upload
npm install
npx playwright install chromium
node upload.mjs login        # a browser opens: log in to SGAF yourself
```

`login` saves the session cookies to `.auth/state.json` (gitignored). The password
is never stored. Run `login` again when the script says the session expired.

## Usage

```sh
node upload.mjs --since 2026-11-01            # dry run
node upload.mjs --since 2026-11-01 --save     # upload for real
```

A **dry run** fills the form for each report, checks it, saves a full-page
screenshot in `out/`, and does not save anything. Always do a dry run first and
look at the summary.

| Option | Meaning |
|---|---|
| `--since YYYY-MM-DD` / `--until YYYY-MM-DD` | Service-date range (São Paulo time) |
| `--only 75,80` | Only these report ids |
| `--church 1` | Church id in the app (default 1, IEQ Canto do Mar) |
| `--save` | Press Salvar on SGAF |
| `--headed` | Show the browser while it works |
| `--allow-typed` | Allow names that don't exist in SGAF (sent as typed text) |
| `--end-equals-start` | Fill "Horário término" with the start time |

Reports that were saved are recorded in `uploaded.json` (gitignored) and skipped on
later runs, so re-running is safe. If you upload a report by hand, add its id there.

A report is **not** saved, and is listed as `PROBLEM`, when:

- the totals SGAF computes (dízimos, ofertas, ofertas especiais) differ from the database
- a person's name isn't found in SGAF (unless `--allow-typed`)
- a field is invalid, or SGAF shows an error after Salvar

If the script can't confirm that a save went through, it stops the batch so a
re-run can't create a duplicate. Check SGAF, then add the id to `uploaded.json` if
the report is there.

## Mapping rules

| SGAF | App |
|---|---|
| Tipo | Always "Culto Regular" |
| Data, Horário início | `dataCulto`, `horario`. Término is blank unless `--end-equals-start` |
| Presentes, visitantes, conversões, batiz. Esp. Santo, crianças, testemunhos | Matching columns. Batizados (águas), ceias and presença online are 0 |
| Registros principais | `pregador` as "Preleção". A short name like "Pra. Rebeca" resolves to the matching name in `pastoresPresentes` |
| Pastores presentes / Diáconos em serviço | `pastoresPresentes` / the report's deacons |
| Visitantes especiais | `visitasEspeciais`, always as "Pastor" |
| Dízimos | One entry per tither. PIX → Santander account, Dinheiro → Caixa |
| Ofertas / Ofertas especiais / Ofertas de missões | One entry per non-zero total, named the first "Geral" in SGAF (person id 322303), Dinheiro → Caixa, Histórico empty |

People are picked from SGAF's own registry. Its search is accent-sensitive, so the
script searches with the original spelling, then matches ignoring accents, case and
"da/de/do/dos/das/e" (e.g. "Caroline Ferreira Dos Santos" → "CAROLINE FERREIRA SANTOS").
If the first name finds nothing (e.g. "Andrea" vs "ANDRÉA"), it searches by surname.
When several SGAF people match, it takes the **first one in the dropdown order** and
says so in the summary. The script never registers new people in SGAF.

The in-page logic is in `sgaf-page.js`. If SGAF changes its form, that file is the one
to update. It relies on the page's `addPregador/addPastor/addDiacono/addVisita`
functions, the TomSelect pickers, and the `dz_`/`of_`/`oe_`/`ms_` entry fields.
