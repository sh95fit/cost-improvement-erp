# Sprint 3 — 발주(PO) + 입고(Receiving) 도메인 아카이브

> 종결된 Sprint 3 (2026-06-15 ~ 2026-07-07) 의 전체 이력 아카이브.
> Sprint 종결 이후 발견되는 회귀·정정 사항은 본 문서 하단 "사후 추가" 섹션에만 append 한다.
> PROGRESS.md 는 건드리지 않는다.

---

## 1. Sprint 개요

| 항목 | 내용 |
|---|---|
| 기간 | 2026-06-15 ~ 2026-07-07 |
| 스코프 | 발주(PurchaseOrder) 라이프사이클 + 입고(ReceivingNote) 라이프사이클 + 자재 소요량↔발주 연결 |
| 종결 지점 | Phase 4-G G-1~G-4 + 인프라 hotfix (EMAXCONNSESSION) |
| 헌법 개정 | P5 재정정, P9 재정정, 불일치 도메인 분리, 계층분리 원칙 명시 (전부 2026-06-30 ~ 2026-07-08) |
| 신규 모델 | `PurchaseOrderBatch`, `POAdjustmentLog`, `ReceivingDiscrepancy` |
| 확장 모델 | `PurchaseOrder`(locationId·productionLineId·outboundDate·expectedReceiveDate·batchId·submittedAt·approvedAt·cancelledAt 등), `PurchaseOrderItem`(materialRequirementId FK), `ReceivingNote`(confirmedAt·confirmedByUserId), `MaterialRequirement`(lineupId) |
| 신규 enum | `POBatchMode`, `POAdjustmentAction`, `DiscrepancyType` |
| 신규 문서 | `docs/progress/PO_LIFECYCLE.md`, `docs/progress/RECEIVING_INVENTORY_POLICY.md`, `docs/progress/COST_LINEUP_ALIGNMENT.md` |

### Sprint 통계 (Sprint 종결 커밋 직전 확정)

아래 5개 명령을 실행하여 실측치로 대체한다.

- 총 커밋: `git log --oneline --since=2026-06-15 --until=2026-07-08 --author-date-order | wc -l`
- TS 오류 (0 목표): `npx tsc --noEmit`
- any 사용 수 (테스트·eslint-disable 제외): `grep -rn ": any" src --include="*.ts" | grep -v ".test.ts" | grep -v "eslint" | wc -l`
- 신규 마이그레이션 수: `ls prisma/migrations/ | grep -E "^2026(06|07)" | wc -l`
- 테스트 수: `npm run test 2>&1 | grep -E "Tests?:.*passed"`

| 지표 | 값 |
|---|---|
| 총 커밋 | (실행 후 기입) |
| 신규 마이그레이션 | (실행 후 기입) |
| 신규 테스트 케이스 | (실행 후 기입, 최소 100+ 확인됨) |
| TS 오류 | 0 |
| `any` 사용 (테스트 외) | (실행 후 기입) |
| 신규 문서 | 3 (PO_LIFECYCLE, RECEIVING_INVENTORY_POLICY, COST_LINEUP_ALIGNMENT) |
| 헌법 개정 | 3건 (P5·P9·계층분리 명시) |

---

## 2. 이 Sprint 에서 확정한 핵심 결정 (D 시리즈)

### 2.1. 발주 도메인 초기 결정

**D1 — 발주 단위**

1 PO = `(supplierId, locationId, productionLineId 또는 NULL)` 조합. 공급사 단위가 아니라 **공장 도착지 단위**가 우선. 스키마 실측: `PurchaseOrder.locationId` NOT NULL, `productionLineId` nullable. NULL productionLine 은 별도 그룹으로 처리.

**D2 — 위저드 우선, 수동 발주 후순위**

식단 기반 자동 위저드가 표준 흐름. 수동 단건 발주 (`isManual=true`, 스키마 컬럼 이미 존재) 는 Sprint 3 스코프 외. Sprint 4~5 사이 재검토.

**D3 — 단위 환산 체인**

`BOM 사용량(g) → SupplierItem.preUnit(중간 단위) → SupplierItem.supplyUnit(공급 단위)` 3단 체인. `Math.ceil` 라운딩 후 수동 미세조정 허용. 순수 함수 `src/features/purchase-order/lib/calculate-order-quantity.ts` 로 격리. 스키마 근거: `SupplierItem.supplyUnitId` (FK → `UnitMaster`), `supplyUnitQty`.

**D4 — 가격 이력 적층 시점**

`DRAFT → SUBMITTED` 시점에만 `SupplierItemPriceHistory` 적층 + `SupplierItem.currentPrice` 갱신. 다른 시점 (입고 확정, DRAFT 편집) 에서는 절대 마스터 갱신 없음. P9 재정정으로 헌법 승격.

**D5 — PO 그룹핑 키**

`supplierId × locationId × (productionLineId 또는 NULL)`. NULL 처리는 그룹 키 문자열화 시 `'__null__'` 리터럴로 명시. SQL 집계에서는 `GROUP BY supplier_id, location_id, COALESCE(production_line_id, '__null__')`.

**D6 — DraftItem 미도입**

위저드 unmapped 품목은 서버 저장하지 않고 클라이언트 상태 (`useReducer` + `localStorage`) 로만 유지. 별도 DraftItem 테이블 미도입. 근거: unmapped 는 발주 이전 상태이며, 사용자가 `SupplierItem` 을 등록·매핑하는 순간 mapped 로 승격.

---

### 2.2. `outboundDate` · 리드타임 SSOT (D9 · D15 시리즈)

**D9 — `deliveryDate` → `outboundDate` 리네이밍** — 커밋 `75f07d6`

발주의 PK 추적 키(헌법 P8)는 **실제 사용일 = 출고일 = 엔드라인**. `PurchaseOrder.outboundDate` 로 스키마 리네이밍. 마이그레이션 시 기존 `deliveryDate` 데이터를 그대로 이관.

**D15-1 — `outboundDate` 의미 확정**

= 공급업체가 우리 창고/공장으로 출고하는 날짜 (우리 관점의 도착 예정일이 아니라, **공급사의 발송일**). 스키마 주석 명시.

**D15-2 — `expectedReceiveDate` 는 헤더 필드가 아니라 런타임 파생값**

정확한 계산식: `itemExpectedReceiveDate = outboundDate − supplierItem.leadTimeDays`. `leadTimeDays` 미정 시 기본 1일. 헤더에 저장된 `expectedReceiveDate` 는 `outboundDate + MAX(items.leadTimeDays)` 로 참고용 (리스트 정렬 인덱스 용도, SSOT 아님).

