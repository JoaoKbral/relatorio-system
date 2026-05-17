# Project Structure
<!-- Last updated: 2026-05-17 -->

## Overview
Multi-tenant full-stack church worship service reporting system. Multiple churches self-register and manage their own data (service stats, tithes, offerings) with per-church data isolation. Reports can be exported as DOCX documents.

## Tech Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5 (strict) | |
| Framework | Next.js 16.2.2 (App Router) | Breaking changes from common Next.js — read `node_modules/next/dist/docs/` before writing code |
| UI | React 19.2.4 + Tailwind CSS 4 + shadcn/ui | |
| Database | PostgreSQL via Prisma 7.7.0 | Hosted on Neon (serverless) |
| DB adapter | `@prisma/adapter-pg` + `pg` | Connection pooling via `prisma.config.ts` |
| Auth | JWT (jose) + bcryptjs | HTTP-only cookie session; roles: SUPER_ADMIN, ADMIN, MEMBER |
| Doc export | docxtemplater + pizzip | DOCX file generation (template is `.docx`, not `.odt`) |
| Report export | jspdf + jspdf-autotable + xlsx | Client-side PDF and XLSX export for tithe reports |
| Hosting | Vercel (serverless) | Auto-deploy from git |

## Directory Layout
```
relatorios-system/
├── app/                        # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── auth/               # Auth endpoints (login, register, logout, me)
│   │   ├── admin/igrejas/      # Church management — SUPER_ADMIN only
│   │   ├── igreja/config/      # Church self-config (name, pastor) — ADMIN only
│   │   ├── usuarios/           # User CRUD — ADMIN only
│   │   ├── relatorios/         # Report CRUD + DOCX/ZIP download
│   │   ├── pessoas/            # People search + CRUD
│   │   ├── dizimistas/relatorio/  # Tithe report by month/year (grouped by person)
│   │   └── dizimistas/relatorio-comparativo/ # Pivot report: person × month matrix for a date range
│   ├── login/                  # Login page (public)
│   ├── admin/                  # Super-admin panel (SUPER_ADMIN only)
│   ├── configuracoes/          # Church config + user management (ADMIN only)
│   ├── registrar/              # Self-registration page (public)
│   ├── culto/
│   │   ├── novo/               # Create report (multi-step form)
│   │   └── [id]/               # View report + editar/ sub-route
│   ├── pessoas/                # People management UI (nova/, [id]/editar/)
│   ├── relatorios/             # Report history UI
│   ├── dizimistas/             # Tithe reports UI — simples (list) + detalhado (values), PDF/XLSX export
│   ├── layout.tsx              # Root layout with navigation
│   └── page.tsx                # Homepage (recent reports + CTA)
├── components/                 # Shared React components
│   ├── ui/                     # shadcn/ui primitives (7 files: button, card, checkbox, dialog, input, label, select, sonner)
│   ├── CurrencyInput.tsx       # Cents-first pt-BR currency mask (keydown-controlled, onBlur prop)
│   ├── NameAutocomplete.tsx    # Debounced name search; dropdown rendered via portal (bypasses overflow-hidden); onBlur prop
│   ├── DeleteButton.tsx        # Confirm-before-delete button
│   ├── DownloadButton.tsx      # Report download button
│   ├── LogoutButton.tsx        # Session logout button
│   └── ReportCard.tsx          # Report summary card
├── lib/
│   ├── auth.ts                 # requireSession / requireAdmin / requireSuperAdmin helpers
│   ├── odt-generator.ts        # Docxtemplater DOCX export; accepts churchData param
│   ├── password.ts             # bcryptjs hash + verify (12 rounds)
│   ├── prisma.ts               # Prisma Client singleton (dev-safe, PrismaPg adapter)
│   ├── session.ts              # JWT encrypt/decrypt; SessionPayload type
│   └── utils.ts                # clsx helper
├── prisma/
│   ├── schema.prisma           # 5 models: Church, User, Person, Report, TitheRecord
│   └── seed.ts                 # Seeds a SUPER_ADMIN user + demo church
├── public/
│   └── template/               # REFC-template.docx (Word template file)
├── scripts/
│   └── prepare-template.mjs    # Copies DOCX template to public/ at deploy
├── prisma.config.ts            # Prisma 7 config: DB URL + PrismaPg adapter
├── proxy.ts                    # Next.js middleware (auth guard + redirect logic)
├── DEPLOY.md                   # Neon + Vercel setup guide
└── AGENTS.md                   # Next.js version warning for agents
```

## Key Files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 5 models: Church, User (roles), Person, Report, TitheRecord — all scoped by `churchId`; declares `unaccent` PostgreSQL extension (`postgresqlExtensions` preview feature enabled) |
| `prisma.config.ts` | Prisma 7 datasource config (URL lives here, NOT in schema.prisma) |
| `lib/auth.ts` | Auth helpers returning `AuthResult<T>` discriminated union; all API routes use these |
| `lib/session.ts` | JWT helpers; `SessionPayload` = `{ userId, email, churchId, role }` |
| `lib/odt-generator.ts` | Generates DOCX from template; church data passed as `ChurchData` param (from DB) |
| `lib/prisma.ts` | Prisma Client singleton with PrismaPg adapter |
| `proxy.ts` | Middleware: redirects unauthenticated users to `/login`; redirects logged-in users away from auth pages; guards `/admin` routes for SUPER_ADMIN only |
| `app/culto/novo/page.tsx` | 5-step form: date/time → stats → leadership → tithes → offerings |
| `app/api/relatorios/[id]/download/route.ts` | Streams DOCX file to browser |
| `app/api/auth/register/route.ts` | Self-registration: creates Church + ADMIN user in one transaction |

