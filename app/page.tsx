export const dynamic = "force-dynamic";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import ReportCard from "@/components/ReportCard";
import { prisma } from "@/lib/prisma";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function HomePage() {
  const recent = await prisma.report.findMany({
    orderBy: { dataCulto: "desc" },
    take: 5,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Hero action */}
      <div className="bg-blue-600 rounded-2xl p-6 text-white text-center shadow-md">
        <p className="text-lg font-semibold mb-1">Novo Culto</p>
        <p className="text-blue-100 text-sm mb-4">
          Preencha o relatório do culto de hoje
        </p>
        <Link
          href="/culto/novo"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-white text-blue-700 hover:bg-blue-50 font-bold text-base px-8"
          )}
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Iniciar Relatório
        </Link>
      </div>

      {/* Recent reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Relatórios Recentes</h2>
          <Link href="/relatorios" className="text-sm text-blue-600 hover:underline">
            Ver todos
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p>Nenhum relatório cadastrado ainda.</p>
            <p className="text-sm mt-1">Clique em &quot;Iniciar Relatório&quot; para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map((r) => (
              <ReportCard
                key={r.id}
                id={r.id}
                dataCulto={r.dataCulto}
                diaDaSemana={r.diaDaSemana}
                pregador={r.pregador}
                totalPresentes={r.totalPresentes}
                horario={r.horario}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
