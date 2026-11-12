"use client";

import Link from "next/link";
import { CloudOff, CloudUpload, LogIn } from "lucide-react";
import { useOffline } from "./OfflineProvider";

/** Thin bar under the header: offline notice and reports waiting to be sent. */
export default function OfflineStatusBar() {
  const { churchId, online, pending, rejected, syncing, needsLogin } = useOffline();
  if (!churchId) return null;
  if (online && pending === 0) return null;

  let text: string;
  if (needsLogin && pending > 0) {
    text = "Sessão expirada. Entre novamente para enviar os relatórios salvos.";
  } else if (pending > 0) {
    const waiting = pending === 1 ? "1 relatório aguardando envio" : `${pending} relatórios aguardando envio`;
    const problem = rejected > 0 ? ` (${rejected} com problema)` : "";
    text = syncing ? "Enviando relatórios..." : `${waiting}${problem}`;
  } else {
    text = "Sem internet. Novos relatórios ficam salvos no aparelho.";
  }

  const Icon = needsLogin ? LogIn : online ? CloudUpload : CloudOff;
  const href = needsLogin && pending > 0 ? "/login" : "/pendentes";
  const tone = rejected > 0 || needsLogin ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-900 border-amber-200";

  return (
    <div className={`border-b ${tone}`} role="status">
      <Link href={href} className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{text}</span>
        {pending > 0 && <span className="font-medium underline shrink-0">{needsLogin ? "Entrar" : "Ver"}</span>}
      </Link>
    </div>
  );
}
