"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { clearOfflinePages } from "@/lib/offline/clear";
import { useOffline } from "@/components/offline/OfflineProvider";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const { pending } = useOffline();

  async function handleLogout() {
    if (
      pending > 0 &&
      !confirm(
        `Há ${pending === 1 ? "1 relatório" : `${pending} relatórios`} ainda não enviado(s) neste aparelho. ` +
          "Ele(s) continuam guardados e serão enviados quando alguém da igreja entrar de novo neste aparelho. Sair mesmo assim?"
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Saved pages show this church's data; the next user must not see them offline.
      await clearOfflinePages();
      window.location.href = "/login";
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sair do sistema"
      className="flex flex-col items-center py-3 gap-1 text-xs text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50 disabled:pointer-events-none px-3"
    >
      <LogOut className="w-5 h-5" aria-hidden="true" />
      Sair
    </button>
  );
}
