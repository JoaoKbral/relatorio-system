import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { Church, FileText, Users, Settings } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Relatório de Culto",
  description: "Sistema de relatório estatístico e financeiro de culto",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Culto" },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await decrypt(cookieStore.get("session")?.value);

  let churchName = "Relatório de Culto";
  if (session?.churchId) {
    const church = await prisma.church.findUnique({
      where: { id: session.churchId },
      select: { name: true },
    });
    if (church) churchName = church.name;
  }

  const isAdmin = session?.role === "ADMIN" || session?.role === "SUPER_ADMIN";

  return (
    <html lang="pt-BR" className={geist.className}>
      <body className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top nav */}
        <header className="bg-blue-700 text-white shadow-md">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Church className="w-6 h-6 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight text-sm sm:text-base">
                {churchName}
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
            {isAdmin && (
              <Link
                href="/configuracoes"
                className="flex-1 flex flex-col items-center py-3 gap-1 text-xs text-gray-600 hover:text-blue-700 transition-colors"
              >
                <Settings className="w-5 h-5" />
                Config.
              </Link>
            )}
            {session && <LogoutButton />}
          </div>
        </nav>

        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
