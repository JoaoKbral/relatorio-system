"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { useOffline } from "@/components/offline/OfflineProvider";
import { searchCachedPeople } from "@/lib/offline/people";

interface Person {
  id: number;
  name: string;
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

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
/** Weak signal: stop waiting for the server and search the device copy instead. */
const SEARCH_TIMEOUT_MS = 4_000;

/**
 * Text input that suggests people's names while the user types.
 * Searches only on user input: values set by code (e.g. loading a report to
 * edit) never open the suggestion list. Offline, it searches the copy of the
 * people list saved on the device.
 */
export default function NameAutocomplete({
  value,
  onChange,
  placeholder = "Digite um nome...",
  role,
  id,
  disabled,
  onBlur,
}: Props) {
  const { churchId } = useOffline();
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  function cancelSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    requestRef.current?.abort();
  }

  // Cancel pending work on unmount.
  useEffect(() => cancelSearch, []);

  // Keep the portaled list under the input while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    function updatePos() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open]);

  function search(query: string) {
    cancelSearch();
    if (query.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      requestRef.current = controller;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, SEARCH_TIMEOUT_MS);
      const show = (data: Person[]) => {
        if (requestRef.current !== controller) return; // a newer search started
        setSuggestions(data);
        setOpen(data.length > 0);
      };
      setLoading(true);
      try {
        if (!navigator.onLine) throw new Error("offline");
        const params = new URLSearchParams({ q: query.trim() });
        if (role) params.set("role", role);
        const res = await fetch(`/api/pessoas?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        show(await res.json());
      } catch {
        // Offline or too slow: search the device copy. Cancelled by the user: nothing.
        const cancelled = controller.signal.aborted && !timedOut;
        if (!cancelled && churchId) show(await searchCachedPeople(churchId, query, role));
      } finally {
        clearTimeout(timer);
        if (requestRef.current === controller) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function select(name: string) {
    cancelSearch();
    setOpen(false);
    setLoading(false);
    onChange(name);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          search(e.target.value);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {
          cancelSearch();
          setLoading(false);
          setOpen(false);
          onBlur?.();
        }}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
      {open &&
        suggestions.length > 0 &&
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
                // mousedown + preventDefault keeps focus in the input, so the
                // click registers before blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(p.name);
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
