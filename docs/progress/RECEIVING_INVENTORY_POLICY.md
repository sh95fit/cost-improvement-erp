# 입고서 확정 및 재고 반영 정책 (RECEIVING_INVENTORY_POLICY)

> 작성일: 2026-07-01 (D30 C-3 진입 시)
> 최종 갱신: 2026-07-03 (§9 사유 해결 우선순위 추가 — D30 C-3-d3)
> 관련 코드: `src/features/receiving-note/services/receiving-note.service.ts`
> 관련 헌법: PROGRESS.md P5, P8, P9
> 관련 문서: `docs/progress/PO_LIFECYCLE.md` §3-A

## 1. 도메인 정의

입고서(ReceivingNote)는 발주서에 대응하는 실제 도착 물자를 기록하는 문서다. `DRAFT` 상태에서는 자유로이 편집 가능하며, `CONFIRMED` 상태로 전이되는 순간 아래 다섯 가지가 **하나의 트랜잭션 안에서** 원자적으로 수행된다.

1. `ReceivingNote.status` → `CONFIRMED`, `confirmedAt` / `confirmedByUserId` 기록
2. 각 `ReceivingNoteItem` 당 `InventoryLot` + `InventoryTransaction(PURCHASE)` 생성
3. `PurchaseOrderItem.receivedQty` 누적 증가
4. `ReceivingDiscrepancy` 스냅샷 (수량/단가 차이, 항목 누락)
5. `PurchaseOrder.status` → `RECEIVED` 전이 (동일 tx 주입)

어느 한 단계라도 실패하면 전체 롤백된다.

## 2. 단가 정책 (P9 준수)

**PO 단가가 정본이다.** 입고 단가(`ReceivingNoteItem.unitPrice`)가 PO 단가와 다르더라도:

- `InventoryLot.unitPrice` = **PO 단가로 고정** (입고 단가 아님)
- `InventoryTransaction.unitPrice` = **PO 단가로 고정**
- 차이는 `ReceivingDiscrepancy(type=UNIT_PRICE_DIFF)`에 기록 전용으로 남긴다
- 재고 자산 평가에는 입고 단가가 절대 반영되지 않는다

이 정책의 근거는 P9 헌법("PO 단가는 발주 확정(SUBMITTED) 시점에 SupplierItemPriceHistory 적층으로 확정되며, 이후 단계는 그 단가를 참조만 한다")이다.

## 3. 위치 정책 (P1/P3 준수)

- `InventoryLot.locationId` = `PurchaseOrder.locationId`
- `InventoryTransaction.locationId` = `PurchaseOrder.locationId`

입고서에는 별도 `locationId` 컬럼이 없다. PO 헤더의 공장이 곧 입고 공장이며, "입고 위치"와 "발주 배송지"는 동일 개념이다 (재고는 공장/창고에만 존재 — P3).

## 4. Discrepancy 부호 정책 (정책 A)

모든 차이값은 **`diffValue = actual - expected`** 규칙을 따른다.

| 케이스 | type | expectedQty | actualQty | diffValue |
|---|---|---|---|---|
| 수량 부족 | `QUANTITY_SHORT` | `poItem.quantity` | `receivedQty` | 음수 |
| 수량 초과 | `QUANTITY_OVER` | `poItem.quantity` | `receivedQty` | 양수 |
| 단가 차이 | `UNIT_PRICE_DIFF` | `poItem.quantity` | `receivedQty` | `actualUnitPrice - expectedUnitPrice` |
| 발주에 없는 입고 | `ITEM_MISSING` | `null` | `receivedQty` | `+receivedQty` (실입고량) |
| 입고에 없는 발주 | `ITEM_MISSING` | `poItem.quantity` | `0` | `-poItem.quantity` (미도착량) |

`ITEM_MISSING` 은 방향에 따라 `expectedQty`/`actualQty` 중 하나만 채워지며, `reason` 필드로 방향을 구분한다:
- `"발주에 없는 항목이 입고됨"` (입고 → PO 매칭 실패)
- `"발주에 있었으나 입고되지 않음"` (PO → 입고 매칭 실패)

## 5. Subsidiary(부자재) 처리

현 스키마 제약:
- `InventoryTransaction.materialMasterId` 는 NOT NULL
- `InventoryTransaction` 에는 `subsidiaryMasterId` 컬럼이 없음

