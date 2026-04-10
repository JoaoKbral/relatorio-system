# Project Structure
<!-- Last updated: 2026-04-09 -->

## Overview
Full-stack church worship service reporting system for IEQ Canto do Mar (São Sebastião). Allows staff to record service statistics, tithes, and offerings, then export reports as ODT documents.

## Tech Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript 5 (strict) | |
| Framework | Next.js 16.2.2 (App Router) | Breaking changes from common Next.js — read `node_modules/next/dist/docs/` before writing code |
| UI | React 19.2.4 + Tailwind CSS 4 + shadcn/ui | |
| Database | PostgreSQL via Prisma 7.7.0 | Hosted on Neon (serverless) |
| DB adapter | `@prisma/adapter-pg` + `pg` | Connection pooling |
| Doc export | docxtemplater + pizzip | ODT file generation |
| Hosting | Vercel (serverless) | Auto-deploy from git |

## Directory Layout
```
relatorios-system/
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # REST endpoints (relatorios, pessoas)
│   │   ├── relatorios/   # Report CRUD + ODT download
│   │   └── pessoas/      # People search + CRUD
│   ├── culto/            # Worship service report forms
│   │   ├── novo/         # Create report (multi-step form)
│   │   └── [id]/         # View + edit report
│   ├── pessoas/          # People management UI
│   ├── relatorios/       # Report history UI
│   ├── layout.tsx        # Root layout with navigation
│   └── page.tsx          # Homepage (recent reports + CTA)
├── components/           # Shared React components
│   ├── ui/               # shadcn/ui primitives (14 files)
│   ├── CurrencyInput.tsx # Custom pt-BR currency input
│   ├── NameAutocomplete.tsx # Debounced search from DB
│   └── ReportCard.tsx    # Report summary card
├── lib/                  # Utilities and singletons
│   ├── odt-generator.ts  # Docxtemplater ODT export logic
│   ├── prisma.ts         # Prisma singleton (dev-safe)
│   └── utils.ts          # clsx helper
├── prisma/
│   └── schema.prisma     # DB schema: Person, Report, TitheRecord
├── public/
│   └── template/         # REFC-template.odt (ODT template file)
├── scripts/
│   └── prepare-template.mjs # Copies ODT template to public/ at deploy
├── DEPLOY.md             # Neon + Vercel setup guide
└── AGENTS.md             # Next.js version warning for agents
```

## Key Files
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 3 models: Person, Report (service data + financials), TitheRecord |
| `lib/odt-generator.ts` | Generates ODT from template; hardcoded church data (IEQ, CNPJ, pastors) |
| `lib/prisma.ts` | Prisma Client singleton with PrismaPg adapter |
| `app/culto/novo/page.tsx` | 5-step form: date/time → stats → leadership → tithes → offerings |
| `app/api/relatorios/[id]/download/route.ts` | Streams ODT file to browser |
| `.env.example` | `DATABASE_URL` for Neon PostgreSQL |

## Entry Points
- `app/layout.tsx`: Root layout (navigation bar)
- `app/page.tsx`: Homepage — lists 5 most recent reports, links to `/culto/novo`

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build` (runs `prisma generate && next build`)
- **Start**: `npm start`
- **Lint**: `npm run lint`
- **DB migrate**: `npm run db:migrate`
- **DB push**: `npm run db:push`
- **Prepare template**: `npm run prepare-template`

## Conventions
- Server components by default; `"use client"` only when hooks/interactivity needed
- `export const dynamic = "force-dynamic"` on pages that read DB at request time
- PascalCase for component files; lowercase for `page.tsx`, `route.ts`, `layout.tsx`
- `@/` alias maps to project root
- Tailwind utility classes only — no CSS modules
- No tests configured (no jest/vitest)
- No authentication — internal church use, public routes
- `serverExternalPackages: ["docxtemplater", "pizzip"]` in `next.config.ts` (required for ODT generation)

## What Was Built
<!-- Append a row each time a significant feature is completed -->
| Date | Feature / Change | Key files touched |
|------|-----------------|-------------------|
| — | Initial system: report creation, tithes, ODT export, people management | All files |
