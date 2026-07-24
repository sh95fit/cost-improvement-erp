# 2026-07-21 Consumption / Receiving 도메인 전면 재정비 감사서

- **적용 대상**: Sprint 4 S4-3-c 재편 (기존 c-4-1 ~ c-4-5 폐기, R0~R13 신규 순차)
- **우선순위**: 최상위 (P0)
- **PROGRESS.md 반영 범위**: 헌법 표에 P15~P19 추가, 헌법 보강 섹션에 P14 재보강 + P15~P19 상세 삽입, Sprint 4 진행 현황 S4-3-c 서브섹션 전면 교체

---

## §1. 위반 판정표 (헌법 조항 매핑)

| # | 현행 구현 | 위반 조항 | 심각도 | 결정 |
|---|---|---|---|---|
| V1 | 사용 처리 진입이 "목록 필터 → 다이얼로그에서 날짜·사업장 수동 선택" 의 lazy 방식 | P13 + SOLUTION CORE (담당자 인지성) | 🔴 치명 | 폐기 → Eager 자동 생성으로 전환 (R5) |
| V2 | `PendingMealPlanBanner` 가 회사 계층 페이지 (`/meal-plan/${id}`) 로 링크 → 404 | P2/P6 (BOM·MealPlan 회사 계층, Consumption 공장 계층) | 🔴 치명 | 배너 폐지, PENDING Header 가 목록에 자연 노출 (R2, R9) |
| V3 | `/consumption/new` 에서 사업장 선택 드롭다운 노출 (모든 계층 동일 UI) | P2 보강 (Roll-up) | 🔴 치명 | 롤업 스코프 자동 필터로 재설계, 사업장 선택 UI 제거 (R7) |
| V4 | 사용 처리 draft 가 "자재 그룹(MaterialMaster) 단위" 로 표시·저장 | P14 (라인업별 행 분리) + 원가 흐름 (품목=SupplierItem 정본) | 🔴 치명 | 품목(SupplierItem) 단위 행 분리 재설계, 자재는 UI 그루핑에만 사용 (R8) |
| V5 | "발주단위(orderUnit)" 별개 개념 도입 + `UnitConversionMiniDialog` 인라인 등록 UX | P14 보강 (발주단위=사용단위=`PurchaseOrderItem.orderUnit`) + 단위 중앙 관리 | 🟠 심각 | 별개 "발주단위" 개념 제거, 미등록 시 자재 마스터 편집 페이지로 유도 (R2) |
| V6 | UI 에 "이론량(theoreticalQty)" 자체 판단 항목 노출 | 사용자 지정 표준 8항목 외 항목 도입 금지 | 🟠 심각 | "이론량" 제거, 8개 표준 항목으로 통일 (R8) |
| V7 | 확정된 ConsumptionItem 이 CONFIRMED 상태 하나만 존재 (PENDING 없음) | P13 (Layer A 자동 산출 = 확정 전 상태 존재 필요) | 🟠 심각 | `ConsumptionHeader` (PENDING/CONFIRMED) 도입, Item 은 자식 (R3, R5) |
| V8 | 부자재(SK) 사용 처리 시 SupplierItem 매핑 UI 부재 | P12 (SK 는 사용 시점 이연 확보) + P13 Layer B | 🟠 심각 | 상세 페이지에 "품목 수동 매핑" 다이얼로그 신설 (R8, R9) |
| V9 | 가용재고 개념이 (총 재고) 만 반영, 예약 재고 개념 미정 | P11 (Pre-flight 는 실제 사용 가능 잔량 기준) | 🟠 심각 | P16 정본 공식 도입, 4요소 예약 정의 (R6) |
| V10 | 공장(FACTORY Location) 이 SK 발주 처리 불가 (창고 전용 제약) | P3 보강 (FACTORY/WAREHOUSE/HYBRID 모두 재고 보유) + P12 | 🟠 심각 | SK 도착 Location 검증 완화, FACTORY 허용 (R10) |
| V11 | SK 발주에 입고 예정일 필드 부재 | 재고 관리 실무 (SK 는 별도 관리 축) | 🟡 보통 | `PurchaseOrder.expectedReceivedDate` 신설 (R10) |
| V12 | 식단 기반 발주에서 출고일 제약 부재 | P8 (발주 PK = outboundDate = 실제 출고일) | 🟡 보통 | 식단 발주 시 `outboundDate = MealPlan.baseDate` 강제 (R10) |
| V13 | 입고서 편집이 수량·단가만 지원, 총액 비교 UI 부재 | P5/P9' (입고↔발주 차이 = ReceivingDiscrepancy 로 기록) | 🟡 보통 | 3-3-1 컬럼 그룹 UI (품목/발주3열/입고3열/차이) (R11) |
| V14 | `/shipping` 페이지 잔존 (스키마는 이미 drop) | P13 보강 (Shipping 도메인 폐지 S4-3-INT) | 🟡 보통 | 코드·라우트 잔재 완전 제거 (R1) |

---

## §2. 신규 헌법 조항 상세 해설

PROGRESS.md 의 헌법 보강 섹션에 삽입되는 P14 재보강 + P15 ~ P19 조항의 상세 근거·설계 결정 배경. (PROGRESS.md 는 정본 문구만 담고, 이 감사서는 왜 이 문구가 결정됐는지의 논거를 담는다.)

### P14 재보강 근거

원가 산정의 정본은 개별 lot 의 `unitPrice` 이며, lot 은 SupplierItem 단위로 존재한다. 자재 단위로 원가를 계산하면 (a) 같은 자재의 공급업체별 단가 차이를 평균으로 뭉개게 되고 (b) FIFO 소진 정본과 UI 표시가 어긋난다.

### P15 2축 분리 근거

이전 초안에서 "수동 생성" 이라는 단일 용어로 두 가지 서로 다른 행위 (기존 Header 에 행 추가 vs 새 Header 생성) 를 지칭하여 혼선이 발생. 두 행위의 데이터 위치, 권한 요건, UI 진입점, 감사 로그 표기가 모두 다르므로 **축 A "행 추가"** 와 **축 B "헤더 생성"** 을 완전히 분리한다.

- **축 A "행 추가"**: 자동 생성된 Header 는 이미 라인업·Location·ProductionLine 이 확정되어 있으므로 추가되는 Item 도 그 컨텍스트를 상속. 라인업 추적성 유지. 권한 게이팅 불필요.
- **축 B "헤더 생성"**: Header 자체를 새로 만들려면 라인업 등 4요소를 반드시 명시해야 원가 축이 확보됨. 이를 잊거나 잘못 지정하면 원가 정본이 오염되므로 초기에는 SYSTEM/COMPANY_ADMIN 만 허용.

### P16 가용재고 4요소 예약 정의 근거

