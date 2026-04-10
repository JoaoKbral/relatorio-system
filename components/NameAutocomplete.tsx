"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface Person {
  id: number;
  name: string;
  roles: string[];
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  role?: string;
  id?: string;
  disabled?: boolean;
}

export default function NameAutocomplete({
  value,
  onChange,
  placeholder = "Digite um nome...",
  role,
  id,
  disabled,
}: Props) {
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `/api/pessoas?q=${encodeURIComponent(value)}${role ? `&role=${role}` : ""}`;
        const res = await fetch(url);
        const data: Person[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [value, role]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-auto">
          {suggestions.map((p) => (
            <li
              key={p.id}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
              onMouseDown={() => {
                onChange(p.name.toUpperCase());
                setOpen(false);
              }}
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
