-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "ChurchStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX');

-- CreateTable
CREATE TABLE "churches" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cnpj" TEXT,
    "pastorName" TEXT,
    "pastorProntuario" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "ChurchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "churches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "churchId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "churchId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "churchId" INTEGER NOT NULL,
    "dataCulto" TIMESTAMP(3) NOT NULL,
    "diaDaSemana" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "pregador" TEXT NOT NULL,
    "pastoresPresentes" TEXT[],
    "visitasEspeciais" TEXT[],
    "testemunhoCura" INTEGER NOT NULL DEFAULT 0,
    "conversoes" INTEGER NOT NULL DEFAULT 0,
    "batizadosEspirito" INTEGER NOT NULL DEFAULT 0,
    "visitantes" INTEGER NOT NULL DEFAULT 0,
    "diaconosServico" INTEGER NOT NULL DEFAULT 0,
    "criancasApresentadas" INTEGER NOT NULL DEFAULT 0,
    "totalPresentes" INTEGER NOT NULL DEFAULT 0,
    "totalOfertasGerais" DECIMAL(10,2) NOT NULL,
    "totalOfertasEspeciais" DECIMAL(10,2) NOT NULL,
    "outrasEntradas" DECIMAL(10,2) NOT NULL,
    "arrecadacaoTotal" DECIMAL(10,2) NOT NULL,
    "totalOfertasMissoes" DECIMAL(10,2),
    "totalDizimos" DECIMAL(10,2) NOT NULL,
    "diaconosEmServico" TEXT[],
    "diaconosResponsaveis" TEXT[],
    "responsavelPeloRelatorio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitheRecord" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "personName" TEXT NOT NULL,
    "chequeNumber" TEXT,
    "bankNumber" TEXT,
    "paymentMethod" "PaymentMethod",
    "value" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TitheRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_churchId_idx" ON "users"("churchId");

-- CreateIndex
CREATE INDEX "Person_churchId_idx" ON "Person"("churchId");

-- CreateIndex
CREATE INDEX "Person_churchId_name_idx" ON "Person"("churchId", "name");

-- CreateIndex
CREATE INDEX "Report_churchId_idx" ON "Report"("churchId");

-- CreateIndex
CREATE INDEX "Report_churchId_dataCulto_idx" ON "Report"("churchId", "dataCulto");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitheRecord" ADD CONSTRAINT "TitheRecord_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
