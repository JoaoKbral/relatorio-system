-- Offline sync: id generated on the device, so a resent report is not saved twice.
-- Additive only: the column is nullable and existing rows keep NULL.
-- PostgreSQL unique indexes allow many NULLs, so existing reports never conflict.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "clientId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Report_churchId_clientId_key" ON "Report"("churchId", "clientId");
