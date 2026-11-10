"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencyInput from "@/components/CurrencyInput";
import NameAutocomplete from "@/components/NameAutocomplete";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_RESPONSIBLE_DEACONS } from "@/lib/report-schema";
import {
  OFFER_FIELDS,
  STAT_FIELDS,
  diaDaSemana,
  emptyTither,
  formatBRL,
  totals,
  type FormValues,
  type PaymentMethod,
  type PersonOption,
  type TitherRow,
} from "./form-values";
import type { PeopleOptions } from "./use-people-options";
import type { UpdateValues } from "./ReportForm";

interface StepProps {
  values: FormValues;
  update: UpdateValues;
  people: PeopleOptions;
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

// ─── Shared pieces ───────────────────────────────────────────────────────────

function CheckList({
  options,
  checked,
  onToggle,
  isDisabled,
}: {
  options: PersonOption[];
  checked: number[];
  onToggle: (id: number) => void;
  isDisabled?: (id: number) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((p) => (
        <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
          <Checkbox
            checked={checked.includes(p.id)}
            onCheckedChange={() => onToggle(p.id)}
            disabled={isDisabled?.(p.id)}
          />
          {p.name}
        </label>
      ))}
    </div>
  );
}

function NoPeopleHint({ role }: { role: string }) {
  return (
    <p className="text-sm text-gray-400">
      Nenhum {role} cadastrado.{" "}
      <Link href="/pessoas" className="underline text-blue-600">
        Cadastre em Pessoas.
      </Link>
    </p>
  );
}

