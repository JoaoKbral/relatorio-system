# Church administration

## What it does
The platform owner (SUPER_ADMIN) manages all churches and their users at `/admin`. A church ADMIN edits their own church's details (name, city, CNPJ, pastor, prontuário) and manages their church's users at `/configuracoes`. Any logged-in user can change their own password there.

## Key files
- `app/admin/page.tsx` - super-admin panel: list/create/edit/delete churches, set plan and status, list/add/delete a church's users
- `app/api/admin/igrejas/route.ts` - GET all churches (with user/report counts), POST church (optionally with its first ADMIN)
- `app/api/admin/igrejas/[id]/route.ts` - PUT (plan, status, details), DELETE church
- `app/api/admin/igrejas/[id]/usuarios/route.ts`, `.../[userId]/route.ts` - list/add/hard-delete users of a church
- `app/configuracoes/page.tsx` - church settings form + change password
- `app/configuracoes/usuarios/page.tsx` - church user list: add, toggle role, deactivate
- `app/api/igreja/config/route.ts` - GET/PUT own church (ADMIN), re-issues the session cookie
- `app/api/usuarios/route.ts`, `app/api/usuarios/[id]/route.ts` - church-scoped user CRUD (ADMIN)

## How it works
- Church details feed the DOCX header: `city` becomes `igrejaComCidadeEBairro`, plus `cnpj`, `pastorName`, `pastorProntuario` (see [DOCX export](docx-export.md)). Empty optional fields print blank.
- Setting a church's status to anything other than `ACTIVE` blocks its users at login (see [Auth and tenancy](auth-and-tenancy.md)).
- Roles assignable through the APIs are only `ADMIN` or `MEMBER`; any other value becomes `MEMBER`. SUPER_ADMIN is created only by `prisma/seed.ts`.

## Decisions and gotchas
- Deleting differs by path: super-admin `DELETE /api/admin/igrejas/[id]/usuarios/[userId]` hard-deletes; church-admin `DELETE /api/usuarios/[id]` only sets `active: false` and refuses to delete yourself.
- `DELETE /api/admin/igrejas/[id]` cascades (schema `onDelete: Cascade`) and removes all the church's users, people, reports, and tithes. There is no soft delete.
- A church ADMIN can demote or deactivate the last remaining ADMIN of the church (only self-delete is blocked).
- `plan` (FREE/PAID) is stored and editable but nothing in the app enforces limits by plan.
- `prisma/seed.ts` creates the first church + ADMIN from `CHURCH_*` and `SEED_ADMIN_*` env vars, upserts the SUPER_ADMIN from `SEED_SUPER_ADMIN_*`, and backfills `churchId` on legacy rows from the pre-multi-tenant era.

## How to verify it
Not run while writing this doc. As SUPER_ADMIN at `/admin`: create a church with an admin, log in as that admin, change the pastor name at `/configuracoes`, then download a report DOCX and check the header shows the new name. Suspend the church in `/admin`: the admin's next login fails with "Igreja inativa ou suspensa".