기존 `reservation.service.ts` 는 이미 lot 단위 예약을 지원하나, 예약이 언제 생성되는지의 정책은 미정이었음. Sprint 4 R5 에서 MealPlan 확정 트랜잭션에 편입하기로 결정. 예약 4요소 (Lot ACTIVE + useDate + lineup 일치 + Location/ProductionLine 일치) 는 사용자님이 제시한 정본 공식에 따름.

### P17 스코프 자동 필터 근거

레포 스캔 결과 `src/lib/action-helpers.ts` 에 인증/에러 매핑은 있으나 **스코프 필터 유틸은 부재**. 각 서비스가 개별적으로 `WHERE companyId` 만 걸고 있어 하위 계층 (locationId·productionLineId) 필터가 누락. R7 에서 유틸을 신설하고 모든 도메인에 일괄 적용.

### P18 발주 제약 근거

- 식단 발주는 P8 (발주 PK = outboundDate) 에 따라 `outboundDate = MealPlan.baseDate` 이어야 함.
- SK 발주는 lineup·outboundDate 무귀속이므로 대신 `expectedReceivedDate` 로 관리 축 확보.

### P19 Shipping 폐지 확정

스키마 drop 은 S4-3-INT (커밋 c2dd65f, 마이그레이션 `20260715015044_drop_shipping_domain`) 에서 이미 완료. 코드 잔재 (라우트·컴포넌트·import) 만 정리 필요 → R1.

---

## §3. 신규 스키마 상세 (R3 마이그레이션)

### 3-1. `ConsumptionHeaderSource` enum

enum ConsumptionHeaderSource {
  AUTO_MEAL_PLAN
  MANUAL

  @@map("consumption_header_source")
}

### 3-2. ConsumptionHeaderStatus enum
enum ConsumptionHeaderStatus {
  PENDING
  CONFIRMED
  CANCELLED  // R12: Sprint 5 재오픈 UI 이관까지 사용 안 함

  @@map("consumption_header_status")
}

### 3-3. ConsumptionHeader 모델
model ConsumptionHeader {
  id                String                    @id @default(cuid())
  companyId         String                    @map("company_id")
  locationId        String                    @map("location_id")
  productionLineId  String                    @map("production_line_id")
  mealPlanGroupId   String                    @map("meal_plan_group_id")
  consumedDate      DateTime                  @map("consumed_date") @db.Date
  source            ConsumptionHeaderSource   @default(AUTO_MEAL_PLAN)
  status            ConsumptionHeaderStatus   @default(PENDING)
  manualReason      String?                   @map("manual_reason")   // source=MANUAL 시 필수 (앱 레벨)
  createdByUserId   String                    @map("created_by_user_id")
  confirmedAt       DateTime?                 @map("confirmed_at")
  confirmedByUserId String?                   @map("confirmed_by_user_id")
  createdAt         DateTime                  @default(now()) @map("created_at")
  updatedAt         DateTime                  @updatedAt @map("updated_at")

  company           Company                   @relation(fields: [companyId], references: [id])
  location          Location                  @relation(fields: [locationId], references: [id])
  productionLine    ProductionLine            @relation(fields: [productionLineId], references: [id])
  mealPlanGroup     MealPlanGroup             @relation(fields: [mealPlanGroupId], references: [id])
  createdByUser     User                      @relation("ConsumptionHeaderCreatedBy", fields: [createdByUserId], references: [id])
  confirmedByUser   User?                     @relation("ConsumptionHeaderConfirmedBy", fields: [confirmedByUserId], references: [id])
  items             ConsumptionItem[]

  @@unique([mealPlanGroupId, locationId, productionLineId, source])  // AUTO 중복 방지, MANUAL 은 여러 개 가능
  @@index([companyId, consumedDate])
  @@index([status])
  @@map("consumption_headers")
}

### 3-4. ConsumptionItem 변경
headerId String @map("header_id") FK NOT NULL 추가
status (ConsumptionStatus) 컬럼 제거 (Header 로 통일)
supplierItemId String @map("supplier_item_id") NOT NULL 승격
theoreticalQty 컬럼 제거
lineupId, productionLineId 는 Header 에서 상속되지만 조회 성능·SK 수동 매핑을 위해 Item 에도 보존

### 3-5. PurchaseOrder.expectedReceivedDate 추가 (R10)
model PurchaseOrder {
  // ... 기존 필드
  expectedReceivedDate DateTime? @map("expected_received_date")  // SK 필수, JIT nullable
}

## §4. 사용 처리 표준 8항목 (V6 대체·정본)
모든 값은 공급단위 (= 발주단위 = SupplierItem.orderUnit) 기준. 별도 "발주단위" 개념·단위 변환 다이얼로그 불필요.

#	항목명	필드명	도출	표시 위치
1	예상/확정 식수	expectedCount / finalCount	MealCount 조회	헤더 요약
2	최초 필요량 (BOM 기준)	initialRequirementBase	BOM.qty × expectedCount (BOM 기본단위=g)	품목 행
3	최초 필요량 (공급단위 환산)	initialRequirementSupply	initialRequirementBase ÷ conversionFactor	품목 행
4	예상 필요량 (BOM 기준)	expectedRequirementBase	BOM.qty × finalCount	품목 행
5	예상 필요량 (공급단위 환산)	expectedRequirementSupply	expectedRequirementBase ÷ conversionFactor	품목 행 (사용량 초기값)
6	가용재고 (공급단위)	availableQty	P16 정본 공식	품목 행
7	사용량 (공급단위, 편집)	usedQty	사용자 입력 (초기값=⑤)	품목 행 (입력 필드)
8	재고잔량 / 폐기량 (공급단위)	remainingToStock / disposalQty	disposalQty = expectedRequirementSupply − usedQty − remainingToStock (자동)	품목 행 (입력 + 자동)
Pre-flight: usedQty + remainingToStock + Σ(LayerB.qty for same supplierItem) ≤ availableQty

## §5. 입고 총액 비교 UI (V13) 3-3-1 컬럼 사양

### 5-1. 새 입고서 작성 페이지
품목	발주수량	발주단가	기준 총액	입고수량	입고단가	수정 총액	Δ
감자(공급A)	100 kg	3,000	300,000	98 kg	3,050	298,900	−1,100
하단 3행 집계: 기준 총액 합 / 수정 총액 합 / Δ 합.

### 5-2. 입고서 목록
totalAmount 컬럼 상시 표시 (DRAFT 는 계산값, CONFIRMED 는 스냅샷).

### 5-3. 입고서 상세
DRAFT: 3-3-1 그루핑 그대로 + 집계 3행
CONFIRMED: 확정 총액 단일 컬럼 + 확정 총액 합
5-4. 일자별 일괄 입고
다중 발주 선택 시: 기준 총액 합 / 수정 총액 합 / Δ / (일부 확정된 경우) 이미 확정된 금액 병기. 수정 없을 경우 기준 총액 단일 표시.

