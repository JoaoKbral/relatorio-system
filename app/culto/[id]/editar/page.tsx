"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReportForm from "@/components/report-form/ReportForm";
import {
  formValuesFromReport,
  type FormValues,
  type ReportResponse,
} from "@/components/report-form/form-values";
import { loadPeopleOptions, withPeople, type PeopleOptions } from "@/components/report-form/use-people-options";
import { sendJson } from "@/lib/api-client";

export default function EditarCultoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<{ values: FormValues; people: PeopleOptions } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/relatorios/${id}`).then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<ReportResponse>;
      }),
      loadPeopleOptions(),
    ])
      .then(([report, options]) => {
        if (cancelled) return;
        // Keep people the report already uses selectable, even if they have
        // since changed role or been deactivated.
        const people: PeopleOptions = {
          pastors: options.pastors,
          deacons: withPeople(
            options.deacons,
            report.deacons.map((d) => ({ id: d.personId, name: d.person.name }))
          ),
          treasurers: withPeople(options.treasurers, report.treasurer ? [report.treasurer] : []),
        };
        const values = formValuesFromReport(report, options.pastors.map((p) => p.name));
        setState({ values, people });
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href={`/culto/${id}`} className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold flex-1">Editar Relatório</h1>
      </div>

      {error ? (
        <p className="text-center py-10 text-red-500">Erro ao carregar o relatório.</p>
      ) : !state ? (
        <p className="text-center py-10 text-gray-400">Carregando...</p>
      ) : (
        <ReportForm
          initialValues={state.values}
          people={state.people}
          submitLabel="Salvar Alterações"
          onSubmit={async (payload) => {
            await sendJson(`/api/relatorios/${id}`, "PUT", payload);
            toast.success("Relatório atualizado!");
            router.push(`/culto/${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
