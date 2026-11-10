# Service reports

## What it does
After each worship service, a user fills in a step-by-step form: date and time, preacher, attendance statistics, pastors and special visitors, deacons, tithers, and offerings. The saved report can be viewed, edited, deleted, listed by month, and downloaded as the REFC Word document.

## Key files
- `app/culto/novo/page.tsx` - client form, 6 steps: Dados do Culto, Estatísticas, Pastores e Visitantes, Dízimos, Ofertas, Confirmação
- `app/culto/[id]/editar/page.tsx` - edit form; a near-copy of the new-report form that loads the report first
- `app/culto/[id]/page.tsx` - server-rendered read-only view with download/edit/delete
- `app/relatorios/page.tsx` - history filtered by month/year, multi-select ZIP download, delete
- `app/page.tsx` - home: "Novo Culto" button + 5 most recent reports (`components/ReportCard.tsx`)
- `app/api/relatorios/route.ts` - GET list (optional `month`/`year`), POST create
- `app/api/relatorios/[id]/route.ts` - GET, PUT (any church user), DELETE (church ADMIN only)
- `components/CurrencyInput.tsx`, `components/NameAutocomplete.tsx` - inputs used by the form
- `prisma/schema.prisma` - `Report`, `TitheRecord`, `PaymentMethod` (DINHEIRO, PIX)

## How it works
- `diaDaSemana` is derived on the client from the chosen date.
- Deacons and pastors offered as checkboxes come from `GET /api/pessoas?role=diacono` and `?role=pastor`. The client sends `diaconosEmServico` (checked deacons), sets `diaconosServico` to their count, and merges checked pastors with free-text extras into `pastoresPresentes`.
- Tither rows: a new empty row is added automatically once the last row has a name and value > 0, inheriting the previous row's payment method (default PIX). Rows without a name are dropped server-side; `order` is kept 1..n.
- Server recomputes `totalDizimos` (sum of tithers) and `arrecadacaoTotal` = dízimos + ofertas gerais + ofertas especiais + outras entradas with Prisma `Decimal`. Client-sent totals are ignored. `totalOfertasMissoes` is stored but not part of the total.
- PUT replaces all tithers in one transaction (`deleteMany` then nested `create`).
- POST also find-or-creates a `Person` (role `membro`) for every name used (preacher, pastors, visitors, responsible deacons, tithers), deduplicated accent- and case-insensitively. The form also does this per tither name on blur via `POST /api/pessoas`.

## Decisions and gotchas
- Money fields must use `CurrencyInput` (cents-first mask, value in reais as a number). Do not use `<input type="number">`.
- `dataCulto` is a date string saved as UTC midnight. Display uses `timeZone: "UTC"`. Month filters in the APIs build ranges with local-time `new Date(y, m, 1)`, which is correct only when the server runs in UTC (Vercel). On a machine in UTC-3 a report on the 1st falls into the previous month.
- New and edit forms are duplicated (~800 lines each). A change to form behavior must be made in both files.
- Person auto-creation only happens on POST, not on PUT, and always uses role `membro`.
- Request bodies are not validated beyond `Number(...)`/`Array.isArray` coercion; a missing `tithers` array makes POST/PUT throw (500).

## How to verify it
Not run while writing this doc. Create a report with two tithers (R$ 10,00 and R$ 5,50) and R$ 20,00 general offerings: the view page shows total dízimos R$ 15,50 and arrecadação total R$ 35,50. Edit it, remove a tither, save: totals update. The new names appear in `/pessoas`.
