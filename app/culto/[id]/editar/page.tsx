"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import NameAutocomplete from "@/components/NameAutocomplete";
import CurrencyInput from "@/components/CurrencyInput";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tither {
  personName: string;
  chequeNumber: string;
  bankNumber: string;
  paymentMethod: "DINHEIRO" | "PIX" | null;
  value: number;
  order: number;
}

interface FormData {
  dataCulto: string;
  diaDaSemana: string;
  horario: string;
  pregador: string;
  testemunhoCura: number;
  conversoes: number;
  batizadosEspirito: number;
  visitantes: number;
  diaconosServico: number;
  criancasApresentadas: number;
  totalPresentes: number;
  pastoresCheckbox: string[];
  pastoresExtras: string[];
  visitasEspeciais: string[];
  tithers: Tither[];
  diaconosResponsaveis: string[];
  responsavelPeloRelatorio: string;
  totalOfertasGerais: number;
  totalOfertasEspeciais: number;
  outrasEntradas: number;
  totalOfertasMissoes: number;
}

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function diaDaSemanaFromDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  return DIAS[new Date(year, month - 1, day).getDay()];
}

const emptyTither = (order: number): Tither => ({
  personName: "", chequeNumber: "", bankNumber: "", paymentMethod: "PIX", value: 0, order,
});