## §6. Q-C 실체 조사 — InventoryTransaction 사용처 전수 확인

### 6-1. 조사 방법
src/features/consumption/services/confirm-consumption.service.ts (18KB) 실 파일 read 로 InventoryTransaction 생성 지점 확인.

### 6-2. 조사 결과
CONSUMPTION / DISPOSAL 타입: 오직 confirmConsumption 서비스의 8단계 FIFO 차감 루프에서만 생성. referenceType = "CONSUMPTION_ITEM", referenceId = ConsumptionItem.id 로 참조.
PURCHASE 타입: 입고 확정 (ReceivingNote.status → CONFIRMED) 트랜잭션에서만 생성. Consumption 도메인 무관.
ADJUSTMENT 타입: 재고 실사 완료 시 생성. Consumption 도메인 무관.
TRANSFER_IN / TRANSFER_OUT / RETURN: 재고 이동·반품 도메인. Consumption 무관.
InventoryReservation: confirmConsumption 성공 시 releaseReservation(reason=CONSUMED) 호출 → released_at 세팅. 롤백 필요 시 이 세팅을 되돌려야 함.

### 6-3. 결론 및 R4 SQL
BEGIN;
  DELETE FROM consumption_lot_details;
  DELETE FROM consumption_items;
  DELETE FROM inventory_transactions
    WHERE transaction_type IN ('CONSUMPTION', 'DISPOSAL')
      AND reference_type = 'CONSUMPTION_ITEM';
  UPDATE inventory_reservations
    SET released_at = NULL, release_reason = NULL
    WHERE reference_type = 'CONSUMPTION_ITEM'
      AND release_reason = 'CONSUMED';
COMMIT;
후속: bun run scripts/recompute-lot-remaining.ts — 각 Lot 에 대해:

remainingQty = originalQty
  − Σ(consumption + disposal + transfer_out + return 활성 quantity)
  + Σ(adjustment 활성 quantity)
다른 도메인 무영향 확인: PURCHASE / ADJUSTMENT / TRANSFER 트랜잭션은 손대지 않으므로 대시보드·월말 원가·재고 이동 이력 모두 정상 유지.

## §7. 누락 항목 재점검 (L1 ~ L4)
이전 대화 컨텍스트 크로스체크로 발견한 4가지 누락 및 반영 위치.

L1 — SK 부자재 SupplierItem 수동 매핑 서비스: R8 산출물에 subsidiary-supplier-item-mapping.service.ts 명시화.
L2 — MealPlan 확정 시 예약 자동 생성 트리거: R5 트랜잭션에 InventoryReservation 동시 생성 편입.
L3 — write 액션의 스코프 검증: R7 유틸에 assertScopeAccess 추가.
L4 — 확정된 Consumption 재편집 정책: R12 에서 명시적 유예 (CONFIRMED 편집 시 에러), Sprint 5 로 이관.

## §8. Phase 재편 목록 (R0 ~ R13)
PROGRESS.md 의 Sprint 4 진행 현황 서브섹션에 삽입되는 R0~R13 표의 근거·범위. 상세 표는 PROGRESS.md 를 참조.

표준 진행 사이클 (매 Phase 반복)
어시스턴트 (레포 검증): 착수 직전 최신 레포 확인 → 수정 대상 파일 read → 수정 위치·내용 확정
어시스턴트 (가이드 작성): 복사·붙여넣기 즉시 반영 가능한 마크다운·코드 블록 제공
사용자 (로컬 적용): 복사·붙여넣기 → npx tsc --noEmit 확인
사용자 (커밋): git commit + git push, 커밋 해시 회신
어시스턴트 (커밋 검증): 반영 diff 확인 → 프로세스 검증 시나리오 안내
사용자 (테스트): npm run test 결과 회신
어시스턴트 (PROGRESS.md 갱신 초안): Phase 상태 ✅ 갱신 마크다운 제공
사용자 (갱신 커밋): PROGRESS.md 갱신 커밋 → 다음 Phase 로
이 사이클은 PROGRESS.md 상단 "작업 프로세스 규칙" 7단계와 정합.

## §9. R5 상세 설계 (2026-07-23 사전 결정 박제)

### §9-1. 스코프 정의
- **R5-P**: `autoCreatePendingConsumptionHeaders` — MealPlan CONFIRMED→IN_PROGRESS 시 (mealPlanGroupId, locationId, productionLineId, source=AUTO_MEAL_PLAN) 조합별 idempotent upsert.
- **R5-R1**: `autoReserveFromMaterialRequirements` — 동일 트랜잭션에서 `MaterialRequirement` 순회 → `isReservationEligibleLot` 통과 lot 대상 `createReservation` 호출.
- **R5-R2**: 발주→입고 흐름 예약 생성. **본 페이즈 제외**, 신규 페이즈 **R14** 로 이관.

### §9-2. 트리거 지점
- **파일**: `src/features/meal-plan/services/meal-plan.service.ts`
- **함수**: `updateMealPlanGroup`
- **라인**: 705-740 (CONFIRMED→IN_PROGRESS / IN_PROGRESS→COMPLETED 전이 트랜잭션 블록)
- **삽입 순서**: (1) 검증 → (2) status update → (3) `generateMaterialRequirements` → **(4-new) `autoCreatePendingConsumptionHeaders`** → **(5-new) `autoReserveFromMaterialRequirements`**
- **근거**: DRAFT→CONFIRMED 는 식수 확정 이전이라 MR 이 없어 예약 불가. IN_PROGRESS 진입 시점이 P16 예약의 최초 성립 조건 충족.

### §9-3. 예약 참조 축 (P16 정정)
- **정정 전**: `referenceType = "MEAL_PLAN_SLOT"`, `referenceId = MealPlanSlot.id`
- **정정 후**: `referenceType = "MATERIAL_REQUIREMENT"`, `referenceId = MaterialRequirement.id`
- **근거**: MaterialRequirement 가 이미 (materialMasterId, locationId, productionLineId, lineupId, requiredQty, countSource) 를 정규화 보유. Slot 단위 반복 회피, releaseReservation 시 역추적 단일 경로 확보.
- **영향**: PROGRESS.md L131·L532 영역 P16 공식 원문 정정 필요.

### §9-4. 재산출/재편집 정책 (2026-07-23 재정정, 사용자 확인)

**순방향 (전진 전이)**:
- CONFIRMED → IN_PROGRESS: `autoCreatePendingConsumptionHeaders` + `autoReserveFromMaterialRequirements(ESTIMATED)` 호출 (예약 최초 생성)
- IN_PROGRESS → COMPLETED: 예약 재생성 **안 함** (α3). FINAL MR 만 생성 (기존 `generateMaterialRequirements` 로직 유지). FINAL 은 원가 검증 지표로만 사용.
- 근거: FINAL 시점(COMPLETED) 은 이미 실사용 임박. 예약보다 실제 사용(Consumption 확정)이 더 적절. 이중 계산 회피.

