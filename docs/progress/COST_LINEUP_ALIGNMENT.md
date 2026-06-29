# 원가 산출 ↔ 라인업 차원 정합성 (Cost-Lineup Alignment)

> 작성일: 2026-06-26
> 단일 진실원천: PROGRESS.md, schema.prisma, 본 문서
> 관련 Phase: Sprint 3 Phase 4-C2 (D29), Phase 4-F (D21-A),
>            Sprint 4 (Consumption/CookingPlan), Sprint 5 (CostSnapshot)

## 1. 배경

원가는 세 가지 경로로 산출되며, 모든 경로에서 **회사 → 공장(Location) →
라인(ProductionLine) 계층**과 **라인업(Lineup) 차원**을 동시에 보존해야 한다.

- ESTIMATED  : MealCount.estimatedCount × BOM (Phase 9-A 완료)
- ORDER_BASED: PurchaseOrderItem 가격 × 수량
- ACTUAL     : ConsumptionLotDetail (FIFO 사용량 × Lot 단가)

또한 월말 회계원가는 두 가지 산출 방식을 라인업별로 제공해야 한다.

- 사용량 기반: 기간 내 FIFO 사용량 × 단가 합계
- 재고 차분  : 기초재고 + 입고 − 기말재고

## 2. 핵심 원칙 (PC: Principle-Cost)

- PC1. 라인업은 MealPlan의 1차 분류이며, 모든 원가 산출 결과는
       라인업별 / 라인별 / 공장별 / 회사별 집계를 동시에 제공해야 한다.
- PC2. PO는 `supplier × location × productionLine` 단위로 발행한다.
       라인업은 PO의 그룹핑 키가 아니라 MaterialRequirement 의 추적 차원이다.
       (Sprint 3 D5 와 일치)
- PC3. 한 PO는 여러 라인업의 수요를 합쳐 발주할 수 있으며, 라인업별 귀속은
       PurchaseOrderItem.materialRequirementId → MaterialRequirement.lineupId
       로 역추적한다.
- PC4. ESTIMATED / ORDER_BASED / ACTUAL 세 원가 모두 lineupId 차원을
       유지해야 한다.
- PC5. 월말 원가는 사용량 기반과 재고 차분 방식을 모두 라인업별로 산출 가능해야 한다.

## 3. 현재 스키마 정합성 점검 (2026-06-26)

### 3.1 위배 없음 (현 설계 그대로 사용)
- Company / Location / ProductionLine / Lineup 계층 구조
- MealPlan.lineupId (필수 FK)
- MealPlanSlot.productionLineId (nullable)
- PurchaseOrder.locationId NOT NULL, productionLineId nullable
- PurchaseOrderItem.materialRequirementId
- InventoryLot.unitPrice, ConsumptionLotDetail.unitPrice (FIFO 가능)
- ShippingOrder.lineupId (필수)
- CostType enum (ESTIMATED / ORDER_BASED / ACTUAL)
- MealCountSource enum (ESTIMATED / FINAL)
- PO 그룹핑 키 (D5 그대로 유지)

### 3.2 위배 — 즉시 조정 (GAP-1)
- MaterialRequirement.lineupId 컬럼 없음
- unique 제약이 [mealPlanGroupId, productionLineId, materialMasterId, countSource]
  로만 구성되어 같은 라인의 다른 라인업이 같은 자재를 쓰면 합산되어
  라인업 출처가 사라진다.
- Phase 4-C2 (D29 라인업 3종 뷰) 와 Phase 4-F (D21-A 다축 PO 목록) 가 차단됨.

### 3.3 사전 결정 — 미구현 영역 (GAP-2, GAP-3)
구현 시점에 1차 마이그레이션에 포함하여 함께 처리한다.

- GAP-2: CookingPlan.mealPlanGroupId / lineupId 없음,
         CookingPlanSlot.mealPlanSlotId 없음
         → Sprint 4 Phase 1 (Consumption/CookingPlan 스키마) 진입 시 함께 추가
- GAP-3: CostSnapshotItem.lineupId / locationId / productionLineId 없음
         → Sprint 5 Phase 1 (CostSnapshot) 진입 시 함께 추가

## 4. 결정 (DC: Decision-Cost)

- DC1. GAP-1 은 Phase 4-C2 (D29) 의 선행 작업으로 즉시 해소한다.
       마이그레이션 명: `phase_4_c2_pre_mr_lineup_id`
- DC2. GAP-2 는 Sprint 4 Phase 1 의 정의에 포함하며, 본 문서에는 결정만 기록한다.
       구현 시점 도래 시 본 문서를 갱신한다.
- DC3. GAP-3 은 Sprint 5 Phase 1 의 정의에 포함하며, 본 문서에는 결정만 기록한다.
       구현 시점 도래 시 본 문서를 갱신한다.
- DC4. PO 그룹핑 키는 변경하지 않는다 (Sprint 3 D5 와 일치).
       MaterialRequirement 가 라인업별로 행이 분리되어도, PO 생성 시에는
       `supplier × location × productionLine` 단위로 합산하여 1건의 PO 로 발행한다.
