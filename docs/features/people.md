# People

## What it does
Each church keeps a list of people with roles (Pastor, Diácono, Membro, Líder). The list powers name autocomplete in the report form and the pastor/deacon checkboxes. People can be added, edited, and deactivated at `/pessoas`; most are created automatically when a new name is used in a report.

## Key files
- `app/pessoas/page.tsx` - list with search and role filter, deactivate
- `app/pessoas/nova/page.tsx`, `app/pessoas/[id]/editar/page.tsx` - create/edit; role ids are `pastor`, `diacono`, `membro`, `lider`
- `app/api/pessoas/route.ts` - GET search (`q`, `role`; active only, max 50), POST find-or-create
- `app/api/pessoas/[id]/route.ts` - GET, PUT and DELETE (ADMIN only; DELETE sets `active: false`)
- `components/NameAutocomplete.tsx` - debounced search input, dropdown rendered in a portal
- `prisma/schema.prisma` - `Person` model, `unaccent` extension

## How it works
- Search uses raw SQL `unaccent(name) ILIKE unaccent('%q%')`, so "joao" finds "João". Role filter is `role = ANY(roles)`.
- `POST /api/pessoas` returns the existing active person when the name matches accent/case-insensitively, else creates one (201).
- `NameAutocomplete` waits for 2+ characters, then queries `/api/pessoas` (optionally with `role`). The dropdown is portaled to `document.body` with `fixed` positioning from `getBoundingClientRect()`, updated on scroll/resize, so ancestor `overflow-hidden` cannot clip it.

## Decisions and gotchas
- Use `$queryRaw` with `unaccent` for name lookups. Prisma `contains` + `mode: "insensitive"` ignores case but not accents.
- The `unaccent` extension must exist in the database (`extensions = [unaccent]` with the `postgresqlExtensions` preview feature). Without it, search and report creation fail.
- There is no unique constraint on `(churchId, name)`, so concurrent find-or-create calls can still create duplicates; `createMany({ skipDuplicates })` in report creation does not prevent this.
- Find-or-create only checks active people. Using the name of a deactivated person creates a new, active duplicate.
- Roles are free strings in a `String[]`; the allowed values live only in the UI files.
- `app/api/pessoas/route.ts` has a TODO noting a future ERP may become the source of people.

## How to verify it
Not run while writing this doc. Create "João Silva" as Diácono. In the report form, typing "joao" in a name field suggests "João Silva", and he appears in the deacon checkboxes. `POST /api/pessoas` with `{"name":"JOAO SILVA"}` returns the existing record with status 200.
