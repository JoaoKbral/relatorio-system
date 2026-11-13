# SGAF upload

## What it does
A command-line tool that copies service reports from the app database into SGAF Conecta,
the denomination's system, which has no API. It fills SGAF's report form
(`https://conecta.sgaf.org.br/Cadastros/Relatorios/Culto/Upsert`) with Playwright. Usage
and the full field mapping are in `tools/sgaf-upload/README.md`.

## Key files
- `tools/sgaf-upload/upload.mjs` - CLI: SGAF login, read-only DB query, the dry-run and save loop, checks, and the local state files
- `tools/sgaf-upload/sgaf-page.js` - `fillReport`, which runs inside the SGAF page and drives its widgets, plus the `--review` panel
- `tools/sgaf-upload/README.md` - setup, options, mapping rules, how unknown names are handled
- Local, gitignored: `.auth/state.json` (SGAF session cookies), `uploaded.json` (report ids already on SGAF), `aliases.json` (name choices made in review), `out/` (screenshots)

## How it works
1. `upload.mjs` reads reports with `pg` in a read-only transaction, using `to_jsonb(r)` so the query doesn't depend on exact columns. Reports listed in `uploaded.json` are skipped.
2. For each report it opens a blank form and runs `fillReport` with `page.evaluate`. People rows come from the page's own `addPregador/addPastor/addDiacono/addVisita`. People are chosen through the TomSelect pickers (`select.tomselect`). Money entries go through the `dz_/of_/oe_/ms_` boxes and their ADICIONAR buttons.
3. Before saving, it compares the totals SGAF shows with the database. Any mismatch, invalid field or unknown name blocks the save. `--save` presses Salvar and records the report in `uploaded.json` only after SGAF moves off the blank form.

## Decisions and gotchas
- **Unknown names are never sent as text**, because SGAF creates a new person for every typed name (the user saw this happen). They block the report. `--review` lets the user pick a suggested SGAF person (saved in `aliases.json`), register them through SGAF's own quick-registration popup (`abrirModalCadastroRapido`, where the user clicks Cadastrar), or skip the report.
- SGAF's person search is **accent-sensitive** ("Andrea" doesn't find "ANDRÉA"). So the lookup searches with the original spelling, then by surname, and compares ignoring accents, case and da/de/dos. When several people match, it takes the first in SGAF's dropdown order (user's rule). That order comes from `ts.search(q)`, not from `ts.options`.
- Different pickers can return different records for the same person (the pregador and pastor pickers gave two different ids for Fábio Cabral). That's why each row's own picker is used and aliases are stored per role (`role|name`).
- Offerings are one entry per non-zero total. The name is the first "Geral" in SGAF, person id `322303` (`GERAL_PERSON_ID`), because SGAF has 7 people called "Geral". Histórico is left empty.
- PIX tithes need the Santander account picked from a list that re-renders after it opens, so `chooseSantander` waits and retries until the hidden `<px>_conta` has an id.
- SGAF sessions last about 3 hours (the `sgi_ctx` cookie expires 3 h after login). After that every page redirects to `/Login`, so `upload.mjs` stops with "session expired". `login` prints each page it visits and opens the report form before saving `.auth/state.json`, so a redirect back to the login page shows up in the output instead of being saved as a dead session.
- If a save can't be confirmed, the batch stops, so a re-run can't create a duplicate on SGAF.
- The tool has its own `node_modules` and Playwright Chromium, because the app's `node_modules` were installed on Windows. `tools/**` is excluded from the app's ESLint.
- After SGAF redirects, the save check relies on the URL changing or `Relatorio.Id` being set. What SGAF actually shows after a save hasn't been seen yet.

## How to verify it
- `node upload.mjs --since 2026-11-01` (dry run) prints each report as OK or PROBLEM, with closest SGAF names for unknown ones, and writes screenshots to `out/`. Run on 2026-11-12: it listed the expected unknown names, and the totals matched for all 4 reports.
- The `--review` "Usar …" path was tested headless by auto-clicking the first suggestion: the right person was selected and nothing was saved.
- Not tested yet: an actual `--save`, and the "Cadastrar no SGAF…" path, which would create a real person.