const STEP_TITLES = [
  "Dados do Culto", "Estatísticas", "Pastores e Visitantes",
  "Dízimos", "Ofertas", "Confirmação",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EditarCultoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableDeacons, setAvailableDeacons] = useState<string[]>([]);
  const [availablePastors, setAvailablePastors] = useState<string[]>([]);
  const [diaconosPresentes, setDiaconosPresentes] = useState<string[]>([]);

  // Load report + people lists in parallel
  useEffect(() => {
    Promise.all([
      fetch(`/api/relatorios/${id}`).then((r) => r.json()),
      fetch("/api/pessoas?role=pastor").then((r) => r.json()),
      fetch("/api/pessoas?role=diacono").then((r) => r.json()),
    ]).then(([report, pastors, deacons]) => {
      const knownPastors: string[] = pastors.map((p: { name: string }) => p.name);
      setAvailablePastors(knownPastors);
      setAvailableDeacons(deacons.map((d: { name: string }) => d.name));

      const knownSet = new Set(knownPastors);
      const pastoresCheckbox = (report.pastoresPresentes as string[]).filter((p) => knownSet.has(p));
      const pastoresExtras = (report.pastoresPresentes as string[]).filter((p) => !knownSet.has(p));

      setForm({
        dataCulto: new Date(report.dataCulto).toISOString().split("T")[0],
        diaDaSemana: report.diaDaSemana,
        horario: report.horario,
        pregador: report.pregador,
        testemunhoCura: report.testemunhoCura,
        conversoes: report.conversoes,
        batizadosEspirito: report.batizadosEspirito,
        visitantes: report.visitantes,
        diaconosServico: report.diaconosServico,
        criancasApresentadas: report.criancasApresentadas,
        totalPresentes: report.totalPresentes,
        pastoresCheckbox,
        pastoresExtras: pastoresExtras.length ? [...pastoresExtras, ""] : [""],
        visitasEspeciais: report.visitasEspeciais.length
          ? [...report.visitasEspeciais, ""]
          : [""],
        tithers: report.tithers.length
          ? report.tithers.map((t: { personName: string; chequeNumber: string | null; bankNumber: string | null; paymentMethod: "DINHEIRO" | "PIX" | null; value: number; order: number }) => ({
              personName: t.personName,
              chequeNumber: t.chequeNumber ?? "",
              bankNumber: t.bankNumber ?? "",
              paymentMethod: t.paymentMethod ?? "PIX",
              value: Number(t.value),
              order: t.order,
            }))
          : [emptyTither(1)],
        diaconosResponsaveis: report.diaconosResponsaveis as string[],
        responsavelPeloRelatorio: report.responsavelPeloRelatorio ?? "",
        totalOfertasGerais: Number(report.totalOfertasGerais),
        totalOfertasEspeciais: Number(report.totalOfertasEspeciais),
        outrasEntradas: Number(report.outrasEntradas),
        totalOfertasMissoes: Number(report.totalOfertasMissoes ?? 0),
      });
      setDiaconosPresentes(report.diaconosResponsaveis as string[]);
    }).catch(() => toast.error("Erro ao carregar relatório."));
  }, [id]);

  if (!form) {
    return <p className="text-center text-gray-400 py-12">Carregando...</p>;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function setNum(key: keyof FormData, value: string) {
    setForm((prev) => prev ? { ...prev, [key]: Number(value) || 0 } : prev);
  }

  function setPastorExtra(i: number, v: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const arr = [...prev.pastoresExtras];
      arr[i] = v;
      if (v.trim() && i === arr.length - 1) arr.push("");
      return { ...prev, pastoresExtras: arr };
    });
  }

  function removePastorExtra(i: number) {
    setForm((prev) => {
      if (!prev) return prev;
      const arr = prev.pastoresExtras.filter((_, idx) => idx !== i);
      return { ...prev, pastoresExtras: arr.length ? arr : [""] };
    });
  }

  function togglePastor(name: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const already = prev.pastoresCheckbox.includes(name);
      return {
        ...prev,
        pastoresCheckbox: already
          ? prev.pastoresCheckbox.filter((p) => p !== name)
          : [...prev.pastoresCheckbox, name],
      };
    });
  }

  function setVisita(i: number, v: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const arr = [...prev.visitasEspeciais];
      arr[i] = v;
      if (v.trim() && i === arr.length - 1) arr.push("");
      return { ...prev, visitasEspeciais: arr };
    });
  }

  function removeVisita(i: number) {
    setForm((prev) => {
      if (!prev) return prev;
      const arr = prev.visitasEspeciais.filter((_, idx) => idx !== i);
      return { ...prev, visitasEspeciais: arr.length ? arr : [""] };
    });
  }

  function toggleDiaconoPresente(name: string) {
    setDiaconosPresentes((prev) => {
      const removing = prev.includes(name);
      if (removing) {
        setForm((f) => {
          if (!f) return f;
          const newResp = f.diaconosResponsaveis.filter((d) => d !== name);
          const newRelat = newResp.includes(f.responsavelPeloRelatorio) ? f.responsavelPeloRelatorio : "";
          return { ...f, diaconosResponsaveis: newResp, responsavelPeloRelatorio: newRelat };
        });
        return prev.filter((n) => n !== name);
      }
      return [...prev, name];
    });
  }

  function toggleDeacon(name: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const already = prev.diaconosResponsaveis.includes(name);
      if (!already && prev.diaconosResponsaveis.length >= 3) return prev;
      const newResp = already
        ? prev.diaconosResponsaveis.filter((d) => d !== name)
        : [...prev.diaconosResponsaveis, name];
      const newRelat = newResp.includes(prev.responsavelPeloRelatorio) ? prev.responsavelPeloRelatorio : "";
      return { ...prev, diaconosResponsaveis: newResp, responsavelPeloRelatorio: newRelat };
    });
  }

  function setTither(index: number, field: keyof Tither, value: string | number) {
    setForm((prev) => {
      if (!prev) return prev;
      const tithers = [...prev.tithers];
      tithers[index] = { ...tithers[index], [field]: value };
      if (field === "personName" && String(value).trim() && index === tithers.length - 1) {
        tithers.push(emptyTither(tithers.length + 1));
      }
      return { ...prev, tithers };
    });
  }

  function removeTither(index: number) {
    setForm((prev) => {
      if (!prev || prev.tithers.length <= 1) return prev;
      const tithers = prev.tithers
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, order: i + 1 }));
      return { ...prev, tithers };
    });
  }

  const totalDizimos = form.tithers.reduce((s, t) => s + Number(t.value), 0);
  const arrecadacaoTotal =
    totalDizimos +
    Number(form.totalOfertasGerais) +
    Number(form.totalOfertasEspeciais) +
    Number(form.outrasEntradas);
  const filledTithers = form.tithers.filter((t) => t.personName.trim());

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/relatorios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          diaconosServico: diaconosPresentes.length,
          pastoresPresentes: [
            ...form.pastoresCheckbox,
            ...form.pastoresExtras.filter(Boolean),
          ],
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Relatório atualizado!");
      router.push(`/culto/${id}`);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function validate(): string | null {
    if (!form) return null;
    if (step === 0) {
      if (!form.dataCulto) return "Informe a data do culto.";
      if (!form.horario.trim()) return "Informe o horário.";
      if (!form.pregador.trim()) return "Informe o nome do pregador.";
    }
    if (step === 2) {
      const all = [...form.pastoresCheckbox, ...form.pastoresExtras.filter(Boolean)];
      if (all.length === 0) return "Informe ao menos um pastor presente.";
    }
    if (step === 3) {
      if (diaconosPresentes.length === 0)
        return "Selecione ao menos um diácono em serviço.";
      if (form.diaconosResponsaveis.length === 0)
        return "Selecione ao menos um diácono responsável.";
    }
    return null;
  }

  function next() {
    const err = validate();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  const fmtCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/culto/${id}`}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold flex-1">Editar Relatório</h1>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Passo {step + 1} de {STEP_TITLES.length}</span>
          <span>{STEP_TITLES[step]}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          {/* STEP 0 — Dados do Culto */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="dataCulto">Data do Culto *</Label>
                  <Input
                    id="dataCulto"
                    type="date"
                    value={form.dataCulto}
                    onChange={(e) => {
                      set("dataCulto", e.target.value);
                      set("diaDaSemana", diaDaSemanaFromDate(e.target.value));
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Dia da Semana</Label>
                  <Input value={form.diaDaSemana} readOnly className="bg-gray-50" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="horario">Horário *</Label>
                <Input
                  id="horario"
                  type="time"
                  value={form.horario}
                  onChange={(e) => set("horario", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="pregador">Pregador *</Label>
                <NameAutocomplete
                  id="pregador"
                  value={form.pregador}
                  onChange={(v) => set("pregador", v)}
                  placeholder="Nome do pregador"
                />
              </div>
            </>
          )}

          {/* STEP 1 — Estatísticas */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "testemunhoCura", label: "Testemunhos de Cura" },
                { key: "conversoes", label: "Conversões" },
                { key: "batizadosEspirito", label: "Batizados no Esp. Santo" },
                { key: "visitantes", label: "Visitantes" },
                { key: "criancasApresentadas", label: "Crianças Apresentadas" },
                { key: "totalPresentes", label: "Total de Presentes" },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    min="0"
                    value={form[key as keyof FormData] as number || ""}
                    onChange={(e) => setNum(key as keyof FormData, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}

          {/* STEP 2 — Pastores e Visitantes */}
          {step === 2 && (
            <>
              <div className="flex flex-col gap-2">
                <Label>Pastores Presentes *</Label>
                {availablePastors.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {availablePastors.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={form.pastoresCheckbox.includes(name)}
                          onCheckedChange={() => togglePastor(name)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 mt-1">
                  <p className="text-xs text-gray-500">Adicionar pastor não listado:</p>
                  {form.pastoresExtras.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <NameAutocomplete
                        value={v}
                        onChange={(val) => setPastorExtra(i, val)}
                        placeholder="Nome do pastor"
                      />
                      {form.pastoresExtras.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-red-500 hover:text-red-700"
                          onClick={() => removePastorExtra(i)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t pt-4">
                <Label>Visitas Especiais</Label>
                {form.visitasEspeciais.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <NameAutocomplete
                      value={v}
                      onChange={(val) => setVisita(i, val)}
                      placeholder="Nome do visitante especial (opcional)"
                    />
                    {form.visitasEspeciais.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-500 hover:text-red-700"
                        onClick={() => removeVisita(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* STEP 3 — Dízimos */}
          {step === 3 && (
            <>
              <p className="text-sm text-gray-500">
                Preencha os membros que entregaram dízimo neste culto.
                Campos em branco serão ignorados.
              </p>
              <div className="flex flex-col gap-3">
                {form.tithers.map((t, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <span className="text-sm text-gray-400 w-5 shrink-0 pb-2">{i + 1}</span>
                    <div className="flex-1 flex flex-col gap-1">
                      <Label className={i === 0 ? "" : "sr-only"}>Nome</Label>
                      <NameAutocomplete
                        value={t.personName}
                        onChange={(v) => setTither(i, "personName", v)}
                        placeholder="Nome do membro"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className={i === 0 ? "" : "sr-only"}>Forma</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={t.paymentMethod === "DINHEIRO" ? "default" : "outline"}
                          onClick={() => setTither(i, "paymentMethod", "DINHEIRO")}
                        >
                          Dinheiro
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={t.paymentMethod === "PIX" ? "default" : "outline"}
                          onClick={() => setTither(i, "paymentMethod", "PIX")}
                        >
                          Pix
                        </Button>
                      </div>
                    </div>
                    <div className="w-32 flex flex-col gap-1">
                      <Label className={i === 0 ? "" : "sr-only"}>Valor</Label>
                      <CurrencyInput
                        value={t.value}
                        onChange={(v) => setTither(i, "value", v)}
                      />
                    </div>
                    {form.tithers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-400 hover:text-red-600 pb-0"
                        onClick={() => removeTither(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setForm((prev) =>
                    prev
                      ? { ...prev, tithers: [...prev.tithers, emptyTither(prev.tithers.length + 1)] }
                      : prev
                  )
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar membro
              </Button>

              <div className="flex justify-between items-center border-t pt-3">
                <span className="font-semibold text-sm">Total Dízimos</span>
                <span className="font-bold text-blue-700">{fmtCurrency(totalDizimos)}</span>
              </div>

              {/* Diáconos em serviço */}
              <div className="flex flex-col gap-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label>Diáconos em Serviço *</Label>
                  {diaconosPresentes.length > 0 && (
                    <span className="text-xs text-gray-500">{diaconosPresentes.length} selecionado(s)</span>
                  )}
                </div>
                {availableDeacons.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    Nenhum diácono cadastrado.{" "}
                    <a href="/pessoas" className="underline text-blue-600">Cadastre em Pessoas.</a>
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableDeacons.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={diaconosPresentes.includes(name)}
                          onCheckedChange={() => toggleDiaconoPresente(name)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Responsáveis (sub-select, max 2, only from presentes) */}
              {diaconosPresentes.length > 0 && (
                <div className="flex flex-col gap-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <Label>Responsáveis pelo Serviço * <span className="font-normal text-gray-400">(máx. 3)</span></Label>
                    {form.diaconosResponsaveis.length >= 3 && (
                      <span className="text-xs text-amber-600">Limite atingido</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {diaconosPresentes.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={form.diaconosResponsaveis.includes(name)}
                          onCheckedChange={() => toggleDeacon(name)}
                          disabled={!form.diaconosResponsaveis.includes(name) && form.diaconosResponsaveis.length >= 3}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Responsável pelo Relatório */}
              {form.diaconosResponsaveis.length > 0 && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  <Label>Responsável pelo Relatório</Label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500">
                      <input
                        type="radio"
                        name="responsavelPeloRelatorio"
                        value=""
                        checked={form.responsavelPeloRelatorio === ""}
                        onChange={() => set("responsavelPeloRelatorio", "")}
                      />
                      Nenhum
                    </label>
                    {form.diaconosResponsaveis.map((name) => (
                      <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="responsavelPeloRelatorio"
                          value={name}
                          checked={form.responsavelPeloRelatorio === name}
                          onChange={() => set("responsavelPeloRelatorio", name)}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 4 — Ofertas */}
          {step === 4 && (
            <>
              {[
                { key: "totalOfertasGerais", label: "Ofertas Gerais" },
                { key: "totalOfertasEspeciais", label: "Ofertas Especiais" },
                { key: "outrasEntradas", label: "Outras Entradas" },
                { key: "totalOfertasMissoes", label: "Oferta de Missões (3º Domingo)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <Label htmlFor={key}>{label}</Label>
                  <CurrencyInput
                    id={key}
                    value={form[key as keyof FormData] as number}
                    onChange={(v) => set(key as keyof FormData, v as never)}
                  />
                </div>
              ))}
              <div className="flex justify-between items-center border-t pt-3">
                <span className="font-semibold text-sm">Total Arrecadação</span>
                <span className="font-bold text-blue-700">{fmtCurrency(arrecadacaoTotal)}</span>
              </div>
              <p className="text-xs text-gray-400">
                * O total de arrecadação não inclui a oferta de missões.
              </p>
            </>
          )}

          {/* STEP 5 — Confirmação */}
          {step === 5 && (
            <div className="flex flex-col gap-3 text-sm">
              <Section label="Culto">
                <Row label="Data" value={new Date(form.dataCulto + "T12:00:00").toLocaleDateString("pt-BR")} />
                <Row label="Dia" value={form.diaDaSemana} />
                <Row label="Horário" value={form.horario} />
                <Row label="Pregador" value={form.pregador} />
              </Section>

              <Section label="Estatísticas">
                <Row label="Total de presentes" value={form.totalPresentes} />
                <Row label="Conversões" value={form.conversoes} />
                <Row label="Batizados no Esp. Santo" value={form.batizadosEspirito} />
                <Row label="Visitantes" value={form.visitantes} />
                <Row label="Diáconos em serviço" value={diaconosPresentes.length} />
                <Row label="Testemunhos de cura" value={form.testemunhoCura} />
                <Row label="Crianças apresentadas" value={form.criancasApresentadas} />
              </Section>

              <Section label="Pastores e Visitantes">
                {(() => {
                  const all = [...form.pastoresCheckbox, ...form.pastoresExtras.filter(Boolean)];
                  return all.map((p, i) => (
                    <Row key={i} label={i === 0 ? "Pastor(es)" : ""} value={p} />
                  ));
                })()}
                {form.visitasEspeciais.filter(Boolean).map((v, i) => (
                  <Row key={i} label={i === 0 ? "Visita(s) especial(is)" : ""} value={v} />
                ))}
              </Section>

              <Section label="Dízimos">
                {filledTithers.map((t, i) => (
                  <Row
                    key={i}
                    label={`${i + 1}. ${t.personName}${t.paymentMethod === "PIX" ? " (Pix)" : " (Dinheiro)"}`}
                    value={fmtCurrency(t.value)}
                  />
                ))}
                <Row label="Total dízimos" value={fmtCurrency(totalDizimos)} bold />
                <Row label="Diácono(s) responsável(is)" value={form.diaconosResponsaveis.join(", ")} />
                {form.responsavelPeloRelatorio && (
                  <Row label="Responsável pelo relatório" value={form.responsavelPeloRelatorio} />
                )}
              </Section>

              <Section label="Ofertas">
                <Row label="Ofertas gerais" value={fmtCurrency(form.totalOfertasGerais)} />
                <Row label="Ofertas especiais" value={fmtCurrency(form.totalOfertasEspeciais)} />
                <Row label="Outras entradas" value={fmtCurrency(form.outrasEntradas)} />
                {form.totalOfertasMissoes > 0 && (
                  <Row label="Oferta de missões" value={fmtCurrency(form.totalOfertasMissoes)} />
                )}
                <Row label="Total arrecadação" value={fmtCurrency(arrecadacaoTotal)} bold />
              </Section>

              <Button className="w-full mt-2" onClick={save} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {step < 5 && (
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={back}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          )}
          <Button className="flex-1" onClick={next}>
            {step < 4 ? (
              <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>
            ) : (
              "Revisar"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex justify-between px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold text-blue-700" : "font-medium"}>{value}</span>
    </div>
  );
}
