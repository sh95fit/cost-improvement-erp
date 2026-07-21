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