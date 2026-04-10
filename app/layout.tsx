import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { Church, FileText, Users } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Relatório de Culto — IEQ Canto do Mar",
  description: "Sistema de relatório estatístico e financeiro de culto",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Culto" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={geist.className}>
      <body className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top nav */}
        <header className="bg-blue-700 text-white shadow-md">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Church className="w-6 h-6 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight text-sm sm:text-base">
                IEQ — Canto do Mar
              </p>
              <p className="text-blue-200 text-xs leading-tight">
                Relatório de Culto
              </p>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="bg-white border-t shadow-sm sticky bottom-0">
          <div className="max-w-2xl mx-auto flex">
            <Link
              href="/"
              className="flex-1 flex flex-col items-center py-3 gap-1 text-xs text-gray-600 hover:text-blue-700 transition-colors"
            >
              <Church className="w-5 h-5" />
              Início
            </Link>
            <Link
              href="/relatorios"
              className="flex-1 flex flex-col items-center py-3 gap-1 text-xs text-gray-600 hover:text-blue-700 transition-colors"
            >
              <FileText className="w-5 h-5" />
              Histórico
            </Link>
            <Link
              href="/pessoas"
              className="flex-1 flex flex-col items-center py-3 gap-1 text-xs text-gray-600 hover:text-blue-700 transition-colors"
            >
              <Users className="w-5 h-5" />
              Pessoas
            </Link>
            <LogoutButton />
          </div>
        </nav>

        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
