# Service reports

## What it does
After each worship service, a user fills in a step-by-step form: date and time, preacher, attendance statistics, pastors and special visitors (optional), tithers, deacons, the treasurer responsible for the report, and offerings. The saved report can be viewed, edited, deleted, listed by month, and downloaded as the REFC Word document.

## Key files
- `components/report-form/ReportForm.tsx` - the 6-step form shared by create and edit; per-step validation, submit
- `components/report-form/steps.tsx`, `ReviewStep.tsx` - the step UIs and the confirmation summary
- `components/report-form/form-values.ts` - client form state, conversion from a loaded report and to the API payload
- `components/report-form/use-people-options.ts` - loads pastors, deacons and treasurers for the checklists
- `app/culto/novo/page.tsx`, `app/culto/[id]/editar/page.tsx` - thin wrappers: create (then download/view) and edit
- `app/culto/[id]/page.tsx` - server-rendered read-only view
- `app/relatorios/page.tsx` - history by year/month, multi-select ZIP download, delete
- `lib/report-schema.ts` - zod schema of the request body, shared by client (types) and server (validation)
- `lib/reports.ts` - server: validation, people checks, computed columns, deacon/tither rows, person auto-create, view include
- `app/api/relatorios/route.ts` (GET list, POST; POST dedupes by `clientId`), `app/api/relatorios/[id]/route.ts` (GET, PUT, DELETE admin-only)
- `prisma/schema.prisma` - `Report`, `ReportDeacon`, `TitheRecord`

## How it works
- POST and PUT parse the body with `parseReportInput` (400 with a pt-BR message on failure), then `checkReportPeople`: the treasurer must be a person of the church, active and with role `tesoureiro`; deacon ids must belong to the church. On PUT a report keeps its current treasurer even if that person later lost the role.
- `reportFields` computes everything derived: `diaDaSemana` from the date (UTC), `diaconosServico` = number of deacons, totals with `Decimal` (`arrecadacaoTotal` = dízimos + gerais + especiais + outras; missões is stored but excluded). Client totals are display-only.
- Deacons are `ReportDeacon` rows (`personId`, `responsible`, `order`). Responsible deacons (max 2) come first, in the order picked; that order is the signature slot order in the DOCX. PUT replaces deacons and tithers in one nested update.
- The treasurer is `Report.treasurerId`. It is required by the API, but the column is nullable because a few old reports could not be linked during the migration.
- POST accepts an optional `clientId` (UUID, made on the device). If the church already has a report with it, POST returns 200 with that id and creates nothing. This is what makes offline resends safe; see [Offline reports](offline-reports.md). PUT ignores `clientId`.
- The new-report form saves to the device when the server cannot be reached. The people lists come from `lib/offline/people.ts`, which falls back to the device copy.
- After saving, `ensurePeopleExist` creates a Person (role `membro`) for new free-text names (preacher, pastors, visitors, tithers), matched accent- and case-insensitively.
- `/relatorios` defaults to the current month; the chosen year/month is kept in `sessionStorage` (`relatorios.filter`) for the tab's session. It is read in an effect, not during render, to avoid a hydration mismatch.

## Decisions and gotchas
- Month ranges in `GET /api/relatorios` use `Date.UTC`, because `dataCulto` is stored as UTC midnight. The tithe report APIs still use local time (see [Tithe reports](tithe-reports.md)).
- Money fields must use `CurrencyInput` (cents-first mask, value in reais as a number). Do not use `<input type="number">`.
- `NameAutocomplete` searches only from its own `onChange`. Do not move the search back into an effect on `value`: values filled in by code (loading a report to edit) would open a suggestion list on every field.
- The edit page adds the report's current deacons and treasurer to the option lists, so people who changed role or were deactivated stay selectable.
- `Report.diaconosEmServico`, `diaconosResponsaveis` and `responsavelPeloRelatorio` are deprecated and no longer written. They are still read as a fallback for reports the migration could not link, and are planned to be dropped.
- Base UI `Select` shows the raw value unless given `items`; month selects use `MONTH_ITEMS` from `lib/months.ts`.
- `app/culto/[id]/page.tsx` returns 404 for a session without a church (super-admin).

## How to verify it
Run on 2026-11-10 against a Neon branch, with API and Playwright scripts:
- POST without pastors returns 201; without a treasurer, with a non-treasurer, with 3 responsible deacons, without `tithers`, or with invalid JSON returns 400.
- A report with a R$ 10,50 tither and R$ 20,00 general offerings stores `totalDizimos` 10.5 and `arrecadacaoTotal` 30.5; a 2026-11-08 date gets "Domingo".
- Opening `/culto/<id>/editar` shows no suggestion list until you type.
- `/relatorios` shows "Novembro" in November; choose Março, open another page, come back: still Março.