- DC5. 라인업별 PO / MR / 사용 집계는 모두 **읽기 전용 집계 액션**
       (`*BreakdownAction`) 으로 제공한다. 쓰기 경로(PO 생성, 재고 차감 등) 의
       그룹핑 키에는 영향을 주지 않는다.

## 5. GAP-1 마이그레이션 사양

### 5.1 스키마 변경 (prisma/schema.prisma)
```prisma
model MaterialRequirement {
  // ... 기존 필드 그대로
  lineupId String? @map("lineup_id")
  lineup   Lineup? @relation(fields: [lineupId], references: [id])

  // 기존 unique 제약 교체
  @@unique(
    [mealPlanGroupId, productionLineId, lineupId, materialMasterId, countSource],
    name: "uniq_mr_group_line_lineup_material_source"
  )
  @@index([lineupId])
}

model Lineup {
  // ... 기존 필드 그대로
  materialRequirements MaterialRequirement[]
}

5.2 서비스 변경 (material-requirement.service.ts)
AggregatedRequirement 인터페이스에 lineupId: string | null 추가
makeKey 시그니처: (productionLineId, materialMasterId) → (productionLineId, lineupId, materialMasterId)
calculateRequirementsForGroup: MealPlan select 에 lineupId: true 추가
accumulate / expandBomAndAccumulate 호출 체인에 lineupId 전파
INSERT/UPDATE/UNDELETE 시 data 에 lineupId 포함
LIST_INCLUDE 에 lineup 추가
listMaterialRequirements orderBy 에 lineup.name 추가
material-requirement.schema.ts 의 listMaterialRequirementsSchema 에 lineupId: z.string().optional() 추가
5.3 영향 없는 영역 (변경 금지)
purchase-order-batch.service.ts 의 makeGroupKey (PC2/DC4)
buildPOItemsFromMR 의 그룹핑
D27 idempotency guard
PriceHistory 적층 (P9')
PO ↔ MR 매핑 (PurchaseOrderItem.materialRequirementId 그대로 유지)
6. 단계별 실행 계획
단계	작업	산출물	의존
S0	본 문서 등록 + PROGRESS.md / SCHEMA_COVERAGE.md 링크 추가	docs/progress/COST_LINEUP_ALIGNMENT.md	—
S1	GAP-1 스키마 변경 + 마이그레이션	phase_4_c2_pre_mr_lineup_id	S0
S2	MR 서비스/스키마 수정	service diff, schema diff	S1
S3	MR 테스트 갱신 + 신규 라인업 분리 케이스	tests	S2
S4	seed 데이터 보강	seed.ts	S2
S5	Phase 4-C2 (D29) lineupBreakdownAction + UI	action + page	S3, S4
S6	PROGRESS.md / SCHEMA_COVERAGE.md 갱신	docs	S5
7. Definition of Done
DoD1. MaterialRequirement unique 제약이 새 5컬럼 키로 변경됨
DoD2. 같은 라인 × 같은 자재 × 다른 라인업 → MR 행이 분리되어 저장됨
DoD3. 같은 라인 × 같은 자재 × 같은 라인업 → 기존처럼 합산되어 1행 유지
DoD4. PO 생성은 여전히 supplier × location × line 단위로 1건 발행
DoD5. lineupBreakdownAction 이 라인업 × {자재 / 공급사 / PO} 3종 집계 반환
DoD6. 기존 테스트 PASS + 신규 라인업 분리 케이스 PASS
DoD7. PROGRESS.md 의 핵심 설계 결정 섹션에 PC1~PC5, DC1~DC5 반영
8. 변경 이력
2026-06-26: 초안 작성 (GAP-1 즉시 조정, GAP-2/3 사전 결정)
- 2026-06-29: GAP-1 종결 (S0~S6 완료). 마이그레이션 `20260629024328_phase_4_c2_pre_mr_lineup_id` 적용. `MaterialRequirement.lineupId` + 5컬럼 unique + `getLineupBreakdownAction` 백엔드 완성. UI(Step 4 라인업 3종 뷰)는 Phase 4-C2 (UI) 로 별도 진행. 커밋: `318d602` (S1), `cc086e25` (S2), `61e8da48` (S3), `b9d043c1` (S5), `9ea97f88` (S5-A). 누적 테스트 22/22 PASS.

---

## 📌 지금 S0 만 먼저 처리, 검토 후 S1 진행

위 문서를 그대로 **`docs/progress/COST_LINEUP_ALIGNMENT.md`** 로 커밋하시고, **PROGRESS.md 의 "핵심 설계 결정" 섹션 끝**에 다음 한 줄을 추가하시면 됩니다:


- 원가-라인업 차원 정합성: docs/progress/COST_LINEUP_ALIGNMENT.md
  (PC1-5 / DC1-5 / GAP-1 즉시 조정, GAP-2/3 Sprint 4/5 진입 시)

