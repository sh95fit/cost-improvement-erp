/**
 * S4-3-c-2 — Layer B 클라이언트 상태 타입
 *
 * 서버 초안(`ConsumptionDraftItem`) 과 구조가 유사하나 다음이 다르다:
 *   - id: 클라이언트 임시 UUID (S4-3-d 확정 시 서버에서 재발급)
 *   - quantity: 사용자가 직접 입력 (expectedQty 아님)
 *   - note: 선택 사유 문자열
 *   - sourceType: 항상 MANUAL_ADDITION (P13 Layer B)
 *   - lineupId / productionLineId: 라인업 선택 시 (lineupId, productionLineId)
 *     쌍으로 세팅 (audit §10-14, R6-B-3). 서버 전송 시 non-null 필수.
 */
import type { ItemType } from "@prisma/client";

export type LayerBItem = {
  /** 클라이언트 임시 ID (crypto.randomUUID()) */
  clientId: string;
  itemType: ItemType;
  /** MaterialMaster.id 또는 SubsidiaryMaster.id */
  itemId: string;
  itemName: string;
  itemCode: string;
  unit: string;
  /** 사용자가 입력한 수량 (> 0) */
  quantity: number;
  /**
   * 선택된 라인업 ID.
   * UI 초기 상태 null 허용, 서버 전송 직전 non-null 강제 (Zod).
   */
  lineupId: string | null;
  /**
   * 선택된 라인업과 함께 자동 매핑되는 생산라인 ID.
   * MaterialRequirement 조회 결과에서 (lineupId, productionLineId) 쌍으로 주어짐.
   */
  productionLineId: string | null;
  /** 선택 입력: 사유 메모 */
  note?: string;
};
