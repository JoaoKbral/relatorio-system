# Tithe reports

## What it does
The "Dízimos" tab (`/dizimistas`) shows who tithed and how much, built from the tithers recorded in service reports. Three report types, each exportable to PDF and XLSX:
- **Detalhado** - total per person for one month, with the number of tithes.
- **Detalhado por dia** - each tithe in the month with date and payment method, viewable grouped by date or by person, with name search.
- **Comparativo** - person × month matrix for a month range within one year, with row totals.

## Key files
- `app/dizimistas/page.tsx` - client page: type tabs, filters, tables, PDF (jspdf + jspdf-autotable, lazy-imported) and XLSX (`xlsx`) export
- `app/api/dizimistas/relatorio/route.ts` - GET `month`, `year`, optional `tipo=detalhado_por_dia`
- `app/api/dizimistas/relatorio-comparativo/route.ts` - GET `year`, `monthStart`, `monthEnd`

## How it works
- Both APIs read `TitheRecord` joined to `Report` filtered by `churchId` and `dataCulto` range; there is no separate tithe table.
- Per-person grouping uses `personName.trim().toUpperCase()` as the key and the first spelling seen as the display name. Sorting uses `localeCompare(..., "pt-BR")`.
- Values are returned as strings with 2 decimals; the client formats them as BRL.
- Exports are generated entirely in the browser.

## Decisions and gotchas
- Grouping is by the name typed on the report, not by `Person.id`. "José" and "Jose" are different people here, even though people search treats them as the same. Renaming a Person does not change past tithe records.
- Sums use JS `Number`, not `Decimal`; fine for display at these magnitudes but not exact arithmetic.
- Month ranges use server local time, and the comparativo bucket uses `getMonth()` (local). Correct on a UTC server (Vercel); off by one at month edges on a UTC-3 machine. See [Service reports](service-reports.md).
- `PROJECT_STRUCTURE.md` mentions a "simples" type; the current types are the three above.

## How to verify it
Not run while writing this doc. With two reports in the same month where "Maria" tithes R$ 50 and R$ 30: Detalhado shows Maria R$ 80,00 with 2 tithes; Detalhado por dia shows both dates; Comparativo for that month shows R$ 80,00. Export PDF and XLSX and open them.
