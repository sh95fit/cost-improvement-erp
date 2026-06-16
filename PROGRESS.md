# LunchLab ERP — 프로젝트 진행 현황

> 본 문서는 **현재 진행 상황과 앞으로 할 일**을 관리하는 SSOT(단일 진실 공급원)이다.
> 종결된 Sprint의 상세 이력은 `docs/progress/SPRINT{n}.md` 로 이관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에서 관리한다.
>
> 마지막 갱신: 2026-06-16 (Sprint 3 Phase 4-B'-4 완료, Phase 4-B'-5 위저드 UI 착수 대기)

---

## 📌 작업 프로세스 규칙

모든 Phase는 아래 7단계를 순서대로 따른다. 단계를 건너뛰지 않는다.

| 순서 | 단계 | 설명 | 완료 기준 |
|------|------|------|-----------|
| 1 | **깃 배포** | 코드 수정 → `npx tsc --noEmit` → `git commit` → `git push origin main` | push 성공, GitHub에서 커밋 확인 |
| 2 | **레포 검증** | GitHub 레포에서 변경 파일 목록·diff 확인 | 변경 파일이 계획과 일치 |
| 3 | **프로세스 검증** | `npm run dev` → 해당 Phase 기능을 UI에서 직접 조작 | 모든 시나리오 통과 |
| 4 | **테스트** | `npm run test` → 관련 테스트 통과 확인, 필요 시 새 테스트 작성 | 전체 테스트 PASS |
| 5 | **보완** | 검증에서 발견된 버그·누락 수정 → 1~4 반복 | 재검증 통과 |
| 6 | **PROGRESS.md 갱신** | 본 문서의 해당 Phase 상태를 ✅로 변경하고 커밋 해시·변경 파일·이슈를 기록 | 본 문서 커밋·푸시 완료 |
| 7 | **다음 단계 진행 또는 Sprint 종결** | Phase가 Sprint 내부면 다음 Phase로. 마지막 Phase면 아래 "Sprint 종결 절차" 수행 | 다음 Phase 착수 또는 Sprint 아카이브 커밋 완료 |

### 📁 문서 책임 매트릭스

| 문서 | 역할 | 갱신 시점 |
|------|------|-----------|
| `PROGRESS.md` (본 문서) | **현재 진행 + 앞으로 할 일** SSOT, 대시보드 | 매 Phase 완료마다 |
| `docs/progress/SPRINT{n}.md` | **종결된 Sprint 아카이브** | Sprint 종결 시 일괄 이관 |
| `docs/progress/SCHEMA_COVERAGE.md` | 모델 구현 현황 트래커 | 모델 상태 변동 시마다 |

**원칙**:
- Sprint 진행 중 이력은 PROGRESS.md 본문에만 기록. `SPRINT{n}.md` 에 미리 이중 기록 금지.
- Sprint 종결 시 해당 Sprint 섹션 전체를 `SPRINT{n}.md` 로 이동 후 PROGRESS.md 에는 한 줄 요약 + 링크만 남긴다.
- 종결된 Sprint 의 Phase 결정사항·이력은 PROGRESS.md 본문에 잔류시키지 않는다.

### Sprint 종결 절차 (체크리스트)

1. Sprint 통계 확정 (총 Phase, 커밋, 변경 파일, 테스트, TS 오류, any 사용 수)
2. PROGRESS.md 의 해당 Sprint 상세 이력 → `docs/progress/SPRINT{n}.md` 로 이동 (컷·앤·페이스트)
3. PROGRESS.md 본문에는 한 줄 요약 + `> 상세 이력 → docs/progress/SPRINT{n}.md` 링크만 남김
4. `SCHEMA_COVERAGE.md` 변경 이력에 "Sprint {n} 종결" 라인 추가
5. 커밋 메시지: `docs(progress): close sprint {n} — archive history to SPRINT{n}.md`
6. 다음 Sprint 의 "현재 상태 요약" 갱신

