import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required')
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Starting seed...')

  // 1. Create the first church (IEQ Canto do Mar)
  let church = await prisma.church.findFirst({ where: { name: process.env.CHURCH_NAME! } })

  if (!church) {
    church = await prisma.church.create({
      data: {
        name: process.env.CHURCH_NAME!,
        city: process.env.CHURCH_CITY!,
        cnpj: process.env.CHURCH_CNPJ!,
        pastorName: process.env.CHURCH_PASTOR!,
        pastorProntuario: process.env.CHURCH_PRONTUARIO!,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    })
    console.log(`Created church: ${church.name} (id=${church.id})`)
  } else {
    console.log(`Church already exists: ${church.name} (id=${church.id})`)
  }

  // 2. Create the ADMIN user for IEQ Canto do Mar
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminEmail || !adminPassword) throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars are required')

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Administrador',
        role: 'ADMIN',
        churchId: church.id,
      },
    })
    console.log(`Created admin user: ${adminEmail}`)
  } else {
    console.log(`Admin user already exists: ${adminEmail}`)
  }

  // 3. Create/update the SUPER_ADMIN user — no churchId (platform-level admin)
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL?.toLowerCase().trim()
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD
  if (!superAdminEmail || !superAdminPassword) throw new Error('SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD env vars are required')

  const superAdminHash = await bcrypt.hash(superAdminPassword, 12)
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: { churchId: null, name: 'Super Administrador', role: 'SUPER_ADMIN', passwordHash: superAdminHash },
    create: {
      email: superAdminEmail,
      passwordHash: superAdminHash,
      name: 'Super Administrador',
      role: 'SUPER_ADMIN',
    },
  })
  console.log(`Upserted SUPER_ADMIN user: ${superAdminEmail}`)

  // 4. Backfill churchId on all existing Person and Report records.
  //    During the two-step migration, churchId is added as nullable first. After seed,
  //    a second migration makes it NOT NULL. Use raw SQL to target null rows safely.
  const updatedPeople = await prisma.$executeRaw`
    UPDATE "Person" SET "churchId" = ${church.id} WHERE "churchId" IS NULL
  `
  const updatedReports = await prisma.$executeRaw`
    UPDATE "Report" SET "churchId" = ${church.id} WHERE "churchId" IS NULL
  `

  console.log(`Backfilled ${updatedPeople} person records`)
  console.log(`Backfilled ${updatedReports} report records`)

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
