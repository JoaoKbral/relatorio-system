"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, FileSpreadsheet, Search } from "lucide-react";
import { toast } from "sonner";

type Tipo = "detalhado" | "detalhado_por_dia" | "comparativo";
type SubMode = "por_data" | "por_pessoa";

interface TitheData {
  personName: string;
  totalValue: string;
  titheCount: number;
}

interface TitheEntry {
  personName: string;
  date: string;
  value: string;
}

interface ComparativoRow {
  personName: string;
  values: string[];
  total: string;
}

interface ComparativoData {
  months: number[];
  rows: ComparativoRow[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatBRL = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

const formatNum = (value: string | number) => {
  const n = Number(value);
  if (n === 0) return "0";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DizimistasPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const [tipo, setTipo] = useState<Tipo>("detalhado");
  const [subMode, setSubMode] = useState<SubMode>("por_data");

  // Detalhado / Detalhado por Dia
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<TitheData[]>([]);
  const [dayData, setDayData] = useState<TitheEntry[]>([]);

  // Comparativo
  const [compYear, setCompYear] = useState(String(currentYear));
  const [monthStart, setMonthStart] = useState("1");
  const [monthEnd, setMonthEnd] = useState(String(now.getMonth() + 1));
  const [compData, setCompData] = useState<ComparativoData | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSearch("");
    setLoading(true);
    setData([]);
    setDayData([]);
    setCompData(null);

    if (tipo === "detalhado") {
      fetch(`/api/dizimistas/relatorio?month=${month}&year=${year}`)
        .then((r) => r.json())
        .then((d) => setData(Array.isArray(d) ? d : []))
        .catch(() => toast.error("Erro ao carregar dados."))
        .finally(() => setLoading(false));
    } else if (tipo === "detalhado_por_dia") {
      fetch(`/api/dizimistas/relatorio?month=${month}&year=${year}&tipo=detalhado_por_dia`)
        .then((r) => r.json())
        .then((d) => setDayData(Array.isArray(d) ? d : []))
        .catch(() => toast.error("Erro ao carregar dados."))
        .finally(() => setLoading(false));
    } else {
      if (Number(monthStart) > Number(monthEnd)) {
        setLoading(false);
        return;
      }
      fetch(
        `/api/dizimistas/relatorio-comparativo?year=${compYear}&monthStart=${monthStart}&monthEnd=${monthEnd}`
      )
        .then((r) => r.json())
        .then((d) => setCompData(d?.rows ? d : null))
        .catch(() => toast.error("Erro ao carregar dados."))
        .finally(() => setLoading(false));
    }
  }, [tipo, month, year, compYear, monthStart, monthEnd]);

  function handleMonthStartChange(v: string | null) {
    if (!v) return;
    setMonthStart(v);
    if (Number(v) > Number(monthEnd)) setMonthEnd(v);
  }

  const monthName = MONTHS[Number(month) - 1];

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();

  const filteredData = useMemo(
    () => search ? data.filter((d) => normalize(d.personName).includes(normalize(search))) : data,
    [data, search]
  );

  const filteredDayData = useMemo(
    () => search ? dayData.filter((r) => normalize(r.personName).includes(normalize(search))) : dayData,
    [dayData, search]
  );

  const filteredCompRows = useMemo(
    () => compData
      ? search
        ? compData.rows.filter((r) => normalize(r.personName).includes(normalize(search)))
        : compData.rows
      : [],
    [compData, search]
  );

