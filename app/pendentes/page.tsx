"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CloudUpload, Loader2, Pencil, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ReportForm from "@/components/report-form/ReportForm";
import { diaDaSemana, formValuesFromPayload, type FormValues } from "@/components/report-form/form-values";
import { usePeopleOptions } from "@/components/report-form/use-people-options";
import { useOffline } from "@/components/offline/OfflineProvider";
import { deletePending, getPending, listPending, onOutboxChange, savePending, type PendingReport } from "@/lib/offline/db";
import { setEditing } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatSavedAt(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Reports saved on this device that the server has not received yet. */
export default function PendentesPage() {
  const { churchId, online, syncing, needsLogin, sync } = useOffline();
  const { options } = usePeopleOptions();
  const [items, setItems] = useState<PendingReport[] | null>(null);
  const [editing, setEditingItem] = useState<{ item: PendingReport; values: FormValues } | null>(null);

  const reload = useCallback(() => {
    if (!churchId) return;
    listPending(churchId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [churchId]);

  useEffect(() => {
    reload();
    return onOutboxChange(reload);
  }, [reload]);

  // Keep automatic sending away from a report while it is being edited.
  useEffect(() => {
    if (!editing) return;
    const id = editing.item.clientId;
    setEditing(id, true);
    return () => setEditing(id, false);
  }, [editing]);

  async function sendAll() {
    const result = await sync({ includeRejected: true });
    if (result && result.sent === 0 && result.rejected === 0 && !result.stopped) {
      toast.info("Nenhum relatório para enviar.");
    }
  }

  async function remove(item: PendingReport) {
    const label = `${formatDate(item.payload.dataCulto)} ${item.payload.horario}`;
    if (!confirm(`Excluir o relatório de ${label} deste aparelho? Ele ainda não foi enviado e será perdido.`)) return;
    await deletePending(item.clientId);
    toast.success("Relatório excluído do aparelho.");
  }

  function edit(item: PendingReport) {
    if (!options) return;
    setEditingItem({ item, values: formValuesFromPayload(item.payload, options.pastors.map((p) => p.name)) });
  }

  if (!churchId) {
    return <p className="text-center py-10 text-gray-500">Entre com sua conta para ver os relatórios pendentes.</p>;
  }

  if (editing && options) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Editar relatório pendente</h1>
          <Button variant="ghost" onClick={() => setEditingItem(null)}>
            Cancelar
          </Button>
        </div>
        <ReportForm
          initialValues={editing.values}
          people={options}
          submitLabel="Salvar no aparelho"
          onSubmit={async (input) => {
            const { item } = editing;
            // Sent meanwhile (e.g. from another tab): the change must be made in the history.
            if (!(await getPending(item.clientId))) {
              throw new Error("Este relatório já foi enviado. Faça a alteração pelo Histórico.");
            }
            await savePending({
              ...item,
              payload: { ...input, clientId: item.clientId },
              status: "pending",
              error: undefined,
            });
            toast.success("Alterações salvas no aparelho.");
            setEditingItem(null);
            if (navigator.onLine) sync({ quiet: true });
          }}
        />
      </div>
    );
  }

  const hasItems = items !== null && items.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold">Relatórios pendentes</h1>

      {items === null ? (
        <p className="text-center py-10 text-gray-400">Carregando...</p>
      ) : !hasItems ? (
        <div className="text-center py-10 text-gray-500 flex flex-col gap-3 items-center">
          <p>Nenhum relatório aguardando envio neste aparelho.</p>
          <Link href="/relatorios" className={cn(buttonVariants({ variant: "outline" }))}>
            Ver histórico
          </Link>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <p className="text-sm text-gray-600">
                Estes relatórios estão salvos <strong>somente neste aparelho</strong>. Eles são enviados sozinhos
                quando o app está aberto com internet. Você também pode enviar todos agora.
              </p>
              <p className="text-sm text-amber-800 bg-amber-50 rounded-md p-2 flex gap-2">
                <Wifi className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                Fique em um local com boa internet e mantenha o app aberto até o envio terminar.
              </p>
              {needsLogin && (
                <p className="text-sm text-red-700">
                  Sua sessão expirou.{" "}
                  <Link href="/login" className="underline font-medium">
                    Entre novamente
                  </Link>{" "}
                  para enviar.
                </p>
              )}
              <Button onClick={sendAll} disabled={syncing || !online} className="w-full">
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4 mr-2" />
                )}
                {syncing ? "Enviando..." : !online ? "Sem internet" : `Enviar todos (${items.length})`}
              </Button>
            </CardContent>
          </Card>

          {items.map((item) => (
            <Card key={item.clientId} className={item.status === "error" ? "border-red-300" : undefined}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {formatDate(item.payload.dataCulto)} · {item.payload.horario}
                    </p>
                    <p className="text-sm text-gray-500">
                      {diaDaSemana(item.payload.dataCulto)} · {item.payload.pregador}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 text-right shrink-0">
                    Salvo em
                    <br />
                    {formatSavedAt(item.createdAt)}
                  </span>
                </div>
                {item.status === "error" && (
                  <p className="text-sm text-red-700 bg-red-50 rounded-md p-2 flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Não aceito pelo servidor: {item.error ?? "dados inválidos"}. Corrija e envie de novo.
                    </span>
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => edit(item)}
                    disabled={!options || syncing}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => remove(item)}
                    disabled={syncing}
                    aria-label="Excluir do aparelho"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