**역방향 (후진 전이)** — R5-R1-B 신규 서비스 위임:
- COMPLETED → IN_PROGRESS · IN_PROGRESS → CONFIRMED · IN_PROGRESS → DRAFT · COMPLETED → DRAFT 모두:
  1. **가드**: 연계된 Consumption 이 CONFIRMED 이면 `ConfirmedConsumptionExistsError` throw (R12 유예 정책)
  2. **정리**: 전부 PENDING 이하일 경우 → PENDING Consumption 삭제 + 대상 countSource MR soft-delete + 관련 Reservation release (reason=MANUAL_CANCEL)
  3. **재확정 시점**: 순방향 재진입 시 자연 재생성 (idempotent)
- 어느 상태 → CANCELLED: R15 페이즈 (§9-5, 별도)

**실패 정책 (기존 유지)**:
- 예약 부족(`InsufficientAvailableQtyError`) 발생 시 → **전체 트랜잭션 롤백**.
- 결과: MealPlanGroup.status 원복(CONFIRMED 유지), MR 롤백, Header/Reservation 미생성.
- 사용자는 자재 보충 후 재시도.

### §9-5. 예약 해제 (R5 범위 외)
- MealPlan CANCELLED 전이 시 예약 해제 로직 **현재 미구현**.
- `MealPlanStatus.CANCELLED` 리터럴 검색 결과 프로덕션 코드 0건 확인 (2026-07-23).
- 별도 페이즈로 이관 (제안: **R15** — CANCELLED 전이 시 활성 Reservation 일괄 release).

### §9-6. 데이터 축 일치 검증
- MaterialRequirement.lineupId 는 nullable → SK(STOCK_KEEPING) 발주 대응.
- 예약 축(lineupId, locationId, productionLineId) 이 MR 축과 1:1 매핑되므로 별도 파생 로직 불필요.

### §9-7. 신규 서비스 스펙
| 파일 | 시그니처 | 반환 |
|------|---------|------|
| `src/features/consumption/services/auto-create-pending-consumption-headers.service.ts` | `autoCreatePendingConsumptionHeaders(tx, { companyId, mealPlanGroupId, userId })` | `{ created: number; existing: number }` |
| `src/features/inventory/services/auto-reserve-from-material-requirements.service.ts` | `autoReserveFromMaterialRequirements(tx, { companyId, mealPlanGroupId, countSource, userId })` | `{ reserved: number; skipped: number }` |

### §9-8. 테스트 계획
- `auto-create-pending-consumption-headers.service.test.ts`: (a) 최초 호출 시 조합별 생성, (b) 재호출 시 중복 생성 없음(idempotent), (c) 이미 CONFIRMED Header 존재 시 skip.
- `auto-reserve-from-material-requirements.service.test.ts`: (a) reservation-eligible lot 만 예약, (b) STOCK_KEEPING 자재 skip, (c) 재고 부족 시 throw.
- `meal-plan.service.test.ts` 확장: CONFIRMED→IN_PROGRESS 전이 시 두 서비스 호출 검증 + 예약 실패 롤백 검증.

### §9-9. 미해결 항목
- MR 재생성(예: IN_PROGRESS 상태에서 식수 재조정)의 예약 재계산 정책 → R5 종료 후 별도 논의.
- 다중 라인업 부분 확정 시나리오 → 현 스키마상 MealPlanGroup 단위 확정이라 문제 없음.

### §9-10. R5-P 스키마 매핑 (2026-07-23 8-A~8-G 확인 후 확정)
**Header 매핑 (R5-P)**:
- `consumedDate` = `MealPlanGroup.planDate` (파생; unique 4요소 밖이나 MealPlanGroup 유일성으로 1:1 결정)
- `source` = `ConsumptionHeaderSource.AUTO_MEAL_PLAN` (P15 축 A). Item 축 `ConsumptionSourceType.MEAL_PLAN_AUTO` 와 구분되는 별개 enum.
- `status` = `ConsumptionHeaderStatus.PENDING` (초기값, R3-c 에서 확정 시점에 CONFIRMED 로 전이)
- `createdByUserId` = `updateMealPlanGroup(..., actorUserId)` 신규 파라미터로 전파. Action 에서 `session.userId` 전달 (D-R5-1-b α).
- `(locationId, productionLineId)` 조합 추출 경로: `MealPlanGroup → MealPlan[] → MealPlanSlot[]` 순회 → **`productionLineId` 가 있는 Slot 만** 선별(nullable, 9-A 재확인) → `productionLine.locationId` join → unique set. `productionLineId=null` 슬롯은 자재 산출 대상이 아니므로 Header 생성에서도 제외.
- upsert 의 `update` 는 no-op(빈 객체) — idempotent, 기존 CONFIRMED Header 도 보존.

**Reservation 매핑 (R5-R1)**:
- `referenceType` = `"MATERIAL_REQUIREMENT"` (문자열, §9-3)
- `referenceId` = `MaterialRequirement.id`
- `useDate` = `MealPlanGroup.planDate` (Header 와 동일 축)
- `actorUserId` = 상동
- **재산출 정책 (§9-4 α3 정정, 2026-07-23)**: CONFIRMED→IN_PROGRESS 진입 시에만 호출 (ESTIMATED). IN_PROGRESS→COMPLETED (FINAL) 시점 예약 재생성 안 함. 역방향 전이 시 예약 release·MR soft-delete·PENDING Consumption 삭제는 `revert-guard.service.ts` (R5-R1-B, R12) 가 전담.
- 반환 타입: `{ reserved, skipped }` (release Phase 제거, §9-4 α3 정합).

**미해결 → 후속**:
- MealPlanGroup 이 여러 planDate 를 가지는 경우 없음 (스키마 `planDate` 단일 필드).
- MealPlanSlot.productionLineId 는 nullable 이나 실사용상 라인 미배정 슬롯은 MR 산출 단계에서도 제외되므로(§9-6 일치) 축 정합성 보존.
- MealPlanSlot.productionLineId 재확인 필요 시 R5-R1 착수 전 8-H 로 별도 검증.

### §9-11. Location 경계 원칙 (P4 준수, 2026-07-23 사용자 확인)
- **Lot 조회 필터**: `where: { locationId: mr.locationId }` 로 강제. 다른 Location 의 lot 합산 금지.
- **부족 시 정책**: 동일 Location 내 모든 eligible lot 합산해도 requiredQty 미달 시 → `InsufficientAvailableQtyError` throw → 트랜잭션 전체 롤백 (§9-4 정합).
- **재고 확보 경로 (사용자 액션, R5-R1 범위 외)**:
  1. 추가 발주 후 입고 대기
  2. `InventoryTransfer` 로 다른 Location 에서 이관
  3. MealPlan 을 CONFIRMED 로 되돌린 후 재조정
