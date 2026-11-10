# Project docs

Multi-tenant Next.js 16 + Prisma 7 (PostgreSQL/Neon) app where churches record each worship service ("culto") and export the official REFC report. UI text is pt-BR. See `PROJECT_STRUCTURE.md` for the stack overview and `AGENTS.md` before writing Next.js code.

- [Auth and tenancy](features/auth-and-tenancy.md) - Login, self-registration, JWT cookie sessions, roles, `proxy.ts` guard, per-church `churchId` scoping
- [Church administration](features/church-administration.md) - Super-admin church/user panel (`/admin`), church settings and user management for church admins (`/configuracoes`)
- [Service reports](features/service-reports.md) - The 6-step "Novo Culto" form, report edit/view/history, totals calculation, auto-creating people from names
- [DOCX export](features/docx-export.md) - Filling the REFC Word template per report, multi-page tither overflow, single and ZIP download
- [Tithe reports](features/tithe-reports.md) - `/dizimistas`: monthly per-person, per-day, and multi-month comparative tithe reports with PDF/XLSX export
- [People](features/people.md) - Person registry with roles (pastor, diácono, membro, líder), accent-insensitive search, name autocomplete
