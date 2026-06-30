# Prisma 스키마 모델 커버리지 (68모델 + UnitMaster)

> 아래 표는 schema.prisma v5의 모델이 어느 Sprint의 어느 Phase에서 구현되는지를 추적한다.
> 기존 Sprint 계획과 Phase 매핑은 삭제하지 않는다.
> MealPlanGroup / MealPlan / MealPlanSlot은 기본 구현 완료 상태를 유지하되, Sprint 2 내부 구조 재정의 보강 작업 대상임을 함께 표시한다.
> Phase 8.5 (Location / ProductionLine 마스터)가 Sprint 2 라운드 안에서 완료되어 해당 행은 ✅로 갱신함. Sprint 6 본 Phase는 조직 단위 통합 시점에 재점검 예정.
> 마지막 갱신: 2026-06-29 (Phase 4-C2 UI 완료 — Step 4 다축 집계 뷰)

| # | 모델 | Sprint | Phase | 상태 |
|---|------|--------|-------|------|
| 1 | Company | S6 | P1 | ⬜ |
| 2 | Location | S2 / S6 | P8.5-A·B / P3 | ✅ (Phase 8.5-A 스키마 + 8.5-B 마스터 UI 완료, Sprint 6 P3는 통합 시점 재점검) |
| 3 | ProductionLine | S2 / S6 | P8.5-A·C / P4 | ✅ (Phase 8.5-A 스키마 + 8.5-C 마스터 UI 완료, Sprint 6 P4는 통합 시점 재점검) |
| 4 | User | S7 | P1-2 | ⬜ |
| 5 | UserScope | S7 | P1-2 | ⬜ |
| 6 | PermissionSet | S7 | P3-4 | ⬜ |
| 7 | PermissionSetItem | S7 | P3-4 | ⬜ |
| 8 | Invitation | S7 | P5-6 | ⬜ |
| 9 | MaterialMaster | 구현완료 | — | ✅ |
| 10 | SubsidiaryMaster | 구현완료 | — | ✅ |
| 11 | Supplier | 구현완료 | — | ✅ |
| 12 | SupplierItem | 구현완료 | — | ✅ |
| 13 | SupplierItemPriceHistory | 구현완료 | — | ✅ |
| 14 | ~~ContainerGroup~~ | 구현완료 | — | ✅ (v5: SubsidiaryMaster에 흡수, 모델 삭제) |
| 15 | ContainerSlot | 구현완료 | — | ✅ |
| 16 | ~~ContainerAccessory~~ | 구현완료 | — | ✅ (v5: MealTemplateAccessory로 대체, 모델 삭제) |
| 17 | Recipe | 구현완료 | — | ✅ |
| 18 | RecipeIngredient | 구현완료 | — | ✅ |
| 19 | RecipeBOM | 구현완료 | — | ✅ |
| 20 | RecipeBOMSlot | 구현완료 | — | ✅ |
| 21 | RecipeBOMSlotItem | 구현완료 | — | ✅ |
| 22 | SemiProduct | 구현완료 | — | ✅ |
| 23 | BOM | 구현완료 | — | ✅ |
| 24 | BOMItem | 구현완료 | — | ✅ |
| 25 | UnitConversion | 구현완료 | — | ✅ |
| 26 | UnitMaster | 구현완료 | S1-P3 | ✅ |
| 27 | MealTemplate | S2 | P1-2 | ✅ |
| 28 | MealTemplateContainer | S2 | P1-2 | ✅ (v5: MealTemplateSlot 폐지) |
| 29 | MealTemplateAccessory | S2 | P1-2 | ✅ |
| 30 | MealPlanGroup | S2 | P3-4 / 5-R | ✅ (Phase 5-R 완료: 날짜 그룹 단순화) |
| 31 | MealPlan | S2 | P3-4 / 5-R | ✅ (Phase 5-R 완료: 식사타입 × lineup, companyMealSlotId 단일 키) |
| 32 | MealPlanSlot | S2 | P3-4 / 5-R / 7-A~F / 9-D-Sym | ✅ schema·service·action·UI 완료 (Phase 7-F까지: 슬롯 에디터 + BOM 적격 가드 + 적격 레시피 필터 + 서비스 테스트 Step 8-A) + Phase 9-D-Sym 컬럼 분리 (estimated_quantity / final_quantity) |
| 33 | MealCount | S2 | P8 / 5-R | ✅ schema·service·action·UI 완료 (Step 6-3c-A2, MealPlan 1:1) |
| 34 | MealPlanAccessory | S2 | P7-B2 / P8 | ✅ schema·service·action·UI 완료 (Phase 7-B2) + 테스트 (Step 8-A) |
| 35 | Lineup | S6 | P5 | ⬜ |
| 36 | LineupLocationMap | S6 | P5 | ⬜ |
| 37 | AutoGenLog | S8 | P7 | ⬜ |
| 38 | MaterialRequirement | S2 / S3 | P9 / P4-C2-pre | ✅ (Phase 9-A~D + Phase 4-C2 pre 완료: lineupId 추가, 5컬럼 unique, getLineupBreakdown 액션. GAP-1 종결) |
| 39 | PurchaseOrder | S3 | P1-4 / P1.5 / P4-B' | 🔄 (Phase 1.5 에서 locationId NOT NULL + productionLineId 추가, Phase 4-B' 위저드 백엔드 4단계 + 위저드 액션 완료) |
| 40 | PurchaseOrderItem | S3 | P1-4 / P4-B' | 🔄 (Phase 4-B' 배치 생성 서비스 + PriceHistory 적층 정책 적용) |
| 41 | ReceivingNote | S3 | P5-8 | ⬜ |
| 42 | ReceivingNoteItem | S3 | P5-8 | ⬜ |
| 43 | InventoryLot | S4 | P1-2 | ⬜ |
| 44 | InventoryTransaction | S4 | P1-2 | ⬜ |
| 45 | InventoryReservation | S4 | P3 | ⬜ |
| 46 | InventoryTransfer | S4 | P4-5 | ⬜ |
| 47 | InventoryTransferItem | S4 | P4-5 | ⬜ |
| 48 | StockTake | S4 | P6-7 | ⬜ |
| 49 | StockTakeItem | S4 | P6-7 | ⬜ |
| 50 | ShippingOrder | S4 | P8-9 | ⬜ |
| 51 | ShippingOrderItem | S4 | P8-9 | ⬜ |
| 52 | ConsumptionItem | S4 | P10-11 | ⬜ |
| 53 | ConsumptionLotDetail | S4 | P10-11 | ⬜ |
| 54 | CookingPlan | S4 | P12-13 | ⬜ |
| 55 | CookingPlanItem | S4 | P12-13 | ⬜ |
| 56 | CookingPlanSlot | S4 | P12-13 | ⬜ |
| 57 | CostSnapshot | S5 | P1-2 | ⬜ |
| 58 | CostSnapshotItem | S5 | P1-2 | ⬜ |
| 59 | CostCalculation | S5 | P3-4 | ⬜ |
| 60 | CostCalculationItem | S5 | P3-4 | ⬜ |
| 61 | OverheadCost | S5 | P5-6 | ⬜ |
| 62 | MonthEndSnapshot | S5 | P7-8 | ⬜ |
| 63 | MonthEndAdjustment | S5 | P7-8 | ⬜ |
| 64 | MonthEndAdjustmentItem | S5 | P7-8 | ⬜ |
| 65 | NotificationTagDef | S5 | P9-10 | ⬜ |
| 66 | NotificationRule | S5 | P9-10 | ⬜ |
| 67 | NotificationTemplate | S5 | P9-10 | ⬜ |
| 68 | NotificationLog | S5 | P9-10 | ⬜ |
| 69 | AuditLog | S8 | P3-4 | ⬜ |

