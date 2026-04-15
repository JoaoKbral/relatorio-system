## Summary

Multi-tenant SaaS upgrade for the REFC church reporting system. Adds `Church` and `User` models, scopes all existing data by `churchId`, replaces env-var-based auth with DB-backed JWT auth with roles (SUPER_ADMIN, ADMIN, MEMBER), and adds church configuration/registration pages.

## Architecture Decisions (ADRs)

### ADR-001: Keep Custom JWT Auth (Extend Existing), Do Not Adopt NextAuth/Auth.js

**Status:** Accepted

**Context:** The app already has a working custom JWT auth system using `jose` (lib/session.ts) with httpOnly cookies. The question is whether to migrate to NextAuth v5 or extend the existing system.

**Decision:** Extend the existing custom JWT auth.

**Rationale:**
1. The existing session.ts + jose implementation is clean, working, and well-understood.
2. NextAuth v5 (Auth.js) adds ~50KB of dependencies, adapter complexity, and callback configuration for what amounts to a simple Credentials provider. Its main value is OAuth providers, which are explicitly excluded here.
3. The current system already uses timing-safe comparison, httpOnly cookies, and HS256 JWT — all the security fundamentals are covered.
4. Migration risk: NextAuth has its own session/cookie semantics that could conflict with the existing API route auth pattern.
5. The only changes needed: expand SessionPayload to include userId, churchId, and role; add password hashing (bcrypt); move credential validation from env vars to DB lookup.

**Consequences:** No new auth dependency. Must manually implement password hashing (add `bcryptjs`), role checking, and registration flow.

---

### ADR-002: Shared-Database, Shared-Schema Multi-Tenancy via churchId Foreign Key

**Status:** Accepted

**Context:** Need to isolate data per church. Options: (a) separate databases per tenant, (b) separate schemas per tenant, (c) shared schema with churchId discriminator column.

**Decision:** Shared schema with `churchId` on Person, Report, TitheRecord.

**Rationale:**
1. The app will serve tens to low hundreds of churches, not thousands. No need for physical isolation.
2. Neon free/pro tier supports one database — multiple databases would require plan upgrades or operational complexity.
3. Prisma does not natively support schema-per-tenant switching.
4. A `churchId` column with proper indexes and middleware enforcement is simple, well-understood, and sufficient.
5. All existing queries are simple Prisma findMany/create — adding `where: { churchId }` is mechanical.

**Consequences:** Must add churchId to every query. Risk of data leaks if a query forgets the filter. Mitigated by: (a) a helper function that extracts churchId from session and returns a Prisma `where` clause, (b) middleware that validates session and injects churchId before routes execute.

---

### ADR-003: Middleware for Auth Gating, Helper Function for Tenant Scoping

**Status:** Accepted

**Decision:** Use Next.js middleware.ts for authentication redirects (unauthenticated users to /login). Use a shared `getSessionOrFail()` helper in API routes that returns `{ userId, churchId, role }` from the JWT — every DB query must explicitly use this churchId. No Prisma-level middleware/extension for automatic filtering (too magical, harder to debug).

---

### ADR-004: Church Registration as Self-Service with Approval Field

**Status:** Accepted

**Decision:** Public `/registrar` page where a church admin can register their church + their admin account. Church record gets `status: PENDING | ACTIVE | SUSPENDED`. SUPER_ADMIN can activate churches. For MVP, set status to ACTIVE immediately (no approval gate) but the field exists for future use.

---

## Component Responsibilities

### New Models

| Model | Purpose |
|-------|---------|
| `Church` | Tenant entity. Holds name, city, CNPJ, pastor info, plan, status. |
| `User` | Authentication entity. Belongs to a Church. Has email, passwordHash, role. |

### Modified Models

| Model | Change |
|-------|--------|
| `Person` | Add `churchId` FK |
| `Report` | Add `churchId` FK |
| `TitheRecord` | No direct change (scoped via Report.churchId) |

## Data Models

### Full Updated Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

enum Plan {
  FREE
  PAID
}

enum ChurchStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  MEMBER
}

enum PaymentMethod {
  DINHEIRO
  PIX
}

model Church {
  id                    Int           @id @default(autoincrement())
  name                  String        // e.g. "IEQ Canto do Mar"
  city                  String        // e.g. "Sao Sebastiao - Canto do Mar"
  cnpj                  String?       // optional — some small churches lack CNPJ
  pastorName            String?       // nome do pastor titular
  pastorProntuario      String?       // prontuario number
  plan                  Plan          @default(FREE)
  status                ChurchStatus  @default(ACTIVE)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  users                 User[]
  people                Person[]
  reports               Report[]

  @@map("churches")
}

