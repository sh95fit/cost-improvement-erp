import { UnitCategory } from "@prisma/client";

export type UnitOption = { value: string; label: string };

export const UNIT_OPTIONS: Record<UnitCategory, UnitOption[]> = {
  WEIGHT: [
    { value: "g", label: "g (그램)" },
    { value: "kg", label: "kg (킬로그램)" },
    { value: "mg", label: "mg (밀리그램)" },
    { value: "근", label: "근 (600g)" },
    { value: "관", label: "관 (3.75kg)" },
  ],
  VOLUME: [
    { value: "ml", label: "ml (밀리리터)" },
    { value: "L", label: "L (리터)" },
    { value: "cc", label: "cc" },
  ],
  COUNT: [
    { value: "개", label: "개" },
    { value: "봉", label: "봉" },
    { value: "팩", label: "팩" },
    { value: "박스", label: "박스" },
    { value: "캔", label: "캔" },
    { value: "병", label: "병" },
    { value: "장", label: "장" },
    { value: "판", label: "판" },
    { value: "EA", label: "EA" },
  ],
  LENGTH: [
    { value: "cm", label: "cm (센티미터)" },
    { value: "m", label: "m (미터)" },
    { value: "mm", label: "mm (밀리미터)" },
  ],
};

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  WEIGHT: "중량",
  VOLUME: "용량",
  COUNT: "수량",
  LENGTH: "길이",
};

export function getAllUnitOptions(): UnitOption[] {
  return Object.values(UNIT_OPTIONS).flat();
}

export function getUnitOptionsByCategory(category: UnitCategory): UnitOption[] {
  return UNIT_OPTIONS[category] ?? [];
}