따라서 부자재의 재고 트랜잭션을 기록할 스키마상 자리가 없다. `PurchaseOrderItem.itemType === "SUBSIDIARY"` 를 입고 확정하려 하면 `UnsupportedSubsidiaryReceivingError` 를 던진다.

**해소 계획**: Sprint 4 Phase 10 에서 `InventoryTransaction.materialMasterId` 를 nullable 로 완화하고 `subsidiaryMasterId` 를 추가한 뒤 본 정책 §5 를 갱신한다.

## 6. Idempotency

동일 입고서를 두 번 확정하려 하면 `ReceivingNoteAlreadyConfirmedError` (액션 매핑: `ALREADY_CONFIRMED`) 를 던진다. 재고 이중 반영 방지의 1차 방어선이다. 스키마 레벨의 2차 방어선은 `ReceivingNote.status` 컬럼 자체가 상태를 보존한다는 사실이다.


## 7. ReceivingDiscrepancy 관계 격리 정책

`ReceivingDiscrepancy` 는 감사·스냅샷 성격의 이력 테이블이다. `purchaseOrderItemId`, `receivingNoteItemId` FK 스칼라 필드는 유지하되, Prisma 관계 라인(`@relation`)은 의도적으로 정의하지 않는다.

**근거**:
- 스냅샷 값(`expectedQty`, `actualQty`, `expectedUnitPrice`, `actualUnitPrice`, `diffValue`)이 기록 시점에 이미 박제되어 있어, 현재 상태를 관계로 다시 끌어올 필요가 없다.
- 상위 엔티티(`PurchaseOrderItem`, `ReceivingNoteItem`)가 변경·삭제되더라도 이력의 진실성이 유지되도록 soft dependency 를 유지한다.
- 반면 `company`, `purchaseOrder`, `receivingNote`, `recordedByUser` 관계는 유지한다. 집계·필터·권한 체크·기록자 표시에 필수이고, 상위 엔티티가 hard delete 되지 않는 도메인 규약을 갖기 때문이다.

**UI 구현 규약**:
품목명 등 부가 정보가 필요한 경우, 이미 로드된 `receivingNote.purchaseOrder.items` 배열에서 `purchaseOrderItemId` 로 클라이언트 사이드 조인한다. 추가 DB 조회를 하지 않는다.


## 8. ReceivingDiscrepancy 관계 격리 정책

`ReceivingDiscrepancy` 는 감사·스냅샷 성격의 이력 테이블이다. `purchaseOrderItemId`, `receivingNoteItemId` FK 스칼라 필드는 유지하되, Prisma 관계 라인(`@relation`)은 의도적으로 정의하지 않는다.

**근거**:
- 스냅샷 값(`expectedQty`, `actualQty`, `expectedUnitPrice`, `actualUnitPrice`, `diffValue`)이 기록 시점에 이미 박제되어 있어, 현재 상태를 관계로 다시 끌어올 필요가 없다.
- 상위 엔티티(`PurchaseOrderItem`, `ReceivingNoteItem`)가 변경·삭제되더라도 이력의 진실성이 유지되도록 soft dependency 를 유지한다.
- 반면 `company`, `purchaseOrder`, `receivingNote`, `recordedByUser` 관계는 유지한다. 집계·필터·권한 체크·기록자 표시에 필수이고, 상위 엔티티가 hard delete 되지 않는 도메인 규약을 갖기 때문이다.

**UI 구현 규약**:
품목명 등 부가 정보가 필요한 경우, 이미 로드된 `receivingNote.purchaseOrder.items` 배열에서 `purchaseOrderItemId` 로 클라이언트 사이드 조인한다. 추가 DB 조회를 하지 않는다.


## 9. 불일치 사유 해결 우선순위 (D30 C-3-d3, 2026-07-03)

하나의 입고서에 여러 불일치(수량 부족/초과, 단가 차이, 항목 누락)가 동시에 발생할 수 있다. 각 불일치는 원인이 서로 다를 수 있으므로 (예: "수량 부족은 공급사 오배송, 단가 차이는 계약 변경 미반영"), **품목·유형별로 사유를 분리 기록**한다.

### 9.1 사유 저장 우선순위