**D15-3 — 품목별 입고일은 DB 미저장, 런타임 계산**

`format-lead-time.ts` 유틸이 SSOT. `PurchaseOrderItem` 단위로 `outboundDate − supplierItem.leadTimeDays` 계산.

**D15-5 — 리드타임 부호 회귀 사건 (2026-06-28 정정)**

초기 D30-Ex1 구현에서 5개 지점에서 `expectedReceiveDate = outboundDate + leadTimeDays` 로 **부호가 뒤바뀐 회귀** 발생. 영향 지점:

- `src/features/purchase-order/lib/format-lead-time.ts`
- `src/features/purchase-order/services/purchase-order.service.ts`
- `src/features/purchase-order/services/purchase-order-batch.service.ts`
- `src/features/receiving/services/daily-receiving.service.ts`
- 관련 마이그레이션의 seed 로직

5개 지점 전량 `−` 로 재정정. `daily-receiving.service.ts` 의 `outboundFilter` 주석도 `[selectedDate, selectedDate + MAX_LEAD_TIME_DAYS_WINDOW]` 로 정정.

> **교훈**: 리드타임 방향은 5군데에 흩어져 있어 회귀가 즉시 감지되지 않았다. Sprint 4 이후 유사 파생값은 **단일 유틸 함수(순수 함수)** 로 격리하고 다른 위치에서는 해당 유틸만 import 하여 사용한다. 마이그레이션 seed 도 유틸을 재사용한다.

**D15-8 — SupplierItem partial unique**

`(supplier, itemType, material/subsidiary, productName) WHERE deleted_at IS NULL` — soft-delete 후 동일 product 재등록 가능. Prisma `@@unique` 는 partial 조건 미지원이므로 마이그레이션 SQL 직접 정의.

---

### 2.3. 위저드 프리뷰 · 라인업 다축 정합성 (D25 · D29)

**D25-1 — 프리뷰 데이터 정합성**

`mappedPartialStock` 을 프리뷰에 병합, `orderQuantity` 가 0/null 인 행은 프리뷰 집계에서 제외.

**D25-3 — `NewModePreview` 단일 SSOT**

Step 5 프리뷰의 SSOT 는 `WizardPreviewPanel → NewModePreview`. 레거시 `StepSplitPreview` 는 사용처 제거.

**D25-4 — 레거시 컴포넌트 물리 삭제** — 커밋 `dafb5785`

`src/features/purchase-order/components/wizard/step-split-preview.tsx` 파일 삭제. `po-wizard.tsx` / `new-mode-preview.tsx` JSDoc 갱신.

> **교훈**: `deprecated` 주석만 남기면 재유입 위험. 사용처 제거 (N-1) → 파일 삭제 (N) 를 2단계로 확정한다.

**D29 — 라인업 다축 집계** — 커밋 `bf103b1a`

Step 4 프리뷰에 4축 탭 (공장 / 제조라인 / 공급업체 / **라인업**). `scopeLevel` 별 기본 축 차등:

- COMPANY 스코프 → 공장 축 기본
- LOCATION 스코프 → 제조라인 축 기본
- LINE 스코프 → 공급업체 축 기본

`POItemCandidate` 에 `lineupId` / `lineupName` 전파. `loadPOWizardDataAction` 이 MR select 에 `lineupId + lineup.name` 포함 후 평탄화.

**PC1~5 / DC1~5 / DoD1~7 — 원가↔라인업 정합성**

상세는 `docs/progress/COST_LINEUP_ALIGNMENT.md`. 핵심:

- `MaterialRequirement.lineupId` 신설 (nullable — 라인업 미배정 슬롯 대응).
- 5컬럼 unique 인덱스 `uq_mr_group_line_lineup_material_source` (`mealPlanGroupId, productionLineId, lineupId, materialMasterId, countSource`).
- 마이그레이션 `20260629024328_phase_4_c2_pre_mr_lineup_id`.
- 신규 read-only 액션 `getLineupBreakdownAction` — 라인업 × {자재, 공급사, PO} 3종 집계. PO 역추적은 `PurchaseOrderItem.materialRequirementId` FK, CANCELLED PO 제외, 같은 PO 가 여러 라인업에 걸치면 `contributedAmount` 로 분배.
- 쓰기 경로 (PO 그룹핑 키, 재고 차감) 무수정 (PC2/DC4 보존) — 라인업은 읽기 축으로만 사용.

---

### 2.4. 위저드 3-모드 (R1-b 시리즈)

#### 공통 인프라 (R1-b1, 커밋 `a32e255`)

**`PurchaseOrderBatch` 모델 신설**

스키마 실측 필드:

- PK: `id`
- Unique: `(companyId, idempotencyKey)`
- 필드: `companyId`, `idempotencyKey`, `mealPlanGroupId?`, `countSource(MealCountSource)`, `mode(POBatchMode)`, `basedOnPOIds String[]`, `createdByUserId`, `createdAt`
- 관계: `purchaseOrders PurchaseOrder[]`, `adjustmentLogs POAdjustmentLog[]`

**`PurchaseOrder.batchId` (nullable)**

NEW/DELTA/REPLACE 어느 모드든 batch 에 묶임. `@@index([batchId])`.

**`WizardModeSelector` 컴포넌트**

기존 PO 상태별 라디오 활성/비활성 로직.

**`ExistingPONotice`**

Step 1·5 에서 기존 PO 사전 안내.

#### NEW 모드

기존 PO 유지, 신규 DRAFT PO 생성. `executeNewMode` — 순수 생성 경로. 사이드이펙트 없음.

#### DELTA 모드 (R1-b3) — 커밋 `a32e255`, `a952a95`, `ee1f47b`, `32544bb`, `f65c582`

**`po-delta.service.ts` — 순수 함수**

시그니처:

- `previewDeltaPlan(currentPOs, mrCandidates) => DeltaPlan` — DB 무영향.

**`executeDeltaMode` — 트랜잭션 내 3단계**

1. 기존 `PurchaseOrderItem` 수량 합산.
2. 신규 자재 `ADD`.
3. 각 변경분마다 `POAdjustmentLog` 1행 적층.

**`POAdjustmentLog` 스키마 실측**

- 필드: `purchaseOrderId`, `purchaseOrderItemId?`, `action(POAdjustmentAction)`, `fieldName?`, `beforeValue?` (JSON 문자열), `afterValue?` (JSON 문자열), `reason`, `sourceBatchId?`, `actorUserId`, `createdAt`.
- `POAdjustmentAction` enum: `ADD`, `UPDATE_QUANTITY`, `UPDATE_UNIT_PRICE`, `REMOVE`, `NOTE_CHANGE`.

