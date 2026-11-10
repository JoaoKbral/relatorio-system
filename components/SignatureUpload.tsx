"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { processSignatureImage, SignatureImageError, type ProcessedSignature } from "@/lib/signature-image";

interface Props {
  personId: number;
  /** When the saved signature last changed; null if there is none. */
  updatedAt: string | null;
}

// Checkerboard so transparent areas are visible in the preview.
const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "16px 16px",
};

/** Upload, preview and remove a person's signature (used on the REFC report). */
export default function SignatureUpload({ personId, updatedAt: initialUpdatedAt }: Props) {
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [pending, setPending] = useState<(ProcessedSignature & { url: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Free the preview's object URL when it is replaced or the component unmounts.
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);

  const savedUrl = updatedAt
    ? `/api/pessoas/${personId}/assinatura?v=${encodeURIComponent(updatedAt)}`
    : null;

  async function handleFile(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const processed = await processSignatureImage(file);
      setPending({ ...processed, url: URL.createObjectURL(processed.blob) });
    } catch (e) {
      toast.error(e instanceof SignatureImageError ? e.message : "Não foi possível processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pessoas/${personId}/assinatura`, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: pending.blob,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar a assinatura.");
      setUpdatedAt(data.updatedAt);
      setPending(null);
      toast.success("Assinatura salva!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a assinatura.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remover a assinatura desta pessoa?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pessoas/${personId}/assinatura`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setUpdatedAt(null);
      toast.success("Assinatura removida.");
    } catch {
      toast.error("Erro ao remover a assinatura.");
    } finally {
      setBusy(false);
    }
  }

  const shownUrl = pending?.url ?? savedUrl;

  return (
    <div className="flex flex-col gap-2">
      <Label>Assinatura</Label>
      <p className="text-xs text-gray-500">
        Usada no relatório REFC para diáconos responsáveis e tesoureiros. Envie uma foto ou PNG da
        assinatura em fundo claro: o fundo fica transparente e as margens são cortadas automaticamente.
      </p>

      <div
        className="flex items-center justify-center rounded-md border h-28 p-2"
        style={CHECKERBOARD}
      >
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not a static asset
          <img src={shownUrl} alt="Assinatura" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-gray-500 bg-white/80 px-2 rounded">Nenhuma assinatura</span>
        )}
      </div>
      {pending && (
        <p className="text-xs text-amber-700">Pré-visualização: clique em salvar para usar esta assinatura.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        {pending ? (
          <>
            <Button type="button" size="sm" onClick={save} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar assinatura
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              {updatedAt ? "Trocar assinatura" : "Enviar assinatura"}
            </Button>
            {updatedAt && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-red-500 hover:text-red-700"
                onClick={remove}
                disabled={busy}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remover
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
