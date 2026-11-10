// Small fetch wrapper for the app's JSON API (browser side).

/** Sends JSON and returns the parsed response; throws Error(message) on failure. */
export async function sendJson<T>(url: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? "Erro ao salvar. Tente novamente.");
  }
  return data as T;
}
