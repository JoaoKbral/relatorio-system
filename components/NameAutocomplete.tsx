"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  onBlur?: () => void;
}

export default function NameAutocomplete({
  value,
  onChange,
  placeholder = "Digite um nome...",
  role,
  id,
  disabled,
  onBlur,
}: Props) {
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  function updatePos() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
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

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full"
        onBlur={() => {
          if (justSelectedRef.current) return;
          setOpen(false);
          onBlur?.();
        }}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
      {open && suggestions.length > 0 && typeof window !== "undefined" &&
        createPortal(
          <ul
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="rounded-md border bg-white shadow-lg max-h-48 overflow-auto"
          >
            {suggestions.map((p) => (
              <li
                key={p.id}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                onMouseDown={() => {
                  justSelectedRef.current = true;
                  onChange(p.name);
                  setOpen(false);
                }}
              >
                {p.name}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
