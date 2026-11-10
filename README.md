# Relatórios de Culto

Multi-tenant web app where churches record each worship service (attendance statistics, tithers, offerings), export the official REFC Word report, and run monthly tithe reports. The UI is in Portuguese (pt-BR).

Stack: Next.js 16 (App Router), React 19, Prisma 7 on PostgreSQL (Neon), deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and SESSION_SECRET
npx prisma db push          # create the tables
npm run db:seed             # create the super-admin and the first church
npm run dev
```

Open http://localhost:3000 and log in with the `SEED_SUPER_ADMIN_*` or `SEED_ADMIN_*` credentials from `.env`.

The schema is applied with `prisma db push`; there are no committed migrations yet, so `npm run db:migrate` has nothing to apply.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database |
| `npm run db:seed` | Seed the super-admin, church admin and first church |

## Documentation

- [`docs/INDEX.md`](docs/INDEX.md) - per-feature docs (how each feature works, gotchas, how to verify)
- [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md) - stack, directory layout, conventions
- [`DEPLOY.md`](DEPLOY.md) - Neon + Vercel deployment guide (pt-BR)
- [`AGENTS.md`](AGENTS.md) - read before writing Next.js code; this version has breaking changes
