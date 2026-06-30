# 발주서(PurchaseOrder) 상태 라이프사이클

> 작성일: 2026-06-30
> 관련 코드: src/features/purchase-order/schemas/purchase-order.schema.ts
> 관련 헌법: PROGRESS.md P9 / P9'
> 관련 정합: docs/progress/COST_LINEUP_ALIGNMENT.md DC4

## 1. 도메인 정의

본 시스템의 발주서는 **외부(공급사)에 전송되는 공식 문서가 아니다.** 실제 발주 행위는 카카오톡·SMS·공급사 웹사이트 등 외부 채널로 수행되며, 본 시스템의 발주서는 *"이번 발주에서 어떤 자재를 얼마에 받기로 했는가"* 를 사내에서 관리·추적하기 위한 **내부 관리 문서**이다.

이 도메인 정의에 따라 상태 라벨은 *외부 제출 행위*가 아닌 *내부 의사결정 단계*를 표현해야 한다.

## 2. 상태 5단계

| enum | 라벨 | 의미 | 진입 액션 |
|---|---|---|---|
| DRAFT | 작성중 | 자유롭게 수정 가능. 단가 마스터에 영향 없음. | 위저드 생성, 수동 발주 생성 |
| SUBMITTED | 발주 확정 | **이번 발주의 내용/단가가 확정된 시점.** SupplierItemPriceHistory 적층 + SupplierItem.currentPrice 갱신. (헌법 P9') | 발주 확정 버튼 (개별 또는 일괄) |
| APPROVED | 결재 승인 | 결재 프로세스 도입 시 활용할 옵션 단계. **현재 운영에서는 사용하지 않는다.** enum/매트릭스에만 보존. | (현재 미사용) |
| RECEIVED | 입고 완료 | 입고가 더 이상 없을 것으로 운영자가 판단한 시점에 명시 액션으로 전이. 미달·정확·초과 모두 운영자 판단. | markPurchaseOrderAsReceivedAction (개별) 또는 bulkTransitionPOStatusAction (일괄) |
| CANCELLED | 취소 | 종결. cancelReason 필수. | 취소 버튼 (개별 또는 일괄) |

## 3. 전이 매트릭스

DRAFT → SUBMITTED, CANCELLED SUBMITTED → APPROVED, DRAFT, CANCELLED, RECEIVED ★ RECEIVED 직접 전이 허용 APPROVED → RECEIVED, CANCELLED RECEIVED → (잠금) CANCELLED → (잠금)


`SUBMITTED → DRAFT` 회수가 허용되는 이유: 단가 변경분이 마스터에 반영된 뒤에도 외부 채널 발주 전이라면 회수 가능. (단, 회수 시 마스터 단가는 자동 롤백하지 않음 — 다음 SUBMITTED 전이 시 재적층되므로 일관성 유지.)

`SUBMITTED → RECEIVED` 직접 전이가 허용되는 이유: 결재 프로세스를 도입하지 않은 현재 운영에서 APPROVED 를 거치지 않고 입고로 진행해야 함. D30 입고서 confirm 의 자동 전이 경로.

## 3-A. RECEIVED 전이 정책 (안정성 우선)

❌ 폐기: "RECEIVED 는 사용자 명시 액션(markPurchaseOrderAsReceivedAction)으로만 전이"
✅ 채택: "RECEIVED 는 입고서 확정(confirmReceivingNoteAction)의 원자적 결과로 자동 전이. 별도 PO 종결 액션 없음."
전이 매트릭스에서 SUBMITTED → RECEIVED 는 유지하되, "호출자: ReceivingNoteService.confirm 단일" 명시.
단가 정책: "RECEIVED 전이 시 단가 마스터 무영향. PO 단가가 정본이며, 입고 단가 차이는 ReceivingDiscrepancy(UNIT_PRICE_DIFF) 기록."

## 4. APPROVED 보존 정책

본 단계는 현재 일반 동선에서 사용하지 않는다. 다음을 보장한다:

- enum 값 보존.
- transition 매트릭스에 진입/이탈 경로 보존.
- UI 일괄 액션 대상에서 제외(작성중 → 발주 확정, 선택 취소 두 액션만 노출).
- 기존 데이터에 APPROVED 가 존재하면 라벨 "결재 승인" 으로 표시는 유지.

결재 프로세스 도입 시:
1. 매트릭스에서 `SUBMITTED → RECEIVED` 제거하여 APPROVED 강제.
2. UI 일괄 액션바에 "선택 결재 승인" 추가.
3. 본 문서 §4 갱신.

## 5. 변경 이력

- 2026-06-30: 초안 작성. 라벨 재정의 (SUBMITTED="발주 확정", APPROVED="결재 승인"), 매트릭스에 SUBMITTED → RECEIVED 직접 전이 추가, **RECEIVED 자동 전이 폐기 → 사용자 명시 액션으로 분리** (안정성 우선).