/** Name inputs that always keep one empty slot at the end. */
function AutoGrowNames({
  names,
  onChange,
  placeholder,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  placeholder: string;
}) {
  function set(i: number, v: string) {
    const next = [...names];
    next[i] = v;
    if (v.trim() && i === next.length - 1) next.push("");
    onChange(next);
  }
  function remove(i: number) {
    const next = names.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [""]);
  }
  return (
    <div className="flex flex-col gap-2">
      {names.map((v, i) => (
        // Index keys are fine here: rows are only appended or removed together with their value.
        <div key={i} className="flex gap-2 items-center">
          <NameAutocomplete value={v} onChange={(val) => set(i, val)} placeholder={placeholder} />
          {names.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover"
              className="shrink-0 text-red-500 hover:text-red-700"
              onClick={() => remove(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

export function CultoStep({ values, update }: StepProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="dataCulto">Data do Culto *</Label>
          <Input
            id="dataCulto"
            type="date"
            value={values.dataCulto}
            onChange={(e) => update({ dataCulto: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="diaDaSemana">Dia da Semana</Label>
          <Input id="diaDaSemana" value={diaDaSemana(values.dataCulto)} readOnly className="bg-gray-50" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="horario">Horário *</Label>
        <Input
          id="horario"
          type="time"
          value={values.horario}
          onChange={(e) => update({ horario: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="pregador">Pregador *</Label>
        <NameAutocomplete
          id="pregador"
          value={values.pregador}
          onChange={(v) => update({ pregador: v })}
          placeholder="Nome do pregador"
        />
      </div>
    </>
  );
}

export function StatsStep({ values, update }: StepProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {STAT_FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            type="number"
            inputMode="numeric"
            min="0"
            value={values[key] || ""}
            onChange={(e) => update({ [key]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
            placeholder="0"
          />
        </div>
      ))}
    </div>
  );
}

export function PastorsStep({ values, update, people }: StepProps) {
  const pastorNames = people.pastors.map((p) => p.name);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>
          Pastores Presentes <span className="font-normal text-gray-400">(opcional)</span>
        </Label>
        {pastorNames.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {pastorNames.map((name) => (
              <label key={name} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={values.pastoresCheckbox.includes(name)}
                  onCheckedChange={() =>
                    update((prev) => ({ ...prev, pastoresCheckbox: toggle(prev.pastoresCheckbox, name) }))
                  }
                />
                {name}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">Adicionar pastor não listado:</p>
        <AutoGrowNames
          names={values.pastoresExtras}
          onChange={(pastoresExtras) => update({ pastoresExtras })}
          placeholder="Nome do pastor"
        />
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <Label>
          Visitas Especiais <span className="font-normal text-gray-400">(opcional)</span>
        </Label>
        <AutoGrowNames
          names={values.visitasEspeciais}
          onChange={(visitasEspeciais) => update({ visitasEspeciais })}
          placeholder="Nome do visitante especial"
        />
      </div>
    </>
  );
}

function registerTitherName(name: string) {
  // Best effort: makes the name available in suggestions right away.
  // The server also creates missing people when the report is saved.
  if (!name.trim()) return;
  fetch("/api/pessoas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), roles: ["membro"] }),
  }).catch(() => {});
}

export function TithesStep({ values, update, people }: StepProps) {
  const { totalDizimos } = totals(values);

  function setTither(key: number, change: Partial<TitherRow>) {
    update((prev) => {
      const tithers = prev.tithers.map((t) => (t.key === key ? { ...t, ...change } : t));
      const last = tithers[tithers.length - 1];
      // A new empty row appears once the last row has a name and a value.
      if (last.personName.trim() && last.value > 0) tithers.push(emptyTither(last.paymentMethod));
      return { ...prev, tithers };
    });
  }

  function removeTither(key: number) {
    update((prev) => {
      const tithers = prev.tithers.filter((t) => t.key !== key);
      return { ...prev, tithers: tithers.length ? tithers : [emptyTither()] };
    });
  }

  function toggleInService(id: number) {
    update((prev) => {
      const deaconsInService = toggle(prev.deaconsInService, id);
      return {
        ...prev,
        deaconsInService,
        // A deacon who is no longer in service cannot stay responsible.
        responsibleDeacons: prev.responsibleDeacons.filter((d) => deaconsInService.includes(d)),
      };
    });
  }

  function toggleResponsible(id: number) {
    update((prev) => {
      const already = prev.responsibleDeacons.includes(id);
      if (!already && prev.responsibleDeacons.length >= MAX_RESPONSIBLE_DEACONS) return prev;
      return { ...prev, responsibleDeacons: toggle(prev.responsibleDeacons, id) };
    });
  }

  const inService = people.deacons.filter((d) => values.deaconsInService.includes(d.id));
  const responsibleFull = values.responsibleDeacons.length >= MAX_RESPONSIBLE_DEACONS;

  return (
    <>
      <p className="text-sm text-gray-500">
        Preencha os membros que entregaram dízimo neste culto. Linhas sem nome são ignoradas. Uma nova
        linha é adicionada automaticamente ao preencher a última.
      </p>
      <div className="flex flex-col gap-3">
        {values.tithers.map((t, i) => (
          <div key={t.key} className="flex gap-2 items-end">
            <span className="text-sm text-gray-400 w-5 shrink-0 pb-2">{i + 1}</span>
            <div className="flex-1 flex flex-col gap-1">
              <Label className={i === 0 ? "" : "sr-only"}>Nome</Label>
              <NameAutocomplete
                value={t.personName}
                onChange={(v) => setTither(t.key, { personName: v })}
                placeholder="Nome do membro"
                onBlur={() => registerTitherName(t.personName)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className={i === 0 ? "" : "sr-only"}>Forma</Label>
              <div className="flex gap-1">
                {(["DINHEIRO", "PIX"] as PaymentMethod[]).map((method) => (
                  <Button
                    key={method}
                    type="button"
                    size="sm"
                    variant={t.paymentMethod === method ? "default" : "outline"}
                    onClick={() => setTither(t.key, { paymentMethod: method })}
                  >
                    {method === "PIX" ? "Pix" : "Dinheiro"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-32 flex flex-col gap-1">
              <Label className={i === 0 ? "" : "sr-only"}>Valor</Label>
              <CurrencyInput value={t.value} onChange={(v) => setTither(t.key, { value: v })} />
            </div>
            {values.tithers.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover dizimista"
                className="shrink-0 text-red-400 hover:text-red-600"
                onClick={() => removeTither(t.key)}
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
        onClick={() => update((prev) => ({ ...prev, tithers: [...prev.tithers, emptyTither()] }))}
      >
        <Plus className="w-4 h-4 mr-1" />
        Adicionar membro
      </Button>

      <div className="flex justify-between items-center border-t pt-3">
        <span className="font-semibold text-sm">Total Dízimos</span>
        <span className="font-bold text-blue-700">{formatBRL(totalDizimos)}</span>
      </div>

      {/* Deacons in service */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <Label>Diáconos em Serviço *</Label>
          {values.deaconsInService.length > 0 && (
            <span className="text-xs text-gray-500">{values.deaconsInService.length} selecionado(s)</span>
          )}
        </div>
        {people.deacons.length === 0 ? (
          <NoPeopleHint role="diácono" />
        ) : (
          <CheckList options={people.deacons} checked={values.deaconsInService} onToggle={toggleInService} />
        )}
      </div>

      {/* Responsible deacons: chosen among those in service */}
      {inService.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label>
              Responsáveis pelo Serviço *{" "}
              <span className="font-normal text-gray-400">(máx. {MAX_RESPONSIBLE_DEACONS})</span>
            </Label>
            {responsibleFull && <span className="text-xs text-amber-600">Limite atingido</span>}
          </div>
          <CheckList
            options={inService}
            checked={values.responsibleDeacons}
            onToggle={toggleResponsible}
            isDisabled={(id) => responsibleFull && !values.responsibleDeacons.includes(id)}
          />
        </div>
      )}

      {/* Treasurer */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <Label>Tesoureiro (responsável pelo relatório) *</Label>
        {people.treasurers.length === 0 ? (
          <NoPeopleHint role="tesoureiro" />
        ) : (
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {people.treasurers.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex items-center gap-2 cursor-pointer text-sm rounded-md border px-3 py-2",
                  values.treasurerId === p.id && "border-blue-600 bg-blue-50"
                )}
              >
                <input
                  type="radio"
                  name="treasurer"
                  className="accent-blue-600"
                  checked={values.treasurerId === p.id}
                  onChange={() => update({ treasurerId: p.id })}
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function OffersStep({ values, update }: StepProps) {
  const { arrecadacaoTotal } = totals(values);
  return (
    <>
      {OFFER_FIELDS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1">
          <Label htmlFor={key}>{label}</Label>
          <CurrencyInput id={key} value={values[key]} onChange={(v) => update({ [key]: v })} />
        </div>
      ))}
      <div className="flex justify-between items-center border-t pt-3">
        <span className="font-semibold text-sm">Total Arrecadação</span>
        <span className="font-bold text-blue-700">{formatBRL(arrecadacaoTotal)}</span>
      </div>
      <p className="text-xs text-gray-400">* O total de arrecadação não inclui a oferta de missões.</p>
    </>
  );
}
