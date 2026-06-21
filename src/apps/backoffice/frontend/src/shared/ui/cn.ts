import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind クラスの条件結合＋衝突解決（後勝ち）。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