  // Derived groupings from flat dayData
  const byDate = useMemo(() => {
    const map = new Map<string, { date: string; tithers: { personName: string; value: string }[] }>();
    for (const r of filteredDayData) {
      if (!map.has(r.date)) map.set(r.date, { date: r.date, tithers: [] });
      map.get(r.date)!.tithers.push({ personName: r.personName, value: r.value });
    }
    return Array.from(map.values());
  }, [filteredDayData]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { personName: string; entries: { date: string; value: string }[] }>();
    for (const r of filteredDayData) {
      const key = r.personName.toUpperCase();
      if (!map.has(key)) map.set(key, { personName: r.personName, entries: [] });
      map.get(key)!.entries.push({ date: r.date, value: r.value });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.personName.localeCompare(b.personName, "pt-BR")
    );
  }, [filteredDayData]);

  const grandTotal = useMemo(
    () => filteredDayData.reduce((s, r) => s + Number(r.value), 0),
    [filteredDayData]
  );

  async function exportDetalhadoPDF() {
    if (filteredData.length === 0) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Dizimistas", 14, 16);
      doc.setFontSize(11);
      doc.text(`${monthName} / ${year}`, 14, 24);
      doc.text(`Total: ${filteredData.length} dizimista(s)`, 14, 31);
      const total = filteredData.reduce((s, d) => s + Number(d.totalValue), 0);
      autoTable(doc, {
        head: [["#", "Nome", "Valor Total"]],
        body: [
          ...filteredData.map((d, i) => [i + 1, d.personName, formatBRL(d.totalValue)]),
          ["", "TOTAL", formatBRL(total)],
        ],
        startY: 37,
      });
      doc.save(`dizimistas-${monthName}-${year}.pdf`);
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function exportDetalhadoXLSX() {
    if (filteredData.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const total = filteredData.reduce((s, d) => s + Number(d.totalValue), 0);
      const rows: (string | number)[][] = [
        ["#", "Nome", "Valor Total (R$)"],
        ...filteredData.map((d, i) => [i + 1, d.personName, Number(d.totalValue)]),
        ["", "TOTAL", total],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dizimistas");
      XLSX.writeFile(wb, `dizimistas-${monthName}-${year}.xlsx`);
    } catch {
      toast.error("Erro ao exportar planilha.");
    } finally {
      setExporting(false);
    }
  }

  async function exportDiaPDF() {
    if (dayData.length === 0) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF();
      doc.setFontSize(16);
      const title =
        subMode === "por_data"
          ? "Relatório de Dizimistas — Por Data"
          : "Relatório de Dizimistas — Por Pessoa";
      doc.text(title, 14, 16);
      doc.setFontSize(11);
      doc.text(`${monthName} / ${year}`, 14, 24);

      type DocWithTable = { lastAutoTable: { finalY: number } };
      let cursor = 30;

      if (subMode === "por_data") {
        for (const group of byDate) {
          const subtotal = group.tithers.reduce((s, t) => s + Number(t.value), 0);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(formatDate(group.date), 14, cursor + 6);
          doc.setFont("helvetica", "normal");
          autoTable(doc, {
            head: [["#", "Nome", "Valor"]],
            body: [
              ...group.tithers.map((t, i) => [i + 1, t.personName, formatBRL(t.value)]),
              ["", "Subtotal", formatBRL(subtotal)],
            ],
            startY: cursor + 8,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235] },
          });
          cursor = (doc as unknown as DocWithTable).lastAutoTable.finalY + 6;
          if (cursor > 260) { doc.addPage(); cursor = 10; }
        }
      } else {
        for (const group of byPerson) {
          const subtotal = group.entries.reduce((s, e) => s + Number(e.value), 0);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(group.personName, 14, cursor + 6);
          doc.setFont("helvetica", "normal");
          autoTable(doc, {
            head: [["Data", "Valor"]],
            body: [
              ...group.entries.map((e) => [formatDate(e.date), formatBRL(e.value)]),
              ["Subtotal", formatBRL(subtotal)],
            ],
            startY: cursor + 8,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [37, 99, 235] },
          });
          cursor = (doc as unknown as DocWithTable).lastAutoTable.finalY + 6;
          if (cursor > 260) { doc.addPage(); cursor = 10; }
        }
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Total geral: ${formatBRL(grandTotal)}`, 14, cursor + 6);
      doc.save(`dizimistas-por-dia-${monthName}-${year}.pdf`);
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function exportDiaXLSX() {
    if (dayData.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows: (string | number)[][] = [];

      if (subMode === "por_data") {
        rows.push(["Data", "#", "Nome", "Valor (R$)"]);
        for (const group of byDate) {
          const subtotal = group.tithers.reduce((s, t) => s + Number(t.value), 0);
          group.tithers.forEach((t, i) => {
            rows.push([i === 0 ? formatDate(group.date) : "", i + 1, t.personName, Number(t.value)]);
          });
          rows.push(["", "", "Subtotal", subtotal]);
        }
      } else {
        rows.push(["Nome", "Data", "Valor (R$)"]);
        for (const group of byPerson) {
          const subtotal = group.entries.reduce((s, e) => s + Number(e.value), 0);
          group.entries.forEach((e, i) => {
            rows.push([i === 0 ? group.personName : "", formatDate(e.date), Number(e.value)]);
          });
          rows.push(["", "Subtotal", subtotal]);
        }
      }

      rows.push(["", "", "TOTAL GERAL", grandTotal]);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dizimistas");
      XLSX.writeFile(wb, `dizimistas-por-dia-${monthName}-${year}.xlsx`);
    } catch {
      toast.error("Erro ao exportar planilha.");
    } finally {
      setExporting(false);
    }
  }

  async function exportCompPDF() {
    if (!compData || compData.rows.length === 0) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Relatório Comparativo de Dizimistas", 14, 16);
      doc.setFontSize(10);
      doc.text(
        `${compYear} — ${MONTHS[Number(monthStart) - 1]} a ${MONTHS[Number(monthEnd) - 1]}`,
        14,
        24
      );
      const monthCols = compData.months.map((m) => MONTHS_SHORT[m - 1]);
      autoTable(doc, {
        head: [["#", "Nome", ...monthCols, "Total"]],
        body: compData.rows.map((row, i) => [
          i + 1,
          row.personName,
          ...row.values.map(formatNum),
          formatNum(row.total),
        ]),
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
        columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 52 } },
      });
      doc.save(`dizimistas-comparativo-${compYear}.pdf`);
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function exportCompXLSX() {
    if (!compData || compData.rows.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const monthCols = compData.months.map((m) => MONTHS_SHORT[m - 1]);
      const rows: (string | number)[][] = [
        ["#", "Nome", ...monthCols, "Total"],
        ...compData.rows.map((row, i) => [
          i + 1,
          row.personName,
          ...row.values.map(Number),
          Number(row.total),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dizimistas");
      XLSX.writeFile(wb, `dizimistas-comparativo-${compYear}.xlsx`);
    } catch {
      toast.error("Erro ao exportar planilha.");
    } finally {
      setExporting(false);
    }
  }

  const TIPO_LABELS: Record<Tipo, string> = {
    detalhado: "Detalhado",
    detalhado_por_dia: "Detalhado por Dia",
    comparativo: "Comparativo",
  };

  const TIPO_HINTS: Record<Tipo, string> = {
    detalhado: "Valor total dizimado por pessoa no mês.",
    detalhado_por_dia: "Valor dizimado por pessoa em cada culto do mês.",
    comparativo: "Valores por pessoa em vários meses lado a lado.",
  };

  const tipoList: Tipo[] = ["detalhado", "detalhado_por_dia", "comparativo"];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Relatório de Dizimistas</h1>

      {/* Type toggle */}
      <div className="flex flex-col gap-1">
        <Label>Tipo de relatório</Label>
        <div className="flex rounded-lg border overflow-hidden">
          {tipoList.map((t, idx) => (
            <button
              key={t}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${idx > 0 ? "border-l" : ""} ${
                tipo === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => setTipo(t)}
            >
              {TIPO_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">{TIPO_HINTS[tipo]}</p>
      </div>

      {/* Filters */}
      {tipo !== "comparativo" ? (
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <Label>Mês</Label>
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <Label>Ano</Label>
            <Select value={year} onValueChange={(v) => v && setYear(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[90px] flex flex-col gap-1">
            <Label>Ano</Label>
            <Select value={compYear} onValueChange={(v) => v && setCompYear(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[100px] flex flex-col gap-1">
            <Label>De</Label>
            <Select value={monthStart} onValueChange={handleMonthStartChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[100px] flex flex-col gap-1">
            <Label>Até</Label>
            <Select value={monthEnd} onValueChange={(v) => v && setMonthEnd(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} disabled={i + 1 < Number(monthStart)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Search */}
      {tipo !== "comparativo" || compData ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Carregando...</p>
      ) : tipo === "detalhado" ? (
        filteredData.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            {data.length === 0
              ? `Nenhum dizimista encontrado em ${monthName}/${year}.`
              : "Nenhum resultado para a busca."}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filteredData.length} dizimista(s) — {monthName}/{year}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportDetalhadoPDF}>
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportDetalhadoXLSX}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  XLSX
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{d.personName}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">
                        {formatBRL(d.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-800">
                      {formatBRL(filteredData.reduce((s, d) => s + Number(d.totalValue), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      ) : tipo === "detalhado_por_dia" ? (
        filteredDayData.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            {dayData.length === 0
              ? `Nenhum dizimista encontrado em ${monthName}/${year}.`
              : "Nenhum resultado para a busca."}
          </p>
        ) : (
          <>
            {/* Sub-mode toggle */}
            <div className="flex rounded-lg border overflow-hidden self-start">
              {(["por_data", "por_pessoa"] as SubMode[]).map((m, idx) => (
                <button
                  key={m}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${idx > 0 ? "border-l" : ""} ${
                    subMode === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  onClick={() => setSubMode(m)}
                >
                  {m === "por_data" ? "Por Data" : "Por Pessoa"}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {filteredDayData.length} registro(s) — {monthName}/{year}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportDiaPDF}>
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportDiaXLSX}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  XLSX
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                {subMode === "por_data" ? (
                  <>
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left">Nome</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDate.map((group) => {
                        const subtotal = group.tithers.reduce((s, t) => s + Number(t.value), 0);
                        return (
                          <Fragment key={group.date}>
                            <tr className="bg-blue-50">
                              <td colSpan={3} className="px-3 py-2 font-semibold text-blue-700 text-xs uppercase tracking-wide">
                                {formatDate(group.date)}
                              </td>
                            </tr>
                            {group.tithers.map((t, i) => (
                              <tr key={i} className="hover:bg-gray-50 border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                <td className="px-3 py-2 font-medium">{t.personName}</td>
                                <td className="px-3 py-2 text-right text-green-700 font-medium">
                                  {formatBRL(t.value)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-xs text-gray-500 font-medium">Subtotal</td>
                              <td className="px-3 py-2 text-right text-xs font-semibold text-green-800">
                                {formatBRL(subtotal)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead className="bg-gray-50 text-gray-600 font-medium">
                      <tr>
                        <th className="px-3 py-2 text-left">Data</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byPerson.map((group) => {
                        const subtotal = group.entries.reduce((s, e) => s + Number(e.value), 0);
                        return (
                          <Fragment key={group.personName}>
                            <tr className="bg-blue-50">
                              <td colSpan={2} className="px-3 py-2 font-semibold text-blue-700 text-xs uppercase tracking-wide">
                                {group.personName}
                              </td>
                            </tr>
                            {group.entries.map((e, i) => (
                              <tr key={i} className="hover:bg-gray-50 border-t border-gray-100">
                                <td className="px-3 py-2 text-gray-600">{formatDate(e.date)}</td>
                                <td className="px-3 py-2 text-right text-green-700 font-medium">
                                  {formatBRL(e.value)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td className="px-3 py-2 text-xs text-gray-500 font-medium">Subtotal</td>
                              <td className="px-3 py-2 text-right text-xs font-semibold text-green-800">
                                {formatBRL(subtotal)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </>
                )}
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300">
                    <td className="px-3 py-2 font-semibold text-gray-700" colSpan={subMode === "por_pessoa" ? 1 : 2}>
                      Total Geral
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-800">
                      {formatBRL(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      ) : !compData || compData.rows.length === 0 ? (
        <p className="text-center text-gray-400 py-8">
          Nenhum dado encontrado para o período selecionado.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {filteredCompRows.length} dizimista(s) — {MONTHS[Number(monthStart) - 1]} a{" "}
              {MONTHS[Number(monthEnd) - 1]}/{compYear}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={exporting} onClick={exportCompPDF}>
                <FileDown className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button size="sm" variant="outline" disabled={exporting} onClick={exportCompXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                XLSX
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <table className="text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Nome</th>
                  {compData.months.map((m) => (
                    <th key={m} className="px-3 py-2 text-right">
                      {MONTHS_SHORT[m - 1]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-bold border-l">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCompRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.personName}</td>
                    {row.values.map((v, j) => (
                      <td
                        key={j}
                        className={`px-3 py-2 text-right ${
                          Number(v) === 0 ? "text-gray-300" : "text-gray-800"
                        }`}
                      >
                        {formatNum(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold text-green-700 border-l">
                      {formatNum(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
