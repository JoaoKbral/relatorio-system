"use client";

import { useEffect, useState } from "react";
import type { PersonOption } from "./form-values";
import { getPeople } from "@/lib/offline/people";
import { useOffline } from "@/components/offline/OfflineProvider";

export interface PeopleOptions {
  pastors: PersonOption[];
  deacons: PersonOption[];
  treasurers: PersonOption[];
}

/**
 * Pastors, deacons and treasurers for the form's checklists. With `churchId`
 * it falls back to the copy saved on the device when offline (new report form).
 */
export async function loadPeopleOptions(churchId?: number | null): Promise<PeopleOptions> {
  const { people } = await getPeople(churchId);
  const withRole = (role: string) =>
    people.filter((p) => p.roles.includes(role)).map(({ id, name }) => ({ id, name }));
  return { pastors: withRole("pastor"), deacons: withRole("diacono"), treasurers: withRole("tesoureiro") };
}

/** Registered pastors, deacons and treasurers, also offline once loaded online. */
export function usePeopleOptions(): { options: PeopleOptions | null; error: boolean } {
  const { churchId } = useOffline();
  const [options, setOptions] = useState<PeopleOptions | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPeopleOptions(churchId)
      .then((o) => !cancelled && setOptions(o))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [churchId]);
  return { options, error };
}

/** Adds people the report already references but the lists no longer include. */
export function withPeople(list: PersonOption[], extra: PersonOption[]): PersonOption[] {
  const ids = new Set(list.map((p) => p.id));
  return [...list, ...extra.filter((p) => !ids.has(p.id))];
}
