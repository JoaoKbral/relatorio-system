-- "Outras entradas" is removed from the report. Fold existing values into the
-- special offerings first so nothing is lost; arrecadacaoTotal already includes
-- both, so it stays the same.
UPDATE "Report"
SET "totalOfertasEspeciais" = "totalOfertasEspeciais" + "outrasEntradas"
WHERE "outrasEntradas" <> 0;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "outrasEntradas";
