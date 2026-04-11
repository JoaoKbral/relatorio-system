"use client";

import { useState, useEffect } from "react";
import ReportCard from "@/components/ReportCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface Report {
  id: number;
  dataCulto: string;
  diaDaSemana: string;
  pregador: string;
  totalPresentes: number;
  horario: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function RelatoriosPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("todos");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    const params = new URLSearchParams({ year });
    if (month !== "todos") params.set("month", month);
    fetch(`/api/relatorios?${params}`)
      .then((r) => r.json())
      .then((data) => setReports(data))
      .finally(() => setLoading(false));
  }, [year, month]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/relatorios/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao excluir relatório."); return; }
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("Relatório excluído.");
    } catch {
      toast.error("Erro ao excluir relatório.");
    }
  }

  async function downloadZip(ids: number[]) {
    if (ids.length === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/relatorios/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) { toast.error("Erro ao gerar ZIP."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "REFC-relatorios.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao gerar ZIP.");
    } finally {
      setDownloading(false);
    }
  }

  const allSelected = reports.length > 0 && selectedIds.size === reports.length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Histórico de Relatórios</h1>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1">
          <Label>Ano</Label>
          <Select value={year} onValueChange={(v) => v && setYear(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <Label>Mês</Label>
          <Select value={month} onValueChange={(v) => v && setMonth(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Carregando...</p>
      ) : reports.length === 0 ? (
        <p className="text-center text-gray-400 py-8">
          Nenhum relatório encontrado para este período.
        </p>
      ) : (
        <>
          {/* Bulk actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 accent-blue-600"
              />
              {allSelected ? "Desmarcar todos" : "Selecionar todos"}
            </label>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0 || downloading}
                onClick={() => downloadZip([...selectedIds])}
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar selecionados ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={downloading}
                onClick={() => downloadZip(reports.map((r) => r.id))}
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar todos ({reports.length})
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <ReportCard
                key={r.id}
                id={r.id}
                dataCulto={r.dataCulto}
                diaDaSemana={r.diaDaSemana}
                pregador={r.pregador}
                totalPresentes={r.totalPresentes}
                horario={r.horario}
                selected={selectedIds.has(r.id)}
                onToggle={() => toggleSelect(r.id)}
                onDelete={() => handleDelete(r.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
