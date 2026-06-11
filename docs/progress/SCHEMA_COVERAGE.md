# Prisma 스키마 모델 커버리지 (68모델 + UnitMaster)

> 아래 표는 schema.prisma v5의 모델이 어느 Sprint의 어느 Phase에서 구현되는지를 추적한다.
> 기존 Sprint 계획과 Phase 매핑은 삭제하지 않는다.
> MealPlanGroup / MealPlan / MealPlanSlot은 기본 구현 완료 상태를 유지하되, Sprint 2 내부 구조 재정의 보강 작업 대상임을 함께 표시한다.
> Phase 8.5 (Location / ProductionLine 마스터)가 Sprint 2 라운드 안에서 완료되어 해당 행은 ✅로 갱신함. Sprint 6 본 Phase는 조직 단위 통합 시점에 재점검 예정.
> 마지막 갱신: 2026-06-10

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
| 38 | MaterialRequirement | S2 | P9 | ✅ schema·service·action·UI 완료 (Phase 9-A~9-C-Fix-R1 / 9-D-Sym에서 countSource 입력값 대칭화) |
| 39 | PurchaseOrder | S3 | P1-4 | ⬜ |
| 40 | PurchaseOrderItem | S3 | P1-4 | ⬜ |
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
- 2026-06-11: **Sprint 2 종결.** Phase 9-A/B/C-Fix-R1/D-Sym 완료. MaterialRequirement 모델 신설, MealPlanSlot.quantity → estimatedQuantity + finalQuantity 분리, MealCountSource enum 신설. 누적 신규/확장 모델 12개 안정화. 상세 이력은 `SPRINT2.md` 참조.
- 2026-06-10: MealPlanSlot(#32) Phase 9-D-Sym 컬럼 분리 — `quantity` → `estimated_quantity` 개명 + `final_quantity Int?` 추가. MaterialRequirement(#38) Phase 9-A~9-C 완료 상태 반영.
- 2026-06-05: Location(#2), ProductionLine(#3) ✅ 갱신 (Phase 8.5-A/B/C 반영)
- 2026-06-04 이전: 원본 PROGRESS.md의 모델 표 그대로
