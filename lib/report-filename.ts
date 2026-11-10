// File names for downloaded REFC reports. Used on the server (Content-Disposition,
// ZIP entries) and the client (the <a download> name), so they always match.

/** "19:30" → "19h30", "10:00" → "10h". Returns "" for anything else. */
export function formatHorario(horario: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(horario ?? "");
  if (!match) return "";
  const [, h, m] = match;
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** dataCulto is stored as UTC midnight, so format it in UTC. */
function formatDate(dataCulto: Date | string): string {
  const d = typeof dataCulto === "string" ? new Date(dataCulto) : dataCulto;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

/** e.g. "REFC-09-11-2026-19h30.docx" */
export function reportFileName(dataCulto: Date | string, horario?: string | null): string {
  const time = formatHorario(horario);
  return `REFC-${formatDate(dataCulto)}${time ? `-${time}` : ""}.docx`;
}

/** Appends -2, -3, … to names already used, e.g. inside a ZIP. */
export function uniqueFileNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    for (let n = 2; used.has(candidate); n++) {
      candidate = name.replace(/(\.[^.]+)?$/, (ext) => `-${n}${ext}`);
    }
    used.add(candidate);
    return candidate;
  });
}
