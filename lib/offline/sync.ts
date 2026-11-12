// Sends the reports saved on the device. Runs automatically while the app is
// open and online, and from the "Enviar todos" button. Browser only.
import { deletePending, listPending, savePending } from "./db";
import { postReport } from "./post-report";

export interface SyncResult {
  sent: number;
  /** Rejected by the server in this run; kept on the device with the error. */
  rejected: number;
  /** Still on the device after the run (pending + rejected). */
  remaining: number;
  /** Why the run stopped early, if it did. */
  stopped: "auth" | "network" | null;
}

/** Reports open in the editor; sync leaves them alone so an edit is not lost. */
const editing = new Set<string>();

export function setEditing(clientId: string, on: boolean) {
  if (on) editing.add(clientId);
  else editing.delete(clientId);
}

let running: Promise<SyncResult> | null = null;

/**
 * Sends the church's pending reports, oldest first. Rejected reports are only
 * retried when `includeRejected` is set (the manual button): unchanged, the
 * server would reject them again, unless someone fixed the data on its side.
 * Only one run happens at a time, across tabs where the browser supports it.
 */
export function syncOutbox(churchId: number, { includeRejected = false } = {}): Promise<SyncResult> {
  if (running) return running;
  const work = () => runSync(churchId, includeRejected);
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const run = (async (): Promise<SyncResult> =>
    locks ? await locks.request("relatorio-culto-sync", work) : await work())().finally(() => {
    running = null;
  });
  running = run;
  return run;
}

async function runSync(churchId: number, includeRejected: boolean): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, rejected: 0, remaining: 0, stopped: null };
  for (const item of await listPending(churchId)) {
    if (editing.has(item.clientId)) continue;
    if (item.status === "error" && !includeRejected) continue;

    const res = await postReport(item.payload);
    if (res.kind === "ok") {
      await deletePending(item.clientId);
      result.sent++;
    } else if (res.kind === "invalid") {
      await savePending({ ...item, status: "error", error: res.error });
      result.rejected++;
    } else {
      // No point trying the next ones: same connection, same session.
      result.stopped = res.kind === "auth" ? "auth" : "network";
      break;
    }
  }
  result.remaining = (await listPending(churchId)).length;
  return result;
}
