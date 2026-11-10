/**
 * Lists names on old reports that the 20261110000000 migration could not link
 * to a person (treasurer or deacons). Read-only.
 *
 * Usage: npx tsx scripts/list-unmatched-report-people.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL env var is required");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface Row {
  report_id: number;
  church: string;
  data_culto: Date;
  kind: string;
  name: string;
}

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT r.id AS report_id, c.name AS church, r."dataCulto" AS data_culto,
           'tesoureiro' AS kind, r."responsavelPeloRelatorio" AS name
    FROM "Report" r JOIN churches c ON c.id = r."churchId"
    WHERE r."treasurerId" IS NULL
    UNION ALL
    SELECT r.id, c.name, r."dataCulto", 'diacono', n.name
    FROM "Report" r JOIN churches c ON c.id = r."churchId",
         unnest(r."diaconosEmServico" || r."diaconosResponsaveis") AS n(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM "ReportDeacon" rd JOIN "Person" p ON p.id = rd."personId"
      WHERE rd."reportId" = r.id
        AND lower(unaccent(btrim(p.name))) = lower(unaccent(btrim(n.name)))
    )
    ORDER BY 2, 3, 1`;

  if (rows.length === 0) {
    console.log("All report treasurers and deacons are linked.");
    return;
  }
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.report_id}|${r.kind}|${r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const date = r.data_culto.toISOString().slice(0, 10);
    console.log(`${r.church} | relatório #${r.report_id} (${date}) | ${r.kind}: ${r.name ?? "(vazio)"}`);
  }
}

main().finally(() => prisma.$disconnect());