**프리뷰**

`previewDeltaPlanAction` (READ 권한, DB 무영향) + `DeltaPreviewCard` Step 2/5 통합.

**수동 조정 가시화**

Step 3 매핑 테이블에 시스템 권장값 표시 + 수동 편집 시 색상·되돌리기 버튼.

**테스트**

- `po-delta.service.test.ts` 14건
- `purchase-order-batch.service.test.ts` DELTA 13건
- 합계 27건

#### REPLACE 모드 (R1-b4) — 커밋 `6dbbfb3`, `f385f43`

**차단 기준**

`status NOT IN (DRAFT, SUBMITTED)` — 즉 APPROVED / RECEIVED 는 차단, CANCELLED 는 차단하지 않음.

**`executeReplaceMode`**

1. 기존 DRAFT/SUBMITTED PO 를 CANCELLED 로 일괄 전이. 이 때 `POAdjustmentLog` 에 `action=REMOVE`, `fieldName="po_status"`, `beforeValue="DRAFT" 또는 "SUBMITTED"`, `afterValue="CANCELLED"` 기록.
2. 신규 DRAFT PO 원자적 생성.

**오류 키**

- `REPLACE_BLOCKED_BY_LOCKED_PO` — APPROVED/RECEIVED 존재
- `REPLACE_MISSING_BASED_ON_POS` — basedOnPOIds 가 비어 있음

**단가 이력**

롤백하지 않음. DRAFT → SUBMITTED 재전이 시 자동 재적층.

**테스트**

8건 추가 (`purchase-order-batch.service.test.ts` REPLACE 통합 테스트).

---

### 2.5. 발주 라이프사이클 재정의 (2026-06-27 ~ 06-30, `docs/progress/PO_LIFECYCLE.md`)

#### 도메인 정의 명확화

발주서는 공급사에 전송되는 공식 문서가 아니라 **사내에서 어떤 자재를 얼마에 받기로 했는가를 관리·추적하는 내부 관리 문서**. 실제 발주 채널 (카톡·SMS·공급사 웹사이트 등) 은 시스템 외부.

#### POStatus 5단계 라벨 재정의 — 커밋 `14b2d20c`, `13b1d5f8`

| enum | 라벨 | 의미 |
|---|---|---|
| DRAFT | 작성중 | 자유 편집. 마스터 무영향 |
| SUBMITTED | 발주 확정 | 이번 발주 내용/단가 확정 시점. `SupplierItemPriceHistory` 적층 + `SupplierItem.currentPrice` 갱신 |
| APPROVED | 결재 승인 | 결재 도입 시 활용할 옵션 단계. **현재 미사용**, enum/매트릭스만 보존 |
| RECEIVED | 입고 완료 | ReceivingNote CONFIRMED 시 자동 전이 (§2.6 P5 재정정) |
| CANCELLED | 취소 | 종결. `cancelReason` 필수 |

enum / DB / 마이그레이션 무변경. 라벨 문자열만 변경. 7개 파일 안내문·에러 메시지 정합화.

#### 전이 매트릭스

전이 허용 목록:

- `DRAFT → SUBMITTED, CANCELLED`
- `SUBMITTED → APPROVED, DRAFT, CANCELLED, RECEIVED` (★ RECEIVED 직접 전이 허용)
- `APPROVED → RECEIVED, CANCELLED`
- `RECEIVED → (잠금)`
- `CANCELLED → (잠금)`

부연 설명:

- `SUBMITTED → DRAFT` 회수 허용: 마스터 단가 자동 롤백하지 않음 (다음 SUBMITTED 재전이 시 재적층).
- `SUBMITTED → RECEIVED` 직접 전이 허용: 결재 미도입 상태에서 APPROVED 우회.
- 결재 도입 시: 매트릭스에서 `SUBMITTED → RECEIVED` 제거하여 APPROVED 강제.

---

### 2.6. 헌법 재정정 (2026-06-30)

#### P5 재정정 — 입고 확정 = 재고 생성 + PO 종결 (단일 트랜잭션)

이전 안 (입고 확정 ↔ 발주 종결 분리, `markPurchaseOrderAsReceivedAction` 신설) 폐기. 다음을 채택:

`ReceivingNote.status = CONFIRMED` 시점에 단일 트랜잭션으로 원자적 수행:

1. `InventoryLot` 생성 + `InventoryTransaction(PURCHASE)` 적층.
2. 발주↔입고 차이 발생 시 `ReceivingDiscrepancy` 스냅샷 (QUANTITY_SHORT / QUANTITY_OVER / UNIT_PRICE_DIFF / ITEM_MISSING).
3. `PurchaseOrder.status → RECEIVED` 자동 전이.

수량 미달·초과·단가 차이는 입고를 막지 않음 — `ReceivingDiscrepancy` 스냅샷으로만 기록.

#### `InventoryReservation` 처리 정책 (2026-07-08 확정)

Sprint 3 이전 P5 원문은 "입고 확정 시 예약(Reservation) 생성 → 사용/폐기/재고전환으로 소진" 이었으나, 재정정 시점에는 예약 개념을 **일시 보류**하고 Lot 직접 생성으로 단순화. 스키마에 `InventoryReservation` 모델은 **정의만 유지**된 상태로 남음.

스키마 실측 필드: `companyId`, `inventoryLotId`, `materialMasterId`, `referenceType`, `referenceId`, `quantity`, `useDate`, `reservedAt`, `releasedAt`, `releaseReason(CONSUMED / AUTO_EXPIRED / MANUAL_CANCEL)`.

**Sprint 4 Phase S4-0-b 진입 시 재검토**:

- 안 (a) 예약 재도입 — `CookingPlan CONFIRMED` 시 예약 생성 → `ConsumptionItem CONFIRMED` 시 예약 해제 + Lot 차감.
- 안 (b) 예약 미사용 — FEFO 로 Lot 을 직접 차감.

Sprint 3 종결 시점에서는 `InventoryReservation` 서비스/액션 미구현. 스키마만 정의됨.

#### 분할 입고 정책 — Sprint 4 이후 검토

현재 설계는 "1 발주 = 1 입고서" 단순 케이스 기준. N건 분할 입고 요구가 발생하면 별도 결정으로 확장.

#### P9 재정정 — 발주 확정 = 거래 단가 확정

