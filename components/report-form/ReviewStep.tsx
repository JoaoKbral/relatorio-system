import { allPastors, diaDaSemana, filledTithers, formatBRL, totals, type FormValues } from "./form-values";
import type { PeopleOptions } from "./use-people-options";

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

export function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold text-blue-700 text-right" : "font-medium text-right"}>{value}</span>
    </div>
  );
}

export function ReviewStep({ values, people }: { values: FormValues; people: PeopleOptions }) {
  const { totalDizimos, arrecadacaoTotal } = totals(values);
  const nameOf = (id: number) => people.deacons.find((d) => d.id === id)?.name ?? "—";
  const treasurer = people.treasurers.find((t) => t.id === values.treasurerId)?.name ?? "—";
  const pastors = allPastors(values);
  const visitors = values.visitasEspeciais.map((v) => v.trim()).filter(Boolean);
  const [year, month, day] = values.dataCulto.split("-");

  return (
    <div className="flex flex-col gap-3 text-sm">
      <Section label="Culto">
        <Row label="Data" value={`${day}/${month}/${year}`} />
        <Row label="Dia" value={diaDaSemana(values.dataCulto)} />
        <Row label="Horário" value={values.horario} />
        <Row label="Pregador" value={values.pregador} />
      </Section>

      <Section label="Estatísticas">
        <Row label="Total de presentes" value={values.totalPresentes} />
        <Row label="Conversões" value={values.conversoes} />
        <Row label="Batizados no Esp. Santo" value={values.batizadosEspirito} />
        <Row label="Visitantes" value={values.visitantes} />
        <Row label="Diáconos em serviço" value={values.deaconsInService.length} />
        <Row label="Testemunhos de cura" value={values.testemunhoCura} />
        <Row label="Crianças apresentadas" value={values.criancasApresentadas} />
      </Section>

      <Section label="Pastores e Visitantes">
        {pastors.length === 0 && <Row label="Pastor(es)" value="Nenhum" />}
        {pastors.map((p, i) => (
          <Row key={`p${i}`} label={i === 0 ? "Pastor(es)" : ""} value={p} />
        ))}
        {visitors.map((v, i) => (
          <Row key={`v${i}`} label={i === 0 ? "Visita(s) especial(is)" : ""} value={v} />
        ))}
      </Section>

      <Section label="Dízimos">
        {filledTithers(values).map((t, i) => (
          <Row
            key={t.key}
            label={`${i + 1}. ${t.personName} (${t.paymentMethod === "PIX" ? "Pix" : "Dinheiro"})`}
            value={formatBRL(t.value)}
          />
        ))}
        <Row label="Total dízimos" value={formatBRL(totalDizimos)} bold />
        <Row label="Diácono(s) responsável(is)" value={values.responsibleDeacons.map(nameOf).join(", ")} />
        <Row label="Tesoureiro" value={treasurer} />
      </Section>

      <Section label="Ofertas">
        <Row label="Ofertas gerais" value={formatBRL(values.totalOfertasGerais)} />
        <Row label="Ofertas especiais" value={formatBRL(values.totalOfertasEspeciais)} />
        {values.totalOfertasMissoes > 0 && (
          <Row label="Oferta de missões" value={formatBRL(values.totalOfertasMissoes)} />
        )}
        <Row label="Total arrecadação" value={formatBRL(arrecadacaoTotal)} bold />
      </Section>
    </div>
  );
}
