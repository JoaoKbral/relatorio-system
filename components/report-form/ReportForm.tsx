"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { MAX_RESPONSIBLE_DEACONS, type ReportInput } from "@/lib/report-schema";
import { toPayload, type FormValues } from "./form-values";
import type { PeopleOptions } from "./use-people-options";
import { CultoStep, OffersStep, PastorsStep, StatsStep, TithesStep } from "./steps";
import { ReviewStep } from "./ReviewStep";

const STEPS = [
  "Dados do Culto",
  "Estatísticas",
  "Pastores e Visitantes",
  "Dízimos",
  "Ofertas",
  "Confirmação",
] as const;
const REVIEW_STEP = STEPS.length - 1;

export type UpdateValues = (change: Partial<FormValues> | ((prev: FormValues) => FormValues)) => void;

/** Returns a pt-BR error for the step, or null when it can be left. */
function validateStep(step: number, v: FormValues): string | null {
  switch (step) {
    case 0:
      if (!v.dataCulto) return "Informe a data do culto.";
      if (!v.horario) return "Informe o horário.";
      if (!v.pregador.trim()) return "Informe o nome do pregador.";
      return null;
    case 3:
      if (v.deaconsInService.length === 0) return "Selecione ao menos um diácono em serviço.";
      if (v.responsibleDeacons.length === 0) return "Selecione ao menos um diácono responsável.";
      if (v.responsibleDeacons.length > MAX_RESPONSIBLE_DEACONS)
        return `Selecione no máximo ${MAX_RESPONSIBLE_DEACONS} diáconos responsáveis.`;
      if (!v.treasurerId) return "Selecione o tesoureiro responsável pelo relatório.";
      return null;
    default:
      return null;
  }
}

interface Props {
  initialValues: FormValues;
  people: PeopleOptions;
  submitLabel: string;
  /** Saves the report. Should throw an Error with a user-facing message on failure. */
  onSubmit: (payload: ReportInput) => Promise<void>;
}

/** The step-by-step report form used to create and to edit a report. */
export default function ReportForm({ initialValues, people, submitLabel, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);

  const update: UpdateValues = (change) =>
    setValues((prev) => (typeof change === "function" ? change(prev) : { ...prev, ...change }));

  function next() {
    const error = validateStep(step, values);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(s + 1, REVIEW_STEP));
  }

  async function submit() {
    // Re-check every step: the user may have gone back and changed something.
    for (let s = 0; s < REVIEW_STEP; s++) {
      const error = validateStep(s, values);
      if (error) {
        toast.error(error);
        setStep(s);
        return;
      }
    }
    setSaving(true);
    try {
      await onSubmit(toPayload(values));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Erro ao salvar o relatório. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const stepProps = { values, update, people };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Passo {step + 1} de {STEPS.length}</span>
          <span>{STEPS[step]}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 && <CultoStep {...stepProps} />}
          {step === 1 && <StatsStep {...stepProps} />}
          {step === 2 && <PastorsStep {...stepProps} />}
          {step === 3 && <TithesStep {...stepProps} />}
          {step === 4 && <OffersStep {...stepProps} />}
          {step === REVIEW_STEP && (
            <>
              <ReviewStep values={values} people={people} />
              <Button className="w-full mt-2" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? "Salvando..." : submitLabel}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={saving}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
        )}
        {step < REVIEW_STEP && (
          <Button className="flex-1" onClick={next}>
            {step < REVIEW_STEP - 1 ? (
              <>
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            ) : (
              "Revisar"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
