"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  onBlur?: () => void;
}

const MAX_CENTS = 99_999_999; // R$ 999.999,99

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  id,
  disabled,
  onBlur,
}: Props) {
  const [cents, setCents] = useState(() => Math.round(value * 100));

  useEffect(() => {
    setCents(Math.round(value * 100));
  }, [value]);

  function updateCents(next: number) {
    setCents(next);
    onChange(next / 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      updateCents(Math.min(cents * 10 + Number(e.key), MAX_CENTS));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      updateCents(Math.floor(cents / 10));
    } else if (!["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
    }
  }

  const display = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={onBlur}
        className="pl-9"
      />
    </div>
  );
}
