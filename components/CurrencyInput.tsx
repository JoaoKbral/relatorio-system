"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0,00",
  id,
  disabled,
}: Props) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, comma, and period
    let v = e.target.value.replace(/[^0-9.,]/g, "");
    // Normalize comma to period for parsing
    const normalized = v.replace(",", ".");
    setRaw(v);
    const num = parseFloat(normalized);
    onChange(isNaN(num) ? 0 : num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9"
      />
    </div>
  );
}
