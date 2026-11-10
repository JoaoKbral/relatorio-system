// Browser-only helpers for downloading generated report files.
import { reportFileName } from "@/lib/report-filename";

/** Saves a blob through a temporary <a download> link. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Downloads one report's DOCX. Throws if the server fails. */
export async function downloadReportDocx(
  id: number,
  dataCulto: string | Date,
  horario: string
): Promise<void> {
  const res = await fetch(`/api/relatorios/${id}/download`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  saveBlob(await res.blob(), reportFileName(dataCulto, horario));
}