- 단가 마스터 갱신은 `DRAFT → SUBMITTED` 시점에만.
- 입고 확정 시점 마스터 갱신 **일절 없음**.
- `InventoryLot.unitPrice = PurchaseOrderItem.unitPrice` (PO 단가가 정본).
- 입고 실 단가 차이는 `ReceivingDiscrepancy(UNIT_PRICE_DIFF)` 스냅샷만.
- 사유: 마스터를 갱신하면 동일 공급품의 다른 진행 중 PO 에 파급되어 "거래 단가 확정" 원칙이 깨진다.

#### 불일치 추적 도메인 분리

| 도메인 | 시점 | 기록 모델 | 트랜잭션 영향 |
|---|---|---|---|
| 발주↔입고 | 입고 확정 (동시에 PO 종결) | `ReceivingDiscrepancy` (D30) | 없음 |
| 이론재고↔실재고 | 재고 실사 완료 | `StockTake / StockTakeItem` (Sprint 4) | `InventoryTransaction(type=ADJUSTMENT)` |

두 도메인은 서로의 트리거가 되지 않는다.

#### 계층 분리 원칙 명시 (2026-07-08)

`Company → Location(FACTORY/WAREHOUSE/HYBRID) → ProductionLine` 3계층. 스키마 실측: `LocationType` enum, `ProductionLine.locationId` NOT NULL, `PurchaseOrder.locationId` NOT NULL / `productionLineId` nullable. 상세는 PROGRESS.md 헌법 보강 참조.

---

### 2.7. 입고 도메인 결정 (D30 시리즈)

#### D30 C-1 — 스키마 (커밋 `67a60e34`)

**신규 enum `DiscrepancyType`**

- `QUANTITY_SHORT` — 입고량 < 발주량
- `QUANTITY_OVER` — 입고량 > 발주량
- `UNIT_PRICE_DIFF` — 입고 단가 ≠ 발주 단가 (P9: SupplierItem 마스터 무영향)
- `ITEM_MISSING` — 발주 품목이 입고서에 누락

**신규 모델 `ReceivingDiscrepancy` 스키마 실측**

PK / FK:

- `id` (PK)
- `companyId`, `purchaseOrderId`, `purchaseOrderItemId?`
- `receivingNoteId`, `receivingNoteItemId?`

값 필드:

- `type: DiscrepancyType`
- `expectedQty?`, `actualQty?`
- `expectedUnitPrice?`, `actualUnitPrice?`
- `diffValue?`, `reason?`

메타:

- `recordedAt` (default now), `recordedByUserId?`

인덱스: `(companyId, recordedAt)`, `purchaseOrderId`, `receivingNoteId`, `type`.

**`ReceivingNote` 확장**

- `confirmedAt DateTime?`
- `confirmedByUserId String?` (FK → User, ON DELETE SET NULL)
- `@@index([confirmedByUserId])`

**마이그레이션**

`phase_3_d30_receiving_discrepancy_and_confirmed_meta`.

#### D30 C-2 — `confirmReceivingNote` 서비스 (커밋 `35773f1b`, `6492400684`, `4da325a570`, `f8764185`, `f8ce0592`)

서비스 시그니처:

- 입력: `{ receivingNoteId, companyId, confirmedByUserId, discrepancyReasons?, discrepancyReason? }`
- `existingTx?: PrismaTransactionClient` 파라미터로 외부 트랜잭션 join 지원 (§2.8 참조).
- 출력: `{ receivingNote, createdLots, transitions, discrepancies }`

원자적 트랜잭션 내 순서:

1. `ReceivingNote` 상태 CONFIRMED 로 전이. 이미 CONFIRMED 면 `ALREADY_CONFIRMED` throw.
2. 각 `ReceivingNoteItem` 마다 `InventoryLot` + `InventoryTransaction(PURCHASE)` 생성.
3. PO 원본과 비교하여 4가지 불일치 감지 → `ReceivingDiscrepancy` 스냅샷.
4. 관련 `PurchaseOrder.status → RECEIVED` 자동 전이 (`transitionPurchaseOrderStatus(existingTx=tx)`).

오류 코드:

- `ALREADY_CONFIRMED`
- `RECEIVING_NOTE_NOT_FOUND`
- `COMPANY_MISMATCH`
- `UnsupportedSubsidiaryReceivingError` (아래 제약 참조)

**스키마 제약 (Sprint 4 Phase S4-0-a 에서 해소 예정)**

`InventoryTransaction.materialMasterId` NOT NULL, `subsidiaryMasterId` 컬럼 없음. → SUBSIDIARY 입고는 Sprint 4 Phase S4-0-a (재고 부자재 지원) 스키마 보강 후 지원. Sprint 3 에서는 `confirmReceivingNote` 가 `UnsupportedSubsidiaryReceivingError` throw.

#### D30 C-3-b1 / c — 입고서 CRUD (커밋 `d96ad317`, `70cb64f5` hotfix)

서비스 3종:

- `createReceivingNoteDraft(input)` — DRAFT 로 생성. `receiveNumber` 자동 채번.
- `updateReceivingNoteDraft(id, input)` — DRAFT 상태에서만. CONFIRMED 는 편집 차단.
- `deleteReceivingNoteDraft(id)` — DRAFT 상태에서만. FK 위반 hotfix (`70cb64f5`) — `receiving_note_items` 명시 삭제 후 `receiving_notes` 삭제 (cascade 미설정 스키마 보호).

UI 라우트:

- `/receiving/notes`
- `/receiving/notes/new`
- `/receiving/notes/[id]`
- `/receiving/notes/[id]/edit`

#### D30 C-3-d1 / d2 — 회사 전사 불일치 이력 페이지 (커밋 `20c7f75b`)

- `/receiving/discrepancies` 라우트 + `ReceivingDiscrepancyList` (월 / 타입 / 검색 필터 + 페이지네이션).
- `getReceivingDiscrepancies` 서비스 — 배치 조회, 관계 격리 정책 §7 준수.
- `getReceivingNotes` 반환에 `totalAmount` 파생 필드 추가.
- 대시보드에 불일치 이력 링크 카드 부착.

#### D30 C-3-d3 — 품목별 사유 개별 입력 (커밋 `85302dc9`)

- `previewReceivingNoteDiscrepancies(receivingNoteId)` — 확정 전 DB 무영향 사전 계산. 불일치 예정 목록 반환.
- `resolveReason(key, autoReason)` 우선순위: **품목별 사유 > 통일 사유 > 자동 생성 사유**.
- `buildDiscrepancyKey(type, poItemId, rItemId)` — UI/서비스 간 안정 키 규약. 문자열 조합: `${type}:${poItemId ?? ''}:${rItemId ?? ''}`.
- `ConfirmReceivingNoteDialog` 재작성 — 다이얼로그로 전환, 열림 시 preview 로드, 불일치 0/N건 분기, 통일 모드 토글, 항목별 Textarea (autoReason placeholder).
- 테스트: `preview-receiving-discrepancies.action.test.ts` 6건 + 확정 액션 사유 전달 1건 (총 39건 PASS).

