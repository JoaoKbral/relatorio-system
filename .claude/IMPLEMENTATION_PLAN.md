# Multi-Tenant SaaS Implementation Plan
<!-- Created: 2026-04-15 — resume point after architect planning -->

## Context
Upgrading the single-church REFC reporting app to a multi-tenant SaaS sellable to multiple churches.

User decisions locked in:
- Seed existing data to **IEQ Canto do Mar** (keep it)
- SUPER_ADMIN email: `super_admin@relatorio-systems-quadrangular.com`
- SUPER_ADMIN is a **separate account** from IEQ's admin
- SUPER_ADMIN password: choose one at seed time (store in `.env` as `SEED_SUPER_ADMIN_PASSWORD`)

---

## What the architect decided (see `.claude/handoff/architect.md` for full detail)

- **Multi-tenancy**: shared-schema via `churchId` FK on `Person` and `Report`
- **Auth**: keep existing `jose` JWT, expand `SessionPayload` to `{ userId, churchId, role }`
- **Passwords**: `bcryptjs` (pure JS, safe on Vercel serverless)
- **Middleware**: `middleware.ts` at project root handles auth gating + SUPER_ADMIN route protection
- **Tenant scoping**: every API route calls `requireSession()` → uses `churchId` explicitly in Prisma queries (no magic Prisma middleware)

---

## Implementation Phases

### Phase 1 — Foundation (schema, auth, new API routes)
Files to create/modify:

| Action | File |
|--------|------|
| MODIFY | `prisma/schema.prisma` — add Church, User models + enums; add churchId to Person & Report |
| MODIFY | `lib/session.ts` — expand SessionPayload to `{ userId, email, churchId, role }` |
| CREATE | `lib/password.ts` — bcryptjs hash/verify wrappers |
| CREATE | `lib/auth.ts` — `requireSession`, `requireAdmin`, `requireSuperAdmin`, `churchScope` helpers (return `AuthResult` union, not throw) |
| CREATE | `middleware.ts` (project root) — auth gating + SUPER_ADMIN route protection |
| MODIFY | `app/api/auth/login/route.ts` — DB lookup + bcrypt verify, include `userId/churchId/role` in JWT |
| CREATE | `app/api/auth/register/route.ts` — public: create church + admin user |
| CREATE | `app/api/auth/me/route.ts` — GET current user + church info |
| CREATE | `app/api/igreja/config/route.ts` — GET + PUT church config (ADMIN+) |
| CREATE | `app/api/usuarios/route.ts` — GET list + POST create user (ADMIN+) |
| CREATE | `app/api/usuarios/[id]/route.ts` — PUT + DELETE user (ADMIN+) |
| CREATE | `app/api/admin/igrejas/route.ts` — GET all churches (SUPER_ADMIN) |
| CREATE | `app/api/admin/igrejas/[id]/route.ts` — PUT church plan/status (SUPER_ADMIN) |
| MODIFY | `package.json` — add `bcryptjs` dep, `@types/bcryptjs` dev dep, seed script |
| CREATE | `prisma/seed.ts` — create IEQ church, IEQ admin, SUPER_ADMIN; backfill existing records |

### Phase 2 — Tenant scoping on existing API routes
Every route replaces `decrypt()` pattern with `requireSession()` and adds `churchId` to all Prisma queries:

| File | Key changes |
|------|-------------|
| `app/api/relatorios/route.ts` | `where: { churchId }`, `data: { churchId }`, Person auto-create scoped |
| `app/api/relatorios/[id]/route.ts` | `where: { id, churchId }` on GET/PUT/DELETE |
| `app/api/relatorios/[id]/download/route.ts` | scope query + fetch church + pass to `generateOdt(report, church)` |
| `app/api/relatorios/download-zip/route.ts` | scope ids by churchId, fetch church once, pass to each `generateOdt` call |
| `app/api/pessoas/route.ts` | `where: { churchId }`, `data: { churchId }` |
| `app/api/pessoas/[id]/route.ts` | `where: { id, churchId }` on all methods |

Also: `lib/odt-generator.ts` — remove `CHURCH_DATA` constant, add `church: ChurchData` param to `generateOdt`.

### Phase 3 — Frontend pages (new + modified)

| Action | File | Notes |
|--------|------|-------|
| CREATE | `app/registrar/page.tsx` | Public registration form: church info + admin account |
| CREATE | `app/configuracoes/page.tsx` | Edit church name, city, CNPJ, pastor, prontuario (ADMIN+) |
| CREATE | `app/configuracoes/usuarios/page.tsx` | List/create/edit users in church (ADMIN+) |
| CREATE | `app/admin/page.tsx` | Super admin: list all churches, toggle plan/status |
| MODIFY | `app/layout.tsx` | Dynamic church name from session/DB; add Configurações nav item for ADMIN+ |
| MODIFY | `app/login/page.tsx` | Remove hardcoded "IEQ Canto do Mar"; add link to `/registrar` |

---

## Migration Strategy (IMPORTANT — existing data)

The schema adds `churchId NOT NULL` to Person and Report, but existing rows have no churchId.
Prisma will refuse to apply this migration without a default value.

**Two-step process:**
1. Temporarily edit the generated migration SQL to add `churchId` as **nullable** (`INTEGER`)
2. Run `npx prisma migrate deploy`
3. Run `npm run db:seed` (creates IEQ church + users, backfills all existing rows)
4. Create a second migration: `ALTER TABLE "Person" ALTER COLUMN "churchId" SET NOT NULL` + same for Report
5. Run `npx prisma migrate deploy` again

Or for a **fresh dev environment** (no data to preserve): `npx prisma db push --force-reset` then `npm run db:seed`.

---

## New env vars needed

Add to `.env`:
```
SEED_ADMIN_PASSWORD=<password for admin@ieqcantodomar.com>
SEED_SUPER_ADMIN_PASSWORD=<password for super_admin@relatorio-systems-quadrangular.com>
```

Remove after migration (now stored in DB):
```
AUTH_EMAIL
AUTH_PASSWORD
CHURCH_CITY
CHURCH_CNPJ
CHURCH_PASTOR
CHURCH_PRONTUARIO
```

---

## New dependency
`bcryptjs` + `@types/bcryptjs` — pure JS bcrypt, no native compilation issues on Vercel.

---

## Files NOT changing (safe to ignore)
`lib/prisma.ts`, `lib/utils.ts`, all `components/`, all client-side page components under `app/culto/`, `app/relatorios/`, `app/pessoas/` — they call APIs via fetch and the APIs handle scoping.
