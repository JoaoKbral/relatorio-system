// Sends a new report to the server and classifies the outcome, so callers can
// decide whether to keep it on the device. Browser only.
import type { ReportInput } from "@/lib/report-schema";

export type PostResult =
  | { kind: "ok"; id: number }
  /** The server rejected the data (400): retrying unchanged will fail again. */
  | { kind: "invalid"; error: string }
  /** Not logged in any more (401/403): log in again, then retry. */
  | { kind: "auth" }
  /** No connection, timeout or server error: retry later. */
  | { kind: "retry" };

/** Weak signal can leave a request hanging for minutes; give up and keep it on the device. */
const TIMEOUT_MS = 20_000;

export async function postReport(payload: ReportInput & { clientId: string }): Promise<PostResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "retry" };

  // AbortSignal.timeout is missing on older iPhones (iOS < 16).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/relatorios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { id?: number; error?: string } | null;
    if (res.ok && typeof data?.id === "number") return { kind: "ok", id: data.id };
    if (res.status === 401 || res.status === 403) return { kind: "auth" };
    if (res.status === 400) return { kind: "invalid", error: data?.error ?? "Dados inválidos." };
    return { kind: "retry" };
  } catch {
    return { kind: "retry" };
  } finally {
    clearTimeout(timer);
  }
}

/** Random UUID v4. crypto.randomUUID is missing on iOS < 15.4. */
export function newClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
