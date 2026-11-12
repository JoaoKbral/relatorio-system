// Browser only. Removes the pages the service worker saved for offline use
// (they contain the logged-in church's data). Reports waiting to be sent are kept.
export async function clearOfflinePages(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
    localStorage.removeItem("offline.lastWarm");
  } catch {
    // Storage blocked: nothing to clear.
  }
}
