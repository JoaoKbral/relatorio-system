"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
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
