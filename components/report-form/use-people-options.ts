"use client";

import { useEffect, useState } from "react";
import type { PersonOption } from "./form-values";

export interface PeopleOptions {
  pastors: PersonOption[];
  deacons: PersonOption[];
  treasurers: PersonOption[];
}

async function fetchRole(role: string): Promise<PersonOption[]> {
  const res = await fetch(`/api/pessoas?role=${role}`);
  if (!res.ok) throw new Error(`Failed to load ${role}`);
  const people: PersonOption[] = await res.json();
  return people.map(({ id, name }) => ({ id, name }));
}

export function loadPeopleOptions(): Promise<PeopleOptions> {
  return Promise.all([fetchRole("pastor"), fetchRole("diacono"), fetchRole("tesoureiro")]).then(
    ([pastors, deacons, treasurers]) => ({ pastors, deacons, treasurers })
  );
}

/** Registered pastors, deacons and treasurers for the form's checklists. */
export function usePeopleOptions(): { options: PeopleOptions | null; error: boolean } {
  const [options, setOptions] = useState<PeopleOptions | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPeopleOptions()
      .then((o) => !cancelled && setOptions(o))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);
  return { options, error };
}

/** Adds people the report already references but the lists no longer include. */
export function withPeople(list: PersonOption[], extra: PersonOption[]): PersonOption[] {
  const ids = new Set(list.map((p) => p.id));
  return [...list, ...extra.filter((p) => !ids.has(p.id))];
}