- **P4 준수 확인**: MR.locationId 는 `generateMaterialRequirements` 단계에서 FACTORY/HYBRID 소속 ProductionLine 파생 (P4 보강 L183-185). R5-R1 은 이 전제를 신뢰하고 별도 검증 안 함.

### §9-12. 도메인 축 매트릭스 (2026-07-24 R6-Pre-3 확정, 사용자 승인)

전 도메인의 계층 축(company / location / productionLine / lineup) 반영 현황을 박제한다. 후속 세션에서 축 부재 여부 재조사 방지 목적.

| 도메인 | company | location | productionLine | lineup | 판정 근거 |
|---|---|---|---|---|---|
| `MealPlanGroup` | ✓ NOT NULL | — | — | — | 회사 단위 설계 (P1 원가 귀속은 하위 `MealPlan.lineupId` 로 완결). `@@unique([companyId, planDate])` |
| `MealPlan` | (그룹 파생) | — | — | ✓ NOT NULL | 회사+라인업 축. `@@unique([mealPlanGroupId, companyMealSlotId, lineupId])` |
| `MaterialRequirement` | (그룹 파생) | ✓ NOT NULL | ✓ NOT NULL | ✓ nullable (실질 NOT NULL, §10-11(2)) | 4축 완비 |
| `PurchaseOrder` | ✓ NOT NULL | ✓ NOT NULL | ✓ nullable | ✓ nullable | 4축 완비. Sprint 3 Phase 1.5 (`locationId`+`productionLineId`), Sprint 3.5 Phase S3.5-0 (`lineupId`) |
| `ReceivingNote` | ✓ NOT NULL | (PO 파생) | (PO 파생) | (PO 파생) | PO 종속 이벤트. 축 비정규화 대신 `purchaseOrderId` 조인 원칙 (§9-12-a) |
| `InventoryLot` | ✓ NOT NULL | ✓ NOT NULL | — | (예약 파생) | 2축 설계 의도. 라인업 귀속은 `InventoryReservation → MaterialRequirement.lineupId` 로 파생 |
| `ConsumptionHeader` | ✓ NOT NULL | ✓ NOT NULL | ✓ NOT NULL | — | 3축. 라인업은 `ConsumptionItem` 레벨로 하강 (§9-12-b) |
| `ConsumptionItem` | (Header 파생) | (Header 파생) | (Header 파생) | ⬜ **R6-B-1 도입 예정** | 라인업 축 필요 — Layer B 원가 롤업 요건 (§9-13) |

**§9-12-a — ReceivingNote 축 비정규화 정책**:
- ReceivingNote 는 PurchaseOrder 종속 이벤트이며, PO 확정 시점에 4축이 이미 고정된다.
- 축 필드를 자체 보유하지 않고 `purchaseOrderId` 조인으로 파생 조회한다.
- 스코프 필터 (R7 완료 후): `where: { purchaseOrder: { locationId: ..., productionLineId: ... } }` 중첩 필터 사용.
- ConsumptionHeader 가 축을 자체 보유하는 것과의 비대칭은 의도적 — 소비는 SK 재고 사용 시 PO 와 독립적으로 발생 가능하므로 축 자체 보유 필요.

**§9-12-b — ConsumptionItem.lineupId 도입 배경 (Q6 확정)**:
- Layer A/B 모두 라인업 귀속이 요구된다 (§9-13). Header 축(3축)만으로는 라인업별 원가 롤업 불가.
- `MealPlan.lineupId` 조인 파생만으로는 Layer B (수동 추가) 항목의 라인업 추적 불가 (MealPlan 미경유 케이스).
- 스키마 도입 시점: R6-B-1. 초기부터 **NOT NULL** 즉시 도입 (Q6 사용자 확인, 2026-07-24).
- 판정 근거 (정황증거): (1) `ConsumptionItem.create` 는 `confirm-consumption.service.ts:267` 단일 호출부. (2) seed·mock 생성 0건 (59-3/5 확인). (3) 최신 마이그레이션 `20260722065856_s4_3_c_r3_b_add_consumption_header` 가 2일 전 적용되어 실사용 데이터 유입 창구 부재.
- 안전장치: 마이그레이션 파일에 `DO $$ BEGIN IF EXISTS (SELECT 1 FROM consumption_items LIMIT 1) THEN RAISE EXCEPTION 'use two-step migration'; END IF; END $$;` 가드 삽입 후 `ALTER TABLE ... ADD COLUMN lineup_id TEXT NOT NULL`.

### §9-13. 예약재고 소비 축 정책 (2026-07-24 R6-Pre-3 확정, Q1~Q4 사용자 확인)

R5-R1 로 생성된 `InventoryReservation` 이 R8 (Consumption 재작성) 시점에 어떤 축 규칙으로 소진되는지 박제한다. R6-B Pre-flight 및 FIFO 소진 로직의 정합 근거.

**§9-13-a — Lot 격리 (Q2 확정)**:
- 소비는 자신의 lot(공장) 재고만 사용. Cross-lot 소진 금지.
- 다른 lot 재고가 필요한 경우 반드시 `InventoryTransfer` 를 통한 이관 절차 선행. 이관은 예약이 처리(release)된 이후에만 가능.
- P4 (`LocationType=FACTORY` 소비 원칙) 및 §9-11 (Location 경계 원칙) 정합.

**§9-13-b — 라인업 격리 + 잔여 공유 (Q2 확정)**:
- 라인업 A 를 위해 생성된 예약은 라인업 B 가 소비할 수 없다 (R6-A `getAvailableStock` breakdown 의 `reservedOtherAxis` 로 표현).
- **잔여 공유 예외**: 동일 lot 내에서 라인업 A 의 실제 사용량이 예약량보다 적을 경우, 예약 처리(사용 확정) 시점에 잔여분은 `freeStock` 으로 전환되어 동일 lot 내 다른 라인업이 사용 가능.
- 잔여 공유의 시점 조건: **동일 사용일(useDate)** 내 소비여야 함. 미래 날짜 예약분은 침범 불가 (`reservedOtherDate` 로 차감).

**§9-13-c — 예약 처리 시점 (Q1 확정)**:
- 예약이 실제 재고 이동으로 전환되는 시점 = 소비 확정(`confirmConsumption`) 성공 시점.
- 확정 전까지는 `InventoryReservation.releasedAt IS NULL` 상태 유지 → `available = remainingQty - Σ(active reservations)` 공식이 유지됨.
- 조기 입고(D-3, D-4) 시에도 예약 상태가 유지되므로 예상치 못한 소비 침범 방지.

**§9-13-d — Layer B (수동 추가) 라인업 귀속 (Q3 확정)**:
- Layer B 항목도 예외 없이 라인업 지정 필수 (P1 원가 귀속 원칙).
- UI 에서 라인업 선택 강제 (R6-B-3), 서비스 레벨에서 `LayerBItem.lineupId` non-null 검증 (R6-B-2).
- Layer B 의 라인업 선택 범위: 사용자 스코프 계층에 따라 필터 (Q7 → §10-14).

