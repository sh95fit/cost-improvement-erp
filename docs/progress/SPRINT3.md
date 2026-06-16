> ⚠️ **STALE — Sprint 3 진행 중**. 본 파일은 Phase 4-B'-4 까지만 반영되어 있다.
> Sprint 3 진행 중 SSOT 는 `PROGRESS.md` 이다. Sprint 3 종결 시 PROGRESS.md 의 Sprint 3 섹션이 본 파일로 일괄 이관되며, 그 시점까지 본 파일은 갱신하지 않는다.

# Sprint 3: 발주·입고 (6/15 ~ 진행 중)

> 본 문서는 Sprint 3 전체 Phase 상세 이력 아카이브이다.
> 모델 구현 현황은 `SCHEMA_COVERAGE.md`를 참조한다.
> 발주(P1~P4) → 입고(P5~P8) 순서로 진행한다.

> 총 예상 공수: ~60h (Sprint 2의 9-A처럼 Phase 4-B'에서 위저드 분할 진행)

---

## Sprint 3 핵심 의사결정 (PROGRESS 통합 메모)

### D1. 발주서 의미 — "회사 내부 자재 묶음 문서"
- 1 PO ≠ 1 공급업체 발송 문서. 1 PO = "한 공장(Location)에 들어와야 할 공급업체 묶음".
- 한 식단(MealPlanGroup)에서 다수 공급업체에 걸쳐 PO가 분리되며, `mealPlanGroupId`로 그룹뷰 제공.
- 회사 계층은 공장별로 작업, 공장 계층은 본인 공장만, 라인 계층은 본인 라인만 — 권한 단위는 계층별.

### D2. 위저드 vs 수동 발주 — 위저드 우선 + 수동 단건 보조
- 식단 기반 위저드: MR → 발주 후보 → 공급업체 매핑(즐겨찾기 + 수동) → 일괄 생성 → DRAFT N개.
- 수동 단건: `createPurchaseOrder` 유지(별 진입점). 위저드는 `createPurchaseOrdersBatch` 사용.

### D3. 단위 환산 체인
- 필요량(g) → [UnitConversion.factor] → 환산전 단위(예: 포) → [SupplierItem.supplyUnitQty] → 공급 단위(박스).
- 발주 단위는 `Math.ceil()` 기본, 사용자 수동 조정 허용.
- 재고 차감 적용: 순필요량 = max(0, 필요량 - 재고). 재고 서비스는 Phase 6 이전 placeholder.

### D4. 단가 적층 정책 (입고 단계 단가 미관여)
- DRAFT 단계: 단가 편집만, PriceHistory 미적층.
- DRAFT → SUBMITTED 전이 시점에 변경된 단가만 PriceHistory 적층 + `SupplierItem.currentPrice` 갱신.
- SUBMITTED → DRAFT 되돌리기 시 이력 유지 (이력 보존 우선).
- 입고(P5) 단계는 단가 미관여 — 발주에서만 단가 책임 (입고 담당자는 수량만 본다).
- 이력 수정은 SupplierItem 상세의 PriceHistory 탭에서 직접 (Sprint 3 범위 밖).

### D5. PO 분리 단위 (그룹핑)
- 위저드 일괄 생성 시 `supplierId × locationId × productionLineId`로 그룹핑.
- `productionLineId` null과 값 있는 항목은 별도 PO (정합성 보장).
- 모두 같은 `mealPlanGroupId` 공유 → 그룹뷰 가능.

### D6. 미매핑 항목은 클라이언트 state만 사용
- DB에 별도 DraftItem 테이블 신설하지 않음 (스키마 단순성).
- 위저드 화면에서 미매핑 자재는 클라이언트 state로 보존, 모두 매핑 완료해야 "발주 생성" 활성화.

---

## Phase 0-A — Phase 4-B 회수 + 컴포넌트 삭제 ✅
- **날짜**: 2026-06-15
- **커밋**: `98c4cdb1`
- **사유**: 기존 4-B 폼은 공급사 선두 흐름·TS2352·식단/공장/라인 컨텍스트 부재로 폐기.
- **삭제 파일**:
  - `src/features/purchase-order/components/purchase-order-form-dialog.tsx`
  - `src/features/purchase-order/components/purchase-order-item-row.tsx`
  - `src/features/purchase-order/components/supplier-combobox.tsx`
- **수정**: `src/app/(dashboard)/purchase-orders/page.tsx` — dialog import 제거, "발주 등록" 버튼 토스트 + 배너 안내로 임시 대체.
- **유지**: `purchase-order-list.tsx`, `purchase-order-status-badge.tsx`.

## Phase 0-B — getSupplierItems 반환 타입 정리 ✅
- **날짜**: 2026-06-15
- **커밋**: `b4c9143a`
- **변경**: `src/features/supplier/actions/supplier.action.ts`
  - 헬퍼 타입 `SupplierItemWithRelations`, `SupplierItemWithSupplier` 신설.
  - `getSupplierItemsAction` 반환 타입 `SupplierItem[]` → `SupplierItemWithRelations[]`.
  - `getSupplierItemsByMaterialAction`, `getSupplierItemsBySubsidiaryAction` 반환 `unknown` → `SupplierItemWithSupplier[]`.
- **결과**: TS2352 근본 해결.

## Phase 1.5 — PurchaseOrder roll-up 컬럼 신설 ✅
- **날짜**: 2026-06-15
- **커밋**: `58da2a1e` (스키마+서비스+마이그레이션), `f1db9d25` (테스트 보강)
- **마이그레이션**: `20260615114719_sprint3_phase1_5_po_location_rollup`
- **스키마 변경** (`prisma/schema.prisma`):
  - `PurchaseOrder.locationId String` (NOT NULL, FK Location, ON DELETE RESTRICT)
  - `PurchaseOrder.productionLineId String?` (FK ProductionLine, ON DELETE SET NULL)
  - 인덱스: `@@index([locationId])`, `@@index([productionLineId])`
  - 역방향 관계: `Location.purchaseOrders`, `ProductionLine.purchaseOrders`
- **Zod 스키마** (`purchase-order.schema.ts`):
  - `createPurchaseOrderSchema`: `locationId` 필수, `productionLineId` 선택.
  - `updatePurchaseOrderSchema`: 둘 다 선택.
- **서비스 변경** (`purchase-order.service.ts`):
  - `assertLocationAndLine()` 헬퍼 신설 — 회사 일치 + 라인-공장 정합성.
  - 도메인 에러 3종: `LOCATION_NOT_FOUND`, `PRODUCTION_LINE_NOT_FOUND`, `LINE_LOCATION_MISMATCH`.
  - `createPurchaseOrder`/`updatePurchaseOrder` 검증 후 필드 저장.
  - `getPurchaseOrders`/`getPurchaseOrderById` include에 location/productionLine 추가.
- **테스트**: 24 → 27 PASS (LOCATION_NOT_FOUND / PRODUCTION_LINE_NOT_FOUND / LINE_LOCATION_MISMATCH).

## Phase 4-B'-1 — 단위 환산 라이브러리 ✅
- **날짜**: 2026-06-16
- **커밋**: `b6ec1240`
- **신규 파일**:
  - `src/features/purchase-order/lib/unit-conversion.ts` — `calculateOrderQuantity()` 순수 함수
  - `src/tests/purchase-order-unit-conversion.test.ts` — 16건 테스트
- **기능**: g → 환산전 단위 → 공급 단위 2단계 환산, 재고 차감, 경고 플래그, `requiresManualInput` 분기.
- **테스트**: 신규 16건 / 누적 306 PASS.

## Phase 4-B'-2 — MR → 발주 후보 변환 헬퍼 ✅
- **날짜**: 2026-06-16
- **커밋**: `af333130`
- **신규 파일**:
  - `src/features/purchase-order/lib/inventory-adapter.ts` — `InventoryAdapter` 인터페이스 + `noopInventoryAdapter` (Phase 6에서 교체)
  - `src/features/purchase-order/lib/build-po-items-from-mr.ts` — `buildPOItemsFromMR()` (mapped/unmapped/noOrderNeeded 3분류)
  - `src/tests/build-po-items-from-mr.test.ts` — 9건 테스트
- **최적화**: MaterialMaster, UnitConversion, 재고 일괄 조회 (공장별 1회). 즐겨찾기는 `MaterialMaster.defaultSupplierItem` 사용.
- **테스트**: 신규 9건 / 누적 315 PASS.

## Phase 4-B'-3 — 배치 PO 생성 서비스 ✅
- **날짜**: 2026-06-16
- **커밋**: `ff6b5071`
- **신규 파일**:
  - `src/features/purchase-order/services/purchase-order-batch.service.ts` — `createPurchaseOrdersBatch()` (트랜잭션 + 그룹핑)
  - `src/tests/purchase-order-batch.service.test.ts` — 17건 테스트
- **그룹핑**: `supplierId × locationId × productionLineId(null 포함)`로 N개 PO 분리.
- **검증**: location/line/supplier/supplierItem 4종 일괄 검증.
- **채번**: 트랜잭션 내 순차 채번 + `usedOrderNumbers` Set으로 충돌 방지.
- **마커**: 모든 PO `status=DRAFT`, `sourceType=WIZARD_AUTO`, `isManual=false`.
- **테스트**: 신규 17건 / 누적 332 PASS.

## Phase 4-B'-4 — SUBMITTED 전이 시 PriceHistory 적층 ✅
- **날짜**: 2026-06-16
- **커밋**: `5232ec46`
- **신규 파일**:
  - `src/features/purchase-order/lib/stack-price-history.ts` — `stackPriceHistoryForPO()`
  - `src/tests/stack-price-history.test.ts` — 8건 테스트
- **수정**: `purchase-order.service.ts` `transitionPurchaseOrderStatus()` DRAFT→SUBMITTED 분기에서 호출.
- **정책**: 변경된 단가만 적층 + `SupplierItem.currentPrice` 갱신, 같은 PO 내 중복 supplierItemId는 첫 행 단가 사용, 삭제된 SupplierItem 무시.
- **테스트**: 신규 8건 + PO 서비스 테스트 3건 / 누적 343 PASS.

## Phase 4-B'-5a — 위저드 서버 액션 ⬜ 진행 예정
- **목표**: UI 호출용 액션 3개 신설 (모두 기존 서비스 얇은 래퍼)
  - `getMealPlanGroupsForOrderAction()` — Step 1 드롭다운 (IN_PROGRESS/COMPLETED + 30일)
  - `loadPOWizardDataAction(mealPlanGroupId, countSource)` — Step 2 MR 조회 + `buildPOItemsFromMR()`
  - `createPurchaseOrdersBatchAction(input)` — Step 5 일괄 생성 + PO 1건당 감사 로그
- **스키마 추가**: `loadPOWizardDataSchema`
- **테스트**: 신규 없음 (단순 래퍼) — 통합 테스트는 5c 완료 후

## Phase 4-B'-5b — 위저드 UI 골격 (Step 1·2) ⬜
- **목표**:
  - `app/(dashboard)/purchase-orders/new/page.tsx` 신규 라우트
  - `wizard/po-wizard.tsx` 최상위 클라이언트
  - `wizard/step-meal-plan-group-select.tsx`, `step-load-summary.tsx`
  - 기존 `page.tsx` "발주 등록" 버튼 → `/new` 라우팅으로 변경

## Phase 4-B'-5c — 위저드 UI 편집·생성 (Step 3·4·5) ⬜
- **목표**:
  - Step 3 메인 편집 테이블 (mapped / unmapped 섹션, 즐겨찾기 표시, 수량·단가 인라인 편집)
  - Step 4 분할 미리보기 (공급업체 × 공장 그룹)
  - Step 5 일괄 생성 + 리스트 페이지 리다이렉트 + 토스트
  - "발주 확정" 버튼 (PO 상세에서 DRAFT → SUBMITTED 호출)

## Phase 4-C — PO 상세 + 상태 전이 UI ⬜
- 상세 페이지(읽기 전용 + 상태 전이 버튼), DRAFT 편집 다이얼로그.

## Phase 5~8 — 입고 / 이력 / 단가 수정 UI ⬜
- 입고 단계(P5~P6), Price History 수정 UI (D4의 보완 작업), 발주 통계.
