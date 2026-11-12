"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { listPending, onOutboxChange } from "@/lib/offline/db";
import { getPeople } from "@/lib/offline/people";
import { syncOutbox, type SyncResult } from "@/lib/offline/sync";

interface OfflineState {
  /** Church of the logged-in user; null when logged out or super-admin. */
  churchId: number | null;
  online: boolean;
  /** Reports on this device waiting to be sent (including rejected ones). */
  pending: number;
  /** Of those, the ones the server rejected and that need fixing. */
  rejected: number;
  syncing: boolean;
  /** The last send attempt failed because the session expired. */
  needsLogin: boolean;
  /** Sends pending reports now. `includeRejected` also retries rejected ones. */
  sync: (opts?: { includeRejected?: boolean; quiet?: boolean }) => Promise<SyncResult | null>;
}

const OfflineContext = createContext<OfflineState>({
  churchId: null,
  online: true,
  pending: 0,
  rejected: 0,
  syncing: false,
  needsLogin: false,
  sync: async () => null,
});

export const useOffline = () => useContext(OfflineContext);

/** How often to retry while reports are waiting: `online` can be true with no real internet. */
const RETRY_MS = 60_000;
/**
 * Minimum gap between re-downloads of the pages kept for offline use. Opening
 * a page online already refreshes its copy, and login clears the timestamp, so
 * this only catches deploys for pages not visited since. Kept sparse to spare
 * mobile data.
 */
const WARM_EVERY_MS = 12 * 60 * 60_000;
const WARM_KEY = "offline.lastWarm";
/**
 * The people list is one small query, refreshed on navigation: someone
 * registered just before leaving must already be in the offline form.
 */
const PEOPLE_EVERY_MS = 20_000;
let lastPeopleRefresh = 0;

function refreshPeople(churchId: number) {
  if (!navigator.onLine || Date.now() - lastPeopleRefresh < PEOPLE_EVERY_MS) return;
  lastPeopleRefresh = Date.now();
  getPeople(churchId).catch(() => {});
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") {
    // A worker left over from a production test would serve stale pages in dev.
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
}

/** Asks the service worker to (re)download the pages used offline. Throttled. */
function warmOfflineCache() {
  let last = 0;
  try {
    last = Number(localStorage.getItem(WARM_KEY)) || 0;
  } catch {}
  if (Date.now() - last < WARM_EVERY_MS) return;
  try {
    localStorage.setItem(WARM_KEY, String(Date.now()));
  } catch {}

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "warm" })).catch(() => {});
  }
}

export default function OfflineProvider({
  churchId,
  children,
}: {
  churchId: number | null;
  children: React.ReactNode;
}) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const pendingRef = useRef(0);
  const pathname = usePathname();

  const refreshCounts = useCallback(async () => {
    if (!churchId) return;
    const items = await listPending(churchId).catch(() => []);
    pendingRef.current = items.length;
    setPending(items.length);
    setRejected(items.filter((i) => i.status === "error").length);
  }, [churchId]);

  const sync = useCallback<OfflineState["sync"]>(
    async ({ includeRejected = false, quiet = false } = {}) => {
      if (!churchId) return null;
      setSyncing(true);
      try {
        const result = await syncOutbox(churchId, { includeRejected });
        setNeedsLogin(result.stopped === "auth");
        if (result.sent > 0) {
          toast.success(`${plural(result.sent, "relatório enviado", "relatórios enviados")} ao servidor.`);
        }
        if (result.rejected > 0) {
          toast.error(
            `${plural(result.rejected, "relatório não foi aceito", "relatórios não foram aceitos")}. Veja em Pendentes.`
          );
        }
        if (!quiet && result.stopped === "network") {
          toast.error("Sem conexão com o servidor. Os relatórios continuam salvos no aparelho.");
        }
        if (!quiet && result.stopped === "auth") {
          toast.error("Sua sessão expirou. Entre novamente para enviar os relatórios.");
        }
        return result;
      } catch {
        if (!quiet) toast.error("Não foi possível enviar agora. Tente novamente.");
        return null;
      } finally {
        setSyncing(false);
        refreshCounts();
      }
    },
    [churchId, refreshCounts]
  );

  useEffect(setupServiceWorker, []);

  useEffect(() => {
    if (churchId) refreshPeople(churchId);
  }, [churchId, pathname]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!churchId) return;
    refreshCounts();
    return onOutboxChange(refreshCounts);
  }, [churchId, refreshCounts]);

  // Automatic sending: on open, when the connection comes back, when the app
  // returns to the foreground, and periodically while something is waiting.
  useEffect(() => {
    if (!churchId) return;

    // Ask the browser not to wipe the saved reports when space is low.
    // Safari may also clear data of sites not used for 7 days unless installed.
    navigator.storage?.persist?.().catch(() => {});

    const autoSync = () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      warmOfflineCache();
      refreshPeople(churchId);
      // Rejected reports wait for the user to fix them or press "Enviar todos".
      listPending(churchId)
        .then((items) => (items.some((i) => i.status === "pending") ? sync({ quiet: true }) : null))
        .catch(() => {});
    };
    autoSync();
    const timer = setInterval(() => pendingRef.current > 0 && autoSync(), RETRY_MS);
    window.addEventListener("online", autoSync);
    document.addEventListener("visibilitychange", autoSync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", autoSync);
      document.removeEventListener("visibilitychange", autoSync);
    };
  }, [churchId, sync]);

  return (
    <OfflineContext.Provider value={{ churchId, online, pending, rejected, syncing, needsLogin, sync }}>
      {children}
    </OfflineContext.Provider>
  );
}
