"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import DownloadButton from "@/components/DownloadButton";
import ReportForm from "@/components/report-form/ReportForm";
import { emptyFormValues } from "@/components/report-form/form-values";
import { usePeopleOptions } from "@/components/report-form/use-people-options";
import { useOffline } from "@/components/offline/OfflineProvider";
import { savePending } from "@/lib/offline/db";
import { newClientId, postReport } from "@/lib/offline/post-report";
import { cn } from "@/lib/utils";

type Saved =
  | { where: "server"; id: number; dataCulto: string; horario: string }
  | { where: "device"; sessionExpired: boolean };

export default function NovoCultoPage() {
  const router = useRouter();
  const { churchId } = useOffline();
  const { options, error } = usePeopleOptions();
  // One id per filled-in form: if the same report is sent twice (lost
  // response, retry from the device), the server keeps only one.
  const [form, setForm] = useState(() => ({ clientId: newClientId(), values: emptyFormValues() }));
  const [saved, setSaved] = useState<Saved | null>(null);

  function startNew() {
    setForm({ clientId: newClientId(), values: emptyFormValues() });
    setSaved(null);
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6 text-center">
          <CloudOff className="w-8 h-8 mx-auto text-gray-400" />
          <p className="text-red-600 font-medium">Não foi possível carregar o formulário.</p>
          <p className="text-sm text-gray-500">
            Sem internet, o formulário usa os dados guardados no aparelho. Abra o app uma vez com internet para
            guardá-los e depois ele funciona offline.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (!options) return <p className="text-center py-10 text-gray-400">Carregando...</p>;

  if (saved?.where === "server") {
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

  if (saved?.where === "device") {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <p className="text-amber-700 font-semibold text-center">✓ Relatório salvo no aparelho</p>
          <p className="text-sm text-gray-600 text-center">
            {saved.sessionExpired
              ? "Sua sessão expirou. Entre novamente com internet e o relatório será enviado."
              : "Sem conexão agora. Ele será enviado automaticamente quando o app for aberto com internet. O documento para baixar fica disponível depois do envio."}
          </p>
          <Link href="/pendentes" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Ver relatórios pendentes
          </Link>
          <Button variant="ghost" className="w-full" onClick={startNew}>
            Preencher outro relatório
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-full")}>
            Voltar ao Início
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <ReportForm
      key={form.clientId}
      initialValues={form.values}
      people={options}
      submitLabel="Salvar Relatório"
      onSubmit={async (input) => {
        const payload = { ...input, clientId: form.clientId };
        const res = await postReport(payload);
        if (res.kind === "ok") {
          toast.success("Relatório salvo com sucesso!");
          setSaved({ where: "server", id: res.id, dataCulto: payload.dataCulto, horario: payload.horario });
          return;
        }
        // The form shows this message and stays open for corrections.
        if (res.kind === "invalid") throw new Error(res.error);
        if (!churchId) throw new Error("Sessão inválida. Entre novamente.");

        try {
          await savePending({
            clientId: form.clientId,
            churchId,
            payload,
            createdAt: Date.now(),
            status: "pending",
          });
        } catch {
          throw new Error("Sem conexão e não foi possível salvar no aparelho. Não feche esta tela e tente novamente.");
        }
        toast.success("Relatório salvo no aparelho.");
        setSaved({ where: "device", sessionExpired: res.kind === "auth" });
      }}
    />
  );
}
