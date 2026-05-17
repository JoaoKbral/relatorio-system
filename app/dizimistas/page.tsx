"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Tipo = "simples" | "detalhado" | "comparativo";

interface TitheData {
  personName: string;
  totalValue: string;
  titheCount: number;
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

export default function DizimistasPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const [tipo, setTipo] = useState<Tipo>("simples");

  // Simples / Detalhado
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<TitheData[]>([]);

  // Comparativo
  const [compYear, setCompYear] = useState(String(currentYear));
  const [monthStart, setMonthStart] = useState("1");
  const [monthEnd, setMonthEnd] = useState(String(now.getMonth() + 1));
  const [compData, setCompData] = useState<ComparativoData | null>(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData([]);
    setCompData(null);

    if (tipo !== "comparativo") {
      fetch(`/api/dizimistas/relatorio?month=${month}&year=${year}`)
        .then((r) => r.json())
        .then((d) => setData(Array.isArray(d) ? d : []))
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

  async function exportSimpleDetPDF() {
    if (data.length === 0) return;
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
      doc.text(`Total: ${data.length} dizimista(s)`, 14, 31);

      if (tipo === "simples") {
        autoTable(doc, {
          head: [["#", "Nome"]],
          body: data.map((d, i) => [i + 1, d.personName]),
          startY: 37,
        });
      } else {
        const total = data.reduce((s, d) => s + Number(d.totalValue), 0);
        autoTable(doc, {
          head: [["#", "Nome", "Valor Total"]],
          body: [
            ...data.map((d, i) => [i + 1, d.personName, formatBRL(d.totalValue)]),
            ["", "TOTAL", formatBRL(total)],
          ],
          startY: 37,
        });
      }
      doc.save(`dizimistas-${monthName}-${year}.pdf`);
    } catch {
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function exportSimpleDetXLSX() {
    if (data.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      let rows: (string | number)[][];
      if (tipo === "simples") {
        rows = [["#", "Nome"], ...data.map((d, i) => [i + 1, d.personName])];
      } else {
        const total = data.reduce((s, d) => s + Number(d.totalValue), 0);
        rows = [
          ["#", "Nome", "Valor Total (R$)"],
          ...data.map((d, i) => [i + 1, d.personName, Number(d.totalValue)]),
          ["", "TOTAL", total],
        ];
      }
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
    simples: "Simples",
    detalhado: "Detalhado",
    comparativo: "Comparativo",
  };

  const TIPO_HINTS: Record<Tipo, string> = {
    simples: "Lista de quem dizimou no mês selecionado.",
    detalhado: "Valor total dizimado por pessoa no mês.",
    comparativo: "Valores por pessoa em vários meses lado a lado.",
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Relatório de Dizimistas</h1>

      {/* Type toggle */}
      <div className="flex flex-col gap-1">
        <Label>Tipo de relatório</Label>
        <div className="flex rounded-lg border overflow-hidden">
          {(["simples", "detalhado", "comparativo"] as Tipo[]).map((t, idx) => (
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

      {/* Content */}
      {loading ? (
        <p className="text-center text-gray-400 py-8">Carregando...</p>
      ) : tipo !== "comparativo" ? (
        data.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            Nenhum dizimista encontrado em {monthName}/{year}.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {data.length} dizimista(s) — {monthName}/{year}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportSimpleDetPDF}>
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button size="sm" variant="outline" disabled={exporting} onClick={exportSimpleDetXLSX}>
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
                    {tipo === "detalhado" && (
                      <th className="px-3 py-2 text-right">Valor Total</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{d.personName}</td>
                      {tipo === "detalhado" && (
                        <td className="px-3 py-2 text-right text-green-700 font-medium">
                          {formatBRL(d.totalValue)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {tipo === "detalhado" && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-semibold text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-800">
                        {formatBRL(data.reduce((s, d) => s + Number(d.totalValue), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
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
              {compData.rows.length} dizimista(s) — {MONTHS[Number(monthStart) - 1]} a{" "}
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
                {compData.rows.map((row, i) => (
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