#### D30-Ex1 (α) — 일자별 입고 통합 뷰

커밋 계열:

- 구현: `a44e6cc2`, `1d3a69cd`, `54cb734`, `132d1f4`, `0b4e1c2`
- 테스트: `2c4a9cd`

라우트: `/receiving/daily?date=YYYY-MM-DD&mode=outbound|expected`.

**`daily-receiving.service.ts` 4개 함수 시그니처**

`getDailyReceivingBundle`:

- 입력: `companyId`, `date`, `mode: 'outbound' | 'expected'`
- 출력: `{ pendingPOs, completedNotes, existingDrafts }`

`bulkCreateOrUpdateReceivingNoteDrafts`:

- 입력: `{ companyId, date, drafts: [{ purchaseOrderId, items }] }`
- 출력: `ReceivingNote[]`

`previewBulkConfirmReceivingNotes`:

- 입력: `{ companyId, receivingNoteIds }`
- 출력: `{ perNote: [{ receivingNoteId, discrepancies }] }` — DB 무영향.

`bulkConfirmReceivingNotes`:

- 입력: `{ companyId, confirmedByUserId, receivingNoteIds, discrepancyReasonsPerNote? }`
- 출력: `{ confirmed: ReceivingNote[] }` — all-or-nothing. 실패 시 `BulkConfirmExecutionError` throw.

**mode 정의**

- `outbound` (기본): 선택 날짜 = `outboundDate`. `[selectedDate, selectedDate + MAX_LEAD_TIME_DAYS_WINDOW]` 창 안의 PO 중 outboundDate 일치.
- `expected`: 선택 날짜에 도착 예정 품목이 하나라도 있는 PO 만 표시. `itemExpectedReceiveDate = outboundDate − leadTimeDays` 로 판정. `MAX_LEAD_TIME_DAYS_WINDOW = 30`.

**UI**

- `daily-receiving-header.tsx` — 날짜 이동, mode 토글, pending/completed 카운트, 모드별 설명 문구.
- `daily-receiving-pending-table.tsx` — 미완료 PO 목록 + 일괄 draft 생성/확정 액션.
- 대시보드 링크.

**테스트** (`daily-receiving.service.test.ts` 8건)

outbound/expected 필터, 리드타임 기본값, null 안전성, completed 매칭, 다중 아이템 부분 매칭, existingDraft 매핑.

---

### 2.8. `existingTx` 파라미터 패턴 (D31 · 재사용 규약)

Phase 4-G G-1 도입 이후 Sprint 4+ 에서 재사용될 텍스처 코드 규약으로 승격.

**시그니처 규약**

- 서비스는 `existingTx?: PrismaTransactionClient` 를 선택적으로 받는다.
- 내부에서 `const runner = existingTx ?? prisma` 로 시작.
- 서비스 내부에서 `prisma.$transaction` 을 새로 열지 않는다.
- 트랜잭션 커밋 책임은 최상위 호출자에게 있다.

**적용 원칙**

1. 외부 호출자가 이미 `prisma.$transaction` 안에 있으면 `existingTx` 로 handoff.
2. 서비스 내부에서 `prisma.$transaction` 중첩 호출 금지 — 커넥션 풀 이중 점유 방지 (Infra hotfix EMAXCONNSESSION 의 근본 대응).
3. 반환 후 커밋은 외부 호출자 책임.

**Sprint 3 적용 완료 서비스**

- `transitionPurchaseOrderStatus` — Phase 4-F-1 준비, 커밋 `f8ce0592`
- `generateMaterialRequirements` — Phase 4-G G-1, 커밋 `0f051a30`
- `confirmReceivingNote` — D30 C-2

**Sprint 4+ 적용 예정**

- Consumption 서비스, StockTake 서비스, InventoryTransfer 서비스.

---

### 2.9. Phase 4-G G-1 ~ G-4 (2026-07-07)

#### G-1 — 식단 전진 전이 시 MR 자동 산출 (커밋 `0f051a30`, `6d583486`, `e68bbbbc`)

- `updateMealPlanGroup` 의 `CONFIRMED → IN_PROGRESS` / `IN_PROGRESS → COMPLETED` 전진 전이 훅에서 `generateMaterialRequirements(companyId, { mealPlanGroupId, countSource })` 를 **동일 트랜잭션 내** 자동 호출.
- `IN_PROGRESS` 전이 → `countSource: ESTIMATED` (MealCount.estimatedCount + MealPlanSlot.estimatedQuantity 기반).
- `COMPLETED` 전이 → `countSource: FINAL` (MealCount.finalCount + MealPlanSlot.finalQuantity 기반).
- 실패 시 상태 전이도 함께 롤백 (부분 상태 방지).
- 역행 전이 시 재산출 트리거 두지 않음 — 다시 전진 시 자연 재산출 (5컬럼 unique 로 UPSERT).
- `unmapped` 판정은 위저드 Step 2 (`buildPOItemsFromMR`) 책임 유지 (경계 명확화).
- 테스트: `meal-plan.service.test.ts` +6건, `material-requirement.service.test.ts` +2건 = 8건 신규.

#### G-2 — 위저드 진입 가드 (커밋 `82baf37b`)

- `getMealPlanGroupsForOrderAction` 응답에 `materialRequirementCount` (active MR only, `deletedAt IS NULL`) 추가.
- `loadPOWizardDataAction` 사전 검증에서 MR=0 그룹은 `MR_NOT_GENERATED` throw.
- UI (`step-meal-plan-group-select.tsx`) — "자재 산출" 컬럼 신설. count=0 행은 disabled + "미산출" 배지 + 툴팁.
- 정책: 정상 흐름에서 G-1 훅이 원자적으로 생성하므로 미산출 그룹은 발생하지 않지만, 레거시/DB 직접 조작 대비 이중 방어.

#### G-3 — 자재 소요량 페이지 read-only 대시보드화 (커밋 `f768c902`)

