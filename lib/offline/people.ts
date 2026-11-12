// The church's active people, from the server when online and from the device
// copy when not. The copy is refreshed on every successful load. Browser only.
import { loadPeople, savePeople, type CachedPerson } from "./db";

const TIMEOUT_MS = 8_000;

async function fetchAllPeople(): Promise<CachedPerson[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/pessoas?limit=2000", { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`GET /api/pessoas: ${res.status}`);
    const rows: CachedPerson[] = await res.json();
    return rows.map(({ id, name, roles }) => ({ id, name, roles }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Active people of the church. Without `churchId` it only asks the server.
 * With it, a successful answer is saved on the device and used when the
 * server cannot be reached. Throws when neither is available.
 */
export async function getPeople(churchId?: number | null): Promise<{ people: CachedPerson[]; offline: boolean }> {
  try {
    const people = await fetchAllPeople();
    if (churchId) await savePeople(churchId, people).catch(() => {});
    return { people, offline: false };
  } catch (e) {
    const cached = churchId ? await loadPeople(churchId).catch(() => null) : null;
    if (cached) return { people: cached, offline: true };
    throw e;
  }
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Accent- and case-insensitive name search in the device copy (offline suggestions). */
export async function searchCachedPeople(
  churchId: number,
  query: string,
  role?: string,
  limit = 50
): Promise<CachedPerson[]> {
  const people = (await loadPeople(churchId).catch(() => null)) ?? [];
  const q = normalize(query.trim());
  return people
    .filter((p) => (!role || p.roles.includes(role)) && normalize(p.name).includes(q))
    .slice(0, limit);
}
