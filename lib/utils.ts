import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Title-cases each word; words with 2 or fewer characters stay lowercase. */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\S+/g, (word) =>
      word.length <= 2 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
}