model User {
  id            Int       @id @default(autoincrement())
  email         String    @unique
  passwordHash  String
  name          String
  role          UserRole  @default(MEMBER)
  churchId      Int
  church        Church    @relation(fields: [churchId], references: [id], onDelete: Cascade)
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([churchId])
  @@map("users")
}

model Person {
  id        Int      @id @default(autoincrement())
  name      String
  roles     String[]
  active    Boolean  @default(true)
  churchId  Int
  church    Church   @relation(fields: [churchId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([churchId])
  @@index([churchId, name])
}

model Report {
  id                    Int           @id @default(autoincrement())
  churchId              Int
  church                Church        @relation(fields: [churchId], references: [id], onDelete: Cascade)
  dataCulto             DateTime
  diaDaSemana           String
  horario               String
  pregador              String
  pastoresPresentes     String[]
  visitasEspeciais      String[]
  testemunhoCura        Int           @default(0)
  conversoes            Int           @default(0)
  batizadosEspirito     Int           @default(0)
  visitantes            Int           @default(0)
  diaconosServico       Int           @default(0)
  criancasApresentadas  Int           @default(0)
  totalPresentes        Int           @default(0)
  totalOfertasGerais    Decimal       @db.Decimal(10, 2)
  totalOfertasEspeciais Decimal       @db.Decimal(10, 2)
  outrasEntradas        Decimal       @db.Decimal(10, 2)
  arrecadacaoTotal      Decimal       @db.Decimal(10, 2)
  totalOfertasMissoes   Decimal?      @db.Decimal(10, 2)
  totalDizimos          Decimal       @db.Decimal(10, 2)
  diaconosResponsaveis      String[]
  responsavelPeloRelatorio  String?
  tithers                   TitheRecord[]
  createdAt             DateTime      @default(now())

  @@index([churchId])
  @@index([churchId, dataCulto])
}

model TitheRecord {
  id            Int            @id @default(autoincrement())
  reportId      Int
  report        Report         @relation(fields: [reportId], references: [id], onDelete: Cascade)
  personName    String
  chequeNumber  String?
  bankNumber    String?
  paymentMethod PaymentMethod?
  value         Decimal        @db.Decimal(10, 2)
  order         Int
}
```

### Key Schema Notes
- `TitheRecord` does NOT get a direct `churchId` — it is scoped through `Report.churchId`. When querying tithe records, always go through Report.
- `User.email` is globally unique (not per-church). One person cannot have accounts at two churches with the same email. This is intentional — simplifies login (no "which church?" disambiguation).
- `Church.cnpj` is nullable — not all small churches have one.
- SUPER_ADMIN users: their `churchId` still points to a real church (the platform admin's church or a special "platform" church record). The role grants cross-tenant access, not the churchId.

## API Contracts

### Updated Session Payload

```typescript
export type SessionPayload = {
  userId: number
  email: string
  churchId: number
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER'
}
```

### New Helper: `lib/auth.ts`

```typescript
// Extracts and validates session from request cookies.
// Returns typed session or throws/returns 401 Response.
// Every API route calls this instead of raw decrypt().

export async function getSession(req: NextRequest): Promise<SessionPayload | null>
export async function requireSession(req: NextRequest): Promise<SessionPayload>  // throws 401
export async function requireAdmin(req: NextRequest): Promise<SessionPayload>    // throws 403 if MEMBER
export async function requireSuperAdmin(req: NextRequest): Promise<SessionPayload> // throws 403 if not SUPER_ADMIN

// Helper to get churchId scoping for Prisma queries
export function churchScope(session: SessionPayload) {
  return { churchId: session.churchId }
}
```

### New API Routes

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `POST /api/auth/register` | POST | Register new church + admin user | Public |
| `GET /api/auth/me` | GET | Return current user + church info | Any authenticated |
| `GET /api/igreja/config` | GET | Get current church configuration | ADMIN+ |
| `PUT /api/igreja/config` | PUT | Update church name, city, CNPJ, pastor, prontuario | ADMIN+ |
| `GET /api/usuarios` | GET | List users in church | ADMIN+ |
| `POST /api/usuarios` | POST | Invite/create user in church | ADMIN+ |
| `PUT /api/usuarios/[id]` | PUT | Update user role/active status | ADMIN+ |
| `DELETE /api/usuarios/[id]` | DELETE | Deactivate user | ADMIN+ |
| `GET /api/admin/igrejas` | GET | List all churches (super admin panel) | SUPER_ADMIN |
| `PUT /api/admin/igrejas/[id]` | PUT | Update church status/plan | SUPER_ADMIN |

### Modified API Routes (add churchId scoping)

| Route | Change |
|-------|--------|
| `GET /api/relatorios` | Add `where: { churchId }` to findMany |
| `POST /api/relatorios` | Add `churchId` to report.create data |
| `GET /api/relatorios/[id]` | Add `where: { id, churchId }` (prevent cross-tenant access) |
| `PUT /api/relatorios/[id]` | Add `where: { id, churchId }` |
| `DELETE /api/relatorios/[id]` | Add `where: { id, churchId }` |
| `GET /api/relatorios/[id]/download` | Add `where: { id, churchId }` + pass church data to generateOdt |
| `POST /api/relatorios/download-zip` | Filter ids by churchId |
| `GET /api/pessoas` | Add `where: { churchId }` |
| `POST /api/pessoas` | Add `churchId` to create data |
| `GET /api/pessoas/[id]` | Add `where: { id, churchId }` |
| `PUT /api/pessoas/[id]` | Add `where: { id, churchId }` |
| `DELETE /api/pessoas/[id]` | Add `where: { id, churchId }` |
| `POST /api/auth/login` | Look up user by email in DB, verify bcrypt hash, include churchId+role in JWT |
| `POST /api/auth/logout` | No change needed |

## New Pages

| Path | Purpose | Access |
|------|---------|--------|
| `/registrar` | Church registration form (church info + admin account) | Public |
| `/configuracoes` | Church settings — edit name, city, CNPJ, pastor, prontuario | ADMIN+ |
| `/configuracoes/usuarios` | Manage church users (list, invite, change roles) | ADMIN+ |
| `/admin` | Super admin dashboard — list churches, change status/plan | SUPER_ADMIN |

### Modified Pages

| Path | Change |
|------|--------|
| `/login` | Add link to `/registrar`. Remove hardcoded "IEQ Canto do Mar" — show generic branding or fetched church name after login. |
| `app/layout.tsx` | Read church name from session/DB for header. Add "Configuracoes" nav item for ADMIN+. Dynamic title. |
| `app/page.tsx` | No query changes needed if layout provides churchId context — but verify it scopes correctly. |
| All pages reading data | Ensure fetch calls work with the new auth (session cookie is already sent automatically). |

## Middleware Strategy

### File: `middleware.ts` (NEW — project root)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/registrar', '/api/auth/login', '/api/auth/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets, _next, etc.
  if (pathname.startsWith('/_next') || pathname.startsWith('/template') || pathname === '/manifest.json' || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Check session
  const token = request.cookies.get('session')?.value
  const session = await decrypt(token)

  if (!session) {
    // Redirect to login for page requests, 401 for API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // SUPER_ADMIN-only routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    if (session.role !== 'SUPER_ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // If authenticated user hits /login, redirect to home
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Note:** Middleware handles auth gating (redirect if not logged in) and coarse role checks. Fine-grained `churchId` scoping happens in each API route via `requireSession()` — middleware does NOT inject churchId into headers or rewrite URLs, because API routes need the full session object anyway.

## `lib/odt-generator.ts` Changes

The `generateOdt` function signature changes to accept church data as a parameter instead of reading env vars:

```typescript
interface ChurchData {
  igrejaComCidadeEBairro: string
  CNPJ: string
  nomePastorTitular: string
  prontuarioTitular: string
}

// OLD: export function generateOdt(report: ReportData): Buffer
// NEW:
export function generateOdt(report: ReportData, church: ChurchData): Buffer
```

The `CHURCH_DATA` constant at the top of the file is removed. The download route fetches the church record from DB and passes it in:

```typescript
// In app/api/relatorios/[id]/download/route.ts:
const session = await requireSession(req)
const report = await prisma.report.findUnique({
  where: { id: Number(id), churchId: session.churchId },
  include: { tithers: { orderBy: { order: 'asc' } } },
})
const church = await prisma.church.findUnique({ where: { id: session.churchId } })
const buf = generateOdt(report, {
  igrejaComCidadeEBairro: church.city,
  CNPJ: church.cnpj ?? '',
  nomePastorTitular: church.pastorName ?? '',
  prontuarioTitular: church.pastorProntuario ?? '',
})
```

Same pattern for `download-zip/route.ts` — fetch church once, pass to each `generateOdt` call.

## Migration / Seed Strategy

### Step 1: Create migration adding Church, User tables and churchId columns

```sql
-- Create churches table
CREATE TABLE "churches" (...);

-- Create users table
CREATE TABLE "users" (...);

-- Add churchId to Person (nullable first)
ALTER TABLE "Person" ADD COLUMN "churchId" INTEGER;

-- Add churchId to Report (nullable first)
ALTER TABLE "Report" ADD COLUMN "churchId" INTEGER;
```

### Step 2: Seed script (`prisma/seed.ts`)

```typescript
// 1. Create the first church (IEQ Canto do Mar) with hardcoded data
const church = await prisma.church.create({
  data: {
    name: 'IEQ Canto do Mar',
    city: 'Sao Sebastiao - Canto do Mar',
    cnpj: '62.955.505/8812-60',
    pastorName: 'Fabio Cabral',
    pastorProntuario: '34292',
    plan: 'FREE',
    status: 'ACTIVE',
  },
})

// 2. Create the admin user (hashed password)
const passwordHash = await bcrypt.hash('changeme123', 12)
await prisma.user.create({
  data: {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@ieqcantodomar.com',
    passwordHash,
    name: 'Administrador',
    role: 'ADMIN',
    churchId: church.id,
  },
})

// 3. Backfill churchId on all existing Person and Report records
await prisma.person.updateMany({ where: { churchId: null }, data: { churchId: church.id } })
await prisma.report.updateMany({ where: { churchId: null }, data: { churchId: church.id } })
```

### Step 3: Make churchId NOT NULL

After seed runs, create a second migration:

```sql
ALTER TABLE "Person" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Report" ALTER COLUMN "churchId" SET NOT NULL;
ALTER TABLE "Person" ADD CONSTRAINT "Person_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE;
```

**Practical approach:** Use `prisma migrate dev` to generate migrations. The two-step (nullable -> seed -> not-null) approach handles existing data safely. Alternatively, use a single migration with a custom SQL script if Prisma supports it via `prisma migrate dev --create-only` + manual SQL editing.

## New Dependencies

| Package | Purpose |
|---------|---------|
| `bcryptjs` | Password hashing (pure JS, no native compilation issues on Vercel) |
| `@types/bcryptjs` | TypeScript types |

No other new dependencies. `jose` is already installed for JWT.

## Environment Variable Changes

### Remove (after migration)
- `AUTH_EMAIL` — replaced by DB user lookup
- `AUTH_PASSWORD` — replaced by DB password hash
- `CHURCH_CITY` — now in Church table
- `CHURCH_CNPJ` — now in Church table
- `CHURCH_PASTOR` — now in Church table
- `CHURCH_PRONTUARIO` — now in Church table

### Keep
- `DATABASE_URL` — still needed
- `SESSION_SECRET` — still needed for JWT signing

### Add
- `SEED_ADMIN_EMAIL` (optional) — email for the first admin user during seed
- `SEED_ADMIN_PASSWORD` (optional) — password for the first admin user during seed

## File-by-File Change Summary

### New Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Auth gating + role-based route protection |
| `lib/auth.ts` | Session helpers: getSession, requireSession, requireAdmin, requireSuperAdmin, churchScope |
| `lib/password.ts` | bcryptjs hash/verify wrappers |
| `app/registrar/page.tsx` | Church registration form (church info + admin account creation) |
| `app/configuracoes/page.tsx` | Church settings page (edit church info) |
| `app/configuracoes/usuarios/page.tsx` | User management page (list, create, edit roles) |
| `app/admin/page.tsx` | Super admin dashboard (list churches, toggle status/plan) |
| `app/api/auth/register/route.ts` | POST: create church + admin user |
| `app/api/auth/me/route.ts` | GET: return current user + church |
| `app/api/igreja/config/route.ts` | GET + PUT: church configuration |
| `app/api/usuarios/route.ts` | GET + POST: user management |
| `app/api/usuarios/[id]/route.ts` | PUT + DELETE: individual user management |
| `app/api/admin/igrejas/route.ts` | GET: list all churches |
| `app/api/admin/igrejas/[id]/route.ts` | PUT: update church status/plan |
| `prisma/seed.ts` | Seed script for first church + admin + backfill |

### Modified Files

| File | What Changes |
|------|-------------|
| `prisma/schema.prisma` | Add Church, User models. Add churchId to Person, Report. Add enums (Plan, ChurchStatus, UserRole). |
| `lib/session.ts` | Expand SessionPayload to include userId, churchId, role. Update encrypt/decrypt. |
| `lib/odt-generator.ts` | Remove CHURCH_DATA constant. Add `church: ChurchData` parameter to generateOdt(). |
| `app/api/auth/login/route.ts` | Replace env var check with DB user lookup + bcrypt verify. Include userId, churchId, role in JWT. |
| `app/api/relatorios/route.ts` | Use requireSession(). Add churchId to all queries. |
| `app/api/relatorios/[id]/route.ts` | Use requireSession(). Add churchId to all queries. |
| `app/api/relatorios/[id]/download/route.ts` | Use requireSession(). Fetch church from DB. Pass church data to generateOdt(). |
| `app/api/relatorios/download-zip/route.ts` | Use requireSession(). Scope report IDs by churchId. Fetch church for generateOdt(). |
| `app/api/pessoas/route.ts` | Use requireSession(). Add churchId to all queries and creates. |
| `app/api/pessoas/[id]/route.ts` | Use requireSession(). Add churchId to all queries. |
| `app/layout.tsx` | Fetch church name from session/DB for header. Add "Configuracoes" to nav for ADMIN+. Make title dynamic. |
| `app/login/page.tsx` | Remove hardcoded "IEQ Canto do Mar". Add link to `/registrar`. |
| `package.json` | Add bcryptjs, @types/bcryptjs. Add prisma seed script. |

### Unchanged Files

| File | Why |
|------|-----|
| `lib/prisma.ts` | Singleton pattern stays the same |
| `lib/utils.ts` | Utility, no tenant logic |
| `components/ui/*` | UI primitives, no change |
| `components/CurrencyInput.tsx` | No tenant awareness needed |
| `components/NameAutocomplete.tsx` | Calls /api/pessoas which is already scoped server-side |
| `components/ReportCard.tsx` | Display only, no direct DB access |
| `app/culto/novo/page.tsx` | Client component, calls APIs that are now scoped — no change needed |
| `app/culto/[id]/page.tsx` | Same — calls scoped APIs |
| `app/culto/[id]/editar/page.tsx` | Same |
| `app/relatorios/page.tsx` | Same |
| `app/pessoas/page.tsx` | Same |
| `app/pessoas/nova/page.tsx` | Same |
| `app/pessoas/[id]/editar/page.tsx` | Same |
| `app/page.tsx` | Home page — may need minor update to show church name, but data comes from layout context |
| `public/template/*` | ODT template is universal |
| `scripts/prepare-template.mjs` | No change |

## Open Questions / Risks

1. **SUPER_ADMIN church record**: Should there be a dedicated "Platform" church record for super admins, or should the first church (IEQ Canto do Mar) serve double duty? Recommendation: Create a special "Platform Admin" church record with id=1 during seed, then IEQ Canto do Mar as id=2. Alternatively, just make the first church admin also a SUPER_ADMIN — simpler for now.

2. **Email uniqueness across tenants**: The schema enforces globally unique emails. If two churches have a member named "joao@gmail.com", only one can register. This is intentional for simplicity but could be a friction point. Alternative: composite unique on (email, churchId) — but then login needs a "which church?" selector, which complicates UX significantly.

3. **No password reset flow**: This design does not include forgot-password. For MVP, admin can reset a user's password manually. Consider adding email-based reset in a future phase.

4. **Rate limiting on registration**: The `/registrar` endpoint is public. Without rate limiting, it could be abused. For MVP, this is acceptable. Consider adding rate limiting or CAPTCHA later.

5. **Prisma migration on Neon**: Neon's serverless driver works with Prisma, but migrations should be run via `prisma migrate deploy` against the direct (non-pooled) connection string. The existing `db:migrate` script handles this.

## Recommended Next Steps (which agent, what task)

### Phase 1: Schema + Auth Foundation (backend-dev)
1. Install `bcryptjs` and `@types/bcryptjs`
2. Update `prisma/schema.prisma` with the full schema above
3. Create migration (two-step: add nullable columns, then seed, then make NOT NULL)
4. Create `prisma/seed.ts`
5. Create `lib/auth.ts` and `lib/password.ts`
6. Update `lib/session.ts` with expanded SessionPayload
7. Create `middleware.ts`
8. Update `app/api/auth/login/route.ts` for DB-backed auth
9. Create `app/api/auth/register/route.ts`
10. Create `app/api/auth/me/route.ts`

### Phase 2: Tenant Scoping (backend-dev)
11. Update all existing API routes to use `requireSession()` + `churchScope()`
12. Update `lib/odt-generator.ts` to accept church parameter
13. Update download routes to fetch church data from DB

### Phase 3: New Pages (frontend-dev)
14. Create `/registrar` page
15. Create `/configuracoes` page
16. Create `/configuracoes/usuarios` page
17. Create `/admin` page (super admin)
18. Update `app/layout.tsx` for dynamic church name + conditional nav items
19. Update `app/login/page.tsx` to remove hardcoded church name, add register link

### Phase 4: Review (code-reviewer, then security-auditor)
20. Code review all changes
21. Security audit: auth flow, tenant isolation, registration endpoint