**§9-13-e — 부자재 라인업 축 (Q4 확정)**:
- 부자재(SUBSIDIARY) 소비도 자재와 동일하게 라인업 축 적용.
- 다만 부자재는 예약 대상 아님 (`isReservationEligibleLot` false, `reservation-eligibility.ts:17`) → 축 매칭은 필요하지만 `getAvailableStock` 의 5축 예약 차감 로직은 부자재에 대해 무의미.
- 별도 헬퍼 `getSubsidiaryAvailableForConsumption` 도입 (§10-12).

**§9-13-f — MealPlanAccessory.lineupId 도입 검토 후 폐기 (Q5 확정)**:
- 초기 검토안: `MealPlanAccessory` 에 `lineupId` 필드 추가하여 부자재도 라인업 축을 스키마에서 명시.
- 폐기 사유: 부자재는 `MealPlan` 종속이며 `MealPlan.lineupId` 로 자동 파생 가능. 별도 필드는 중복이며 정합성 리스크(부모/자식 lineupId 불일치) 증가.
- 대신 `ConsumptionItem.lineupId` 도입 시 부자재 소비 항목도 라인업이 명시적으로 기록됨 (§9-12-b).


## §10. R6 상세 설계 (가용재고 정본 서비스, 2026-07-23 사전 결정 박제, 2026-07-24 D-R6-f 정정)

### §10-1. 스코프 정의
- **R6-A** (본 페이즈): `available-stock.service.ts` 신설. P16 정본 공식 aggregate-level 구현. 단위 테스트.
- **R6-B** (별도 페이즈, 후속): P11 Pre-flight 통합. `confirm-consumption.service.ts:156` 리팩토링.
- **R6 범위 외**: 대시보드 UI (선행 UI 없음, 감사서 §4 L137 컬럼 지원은 향후).

### §10-2. P16 공식 축 매칭 정책
- **매칭 축 5개**: `(materialMasterId, locationId, productionLineId, lineupId, useDate)`.
- **productionLineId NOT NULL 확정** (특이사항 1): MR 스키마 상 nullable 아님.
- **lineupId 현재 스키마 실질 NOT NULL**: `MealPlan.lineupId` NOT NULL (schema.prisma), MR 생성 시 MealPlan에서 그대로 전파. 감사서 §9-6의 "MR.lineupId nullable → SK 발주 대응" 은 미래 대비 스키마 여지일 뿐, 현재 도메인에서 SK 발주는 MealPlan을 거치지 않으므로 MR 자체가 생성되지 않음. **null 매칭 로직 불필요**.

### §10-3. 신규 서비스 스펙
- **파일**: `src/features/inventory/services/available-stock.service.ts`
- **함수**: `getAvailableStock(tx, input): Promise<GetAvailableStockResult>`
- **input**: `{companyId, materialMasterId, locationId, productionLineId, lineupId, useDate}`
- **result**: `{available, breakdown: {reservedSameAxis, freeStock, reservedOtherDate, reservedOtherAxis}}`
- **음수 clamp**: `available = max(0, reservedSameAxis + freeStock - reservedOtherDate - reservedOtherAxis)`.
- **STOCK_KEEPING 취급 (D-R6-f α 확정, 2026-07-24)**: SK Lot 은 예약 대상 아님 (`isReservationEligibleLot=false`, `reservation-eligibility.ts:17`). 발주·입고 시 바로 재고화되어 예약 없이 상시 보유 → P16 공식 두 번째 항 `(기존 재고: 예약 미걸림 remainingQty)` = `freeStock` 에 **자연 합산**. 별도 breakdown 필드 불필요.

### §10-4. 반환 타입 상세 (breakdown 관측성)
- 4요소 분리 (`reservedSameAxis`, `freeStock`, `reservedOtherDate`, `reservedOtherAxis`) 로 대시보드·Pre-flight 통합·디버깅 지원.
- `freeStock` 은 예약 미걸림 remainingQty 총합 (`isReservationEligibleLot=true` lot 의 잔량 - 활성 예약 + `isReservationEligibleLot=false` lot 의 잔량).

### §10-5. 기존 헬퍼와의 관계
- **`getAvailableQty(lotId)` (reservation.service.ts:86)**: Lot-level. **유지, R6 는 대체 아님**.
- **`sumActiveReservationsForLot(lotId)` (private, L67)**: Lot-level 활성 예약 합산. **R6 는 재사용 불가** (자재/식단 축 무관 전체 합산). 별도 aggregate 쿼리 작성.
- **`isReservationEligibleLot(lot)` (reservation-eligibility.ts)**: 예약 대상 판정. R6 는 `freeStock` 계산 시 활용 (SK/SUBSIDIARY/purchaseKind=NULL lot 은 예약 차감 없이 remainingQty 그대로 freeStock 에 합산).

### §10-6. MaterialRequirement join 전략
- 예약 조회 시 `InventoryReservation.referenceId` → `MaterialRequirement.id` join 필요.
- 축 필터: `MR.locationId`, `MR.productionLineId`, `MR.lineupId`.
- 성능: `InventoryReservation (referenceType, referenceId)` 복합 인덱스 필요 → **R6-Pre-2 페이즈에서 선행 마이그레이션 추가** (D-R6-e α 확정, 2026-07-24).

### §10-7. 트랜잭션 격리
- R6-A 조회 서비스 단독으로는 `Serializable` 강제 안 함 (읽기 전용).
- 호출자 트랜잭션 (예: R6-B P11 Pre-flight in `confirm-consumption.service.ts:390 Serializable`) 에 합류 가능하도록 `tx` 파라미터 지원.

### §10-8. 테스트 계획
- (a) 순수 freeStock (예약 없음) → available = freeStock.
- (b) 같은 축 예약 존재 → reservedSameAxis + freeStock.
- (c) 다른 useDate 예약 → reservedOtherDate 차감.
- (d) 다른 axis (다른 lineup) 예약 → reservedOtherAxis 차감.
- (e) STOCK_KEEPING lot 존재 → freeStock 에 정상 합산 확인 (예약 대상 아님, 별도 필드 없음).
- (f) 음수 clamp (예약 초과) → available = 0.
- (g) MR 미존재 시 (수동 조회) → freeStock 만.