`ReceivingDiscrepancy.reason` 필드에 저장될 값은 다음 3단계 우선순위로 결정된다.

| 순위 | 소스 | 필드 | 설명 |
|---|---|---|---|
| 1 | 품목·유형별 사유 | `options.discrepancyReasons[key]` | 사용자가 확정 다이얼로그에서 각 불일치 항목에 개별 입력한 사유 |
| 2 | 통일 사유 (하위호환) | `options.discrepancyReason` | "모든 항목에 동일 사유 적용" 토글로 입력한 값 |
| 3 | 자동 사유 (fallback) | 서비스 내부 상수 | `ITEM_MISSING`/`UNIT_PRICE_DIFF` 에 한해 서비스가 부여 (예: `"발주에 없는 항목이 입고됨"`) |

`QUANTITY_SHORT` / `QUANTITY_OVER` 는 자동 사유가 없다 (사용자 입력 없으면 `null`). 이유: 수량 차이의 원인은 도메인 지식이 있어야 판단 가능하며, 자동 문구가 감사 추적을 오히려 흐린다.

### 9.2 안정 키 규약

품목·유형별 사유를 UI 와 서비스가 주고받으려면, 클라이언트에서 사전 계산한 preview 목록과 서비스가 실제로 생성하는 스냅샷이 **동일한 키**로 매칭돼야 한다. 키 생성은 단일 유틸(`src/features/receiving-note/lib/discrepancy-key.ts`)에 위임한다.

buildDiscrepancyKey(type, purchaseOrderItemId, receivingNoteItemId) = ${type}:${purchaseOrderItemId ?? "none"}:${receivingNoteItemId ?? "none"}


케이스별 예시:

| 케이스 | poItemId | rItemId | key 예시 |
|---|---|---|---|
| 수량 부족/초과 | 있음 | 있음 | `QUANTITY_SHORT:po_item_A:rn_item_1` |
| 단가 차이 | 있음 | 있음 | `UNIT_PRICE_DIFF:po_item_A:rn_item_1` |
| 발주에 없는 입고 | `null` | 있음 | `ITEM_MISSING:none:rn_item_9` |
| 입고에 없는 발주 | 있음 | `null` | `ITEM_MISSING:po_item_B:none` |

### 9.3 사전 계산(Preview) 정책

확정 다이얼로그가 열릴 때 `previewReceivingNoteDiscrepancies(companyId, receivingNoteId)` 가 호출되어 확정 시 발생할 불일치를 사전 계산한다.

- **DB 무영향**: 트랜잭션 없이 read-only. `InventoryLot`/`InventoryTransaction`/`Discrepancy` 를 생성하지 않는다.
- **키 재현**: 실제 확정 시 서비스가 생성할 키와 동일한 `buildDiscrepancyKey` 규약을 사용한다.
- **권한**: `receiving-note READ` (확정은 UPDATE 이지만 preview 는 조회 전용).
- **실패 폴백**: preview 조회가 실패해도 확정 자체는 진행 가능. UI 는 통일 사유 입력으로 자동 폴백한다.

### 9.4 감사 추적성 원칙

- 사용자가 사유를 입력하지 않은 항목은 `reason = null` 로 남는다. **빈 문자열을 저장하지 않는다** (`""` 와 `null` 을 구분).
- 통일 사유 모드로 저장된 항목과 개별 사유 모드로 저장된 항목은 스냅샷상 구분 저장하지 않는다. 두 모드는 UI 편의 기능일 뿐이며, DB 관점에서는 "확정 시점에 사용자가 명시적으로 남긴 사유"라는 동일한 의미를 갖는다.


## 10. 변경 이력
- 2026-07-01: 초안. D30 C-2 (서비스) 구현 시점의 실제 코드를 문서화. Discrepancy 부호 정책을 정책 A(`actual - expected`) 로 확정.
- 2026-07-01: §8 (Discrepancy 관계 격리 정책) 추가. D30 C-3-a 보완 커밋(`c1b8abee`)에서 서비스 코드의 `include.purchaseOrderItem` 제거 근거 명시.
- 2026-07-03: §9 (불일치 사유 해결 우선순위) 추가. D30 C-3-d3 (commit `85302dc9`) 배포 반영. 기존 "변경 이력" 헤딩 번호를 §10 으로 이동(문서 내 §8 중복 정정).