- `material-requirement-detail.tsx` — "예상수량으로 산출" / "확정수량으로 산출" 버튼 2개 제거, 자동 산출 안내 배너 추가.
- `material-requirement-result-panel.tsx` — 빈 상태 문구를 자동 산출 안내로 교체.
- `material-requirement-group-list.tsx` — 컬럼 라벨 "소요량 산출" → "결과 보기", Calculator 아이콘 → Eye 아이콘.
- `generateMaterialRequirementsAction` 서버 액션은 유지 (외부 트리거 부재, Phase 5 재검토 대상).

#### G-4 — 식단 상태 라벨/색상 정합화 (커밋 `575a17c5`)

- SSOT 지정: `src/features/meal-plan/constants/status-label.ts`.
- 로컬 상수 3개소 제거 (`material-requirement-group-list.tsx`, `step-meal-plan-group-select.tsx` 2건).
- CONFIRMED 라벨: "확정" → "준비중" 자동 정합 (Phase 9-D-Sym 2026-06-11 결정 존중).
- STATUS_COLOR UX 재배정 (사용자 경험 정합성 우선):
  - `DRAFT → gray`
  - `CONFIRMED → blue`
  - `IN_PROGRESS → amber` (green → 변경, 진행 = 주의 색)
  - `COMPLETED → green` (purple → 변경, 완료 = 초록 표준)
  - `CANCELLED → red`
- enum / DB / 마이그레이션 무변경.

---

### 2.10. Phase 4-F-1 — 발주 일괄 상태 전이 (2026-06-30)

커밋: `82279c17` (feat) → `645890cd` (P5 정합 범위 축소) → `81ac3807`, `f18c481b` (헌법 정합).

**`bulkTransitionPOStatusAction`**

- 입력: `{ purchaseOrderIds, toStatus, reason? }`
- 트랜잭션 내에서 단건 `transitionPurchaseOrderStatus` 를 순차 호출.
- 실패 케이스 분류: `INVALID_TRANSITION`, `NOT_FOUND`, `SKIP` (이미 그 상태).
- 부분 실패 시 전체 롤백.
- 성공 건별 감사 로그 적층.

**입력 스키마**

`bulkTransitionInputSchema.toStatus` 화이트리스트: SUBMITTED, CANCELLED. RECEIVED / APPROVED 는 ZodError 로 거부.

**UI**

발주 목록에 체크박스 컬럼 + `BulkActionBar` ("선택 발주 확정" / "선택 취소").

**"선택 입고 완료" 는 제거**

P5 재정정으로 제거 — RECEIVED 는 ReceivingNote confirm 단일 트랜잭션 내 자동 전이로만 도달.

**APPROVED 미노출**

결재 미도입 상태에서 APPROVED 액션 미노출.

**단가 이력 P9' 보존**

단건 위임으로 자동 보존.

---

### 2.11. Infra hotfix — EMAXCONNSESSION (2026-07-07, 커밋 `2091092b`)

**증상**

식단 그룹 생성 후 상세 진입 시:

- `prisma:error (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15`

**원인**

Prisma 7 + `@prisma/adapter-pg` + `pg.Pool` 기본 max (10) + Next.js HMR 로 인한 pool 재생성 누적 → Supabase Supavisor session-mode 15 슬롯 초과.

**조치 (`src/lib/prisma.ts`)**

- `pg.Pool` 옵션 명시:
  - `max: prod 10 / dev 5`
  - `idleTimeoutMillis: 10_000`
  - `connectionTimeoutMillis: 5_000`
  - `allowExitOnIdle: !prod`
- PrismaClient `log` 에서 `"query"` 제거 (dev 노이즈 감소).
- `globalForPrisma` 로 pool/prisma 재사용 (HMR 안전).
- Soft-delete extension `createValue` 삼항식 간소화.

**`.env` 분리**

- `DATABASE_URL` — `pooler.supabase.com:6543?pgbouncer=true` (앱 런타임).
- `DIRECT_URL` — `:5432` (CLI / 마이그레이션).

**Prisma 설정**

- `prisma.config.ts` 의 `datasource.url` 은 `DIRECT_URL`.
- `schema.prisma` 의 `datasource db` 는 `provider = "postgresql"` 단일 라인 유지 (P1012 회피).

**결과**

신규 식단 생성 · 상세 조회 · IN_PROGRESS 전이 정상 확인.

> **교훈**: 커넥션 풀 튜닝은 배포 인프라 (Supavisor session / transaction 모드, 슬롯 제한) 특성을 파악한 뒤 결정한다. Sprint 4 이후 트랜잭션이 길어지는 도메인 (Consumption FEFO, StockTake 대량 조정) 진입 전 반드시 pool max 를 재검토한다. `existingTx` 패턴 (§2.8) 이 이 문제의 근본적 대응책이다.

---

## 3. Phase 이력 요약표

| Phase | 내용 | 상태 | 대표 커밋 |
|---|---|---|---|
| 0-A | 구 4-B 폼 파일 제거 | ✅ | `98c4cdb1` |
| 0-B | SupplierItem 타입 정합 | ✅ | `b4c9143a` |
| 1.5 | PO location/productionLine 추가 | ✅ | `58da2a1e`, `f1db9d25` |
| 1.6 | deliveryDate → outboundDate (D9·D15) | ✅ | `75f07d6` |
| 4-B'-1 | 단위 환산 라이브러리 (D3) | ✅ | `b6ec1240` |
| 4-B'-2 | MR→PO candidate 헬퍼 | ✅ | `af333130` |
| 4-B'-3 | 배치 PO 생성 서비스 (D5) | ✅ | `ff6b5071` |
| 4-B'-4 | SUBMITTED 가격 이력 적층 (D4) | ✅ | `5232ec46` |
| 4-B'-5a | 위저드 액션 3종 (thin wrapper) | ✅ | `cff165e4` |
| 4-B'-5b~5c | 위저드 UI Steps 3~5 | ✅ | `655da305` |
| 4-C / 4-C2 pre | PO 상세 + MR.lineupId 신설 | ✅ | `318d602`, `cc086e25`, `61e8da48`, `b9d043c1`, `9ea97f88` |
| 4-C2 UI | Step 4 라인업 다축 뷰 (D29) | ✅ | `bf103b1a` |
| R1-a | 4분류 매핑 (mapped/partial/full/unmapped) | ✅ | `5afb0113` |
| R1-b1 | 멱등성 + 모드 선택 UI + Batch 스키마 | ✅ | `a32e255` |
| R1-b3 | DELTA 모드 완전 구현 | ✅ | `a32e255`, `a952a95`, `ee1f47b`, `32544bb`, `f65c582` |
| R1-b4 | REPLACE 모드 + 테스트 | ✅ | `6dbbfb3`, `f385f43` |
| R1-c | Picker portal + 단위환산 인라인 다이얼로그 | ✅ | `07b7181` |
| D25-1~D25-4 | 프리뷰 정합성 → NewModePreview 단일화 → StepSplitPreview 삭제 | ✅ | `a77129`, `dafb5785` |
| Sidebar hotfix | 발주 메뉴 href | ✅ | `b3c787c` |
| PO 라이프사이클 재정의 | POStatus 라벨·전이·RECEIVED 트리거 통합 | ✅ | `14b2d20c`, `13b1d5f8` |
| D30 C-1/C-2 | ReceivingDiscrepancy + confirm 단일 트랜잭션 | ✅ | `67a60e34`, `35773f1b`, `f8ce0592` |
| D30 C-3-b1/c | 입고서 CRUD | ✅ | `d96ad317`, `70cb64f5` |
| D30 C-3-d1/d2 | 불일치 이력 페이지 | ✅ | `20c7f75b` |
| D30 C-3-d3 | 품목별 사유 입력 | ✅ | `85302dc9` |
| D30-Ex1 (α) | 일자별 입고 통합 뷰 | ✅ | `a44e6cc2`, `1d3a69cd`, `54cb734`, `132d1f4`, `0b4e1c2`, `2c4a9cd` |
| 4-F-1 | 발주 일괄 상태 전이 | ✅ | `82279c17`, `645890cd`, `81ac3807`, `f18c481b` |
| 4-G G-1 | MR 자동 산출 훅 + existingTx 패턴 | ✅ | `0f051a30`, `6d583486`, `e68bbbbc` |
| 4-G G-2 | 위저드 진입 가드 | ✅ | `82baf37b` |
| 4-G G-3 | 자재 소요량 read-only 대시보드화 | ✅ | `f768c902` |
| 4-G G-4 | 상태 라벨/색상 정합화 | ✅ | `575a17c5` |
| Infra hotfix | EMAXCONNSESSION | ✅ | `2091092b` |

