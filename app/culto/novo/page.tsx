"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import DownloadButton from "@/components/DownloadButton";
import ReportForm from "@/components/report-form/ReportForm";
import { emptyFormValues } from "@/components/report-form/form-values";
import { usePeopleOptions } from "@/components/report-form/use-people-options";
import { sendJson } from "@/lib/api-client";

interface Saved {
  id: number;
  dataCulto: string;
  horario: string;
}

export default function NovoCultoPage() {
  const router = useRouter();
  const { options, error } = usePeopleOptions();
  const [initialValues] = useState(emptyFormValues);
  const [saved, setSaved] = useState<Saved | null>(null);

  if (error) return <p className="text-center py-10 text-red-500">Erro ao carregar o formulário.</p>;
  if (!options) return <p className="text-center py-10 text-gray-400">Carregando...</p>;

  if (saved) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <p className="text-green-600 font-semibold text-center">✓ Relatório salvo!</p>
          <DownloadButton
            id={saved.id}
            dataCulto={saved.dataCulto}
            horario={saved.horario}
            label="Baixar Relatório"
            size="default"
            variant="outline"
            className="w-full"
          />
          <Button variant="ghost" className="w-full" onClick={() => router.push(`/culto/${saved.id}`)}>
            Ver relatório
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push("/")}>
            Voltar ao Início
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ReportForm
      initialValues={initialValues}
      people={options}
      submitLabel="Salvar Relatório"
      onSubmit={async (payload) => {
        const { id } = await sendJson<{ id: number }>("/api/relatorios", "POST", payload);
        toast.success("Relatório salvo com sucesso!");
        setSaved({ id, dataCulto: payload.dataCulto, horario: payload.horario });
      }}
    />
  );
}
