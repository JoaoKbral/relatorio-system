// Person roles ("categorias"). Stored as plain strings in Person.roles, so this
// list is the single source of truth for which values are valid.

export const PERSON_ROLES = [
  { id: "pastor", label: "Pastor", color: "bg-purple-100 text-purple-700" },
  { id: "diacono", label: "Diácono", color: "bg-blue-100 text-blue-700" },
  { id: "tesoureiro", label: "Tesoureiro", color: "bg-green-100 text-green-700" },
  { id: "membro", label: "Membro", color: "bg-yellow-100 text-yellow-700" },
  { id: "lider", label: "Líder", color: "bg-orange-100 text-orange-700" },
] as const;

export type PersonRole = (typeof PERSON_ROLES)[number]["id"];

const ROLE_IDS = new Set<string>(PERSON_ROLES.map((r) => r.id));

export function isPersonRole(value: string): value is PersonRole {
  return ROLE_IDS.has(value);
}

export function roleLabel(id: string): string {
  return PERSON_ROLES.find((r) => r.id === id)?.label ?? id;
}

export function roleColor(id: string): string {
  return PERSON_ROLES.find((r) => r.id === id)?.color ?? "bg-gray-100 text-gray-600";
}
