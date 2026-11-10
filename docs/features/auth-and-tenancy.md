# Auth and tenancy

## What it does
Users log in with email and password and stay signed in for 7 days. Each church is a tenant: a user only ever sees their own church's people, reports, and tithes. A church can sign itself up at `/registrar`, which creates the church and its first ADMIN user.

## Key files
- `lib/session.ts` - `SessionPayload` type, JWT `encrypt`/`decrypt` (jose, HS256, 7d), and the request-memoized `getSession()` for server components
- `lib/auth.ts` - API-route guards returning an `AuthResult` union: `requireSession`, `requireAdmin`, `requireSuperAdmin`, `requireChurchSession`, `requireChurchAdmin`
- `lib/password.ts` - bcryptjs hash/verify
- `proxy.ts` - Next 16 "proxy" (formerly middleware): redirects and coarse role gating
- `app/api/auth/login|logout|register|me|change-password/route.ts` - auth endpoints
- `app/login/page.tsx`, `app/registrar/page.tsx` - public pages
- `prisma/schema.prisma` - `Church`, `User` (`UserRole`: SUPER_ADMIN, ADMIN, MEMBER), `ChurchStatus`

## How it works
- Login looks up the user by lowercased email, refuses inactive users and users whose church is not `ACTIVE` (SUPER_ADMIN has no church), then sets an httpOnly, `sameSite: strict` cookie named `session`.
- The JWT carries `{ userId, email, churchId, churchName, role }`. `churchName` is shown in the header by `app/layout.tsx`; `PUT /api/igreja/config` re-issues the cookie when the church is renamed.
- `proxy.ts` runs on every non-static path: public auth APIs pass, logged-in users are bounced off `/login` and `/registrar`, anonymous users get 401 (API) or a redirect to `/login`, SUPER_ADMIN is sent from `/` to `/admin`, and `/admin` + `/api/admin/*` are SUPER_ADMIN-only.
- Every API route still calls a `require*` guard itself and filters every query by the session's `churchId`. There is no automatic Prisma-level tenant filter (deliberate: explicit is easier to debug).
- `requireChurch*` reject sessions with `churchId === null`, i.e. SUPER_ADMIN cannot call church-scoped APIs.

## Decisions and gotchas
- Custom JWT instead of NextAuth - only a credentials flow is needed; keeps deps small.
- The session is not re-checked against the DB. Deactivating a user, changing their role, or suspending their church takes effect only at next login (up to 7 days).
- Login on an unknown email runs bcrypt against a dummy hash so timing does not reveal which emails exist. Keep this if you touch the login route.
- Passwords are limited to 8-72 chars because bcrypt silently truncates after 72 bytes. The check is duplicated in register, change-password, `/api/usuarios`, and `/api/admin/igrejas*`.
- `/registrar` creates churches as `ACTIVE` immediately; `PENDING` exists in the enum for a future approval step.
- Requires `SESSION_SECRET`; `getEncodedKey()` throws without it.
- `app/culto/[id]/page.tsx` queries with `churchId: session.churchId ?? undefined`, so a SUPER_ADMIN viewing that URL sees any church's report. Church users are scoped correctly.

## How to verify it
Not run while writing this doc. With `.env` set and `npm run dev`:
1. Visit `/relatorios` logged out: redirected to `/login`. `curl localhost:3000/api/relatorios`: 401 JSON.
2. Log in as a church user: `/admin` redirects to `/`. Log in as SUPER_ADMIN: `/` redirects to `/admin`.
3. Register a church at `/registrar`, log in with it: it sees no reports or people from other churches.
