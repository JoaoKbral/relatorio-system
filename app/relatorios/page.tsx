"use client";

import { useState, useEffect } from "react";
import ReportCard from "@/components/ReportCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ year });
    if (month !== "todos") params.set("month", month);
    fetch(`/api/relatorios?${params}`)
      .then((r) => r.json())
      .then((data) => setReports(data))
      .finally(() => setLoading(false));
  }, [year, month]);

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