## 변경 이력
- 2026-06-29 **Phase 4-C2 UI 완료 + D25-4 정리**: Step 4 라인업 다축 집계 뷰 (`GroupByTabs`) — 4축 탭(공장/제조라인/공급업체/라인업) + `scopeLevel` prop 체인 + 라인업/기준량(g) 컬럼. `POItemCandidate.lineupId`/`lineupName` 전파, `loadPOWizardDataAction` 에서 MR.lineup include. 쓰기 경로 무수정 (PC2/DC4 보존). D25-4: 레거시 `StepSplitPreview` 삭제 → `NewModePreview` 단일 SSOT. 커밋 `bf103b1a`, `{Stage1_SHA}`. 누적 22/22 PASS. 모델 #38 상태는 변동 없음 (✅ 유지).
- 2026-06-29 **Phase 4-C2 pre (GAP-1 종결)**: `MaterialRequirement.lineupId` 추가 + 5컬럼 unique (`uq_mr_group_line_lineup_material_source`) + 마이그레이션 `20260629024328_phase_4_c2_pre_mr_lineup_id`. 서비스 `makeKey` 3-arg 전환 및 `mealPlan.lineupId` BOM 전파. 신규 read-only 액션 `getLineupBreakdownAction` (라인업 × 자재/공급사/PO 3종 집계). 누적 테스트 +3 (22/22 PASS). 커밋 `318d602`, `cc086e25`, `61e8da48`, `b9d043c1`, `9ea97f88`. 근거: `docs/progress/COST_LINEUP_ALIGNMENT.md` (PC1~5 / DC1~5 / DoD1~7).
- 2026-06-16 Phase 4-B'-5a: 위저드 server actions 3종 추가 (`getMealPlanGroupsForOrderAction`, `loadPOWizardDataAction`, `createPurchaseOrdersBatchAction`) + `loadPOWizardDataSchema`. 커밋 `cff165e4`. 모두 thin wrapper, 테스트 미추가.
- 2026-06-16 **Sprint 3 Phase 4-B' 진행 중** (백엔드 4 단계 완료, 343 PASS / 0 fail)
- Phase 1.5: PurchaseOrder.locationId NOT NULL, productionLineId nullable 추가 (마이그레이션 `20260615114719_sprint3_phase1_5_po_location_rollup`). 커밋 `58da2a1e`, `f1db9d25`.
- Phase 4-B'-1: 단위 환산 라이브러리 `calculateOrderQuantity` (16 tests). 커밋 `b6ec1240`.
- Phase 4-B'-2: MR→PO 변환 헬퍼 `buildPOItemsFromMR` + `InventoryAdapter` placeholder (9 tests). 커밋 `af333130`.
- Phase 4-B'-3: 배치 PO 생성 서비스 `createPurchaseOrdersBatch` (17 tests). 커밋 `ff6b5071`.
- Phase 4-B'-4: DRAFT→SUBMITTED 시 `SupplierItemPriceHistory` 적층 (8 tests + 3 integ). 커밋 `5232ec46`.
- PurchaseOrder / PurchaseOrderItem 행 상태: ⬜ → 🔄 (Sprint 3 Phase 1.5 + 4-B' 진행 중)
- 2026-06-15 Sprint 3 Phase 0-A/B: Phase 4-B (공급사 선두 폼) 폐기, 시그니처 정리.
  PurchaseOrder 확장 예정 (Phase 1.5): `locationId` NOT NULL, `productionLineId` NULL 허용.
  마이그레이션 전략은 dev DB PurchaseOrder 행 수 점검 후 확정 (Phase 0-C).
- 2026-06-11: **Sprint 2 종결.** Phase 9-A/B/C-Fix-R1/D-Sym 완료. MaterialRequirement 모델 신설, MealPlanSlot.quantity → estimatedQuantity + finalQuantity 분리, MealCountSource enum 신설. 누적 신규/확장 모델 12개 안정화. 상세 이력은 `SPRINT2.md` 참조.
- 2026-06-10: MealPlanSlot(#32) Phase 9-D-Sym 컬럼 분리 — `quantity` → `estimated_quantity` 개명 + `final_quantity Int?` 추가. MaterialRequirement(#38) Phase 9-A~9-C 완료 상태 반영.
- 2026-06-05: Location(#2), ProductionLine(#3) ✅ 갱신 (Phase 8.5-A/B/C 반영)
- 2026-06-04 이전: 원본 PROGRESS.md의 모델 표 그대로

## D30 (2026-06-30) — 입고 확정 통합

### 신규
- **enum `DiscrepancyType`**: `QUANTITY_SHORT` / `QUANTITY_OVER` / `UNIT_PRICE_DIFF` / `ITEM_MISSING`
- **model `ReceivingDiscrepancy`**: 발주 ↔ 입고 불일치 스냅샷 (수량·단가 차이를 기록 전용으로 보관, 추후 재고 실사 시 근거 자료)
  - 인덱스: `(companyId, recordedAt)`, `purchaseOrderId`, `receivingNoteId`, `type`

### 변경
- **`ReceivingNote`**: `confirmedAt` (nullable), `confirmedByUserId` (nullable, FK → User, ON DELETE SET NULL) 추가, `confirmedByUserId` 인덱스 추가

### 사용처
- `ReceivingNoteService.confirmReceivingNote` (D30)
- 향후 D39–D41 (재고 실사) 에서 `ReceivingDiscrepancy` 조회

### 정책 연관
- **P5**: 입고 확정 = 재고 생성 + PO 종료 (단일 트랜잭션)
- **P9**: 입고 단계 단가 변경 금지 — `UNIT_PRICE_DIFF`는 스냅샷만, `InventoryLot.unitCost`는 PO 확정 시점 단가 고정