## Entry Points
- `app/login/page.tsx`: Login form (public; redirects to `/` if already authenticated)
- `app/layout.tsx`: Root layout (navigation bar, requires session)
- `app/page.tsx`: Homepage — lists 5 most recent reports for the current church

## Auth & Multi-tenancy
- All API routes call `requireSession` / `requireAdmin` / `requireSuperAdmin` from `lib/auth.ts`
- Every DB query includes `churchId` from the session — data never leaks across churches
- Roles: `MEMBER` (read/create), `ADMIN` (+ user management, church config), `SUPER_ADMIN` (+ all churches)
- Sessions are JWT in an HTTP-only cookie (`session`), 7-day expiry
- `proxy.ts` enforces auth at the middleware layer as a first line of defense

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build` (runs `prisma generate && next build`)
- **Start**: `npm start`
- **Lint**: `npm run lint`
- **DB migrate**: `npm run db:migrate`
- **DB push**: `npm run db:push`
- **DB seed**: `npm run db:seed`
- **Prepare template**: `npm run prepare-template`

## Conventions
- Server components by default; `"use client"` only when hooks/interactivity needed
- `export const dynamic = "force-dynamic"` on pages that read DB at request time
- PascalCase for component files; lowercase for `page.tsx`, `route.ts`, `layout.tsx`
- `@/` alias maps to project root
- Tailwind utility classes only — no CSS modules
- No tests configured (no jest/vitest)
- `serverExternalPackages: ["docxtemplater", "pizzip"]` in `next.config.ts` (required for DOCX generation)
- Prisma 7: connection URL belongs in `prisma.config.ts`, NOT in `schema.prisma`
- Passwords: 8–72 char limit (bcrypt truncates silently at 72 bytes)
- `NameAutocomplete` renders its suggestion list via `ReactDOM.createPortal` into `document.body` — always use `fixed` positioning from `getBoundingClientRect()` to avoid clipping by ancestor `overflow-hidden`
- `CurrencyInput` is keydown-controlled (cents-first mask); never use a regular `<input type="number">` for monetary values
- All DB name searches use `unaccent(name) ILIKE unaccent(query)` via `$queryRaw` — never use Prisma's `contains`/`equals` with `mode: "insensitive"` for people lookups (it ignores accents)
- `POST /api/pessoas` is a find-or-create: checks for existing name (accent+case insensitive) before inserting

## What Was Built
<!-- Append a row each time a significant feature is completed -->
| Date | Feature / Change | Key files touched |
|------|-----------------|-------------------|
| — | Initial system: report creation, tithes, DOCX export, people management | All files |
| 2026-04-15 | Multi-tenant auth: Church + User models, JWT sessions, role-based access, per-church data isolation, self-registration | `prisma/schema.prisma`, `lib/auth.ts`, `lib/session.ts`, `lib/password.ts`, `proxy.ts`, `app/api/auth/*`, `app/api/usuarios/*`, `app/api/admin/*`, `app/api/igreja/config/*`, all existing routes updated |
| 2026-04-15 | Prisma 7 schema fix: removed `url` from datasource block → `prisma.config.ts` | `prisma/schema.prisma`, `prisma.config.ts` |
| 2026-04-15 | ODT generator: church data now sourced from DB (not env vars); accepts `ChurchData` param | `lib/odt-generator.ts`, download routes |
| 2026-05-02 | Tithe reports: three report types (simples/detalhado/comparativo) — simples/detalhado filtered by single month, comparativo pivots person × month for a selectable date range; all with PDF + XLSX export | `app/api/dizimistas/relatorio/route.ts`, `app/api/dizimistas/relatorio-comparativo/route.ts`, `app/dizimistas/page.tsx`, `app/layout.tsx` |
| 2026-05-17 | UX fixes — culto/novo tither form: (1) autocomplete dropdown portal (fixes overflow-hidden clipping), (2) unknown tither names auto-created as Membro on blur, (3) CurrencyInput rewritten as cents-first mask, (4) new tither row auto-added as soon as both Nome and Valor are filled, (5) new row inherits Forma from previous row | `components/NameAutocomplete.tsx`, `components/CurrencyInput.tsx`, `app/culto/novo/page.tsx` |
| 2026-05-17 | Accent-insensitive name search everywhere: enabled `unaccent` PostgreSQL extension; all people lookups use `$queryRaw` with `unaccent(name) ILIKE unaccent(query)`; `POST /api/pessoas` upgraded to find-or-create | `prisma/schema.prisma`, `app/api/pessoas/route.ts`, `app/api/relatorios/route.ts` |
