# People

## What it does
Each church keeps a list of people with roles (Pastor, Diácono, Tesoureiro, Membro, Líder) and, optionally, a signature image. The list powers name autocomplete in the report form, the pastor/deacon checklists and the treasurer picker, and the signatures printed on the REFC report. People are managed at `/pessoas`; most are created automatically when a new name is used in a report.

## Key files
- `lib/roles.ts` - the only list of valid roles (ids, labels, badge colours)
- `app/pessoas/page.tsx` - list with search and role filter, signature badge, deactivate
- `app/pessoas/nova/page.tsx`, `app/pessoas/[id]/editar/page.tsx` - create/edit; the edit page has the signature section
- `components/SignatureUpload.tsx` - upload, preview (checkerboard), replace and remove a signature
- `lib/signature-image.ts` - browser-side processing of the uploaded image
- `lib/png.ts` - PNG signature and size check used by the API
- `app/api/pessoas/route.ts` - GET search (`q`, `role`; active only, max 50, includes `hasSignature`), POST find-or-create
- `app/api/pessoas/[id]/route.ts` - GET (includes `signatureUpdatedAt`), PUT and DELETE (admin only; DELETE sets `active: false`)
- `app/api/pessoas/[id]/assinatura/route.ts` - GET the PNG, PUT (admin, raw `image/png` body), DELETE
- `components/NameAutocomplete.tsx` - name suggestions while typing, dropdown in a portal

## How it works
- Search uses raw SQL `unaccent(name) ILIKE unaccent('%q%')`, so "joao" finds "João". Role filter is `role = ANY(roles)`. POST and PUT reject roles not in `lib/roles.ts`.
- Signature upload: `processSignatureImage` reduces the image to two colours. It compares each pixel with the mean brightness of the area around it (`localMean`, an integral image over a window of the longest side / 20). A pixel is ink when it differs from that by at least 20 levels and 15%. Whether the ink is darker or lighter than the paper is decided by which side has more such pixels. Blobs smaller than 1/100 000 of the image are dropped (`removeSpecks`). Ink is painted solid black (`INK_RGB`) and everything else is transparent. It then trims to the ink plus 4 px, fits the result in 600 × 200 and exports a PNG. The API checks it is a PNG of at most 300 KB and 2000 px per side, reads the size from the IHDR chunk, and upserts `PersonSignature`.
- Signature bytes live in their own table so person queries never load them. Reports link people through `Report.treasurerId` and `ReportDeacon`, which use `onDelete: Restrict`; people are only ever deactivated.

## Decisions and gotchas
- Use `$queryRaw` with `unaccent` for name lookups. Prisma `contains` with `mode: "insensitive"` ignores case but not accents. The `unaccent` extension must exist in the database.
- There is no unique constraint on `(churchId, name)`, so duplicates exist (for example two spellings of the same person). Both then appear in checklists; a report links to whichever was picked.
- Find-or-create in POST only checks active people, so using a deactivated person's name creates a new, active duplicate.
- Signature cleanup uses a local threshold, not a fixed or whole-image cut-off. Fixed cut-offs (225/140) failed on grey phone photos. A whole-image Otsu threshold turned a shadow in the corner of a real photo into a large black area. Do not choose the polarity from the median brightness: that real photo's paper was only about 119/255, which looked like a dark background.
- `NameAutocomplete` must search only from user input; see [Service reports](service-reports.md).

## How to verify it
Run on 2026-11-10 against a Neon branch with Playwright: uploading a 1600 × 900 JPG of a dark stroke on cream paper on `/pessoas/<id>/editar` showed a transparent, trimmed preview of at most 600 × 200; after "Salvar assinatura", `GET /api/pessoas/<id>/assinatura` returned a PNG. A GIF body to PUT returns 400.

The two-colour step was checked on 2026-11-10 in headless Chromium by calling `processSignatureImage` directly, without the app or the API. A real 1600 × 900 WhatsApp photo of a blue-pen signature on grey paper, with a shadow in the lower left, came out as a clean 437 × 200 signature with no shadow. A navy stroke on a grey gradient and a light stroke on a dark background each came out as 600 × 123 with about 6% opaque pixels, all `0,0,0`.