### §10-9. P11 Pre-flight 통합 (R6-B, 별도 페이즈 — 2026-07-24 상세 스펙 확정)
- `confirm-consumption.service.ts:156` (Pre-flight P4/P11) 리팩토링 대상.
- R6-A 완료 후 별도 페이즈 R6-B 로 이관 (스코프 격리).
- **R6-B 최종 스펙 (2026-07-24 사용자 확인)**:
  1. `MergedItem` 및 `LayerBItem` 타입에 `lineupId` (non-null) · `productionLineId` (non-null) 추가.
  2. `mergeItems` 병합 키를 `itemKey(itemType, itemId)` → `itemKey(itemType, itemId, lineupId, productionLineId)` 로 확장. 라인업별 분리 유지.
  3. Pre-flight 로직은 자재(MATERIAL)의 경우 `getAvailableStock` (§10-3) 을 병합 항목별로(라인업 축 포함) 호출. 부자재(SUBSIDIARY)는 §10-12 의 별도 헬퍼 사용.
  4. 라인업 격리 + 잔여 공유 정책(§9-13-b)은 `getAvailableStock` 의 `reservedOtherAxis` 차감으로 자연 표현. 별도 로직 불필요.
  5. R6-B 는 R7-a (스코프 유틸 최소 구현, §10-17) 완료 후 착수.
- **R6-B 페이즈 세분화 (§10-16)**: R6-B-1 (스키마) → R6-B-2 (서비스) → R6-B-3 (UI) → R6-B-4 (테스트).

### §10-10. 미해결 항목
- **성능 인덱스**: `InventoryReservation (referenceType, referenceId)` 복합 인덱스 → R6-Pre-2 선행 마이그레이션 (D-R6-e α 확정).
- **대시보드 UI (감사서 §4 L137)**: 향후 페이즈 (R6-A 범위 외).

### §10-11. 특이사항 박제 (설계 결정 근거, 후속 세션 재조사 방지)
1. **MR.productionLineId NOT NULL** (Phase 9-A 확정). 축 매칭 시 null 처리 불필요.
2. **MR.lineupId 스키마상 nullable, 실질 NOT NULL**. MealPlan.lineupId NOT NULL 파생, SK 발주는 MealPlan 미경유이므로 MR 자체 미생성. 현재 도메인에서 MR.lineupId=null 실제 케이스 없음. 향후 SK 발주가 MR을 생성하는 흐름 신설 시 재검토.
3. **`sumActiveReservationsForLot` 재사용 불가**. 자재/식단 축 무관 전체 합산이므로 R6 는 별도 aggregate 쿼리 작성.
4. **P11 Pre-flight 이미 구현** (`confirm-consumption.service.ts:156`). R6-B 별도 페이즈에서 R6 서비스 호출로 리팩토링 (§10-9 상세). R6-A-Ext (`getMaterialAvailableForConsumption` 자재 단위 통합 헬퍼) 안 검토 후 **폐기** (2026-07-24) — Q2 라인업 격리 정책(§9-13-b)이 자재 단위 통합과 충돌. `getAvailableStock` 의 5축 매칭만이 정책과 정합.
5. **STOCK_KEEPING 예약 제외, freeStock 에 자연 합산** (`isReservationEligibleLot`, `reservation-eligibility.ts:17`). 발주·입고 시 바로 재고화 → P16 공식 "기존 재고" 항에 편입. 별도 breakdown 필드 없음 (D-R6-f α 확정, 2026-07-24).
6. **트랜잭션 격리**: R6-A 는 조회 전용, 강제 격리 안 함. 호출자 트랜잭션 (`Serializable` 사용처) 합류 가능.

### §10-12. 부자재 소비 별도 헬퍼 스펙 (R6-B-2 착수 시 구현)

- **함수명**: `getSubsidiaryAvailableForConsumption`
- **위치**: `src/features/inventory/services/available-stock.service.ts` (R6-A 확장이 아닌 별도 export)
- **입력**: `{ companyId, locationId, subsidiaryMasterId }` (라인업 축 없음)
- **반환**: `{ available: number, lots: Array<{ lotId, remainingQty }> }`
- **로직**: `InventoryLot.findMany({ where: { locationId, itemType: "SUBSIDIARY", subsidiaryMasterId, remainingQty: { gt: 0 } } })` 후 `remainingQty` 단순 합산. 예약 차감 없음 (§9-13-e).
- **`getAvailableStock` 와의 관계**: 두 함수는 파라미터·반환 형태가 다르므로 호출자(R6-B pre-flight)에서 `itemType` 분기하여 선택. 통합 함수 시도는 §9-13-e 의 축 비대칭 때문에 회피.

### §10-13. mergeItems 병합 키 확장 정책 (R6-B-1 착수 시)

- **현행 (버그)**: `confirm-consumption.service.ts:513` `mergeItems` 함수가 `itemKey(itemType, itemId)` 만으로 병합 → 다른 라인업의 예약분을 침범하는 잘못된 가용재고 판단 발생 가능.
- **개정 후**: 병합 키에 `lineupId`, `productionLineId` 를 추가. 동일 자재·다른 라인업 항목은 별도 `MergedItem` 으로 유지.
- **`MergedItem` 타입 확장** (`confirm-consumption.service.ts:79-100`): `lineupId: string` (non-null), `productionLineId: string` (non-null) 추가. 부자재의 경우도 `MealPlan.lineupId` 파생으로 non-null 보장 (§9-13-e).
- **영향**: Pre-flight 는 각 `MergedItem` 별로 `getAvailableStock` 을 1회 호출. 자재 종류가 동일하더라도 라인업이 다르면 별도 호출. 성능 우려는 R6-Pre-2 인덱스로 완화.

### §10-14. Layer B UI 라인업 필수 지정 + 스코프 필터 (R6-B-3)

- **UI 요건**: `consumption-layer-b-editor.tsx` 에 라인업 선택 컬럼 추가. 항목 저장 시 라인업 미지정 → 클라이언트/서버 양쪽 검증에서 실패.
- **선택 가능 라인업 범위 (Q7 확정)**: 사용자 스코프 계층에 따라 필터 적용.
  - `SYSTEM_ADMIN` / `COMPANY_ADMIN` → 회사 내 전체 라인업.
  - `MEMBER (Location 소속)` → 해당 Location 의 라인업만.
  - `MEMBER (ProductionLine 소속)` → 해당 ProductionLine 의 라인업만.
- **의존 유틸**: `src/lib/auth/scope.ts` 의 `applyScopeFilter` (R7-a, §10-17).
- **`LayerBItem` 타입 (`layer-b-item.type.ts`)**: `lineupId: string` (non-null), `productionLineId: string` (non-null) 필드 추가.
- **서버 검증**: `confirmConsumption` 액션 진입 시 Zod 스키마에서 `lineupId` 필수 검증 + `assertScopeAccess` 로 사용자 스코프 재검증.

### §10-15. ConsumptionItem.lineupId NOT NULL 즉시 도입 (Q6 확정, R6-B-1)

