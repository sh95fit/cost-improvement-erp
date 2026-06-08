// src/features/material-requirement/utils/format.ts

/**
 * g 기준 수량을 사람이 읽기 좋은 표기로.
 * - < 1000g: "123g"
 * - >= 1000g: "1.23kg"
 */
export function formatGrams(qty: number): string {
    if (!Number.isFinite(qty)) return "—";
    if (qty < 1000) {
      return `${qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}g`;
    }
    const kg = qty / 1000;
    return `${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })}kg`;
  }
  
  /** g 수량 → 보조 표기 (예: "(2.5kg)"). 1000g 미만이면 빈 문자열. */
  export function formatGramsAuxiliary(qty: number): string {
    if (qty < 1000) return "";
    const kg = qty / 1000;
    return `(${kg.toLocaleString(undefined, { maximumFractionDigits: 2 })}kg)`;
  }
  