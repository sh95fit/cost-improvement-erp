"use client";

import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "po-wizard-draft-";

export interface PersistedState {
  mealPlanGroupId: string | null;
  countSource: "ESTIMATED" | "FINAL";
  // Step 3 편집 상태 (mapped 행만 — 미매핑 매핑 결과도 mapped로 들어옴)
  edits: Record<
    string,
    {
      supplierItemId: string;
      supplierId: string;
      orderQuantity: number;
      unitPrice: number;
    }
  >;
  // Step 5 입력
  orderDate: string; // ISO
  // ★ Phase 1.6 (D15-1): deliveryDate → outboundDate
  //   (구 localStorage 데이터의 deliveryDate 키는 JSON.parse 시 무시되어 자연 소멸)
  outboundDate: string | null;
  note: string;
}

/**
 * 위저드 상태를 localStorage에 자동 저장·복구한다.
 * - 키: po-wizard-draft-{mealPlanGroupId}
 * - 식단 그룹이 바뀌면 이전 키는 그대로 두고 새 키 사용 (사용자가 명시 정리하지 않는 한 잔존)
 */
export function useWizardPersistence(
  mealPlanGroupId: string | null,
  state: Omit<PersistedState, "mealPlanGroupId"> | null,
) {
  const initializedRef = useRef(false);

  // 저장
  useEffect(() => {
    if (!mealPlanGroupId || !state) return;
    try {
      const payload: PersistedState = { mealPlanGroupId, ...state };
      localStorage.setItem(
        `${STORAGE_PREFIX}${mealPlanGroupId}`,
        JSON.stringify(payload),
      );
    } catch {
      /* QuotaExceeded 등 — 무시 */
    }
  }, [mealPlanGroupId, state]);

  // 초기 복구 (1회)
  function loadPersisted(groupId: string): PersistedState | null {
    if (initializedRef.current) return null;
    initializedRef.current = true;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${groupId}`);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedState;
    } catch {
      return null;
    }
  }

  function clearPersisted(groupId: string | null) {
    if (!groupId) return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${groupId}`);
    } catch {
      /* 무시 */
    }
  }

  return { loadPersisted, clearPersisted };
}
