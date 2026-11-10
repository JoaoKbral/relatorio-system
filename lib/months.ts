export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

/**
 * Value → label map for month <Select>s ("1".."12"). Base UI's Select shows
 * the raw value in the trigger unless it is given its items like this.
 */
export const MONTH_ITEMS: Record<string, string> = Object.fromEntries(
  MONTHS.map((name, i) => [String(i + 1), name])
);
