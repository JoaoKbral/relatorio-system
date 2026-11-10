-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "treasurerId" INTEGER;

-- CreateTable
CREATE TABLE "PersonSignature" (
    "personId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonSignature_pkey" PRIMARY KEY ("personId")
);

-- CreateTable
CREATE TABLE "ReportDeacon" (
    "reportId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "responsible" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportDeacon_pkey" PRIMARY KEY ("reportId","personId")
);

-- CreateIndex
CREATE INDEX "ReportDeacon_personId_idx" ON "ReportDeacon"("personId");

-- CreateIndex
CREATE INDEX "Report_treasurerId_idx" ON "Report"("treasurerId");

-- AddForeignKey
ALTER TABLE "PersonSignature" ADD CONSTRAINT "PersonSignature_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_treasurerId_fkey" FOREIGN KEY ("treasurerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDeacon" ADD CONSTRAINT "ReportDeacon_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDeacon" ADD CONSTRAINT "ReportDeacon_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Names are matched to people of the same church ignoring case, accents and
-- surrounding spaces. If several people match, the active one with the lowest
-- id wins. Unmatched names are left out; list them with
-- `npx tsx scripts/list-unmatched-report-people.ts`.

-- Treasurer: link the old free-text "responsável pelo relatório".
WITH matched AS (
  SELECT DISTINCT ON (r.id) r.id AS report_id, p.id AS person_id
  FROM "Report" r
  JOIN "Person" p
    ON p."churchId" = r."churchId"
   AND lower(unaccent(btrim(p.name))) = lower(unaccent(btrim(r."responsavelPeloRelatorio")))
  WHERE btrim(coalesce(r."responsavelPeloRelatorio", '')) <> ''
  ORDER BY r.id, p.active DESC, p.id
)
UPDATE "Report" r
SET "treasurerId" = m.person_id
FROM matched m
WHERE r.id = m.report_id;

-- Everyone who was responsible for a report becomes a treasurer.
UPDATE "Person"
SET roles = array_append(roles, 'tesoureiro')
WHERE id IN (SELECT DISTINCT "treasurerId" FROM "Report" WHERE "treasurerId" IS NOT NULL)
  AND NOT ('tesoureiro' = ANY(roles));

-- Deacons: in service + responsible (responsible ones first, in their order).
WITH names AS (
  SELECT r.id AS report_id, r."churchId" AS church_id, n.name, true AS responsible, n.ord
  FROM "Report" r, unnest(r."diaconosResponsaveis") WITH ORDINALITY AS n(name, ord)
  UNION ALL
  SELECT r.id, r."churchId", n.name, false, 1000 + n.ord
  FROM "Report" r, unnest(r."diaconosEmServico") WITH ORDINALITY AS n(name, ord)
),
matched AS (
  SELECT DISTINCT ON (nm.report_id, p.id)
    nm.report_id, p.id AS person_id, nm.responsible, nm.ord
  FROM names nm
  JOIN LATERAL (
    SELECT p.id FROM "Person" p
    WHERE p."churchId" = nm.church_id
      AND lower(unaccent(btrim(p.name))) = lower(unaccent(btrim(nm.name)))
    ORDER BY p.active DESC, p.id
    LIMIT 1
  ) p ON true
  ORDER BY nm.report_id, p.id, nm.responsible DESC, nm.ord
)
INSERT INTO "ReportDeacon" ("reportId", "personId", "responsible", "order")
SELECT report_id, person_id, responsible,
       row_number() OVER (PARTITION BY report_id ORDER BY responsible DESC, ord)::int
FROM matched;