- **결정**: 스키마 최초 도입부터 `lineupId: String @map("lineup_id")` **NOT NULL** + FK to `Lineup`. Nullable → backfill → 승격의 2단계 방식은 채택하지 않음.
- **판정 근거**: §9-12-b 정황증거 세 가지.
- **인덱스**: `@@index([lineupId])` + 향후 원가 롤업 쿼리 대비 `@@index([consumedDate, lineupId])` 복합 인덱스 추가 검토 (R6-B-1 착수 시 최종 결정).
- **마이그레이션 가드 (안전장치)**:
  ```sql
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM consumption_items LIMIT 1) THEN
      RAISE EXCEPTION 'consumption_items has existing rows; use two-step migration';
    END IF;
  END $$;
  ALTER TABLE consumption_items ADD COLUMN lineup_id TEXT NOT NULL;
  ALTER TABLE consumption_items ADD CONSTRAINT consumption_items_lineup_id_fkey
    FOREIGN KEY (lineup_id) REFERENCES lineups(id);
  CREATE INDEX consumption_items_lineup_id_idx ON consumption_items(lineup_id);

  - **`ConsumptionHeader` 축은 변경 없음**: unique 키 `[mealPlanGroupId, locationId, productionLineId, source]` 유지 (헤더 레벨 3축 정책 §9-12).

### §10-16. R6-B 페이즈 세분화 (2026-07-24 확정)

| 하위 페이즈 | 스코프 |
|---|---|
| **R6-B-1** | 스키마 확장 — `ConsumptionItem.lineupId` NOT NULL + FK + 인덱스 (§10-15). Prisma 마이그레이션 + `SCHEMA_COVERAGE.md` 갱신 |
| **R6-B-2** | 서비스 계층 — `MergedItem`/`LayerBItem` 타입 확장, `mergeItems` 병합 키 확장 (§10-13), Pre-flight 로직을 `getAvailableStock` (자재) + `getSubsidiaryAvailableForConsumption` (부자재, §10-12) 호출로 리팩토링 |
| **R6-B-3** | UI 재설계 — `consumption-layer-b-editor.tsx` 에 라인업 선택 컬럼 + 스코프 필터 적용 (§10-14). R7-a 완료 후 착수 |
| **R6-B-4** | 테스트 — `confirm-consumption.service.test.ts` 신설 (현재 파일 부재). Pre-flight 5축 검증, 라인업 격리, 잔여 공유(§9-13-b), 부자재 헬퍼 분기 시나리오 커버 |

### §10-17. R7-a 최소 스코프 유틸 선행 의존성 (2026-07-24 확정)

- **배경**: R6-B-3 (Layer B UI 라인업 필터, §10-14) 는 사용자 스코프에 따라 선택 가능 라인업을 필터링해야 하나, 현재 `src/lib/auth/scope.ts` 미구현 (`session.ts` 의 `AppSession.scopes` 는 `COMPANY` 하드코딩 상태).
- **R7-a 최소 스코프 (R6-B 착수 전 필수 완료)**:
  1. `getUserScope(userId): Promise<{ level: "COMPANY"|"LOCATION"|"PRODUCTION_LINE", scopeIds: string[] }>` — `UserScope` 테이블 조회.
  2. `applyScopeFilter(scope, baseWhere)` — Prisma where 절에 스코프 조건 병합.
  3. `assertScopeAccess(scope, resource)` — 액션 진입 시 대상 자원이 스코프 내인지 검증.
- **R7-b~e (전 도메인 적용)**: Consumption/PO/Receiving/Inventory 각 도메인 목록·write 액션에 스코프 필터 적용. R6-B 완료와 병행 진행 가능.
- **감사서 §11 미해결 항목**과 연동.

### §10-18. R6-A-Ext 폐기 결정 (2026-07-24)

- **초기 검토안**: `getMaterialAvailableForConsumption(companyId, locationId, itemType, itemId): { available, lots[] }` — 자재 단위 통합 조회 헬퍼로 pre-flight 를 단순화.
- **폐기 사유**:
  1. Q2 라인업 격리 정책(§9-13-b) 과 정면 충돌 — 자재 단위 통합은 다른 라인업의 예약분을 침범하는 결과 초래.
  2. `getAvailableStock` (§10-3) 5축 매칭이 이미 P16 공식의 정본이며 라인업 격리를 자연 표현.
  3. 헬퍼가 필요한 실질 이유는 부자재 처리뿐이며, 이는 §10-12 별도 헬퍼로 해결.
- **결과**: R6-A 는 현행 유지, R6-B 는 `getAvailableStock` + `getSubsidiaryAvailableForConsumption` 두 축으로 진행.

#### A‑5. §11 신설 (파일 최말미)

## §11. R6 관련 미해결 항목 및 후속 페이즈 매핑 (2026-07-24 R6-Pre-3 박제)

R6 및 관련 도메인에서 스코프상 R6-B 에 포함되지 않고 별도 페이즈로 이관된 항목을 박제한다. 후속 세션에서 R6 완료 = 전체 완료로 오판 방지.

### §11-1. R7 — 롤업 스코프 유틸 (분리 이관)
- R7-a (최소 유틸): R6-B-3 선행 필수 (§10-17).
- R7-b~e: Consumption/PO/Receiving/Inventory 도메인별 스코프 필터 적용. R6-B 와 병행 진행 가능.
- 현재 서버측 스코프 필터는 `session.companyId` 단일 축만 사용 중 (60-A 조사 확인).

### §11-2. R14 — 발주 → 입고 흐름 예약 생성 (분리 이관)
- 입고 확정 트랜잭션 내 `MaterialRequirement` 매칭 후 `InventoryReservation` 자동 생성.
- R5-R1 이 MealPlan CONFIRMED → IN_PROGRESS 시점 예약을 다뤘다면, R14 는 입고 시점 예약을 다룸.

### §11-3. R15 — MealPlan CANCELLED 시 활성 Reservation 일괄 release (분리 이관)
- 감사서 §9-5 근거. 현재 미구현 상태 확인 (56-3 조사).
- `MealPlanStatus.CANCELLED` 트리거 → 대상 MR 참조 Reservation 전수 `releaseReservation`.

### §11-4. 대시보드 UI — 가용재고 시각화 (범위 외)
- 감사서 §4 L137 언급. R6-A 범위 외로 이미 §10-10 에 명시됨.
- MealPlan 대시보드에서 `getAvailableStock` 호출한 시각화는 별도 페이즈에서 다룰 것.

### §11-5. 원가 롤업 (`src/features/cost/`) 미구현
- 57-A 조사에서 확인: 부자재·라인업 관련 원가 롤업 코드 0건.
- Sprint 5 이후 별도 페이즈 계획 필요.
- `ConsumptionItem.lineupId` (§10-15) 도입은 이 롤업의 선행 조건.

### §11-6. ReceivingNote 축 파생 조회 관례 정착
- §9-12-a 정책에 따른 코드 관례 (중첩 filter) 는 R7-a~e 진행 시 자연 정착.
- 별도 페이즈 불필요, 관례 위반 검증만 R13 (통합 회귀) 에서 확인.