### 예외
- 핫픽스/회귀 수정은 진행 중 Sprint 의 새 Phase 번호(예: `4-D hotfix`)로 추가.
- 종결된 Sprint 에 대한 추가 메모는 해당 `SPRINT{n}.md` 하단 "사후 추가" 섹션에 append. PROGRESS.md 는 건드리지 않는다.

---

## 🎯 SOLUTION CORE — 절대 잊지 말 것

### 풀려는 진짜 문제
식단 기반으로 발주·입고·사용을 정확히 추적하여 일자별 라인업 원가를 신뢰성 있게 산출하고,
폐기·재고 누수를 추적하여 BOM·운영의 적정성을 진단한다.

### 산출물 (목적)
- 일별 라인업 원가 (실시간 경영지표)
- 폐기율 / 원가 편차 / 재고 잔존 (운영 진단)
- 월말 재무회계 원가 (크로스체크용)

### 도구 (수단, 목적 아님)
발주서 · 입고서 · 작업지시서 · 재고 트랜잭션 · 실사

### 헌법 (P1 ~ P10)

| # | 원칙 | 비고 |
|---|------|------|
| P1 | **발주는 식단(MealPlan) 기반**. 공급사 선두 선택 흐름 금지 | 수동 발주는 `isManual=true` 로 분리 |
| P2 | **Roll-up**: Company → Location(공장/창고) → ProductionLine | 모든 운영 도메인 |
| P3 | **재고는 공장/창고에만 존재**. Company 는 무재고 | 회계 단위는 Company |
| P4 | **사용(Consumption)은 공장에서만** 발생 | ProductionLine 단위 추적 |
| P5 | 입고 확정 시 예약(Reservation) 생성 → 사용/폐기/재고전환으로 소진 | |
| P6 | **BOM / MealPlan 은 Company 레벨에서만** 관리 | 공장은 받아서 실행만 |
| P7 | 비용 계산 = (일별 사용 기반 운영원가) + (월말 스냅샷 회계원가) 하이브리드 | |
| P8 | 발주 PK 추적 키 = `outboundDate` (실제 출고일), 회계 키 = `snapshotDate` | |
| P9 | 단가 변경 이력은 **확정 시점**에 `SupplierItemPriceHistory` 적층 (자동) | Sprint 3 결정: 발주 DRAFT→SUBMITTED 시점 적층 (P9' 와 함께 작동) |
| P9' | 발주서 작성/수정 단계의 `unitPrice` 편집은 `PurchaseOrderItem.unitPrice` 에만 영향 — `SupplierItem.currentPrice` 불변 | DRAFT 단계에서는 마스터 갱신 없음. SUBMITTED 전환 시 변경분만 적층 + 마스터 갱신 |
| P10 | 모든 레벨이 발주→입고→사용→재고→폐기 전체 라이프사이클 지원 | |

### 작업 전 체크리스트
새 Phase 시작 전 반드시 자문:
- [ ] 이 작업이 "실시간 원가" 또는 "재무 원가" 산출에 어떻게 기여하는가?
- [ ] 회사 / 공장 / 제조라인 어느 계층에서 작동하는가?
- [ ] 헌법 P1 ~ P10 중 어느 것도 위반하지 않는가?
- [ ] 식단(회사) → 발주(롤업) → 입고(Location) → 사용(FACTORY) 흐름의 어느 위치인가?

---

## 📍 현재 상태 요약

- **현재 진행 중 Sprint**: Sprint 3 (발주 + 입고)
- **현재 기준 완료 지점**: Sprint 3 Phase 4-B'-4 (DRAFT→SUBMITTED PriceHistory 적층)
- **현재 진행 항목**: Phase 4-B'-5a (위저드 server actions 착수 대기)
- **현재 블로커**: 없음
- **누적 테스트**: 343 PASS / 2 skipped / 0 fail
- **TypeScript errors**: 0

---

## 🏗️ Sprint 3: 발주 + 입고 (진행 중)

### Sprint 3 Phase 일정 및 상태

| Phase | 내용 | 상태 | 커밋 |
|---|---|---|---|
| 1 | PO Zod schema | ✅ | (Sprint 3 Phase 1) |
| 2 | PO Service Layer | ✅ | `84e59dc2` |
| 3 | PO Server Actions | ✅ | `28b53151` |
| 4-A | PO 목록 페이지 | ✅ | `90809007` |
| 4-A.1 | 인도일 → 입고예정일 통일 | ✅ | `9f4507e8` |
| ~~4-B (구버전)~~ | ~~공급사 선두 폼 다이얼로그~~ | ❌ **폐기** | `f83eeab2` |
| 0-A | 잘못된 Phase 4-B 제거 + 페이지 안정화 | ✅ | `98c4cdb1` |
| 0-B | SupplierItem action 시그니처 정리 + 문서 갱신 | ✅ | `b4c9143a` |
| 0-C | DB 점검 + PO location/productionLine 마이그레이션 SQL 확정 | ✅ | (Phase 1.5 에 흡수) |
| **1.5** | PurchaseOrder 스키마 확장 (locationId NOT NULL, productionLineId nullable) | ✅ | `58da2a1e`, `f1db9d25` |
| **4-B'-1** | 단위 환산 라이브러리 (`calculateOrderQuantity`) | ✅ | `b6ec1240` |
| **4-B'-2** | MR → PO 항목 변환 헬퍼 (`buildPOItemsFromMR`) + InventoryAdapter placeholder | ✅ | `af333130` |
| **4-B'-3** | 배치 PO 생성 서비스 (`createPurchaseOrdersBatch`) | ✅ | `ff6b5071` |
| **4-B'-4** | DRAFT→SUBMITTED 시 PriceHistory 적층 | ✅ | `5232ec46` |
| **4-B'-5a** | 위저드 server actions (`getMealPlanGroupsForOrder`, `loadPOWizardData`, `createPurchaseOrdersBatchAction`) | 🔄 **착수 대기** | - |
| 4-B'-5b | 위저드 UI 골격 (`/purchase-orders/new`, Step 1·2) | ⬜ | - |
| 4-B'-5c | 위저드 UI 메인 (Step 3 매핑 · Step 4 미리보기 · Step 5 일괄 생성) | ⬜ | - |
| 4-C | 상세보기 + 상태 전이 다이얼로그 | ⬜ | - |
| 4-D | 수동 발주 다이얼로그 (4-B' 컨벤션 재사용, `isManual=true`) | ⬜ | - |
| 5 | ReceivingNote 백엔드 (수량만, 단가는 P9' 에 따라 발주 단계로 위임) | ⬜ | - |
| 6 | ReceivingNote UI | ⬜ | - |
| 7 | MaterialRequirement → PO 자동 생성 파이프라인 | ⬜ | - |
| 8 | CookingPlan / Consumption 연계 | ⬜ | - |

### Sprint 3 결정사항 (라이프사이클 정책)

#### POStatus enum 라벨 매핑 (옵션 A 채택)

`POStatus` enum 을 그대로 유지하고 운영 라벨을 다음과 같이 매핑한다.
대안(`DRAFT→REGISTERED→MODIFIED→CONFIRMED`) 은 `MODIFIED` 가 라이프사이클 상태가 아니라 행동(action)이고, 부분 입고 정책이 `receivedQty` 로 충분히 표현됨에 따라 폐기.

| enum | 운영 라벨 | 수정 가능 | 입고 가능 | 비고 |
|------|-----------|-----------|-----------|------|
| DRAFT | 작성중 | ✅ 자유 | ❌ | 초안 |
| SUBMITTED | 발주등록 | ✅ 자유 | ❌ | 공급업체 통보 전 자유 편집 |
| APPROVED | 발주확정 | ⚠️ 사유 기록 시 허용 | ✅ | 부분 입고 진행 가능 |
| RECEIVED | 입고완료 | ❌ 잠금 | — | 전량 입고 완료 |
| CANCELLED | 취소 | ❌ 잠금 | ❌ | 취소 사유 기록 필수 |

#### 라이프사이클 추적 필드
`PurchaseOrder` 에 추가됨: `submittedAt`, `approvedByUserId`, `cancelledAt`, `cancelledByUserId`, `cancelReason`.

#### 부분 입고 정책
한 PO 에 N 개 ReceivingNote 가능. `PurchaseOrderItem.receivedQty` 누적이 `quantity` 도달 시 PO 자동 `APPROVED → RECEIVED` (서비스 가드).

#### 보정 발주 (별도 트랙)
CONFIRMED / RECEIVED 이후 발견된 오배송·누락은 본 PO 를 수정하지 않고 별도 보정 PO 로 분리. `PurchaseOrder.note` 에 원본 PO 참조 기록.

### Sprint 3 Phase 4-B' 결정사항 (식단 기반 발주 위저드)

#### D1. PO 의미론
1 PurchaseOrder = "1 공장 × 1 공급업체 × 1 발주일" 의 자재 묶음. 즉 위저드는 `MealPlanGroup` 1 개를 입력으로 받아 N 개 DRAFT PO 를 동시에 생성한다 (공장 × 공급업체로 그룹핑).

#### D2. 위저드 vs 수동 발주
- 위저드 (`/purchase-orders/new`): 식단 기반 자동. `sourceType='WIZARD_AUTO'`, `isManual=false`.
- 수동 (`4-D`): 식단 외 소모품·예외 케이스. `isManual=true`. 4-B' 컨벤션(공장 × 공급업체 그룹핑, 단가 적층 정책)을 그대로 재사용.

#### D3. 단위 환산 체인 (2 단계)
필요량(g) → `UnitConversion` → 환산전 단위(예: 포) → `SupplierItem.supplyUnit × supplyUnitQty` → 발주 단위(박스·포대 등).
예시: 19,000 g → 19 포 → 0.95 박스 → `Math.ceil` → **1 박스**.

엣지케이스: `UnitConversion` 미등록 → 경고 + 수동 입력 강제. 계수 0/null → 1 로 간주 + 경고. 소수 결과 → 기본 `Math.ceil`, 사용자 수정 가능.

#### D4. PriceHistory 적층 정책
- DRAFT 단계: 사용자가 `unitPrice` 자유 편집. `SupplierItem.currentPrice` 불변, `PriceHistory` 비적층 (P9' 준수).
- **DRAFT → SUBMITTED 전이 시점**: 변경된 항목만 `SupplierItemPriceHistory` 적층 + `SupplierItem.currentPrice` 갱신.
- SUBMITTED → DRAFT 회수: 히스토리·`currentPrice` 모두 보존 (롤백 안 함).
- 입고 단계(Phase 5): 단가 UI 없음. 수량만 처리.
- 단가 이력 수정 UI 는 별도 (`SupplierItem 상세 > 단가 이력`) 에서 직접 편집 가능.

#### D5. PO 그룹핑 키
`supplierId × locationId × productionLineId` (null 은 별도 그룹). 같은 그룹은 1 개 DRAFT PO 로 통합.

#### D6. 미매핑 자재 처리 (스키마 변경 없음)
"미지정" = BOM 의 자재 자체가 아니라 **자재→공급사 상품 매핑**이 안 된 상태. 즐겨찾기(`MaterialMaster.defaultSupplierItemId`) 자동 적용 후 미매핑 항목은 UI 클라이언트 상태로 빨간 영역에 표시. 미매핑이 1 건이라도 있으면 "발주 생성" 버튼 비활성화. DB 모델 추가 불필요.

#### D7. 회사 계층 발주
PO 는 항상 공장(Location) 단위로 생성됨 (P2 롤업). 회사 계층 사용자는 모든 공장 PO 를 볼 뿐, 공장 미지정 PO 는 생성되지 않는다 → `locationId` NOT NULL 유지.

#### D8. 재고 인터페이스 (Phase 6 대비)
`InventoryAdapter` 인터페이스 + `noopInventoryAdapter` (재고 0 반환) 도입. Sprint 4 재고 구현 시 실제 어댑터로 교체.

### Sprint 3 누적 산출물 요약

**신규 파일** (백엔드):
- `src/features/purchase-order/schemas/purchase-order.schema.ts`
- `src/features/purchase-order/services/purchase-order.service.ts`
- `src/features/purchase-order/services/purchase-order-batch.service.ts`
- `src/features/purchase-order/actions/purchase-order.action.ts`
- `src/features/purchase-order/lib/unit-conversion.ts`
- `src/features/purchase-order/lib/build-po-items-from-mr.ts`
- `src/features/purchase-order/lib/inventory-adapter.ts`
- `src/features/purchase-order/lib/stack-price-history.ts`

**테스트**: `unit-conversion (16) + build-po-items-from-mr (9) + purchase-order-batch (17) + stack-price-history (8) + purchase-order.service (27 — 8 신규 포함) + purchase-order.schema (27)` = Sprint 3 신규 104 tests.

**도메인 에러 코드**:
`NOT_FOUND` / `PO_LOCKED` / `PO_NOT_DRAFT` / `INVALID_TRANSITION` / `LOCATION_NOT_FOUND` / `PRODUCTION_LINE_NOT_FOUND` / `LINE_LOCATION_MISMATCH` / `EMPTY_ITEMS` / `SUPPLIER_NOT_FOUND` / `SUPPLIER_ITEM_NOT_FOUND`

**권한 키**: `purchase-order:READ` / `:CREATE` / `:UPDATE` / `:DELETE` (Sprint 7 PermissionSet seed 등록 예정)

---

## 📋 Sprint 3 다음 단계 상세 (Phase 4-B'-5)

### 4-B'-5a: 위저드 Server Actions (착수 대기)

**수정 파일**:
- `src/features/purchase-order/schemas/purchase-order.schema.ts` — `loadPOWizardDataSchema` append
- `src/features/purchase-order/actions/purchase-order.action.ts` — 3 개 action 추가

**신규 actions**:
- `getMealPlanGroupsForOrderAction()` — Step 1 드롭다운용. 30 일 이내 `IN_PROGRESS`/`COMPLETED` MealPlanGroup 목록.
- `loadPOWizardDataAction(input)` — Step 2 자동 로드. MR 조회 + `buildPOItemsFromMR` 호출.
- `createPurchaseOrdersBatchAction(input)` — Step 5 일괄 생성. `createPurchaseOrdersBatch` 호출 + 각 PO 감사 로그.

### 4-B'-5b: 위저드 UI 골격

**신규 파일**:
- `src/app/(dashboard)/purchase-orders/new/page.tsx` — 라우트 + 인증 가드
- `src/features/purchase-order/components/wizard/po-wizard.tsx` — 클라이언트 위저드 컨테이너
- `src/features/purchase-order/components/wizard/step-meal-plan-group-select.tsx` — Step 1
- `src/features/purchase-order/components/wizard/step-load-summary.tsx` — Step 2

**페이지 연결**: `purchase-orders/page.tsx` 의 "신규 발주" 버튼 → `router.push('/purchase-orders/new')`.

### 4-B'-5c: 위저드 UI 메인

- Step 3: 매핑 테이블 (미매핑 강조, 단가 변경 색 구분, 자동 ceil 알림)
- Step 4: 공장 × 공급업체 분할 미리보기 (배너 + 행 아이콘)
- Step 5: 일괄 생성 모달 + 토스트 + 리다이렉트
- localStorage 임시 저장, 환산 불가 행 메모 기능 포함

---

## 🗂️ 종결된 Sprint 요약

### Sprint 1 — 안정화 + 품질 기반 확보 ✅
- 기간: 2026-05-04 ~ 2026-05-12
- 14 Phase / 16 커밋 / 158 tests / 0 failures, TS errors 0, any 0
- 핵심 산출물: Sonner toast 인프라, UnitMaster 중앙 관리, Container 의존성 가드, duplicateRecipeBOM, handleActionError 통일, Error Boundary, CONVENTIONS 12 규칙
- > 상세 이력 → `docs/progress/SPRINT1.md`

### Sprint 2 — 식단 템플릿 · 식단 계획 ✅
- 기간: 2026-05-13 ~ 2026-06-11
- 핵심 산출물: MealTemplate / MealPlanGroup / MealPlan / MealPlanSlot / MealCount / MealPlanAccessory / Lineup / CompanyMealSlot / Location / ProductionLine / MaterialRequirement 도메인 완성, Phase 5-R 구조 재정의, Phase 7-F BOM 적격 가드, Phase 8.5 Location/ProductionLine 마스터, Phase 9-A MR 서비스, Phase 9-C-Fix-R1 슬롯 정합성, Phase 9-D-Sym 수량 대칭 분리
- 테스트: 239 PASS / 2 skipped / 0 fail, TS errors 0
- > 상세 이력 → `docs/progress/SPRINT2.md`

### Sprint 2.5 — 단위 관리 중앙화 ✅
- 기간: 2026-06-12 (~6h 임시 라운드)
- 핵심 산출물: `UnitCategory.PACKAGE` 추가, `SupplierItem.supplyUnit → supplyUnitId` FK 전환, `UnitCombobox` 컴포넌트, 카테고리 사전 선택 UI 제거, UnitConversion 자동 도출
- > 상세 이력 → `docs/progress/SPRINT2.md` (Sprint 2.5 섹션)

### Sprint 2 잔여 (Sprint 3 또는 백로그로 이관)

| 항목 | 이관 위치 |
|------|-----------|
| Phase 2-e — 부자재-공급업체 연결 UX | 백로그 |
| Phase 6 — 식단 캘린더 뷰 | 백로그 (독립 가능) |
| Phase 7-E — BOM 슬롯 totalWeightG 자동 합산 / 캘린더 공용 컴포넌트 | 백로그 |
| Phase 7-G — 단위 환산 가드 | Sprint 2.5 에서 일부 흡수, Sprint 3 4-B'-1 에서 환산 라이브러리로 완결 |
| Phase 9-A-4 — MR 서비스 추가 테스트 | 백로그 |
| Phase 9-D-Acc — 부자재 사용처 지정 + 독립 발주 트랙 | Sprint 3 4-D 또는 Sprint 4 통합 검토 |
| Phase 9-D-Sym 후속 — `collectGroupSlotQtyIssues` FINAL 분기 | 확정식수 분배 정책 도입 시점 |
| Phase 9-E — PO 자동 생성 연결 | Sprint 3 Phase 7 |
| Phase 10-Lint — 린트 일괄 정리 (react-hooks 24 / no-explicit-any 72 / no-unescaped-entities 2 / no-unused-vars 11) | 별도 정리 스프린트 |
| Phase 11 — 페이지 통합 + 최종 QA | Sprint 8 |

### Sprint 2 잔여 정리 항목 (라이트)
- `page.tsx` 의 `openMealCountEditor` / `closeMealCountEditor` / `handleSaveMealCount` 들여쓰기 정리 (기능 영향 없음)

---

## 🗺️ 앞으로의 Sprint 로드맵

### Sprint 4 — 재고 + 이동 + 실사 + 출고 + 소비 + 조리계획 (~62h)

| Phase | 내용 | 추정 공수 |
|-------|------|-----------|
| 1 | 재고 조회 서비스 (InventoryLot, InventoryTransaction) | 4h |
| 2 | 재고 UI (`/inventory`) | 4h |
| 3 | InventoryReservation 서비스 | 3h |
| 4 | InventoryTransfer 서비스 + 액션 | 4h |
| 5 | InventoryTransfer UI | 4h |
| 6 | StockTake 서비스 + 액션 | 4h |
| 7 | StockTake UI | 3h |
| 8 | ShippingOrder 서비스 + 액션 | 4h |
| 9 | ShippingOrder UI | 3h |
| 10 | ConsumptionItem 서비스 + 액션 (자재·부자재 통합) | 4h |
| 11 | ConsumptionItem UI | 3h |
| 12 | CookingPlan 서비스 + 액션 | 5h |
| 13 | CookingPlan UI | 4h |
| 14 | 테스트 보강 | 4h |
| 15 | Sprint 4 E2E + QA | 3h |

**Sprint 4 진입 시 확장할 결정사항 (사전 합의 보존)**:
- ConsumptionItem 처분 enum: `USED` / `RETURNED` / `DISPOSED`
- DisposalReason enum: `EXPIRED` / `DAMAGED` / `CONTAMINATED` / `OVER_PREPARED` / `OTHER`
- 손질손실(`TRIMMING_LOSS`)은 `BOM.yieldRate` 흡수, 폐기에 미포함
- 재고 검증식: `기초 + ∑PURCHASE − ∑CONSUMPTION(USED) − ∑DISPOSAL(DISPOSED) ± ∑TRANSFER ± ∑ADJUSTMENT = 기말`
- `InventoryLot.materialMasterId` nullable 전환 (부자재 표현 보강), `itemType` 인덱스 추가
- `InventoryAdapter` (Sprint 3 placeholder) 의 실제 구현 연결

### Sprint 5 — 원가 + 간접비 + 월말 마감 + 알림 (~52h)

12 Phase: 원가 스냅샷 / CostCalculation / OverheadCost / MonthEnd / Notification + E2E.

**진입 시 확장할 결정사항**:
- 원가 산출 공식: 예상원가 (MR.ESTIMATED) / 확정원가 (∑USED × Lot 단가) / 손실원가 (∑DISPOSED × Lot 단가) / 원가편차 / 손실률
- `CostType { ESTIMATED, ORDER_BASED, ACTUAL }` 유지. 손실원가는 별도 enum 값 없이 `disposition` 컬럼으로 분기.

### Sprint 6 — 조직 관리 (~38h)
Company / Location 재점검 / ProductionLine 재점검 / Lineup / 사이드바 재구성.
> Phase 8.5 (Location · ProductionLine 마스터)는 Sprint 2 에서 선반영 완료.

### Sprint 7 — 권한 + 사용자 + 초대 (~42h)
User / UserScope / PermissionSet / Invitation + UI + E2E.
Sprint 3 에서 등록 예정인 권한 키들을 PermissionSet seed 에 반영.

### Sprint 8 — 대시보드 + 감사로그 + UX 통일 + 최종 QA (~38h)
메인 대시보드 / AuditLog UI / AutoGenLog UI / CONVENTIONS 최종 점검 / 전체 E2E.

---

## ⏸ 보류 범위

구조 재정의 보강 완료 전 본격 착수하지 않는다:
InventoryReservation · InventoryTransfer · StockTake · ShippingOrder · ConsumptionItem · CookingPlan 본 구현 · CostSnapshot / CostCalculation / OverheadCost / MonthEnd* · Notification* · 조직/권한/초대 · AuditLog 조회 UI · AutoGenLog 조회 UI.

---

## 🤝 Handoff 기준

다음 모델 또는 개발자는 아래 순서로 읽고 시작한다:

1. `PROGRESS.md` (본 문서) — 현재 상태와 다음 단계
2. `docs/progress/SCHEMA_COVERAGE.md` — 모델별 구현 상태
3. `docs/progress/SPRINT2.md` — 최근 작업 컨텍스트 (식단·MR 도메인)
4. `docs/progress/SPRINT1.md` — Sprint 1 안정화 이력
5. `01_개발순서.md` ~ `07_HANDOFF.md` — 기획·설계 문서

---

## 📋 Prisma 스키마 모델 커버리지

요약: 총 69 모델 중 식단·자재 도메인은 ✅, 발주·재고·원가·조직·권한·알림은 ⬜ 또는 🔄.
- PurchaseOrder / PurchaseOrderItem: 🔄 (Sprint 3 Phase 1.5 에서 `locationId` / `productionLineId` 추가, Phase 4-B' 위저드 백엔드 진행 중)
- 상세 표 → `docs/progress/SCHEMA_COVERAGE.md`