---

## 4. 이 Sprint 에서 남긴 파일

### 4.1. 서비스 · 액션 · 라이브러리

발주 도메인:

- `src/features/purchase-order/services/purchase-order.service.ts` (확장 + `existingTx` 지원)
- `src/features/purchase-order/services/purchase-order-batch.service.ts` (createPurchaseOrdersBatch, executeNewMode / DeltaMode / ReplaceMode)
- `src/features/purchase-order/services/po-delta.service.ts` (순수 함수)
- `src/features/purchase-order/lib/calculate-order-quantity.ts` (D3)
- `src/features/purchase-order/lib/build-po-items-from-mr.ts` (D25-1)
- `src/features/purchase-order/lib/format-lead-time.ts` (D15-3, 5개 지점 정정 후 SSOT)
- `src/features/purchase-order/actions/purchase-order.action.ts`
- `src/features/purchase-order/actions/bulk-transition-po-status.action.ts` (4-F-1)
- `src/features/purchase-order/actions/lineup-breakdown.action.ts` (D29)
- `src/features/purchase-order/actions/preview-delta-plan.action.ts`

입고 도메인:

- `src/features/receiving/services/receiving-note.service.ts` (createDraft / updateDraft / deleteDraft / confirm)
- `src/features/receiving/services/daily-receiving.service.ts` (4개 함수, §2.7 D30-Ex1)
- `src/features/receiving/actions/preview-receiving-discrepancies.action.ts`
- `src/features/receiving/actions/confirm-receiving-note.action.ts`
- `src/features/receiving/actions/get-receiving-discrepancies.action.ts`

식단·자재 소요량 (G-1 관련):

- `src/features/material-requirement/services/material-requirement.service.ts` (`existingTx` 지원)
- `src/features/meal-plan/services/meal-plan.service.ts` (G-1 훅)
- `src/features/meal-plan/constants/status-label.ts` (G-4 SSOT)

인프라:

- `src/lib/prisma.ts` (Infra hotfix)

### 4.2. UI 라우트

- `/purchase-orders` — 목록 + BulkActionBar (4-F-1)
- `/purchase-orders/new` — 위저드 (5 스텝, 3 모드)
- `/purchase-orders/[id]` — 상세 + 상태 전이 다이얼로그
- `/receiving/notes`
- `/receiving/notes/new`
- `/receiving/notes/[id]`
- `/receiving/notes/[id]/edit`
- `/receiving/daily?date=&mode=` — 일자별 통합 뷰 (Ex1)
- `/receiving/discrepancies` — 회사 전사 불일치 이력 (C-3-d1/d2)

### 4.3. 마이그레이션 (Sprint 3 기간 신규)

정확한 목록은 아래 명령으로 재확인:

- `ls prisma/migrations/ | grep -E "^2026(06|07)"`

Sprint 3 기간 대표 마이그레이션:

- `20260615114719_sprint3_phase1_5_po_location_rollup`
- `20260629024328_phase_4_c2_pre_mr_lineup_id`
- `phase_3_d30_receiving_discrepancy_and_confirmed_meta`
- (Phase 1.6 outboundDate 리네이밍, R1-b1 PurchaseOrderBatch + POAdjustmentLog 관련 폴더명 실측 후 여기에 기입)

---

## 5. 회고 / 학습 사항

**1. 도메인 이벤트 = 트랜잭션 경계**

P5 를 "입고 확정 ↔ 발주 종결" 두 이벤트로 분리했다가 다시 하나로 통합한 과정에서, 사용자 의사결정 하나에 여러 액션을 요구하는 UX / 도메인 모델은 오작동을 유발함을 확인. Sprint 4 이후에도 도메인 이벤트 단위로 트랜잭션을 묶는 원칙 유지.

**2. 마스터 데이터 갱신 시점의 신중함**

입고 시점 단가 갱신 유혹이 강했으나, 다른 진행 중 PO 에 파급되어 "거래 단가 확정" 원칙이 깨짐을 인지하고 P9 로 명문화. Sprint 4 이후 다른 마스터 (BOM, Recipe, 라인업 등) 갱신 정책 정의 시 동일 원칙 적용.

**3. 커넥션 풀은 배포 인프라의 제약과 함께 튜닝**

Supabase Supavisor session-mode 15 슬롯 제약을 로컬 개발에서 인지하지 못해 HMR 누적으로 터짐. Sprint 4 이후 대규모 트랜잭션 도입 전 pool 튜닝 우선. `existingTx` 패턴 (§2.8) 이 이 문제의 근본 대응.

**4. 레거시 컴포넌트는 2단계로 삭제**

D25-3 (사용처 제거) → D25-4 (파일 삭제). `deprecated` 주석만 남기면 재유입. Sprint 4 이후 동일 원칙.

**5. 파생값은 단일 유틸에 격리**

리드타임 부호 회귀 (D15-5) 는 5군데에 흩어져 있어 감지가 늦었다. 파생값 = 순수 함수 격리 + 다른 위치는 import 만.

**6. read-only 대시보드화 원칙**

자동화된 도메인 이벤트가 있는 화면 (4-G G-3) 은 수동 트리거 버튼을 제거하고 read-only 로. 사용자가 "언제 수동으로 눌러야 하는가"를 판단할 필요가 없어야 함.

**7. `existingTx` 파라미터를 D 결정으로 승격**

Sprint 3 후반부에 재사용성 인지. Sprint 4+ 서비스 시그니처의 표준 패턴으로 채택.

---

## 6. Sprint 4 인수 인계

### 6.1. 스코프 매핑 (스키마 실측 기준)

Sprint 4 는 재고·출고·소비·조리계획·실사 5개 축을 다룬다. 스키마 실측:

| 도메인 | 담당 모델 | 상태 |
|---|---|---|
| 재고 조회 | `InventoryLot` (`itemType: MATERIAL/SUBSIDIARY`), `InventoryTransaction` (⚠️ `materialMasterId` NOT NULL) | 스키마 정의됨, 서비스/UI 미착수 |
| 재고 이동 | `InventoryTransfer` (`TransferType: PUSH/PULL`, `TransferStatus: REQUESTED/DRAFT/CONFIRMED/RECEIVED/CANCELLED`), `InventoryTransferItem` | 스키마 정의됨, 서비스/UI 미착수 |
| 재고 실사 | `StockTake` (`StockTakeStatus: DRAFT/IN_PROGRESS/PENDING_REVIEW/COMPLETED`), `StockTakeItem` (systemQty / actualQty / difference) | 스키마 정의됨, 서비스/UI 미착수 |
| 출하 | `ShippingOrder` (`ShippingStatus: PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED`), `ShippingOrderItem` (MATERIAL/SUBSIDIARY 모두 지원) | 스키마 정의됨, 서비스/UI 미착수 |
| 사용/소비/폐기 | `ConsumptionItem` (`ConsumptionStatus: DRAFT/CONFIRMED`, `ConsumptionDisposition: USED/RETURNED/DISPOSED`, `DisposalReason: EXPIRED/DAMAGED/CONTAMINATED/OVER_PREPARED/OTHER`), `ConsumptionLotDetail` (Lot 분할) | 스키마 정의됨, 서비스/UI 미착수 |
| 조리 계획 | `CookingPlan` (`CookingPlanStatus: DRAFT/CONFIRMED/COMPLETED/REPLACED`) + `CookingPlanItem` + `CookingPlanSlot` (`bomSnapshotJson`) | 스키마 정의됨, 서비스/UI 미착수 |
| 예약 (보류) | `InventoryReservation` (`ReservationReleaseReason: CONSUMED/AUTO_EXPIRED/MANUAL_CANCEL`) | 스키마 정의됨, P5 재정정으로 도입 시점 미정 |

### 6.2. Sprint 4 진입 전 필수 스키마 보강 (Phase S4-0)

**⚠️ CRITICAL — Consumption 부자재 지원 및 InventoryTransaction 확장**

현재 `InventoryTransaction.materialMasterId` NOT NULL. Sprint 4 에서 다음 결정 필요:

- 안 (a) — `InventoryTransaction.materialMasterId` 를 nullable 로 완화 + `subsidiaryMasterId` 컬럼 추가.
- 안 (b) — 부자재 트랜잭션 전용 별도 모델 신설.

스키마 주석에는 (a) 방향이 이미 예고됨 (`ConsumptionItem.itemType` = MATERIAL/SUBSIDIARY 및 `subsidiaryMasterId` 이미 있음). 이 스키마 보강이 있어야 `confirmReceivingNote` 의 `UnsupportedSubsidiaryReceivingError` 해소 가능.

### 6.3. 미해결 이슈 / 보류 항목

| 항목 | 상태 | 근거 |
|---|---|---|
| `InventoryReservation` 서비스/UI | 보류 | P5 재정정 시 예약 개념을 Lot 직접 생성으로 단순화. Sprint 4 Phase S4-0-b 진입 시 재검토 |
| `generateMaterialRequirementsAction` 서버 액션 | 유지 (외부 트리거 없음) | Phase 5 재검토 |
| 분할 입고 (1 PO = N 입고) | 미도입 | Sprint 4 이후 별도 결정. 현재 1:1 가정 |
| APPROVED 결재 상태 | 미사용 (enum·매트릭스 보존) | 결재 도입 시 활성화 |
| 수동 발주 (Phase 4-D) | 미도입 (D2) | Sprint 4~5 사이 재검토 |
| 라인업 breakdown UI | `getLineupBreakdownAction` 만 존재, UI 미부착 | Sprint 5 원가 대시보드에서 조합 |
| SUBSIDIARY 입고 | `UnsupportedSubsidiaryReceivingError` throw | Sprint 4 Phase S4-0-a 스키마 보강 후 |

### 6.4. Sprint 4 착수 전 헌법 재확인

- **P3** — 재고는 Location 에만. `InventoryLot.locationId` NOT NULL 로 강제.
- **P4** — 사용은 공장에서만, ProductionLine 단위 추적. `CookingPlan.productionLineId` NOT NULL. `ConsumptionItem` 은 `cookingPlanId` 로 라인 추적.
- **P7** — 하이브리드 원가. `ConsumptionItem` + `ConsumptionLotDetail.unitPrice` 가 실시간 원가의 raw data.
- **P8** — 실제 사용일 = `outboundDate` (PO) / `consumedDate` (ConsumptionItem) / `shippingDate` (ShippingOrder). 회계 키는 별도 (`MonthEndSnapshot.closingMonth`).

---

## 사후 추가

Sprint 3 종결 이후 발견된 회귀·정정 사항을 append.

### 2026-07-15 — Shipping 도메인 폐지 (S4-3-INT)

Sprint 3 아카이브 시점(라인 755-770) 표에 포함된 `ShippingOrder` / `ShippingOrderItem` 도메인은 Sprint 4 S4-3-INT 에서 폐지됐다. 상세는 `PROGRESS.md` P13 보강 "출고(Shipping) 도메인 폐지 및 Consumption 흡수" 및 커밋 `c2dd65f` 참조. Sprint 3 원문은 시점 기록으로서 그대로 보존한다.