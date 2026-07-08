# LunchLab ERP — 프로젝트 진행 현황

> 본 문서는 **현재 진행 상황과 앞으로 할 일** 을 관리하는 SSOT(단일 진실 공급원)이다.
> 종결된 Sprint 의 상세 이력은 `docs/progress/SPRINT{n}.md` 로 이관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에서 관리한다.
>
> 마지막 갱신: 2026-07-08 (Sprint 3 종결 완료 — 상세 이력 → `docs/progress/SPRINT3.md`. 다음: Sprint 3.5 수동 발주 보완 → Sprint 4 착수)

---

## 📌 작업 프로세스 규칙

모든 Phase 는 아래 7단계를 순서대로 따른다. 단계를 건너뛰지 않는다.

| 순서 | 단계 | 설명 | 완료 기준 |
|------|------|------|-----------|
| 1 | **깃 배포** | 코드 수정 → `npx tsc --noEmit` → `git commit` → `git push origin main` | push 성공, GitHub 에서 커밋 확인 |
| 2 | **레포 검증** | GitHub 레포에서 변경 파일 목록·diff 확인 | 변경 파일이 계획과 일치 |
| 3 | **프로세스 검증** | `npm run dev` → 해당 Phase 기능을 UI 에서 직접 조작 | 모든 시나리오 통과 |
| 4 | **테스트** | `npm run test` → 관련 테스트 통과 확인, 필요 시 새 테스트 작성 | 전체 테스트 PASS |
| 5 | **보완** | 검증에서 발견된 버그·누락 수정 → 1~4 반복 | 재검증 통과 |
| 6 | **PROGRESS.md 갱신** | 본 문서의 해당 Phase 상태를 ✅ 로 변경하고 커밋 해시·변경 파일·이슈 기록 | 본 문서 커밋·푸시 완료 |
| 7 | **다음 단계 진행 또는 Sprint 종결** | Phase 가 Sprint 내부면 다음 Phase 로. 마지막 Phase 면 아래 "Sprint 종결 절차" 수행 | 다음 Phase 착수 또는 Sprint 아카이브 커밋 완료 |

### 문서 책임 매트릭스

| 문서 | 역할 | 갱신 시점 |
|------|------|-----------|
| `PROGRESS.md` (본 문서) | **현재 진행 + 앞으로 할 일** SSOT, 대시보드 | 매 Phase 완료마다 |
| `docs/progress/SPRINT{n}.md` | **종결된 Sprint 아카이브** | Sprint 종결 시 일괄 이관 |
| `docs/progress/SCHEMA_COVERAGE.md` | 모델 구현 현황 트래커 | 모델 상태 변동 시마다 |

**원칙**
- Sprint 진행 중 이력은 PROGRESS.md 본문에만 기록. `SPRINT{n}.md` 에 미리 이중 기록 금지.
- Sprint 종결 시 해당 Sprint 섹션 전체를 `SPRINT{n}.md` 로 이동 후 PROGRESS.md 에는 한 줄 요약 + 링크만 남긴다.
- 종결된 Sprint 의 Phase 결정사항·이력은 PROGRESS.md 본문에 잔류시키지 않는다.

### Sprint 종결 절차 (체크리스트)

1. Sprint 통계 확정 (총 Phase, 커밋, 변경 파일, 테스트, TS 오류, any 사용 수, 신규 마이그레이션)
2. PROGRESS.md 의 해당 Sprint 상세 이력 → `docs/progress/SPRINT{n}.md` 로 이동 (컷·앤·페이스트)
3. PROGRESS.md 본문에는 한 줄 요약 + `> 상세 이력 → docs/progress/SPRINT{n}.md` 링크만 남김
4. `SCHEMA_COVERAGE.md` 변경 이력에 "Sprint {n} 종결" 라인 추가 + 관련 모델 상태 갱신
5. 커밋 메시지: `docs(progress): close sprint {n} — archive history to SPRINT{n}.md`
6. 다음 Sprint 의 "현재 상태 요약" 갱신

### 예외
- 핫픽스/회귀 수정은 진행 중 Sprint 의 새 Phase 번호(예: `4-D hotfix`)로 추가.
- 종결된 Sprint 에 대한 추가 메모는 해당 `SPRINT{n}.md` 하단 "사후 추가" 섹션에 append. PROGRESS.md 는 건드리지 않는다.

---

## 🎯 SOLUTION CORE — 절대 잊지 말 것

### 이 솔루션의 초기 목적 (2026-07-08 재확인)

**최우선 목적**: **재고 관리 + 원가 관리**.

1. **사용량 기반의 데일리 원가 도출** — 매일 라인업별 원가를 산출하여 경영지표로 활용. 잘못 기입된 데이터(BOM 오류·수량 오기입·손실 누락 등)를 식별하는 근거.
2. **회계 기반 원가 산출 병행** — `기초재고 + 당월매입 − 기말재고 = 회계원가` 로 사용량 기반 원가를 **검증**하고 재고 관리와 연결. 두 원가의 편차가 곧 데이터 신뢰도 지표.
3. **예상 식수 원가 ↔ 확정 식수 원가 비교** — MealPlan 확정 전후의 원가 시뮬레이션 및 실제 원가와의 편차 검토.
4. **예상/확정 식수 대비 실제 사용량 비교 → BOM 적정성 판단** — 3축 비교(예상수량·확정수량·실사용량)로 BOM(레시피) 의 현실 정합성 진단.
5. **재고 현황 실시간 파악** — 다음 발주 시 참고, 악성 재고(장기 미사용·유효기간 임박) 판단.
6. **재고 실사(StockTake)로 이론재고 ↔ 실재고 정합화** — 회계 기반 원가 산출의 정확도 담보 축.

### 산출물 (목적)
- **일별 라인업 원가** (최우선 경영지표)
- 공장별·제조라인별 원가 (레퍼런스·이상치 추적축)
- 폐기율 / 원가 편차 / 재고 잔존 (운영 진단)
- 월말 재무회계 원가 (크로스체크용)

### 도구 (수단, 목적 아님)
발주서 · 입고서 · 재고이동 · 작업지시서(CookingPlan) · 재고 트랜잭션 · 실사 · 폐기

### 원가 흐름 (대시보드 축)

대시보드는 다음 흐름을 **한눈에** 보여주어야 한다:

```
발주 금액 → 입고 금액 → 총 사용 금액 → 라인업별 사용 금액 → (예상 수량 기반 원가 vs 확정 수량 기반 원가)
```

각 단계 간 편차가 곧 이상치 탐지 지점이다. 예: `입고 금액 ≠ 발주 금액` → `ReceivingDiscrepancy` 원인, `총 사용 금액 ≠ 라인업별 사용 금액 합계` → 미귀속 소비 존재 등.

### 재고 등급 관리 (ABC 분류) — 상시 관리 프로세스

**목적**: 사용량·비용 기여도가 큰 자재는 촘촘히, 낮은 자재는 성기게 관리하여 실사 부담과 정확도를 균형화한다. 등급은 **일회성 부여가 아니라 상시 재평가되는 관리 대상**이다.

**등급 정의**:
- **가(A) 등급**: 사용량이 많고 단가/총액 비중이 큰 핵심 자재. **사용 시마다 실사 촉구** (Consumption 확정 시 배너).
- **나(B) 등급**: 중간 비중 자재. **주 1회 실사 도래**.
- **다(C) 등급**: 저비중·소모성 자재. **월 1회 실사 도래**.

**적용 대상**: 원자재(`MaterialMaster.stockGrade`) 와 부자재(`SubsidiaryMaster.stockGrade`) **모두**. `StockGrade` enum(A/B/C) 은 스키마에 이미 정의됨.

**관리 원칙 (정본 = 사용자 결정)**:
1. **직접 편집이 최우선 정본**: 사용자가 자재 마스터에서 등급을 직접 부여·수정할 수 있다.
2. **주기적 재평가 (상시)**: 시스템이 정기 배치(초기 안: 매월 1일)로 최근 N개월(초기 안: 3개월) 사용액을 파레토 분석(80/15/5)하여 **"현재 등급과 다르게 판정되는 자재"** 를 "변경 후보 목록"에 지속적으로 노출한다.
3. **변경/유지는 사용자 결정**: 후보 목록의 각 자재에 대해 사용자가 **변경 승인** 또는 **현행 유지** 를 명시적으로 선택한다. 시스템은 절대로 자동 변경하지 않는다.
4. **결정 이력 축적**: 변경·유지 결정은 `StockGradeReviewLog`(신규, S6-7 스키마 보강) 에 이력으로 남아 향후 재평가 판정에서 "최근 유지 결정된 자재"는 재추천 우선순위를 낮춘다.

**흐름 요약**:
1. 등급 편집: Sprint 6 S6-7 (`/settings/stock-grades`) — 자재별 등급 직접 부여·수정
2. 자동 재평가: S6-7 배치(월 1회) — 후보 목록 자동 갱신
3. 리뷰 UI: S6-7 (`/settings/stock-grades/review`) — 후보 리스트 + 각 자재별 [변경] / [유지] 액션
4. 실사 대상 산출: Sprint 4 S4-4 — 현재 등급 기준으로 실사 도래 자재 자동 추출
5. 도래 알림: Sprint 5 S5-5 — `STOCK_TAKE_DUE_{A|B|C}` 태그로 발송
6. 리뷰 도래 알림: Sprint 5 S5-5 — `STOCK_GRADE_REVIEW_PENDING` 태그로 미결 후보 알림

### 헌법 (P1 ~ P11)

| # | 원칙 | 비고 |
|---|------|------|
| P1 | **발주는 식단(MealPlan) 기반이 원칙이되, 독립(수동) 발주도 지원**. 수동 발주는 `PurchaseOrder.isManual=true` 로 분리 | 수동 발주도 **입고지 Location NOT NULL + 라인업(Lineup) NOT NULL** — 원가 귀속 누락 방지 (P1' 참조) |
| P1' | **수동 발주의 필수 지정 항목**: 공장(Location), 라인업(Lineup). 선택: ProductionLine. | 식단 기반 발주는 MealPlan 이 계층을 지정하지만, 수동 발주는 사용자가 명시해야 원가 산정 축이 확보됨 |
| P2 | **Roll-up**: Company → Location(FACTORY/WAREHOUSE/HYBRID) → ProductionLine | 계층 분리 원칙 (아래 보강) |
| P3 | **재고는 `LocationType ∈ {FACTORY, WAREHOUSE, HYBRID}` 인 Location 에만 존재**. Company·ProductionLine 은 재고를 갖지 않는다 | 스키마 강제: `InventoryLot.locationId` NOT NULL. `ProductionLine.locationId` 는 FK 로 소속만 표현, 자체 Lot 소유 금지 (아래 보강) |
| P4 | **사용(Consumption)은 `LocationType=FACTORY` 소속 ProductionLine 에서만** 발생 | ProductionLine 단위 추적. Lot 은 그 ProductionLine 이 속한 Location(FACTORY) 의 것을 소비. 스키마: `CookingPlan.productionLineId` NOT NULL |
| P5 | 입고 확정 시 InventoryLot 생성 + PO 자동 종결 (단일 트랜잭션) | 재정정 있음 (아래) |
| P6 | **BOM / MealPlan 은 Company 레벨에서만** 관리 | 공장은 받아서 실행만 |
| P7 | 비용 계산 = (일별 사용 기반 운영원가) + (월말 스냅샷 회계원가) 하이브리드 | 두 원가의 편차가 데이터 신뢰도 지표 |
| P8 | 발주 PK 추적 키 = `outboundDate` (실제 출고일=엔드라인 사용일), 회계 키 = `MonthEndSnapshot.closingMonth` | |
| P9 | 단가 마스터 갱신은 **DRAFT → SUBMITTED** 시점에만 (자동) | `SupplierItemPriceHistory` 적층 + `SupplierItem.currentPrice` 갱신 |
| P9' | 발주서 작성/수정 단계의 `unitPrice` 편집은 `PurchaseOrderItem.unitPrice` 에만 영향 — `SupplierItem.currentPrice` 불변 | DRAFT 단계 마스터 갱신 없음. SUBMITTED 전환 시 변경분 적층 + 마스터 갱신 |
| P10 | 모든 레벨이 발주→입고→(이동)→사용→재고→폐기 전체 라이프사이클 지원 | |
| P11 | **마이너스 재고 절대 금지 (Pre-flight 필수)** | 사용은 반드시 잔량 확보 후에만 가능. 잔량 부족 시 `INSUFFICIENT_STOCK` 로 차단 (P11 보강) |

### 헌법 보강

#### P1'/P1 보강 — 발주 두 경로 (2026-07-08 명시)

발주는 두 경로가 있으며, 두 경로 모두 **입고지·원가 귀속 축을 반드시 확보한다**.

| 경로 | 트리거 | 계층 지정 | 라인업 지정 | `isManual` |
|---|---|---|---|---|
| 식단 기반 발주 | `MaterialRequirement` 자동 산출 → 위저드 확정 | MealPlan 이 자동 결정 (Company → Location → ProductionLine) | MealPlan 슬롯을 통해 자동 연결 (`MaterialRequirement.lineupId`) | `false` |
| 수동(독립) 발주 | 사용자가 자재·수량·공급사 직접 선택 | **사용자가 명시 필수** (Location NOT NULL, ProductionLine 선택) | **사용자가 명시 필수** (Lineup NOT NULL) — 원가 귀속 축 확보 | `true` |

- 수동 발주가 원가 산정에 누락되지 않도록, `PurchaseOrder.lineupId` 를 필수화한다 (수동 발주에 한하여). 식단 기반 발주는 MR 을 통해 이미 lineup 연결이 보장됨.
- Sprint 3.5(보완 Phase) 에서 수동 발주 UI/서비스를 신설한다 (아래 "다음 진행 항목" 참조).

#### P2 보강 — 계층 분리 원칙 (2026-07-08 명시)

`Company → Location → ProductionLine` 3계층은 모든 운영·권한·원가 도메인의 기본축이다. 스키마 실측 근거를 함께 명시한다.

| 계층 | LocationType | 성격 | 주 책임 | 무엇을 하지 않는가 |
|---|---|---|---|---|
| Company (회사) | — | 회계·마스터 | BOM, MealPlan, SupplierItem 마스터, Lineup 마스터, 원가 롤업, 월말 스냅샷 | **재고 직접 보유 금지** (P3) |
| Location (거점) | FACTORY / WAREHOUSE / HYBRID | 물류·재고 | **InventoryLot, InventoryTransaction, InventoryTransfer, ReceivingNote, StockTake 의 소유 주체** | BOM 편집·MealPlan 편집 금지 |
| ProductionLine (제조라인) | — | 실행·소비 | ConsumptionItem, CookingPlan, MealPlanSlot 배정 | **재고 소유 금지** — 소속 Location(FACTORY) 의 재고를 소비만 함 |

- 발주(PO)는 Company 에서 발생하지만 **Location 도착지 필수 + (nullable) ProductionLine** 을 지정한다 (D1/D5). 스키마: `PurchaseOrder.locationId` NOT NULL, `productionLineId` nullable.
- 사용자·권한·초대는 Company 아래 계층에 종속. 스키마: `UserScope(userId, companyId, role, permissionSetId?)`. Sprint 7 에서 UI 완성.
- `LocationType.FACTORY` 만 사용/조리 대상. `WAREHOUSE` 는 보관 전용. `HYBRID` 는 겸용.

#### P3 보강 — 재고 보유 주체 명문화 (2026-07-08)

**재고를 보유할 수 있는 유일한 주체는 `Location` 이며, 그 중에서도 `LocationType ∈ {FACTORY, WAREHOUSE, HYBRID}` 인 Location 만이다.**

- **Company 는 재고를 갖지 않는다** — Company 는 회계 롤업 축일 뿐. `InventoryLot.companyId` 는 조회 편의를 위한 denormalized 컬럼이며, 소유 주체가 아니다 (`locationId` 가 소유의 유일 판정 키).
- **ProductionLine 은 재고를 갖지 않는다** — 제조라인은 소속 FACTORY 의 Lot 을 "소비만" 한다. 스키마상 `InventoryLot.productionLineId` 컬럼은 존재하지 않으며, 존재해서도 안 된다.
- **Lot 의 회사 귀속은 불변**: `InventoryLot` 은 반드시 하나의 Company 내에서만 존재·이동한다. **Cross-Company 이동은 금지**된다. 이동 시 출발지·도착지 Location 의 `companyId` 가 동일해야 하며, 불일치 시 서비스 레벨에서 `CROSS_COMPANY_TRANSFER_FORBIDDEN` 로 차단한다.
- **재고 이동의 유일한 형태**: **동일 Company 내** 재고 보유 주체(Location) ↔ 재고 보유 주체(Location). 출발지·도착지가 모두 `LocationType ∈ {FACTORY, WAREHOUSE, HYBRID}` 이기만 하면 조합 제약이 없다.
  - WAREHOUSE → FACTORY (중앙창고 → 공장 보급)
  - WAREHOUSE → WAREHOUSE (창고 간 재배치)
  - **FACTORY → FACTORY (공장 간 재고 이관 — 잉여·긴급 지원)**
  - FACTORY → WAREHOUSE (공장 잔여 재고를 창고로 반납)
  - HYBRID 는 위 모든 조합의 출발·도착지로 참여 가능
  - `출발지 == 도착지` 자기 이동은 금지 (서비스 레벨 검증)
- Location → ProductionLine 이동은 개념적으로 존재하지 않으며, 실체는 "해당 ProductionLine 이 속한 Location 에서의 Consumption" 이다.
- 다지점 운영 시의 물류(중앙 창고 → 지점 등)는 위 조합 중 하나로 자연스럽게 표현된다.

#### P4 보강 — 사용 위치의 정합성 (2026-07-08)

- `ConsumptionItem.productionLineId` NOT NULL. 이 ProductionLine 의 `locationId` 는 반드시 `LocationType ∈ {FACTORY, HYBRID}` 여야 한다.
- 서비스 레이어에서 진입 시점에 검증 (`WAREHOUSE` 소속 ProductionLine 은 존재해서는 안 되지만 방어적으로 차단).
- Consumption 은 자기 Location 의 `InventoryLot` 만 차감할 수 있다. 타 Location 의 Lot 을 소비하려면 먼저 `InventoryTransfer` 를 CONFIRMED 시켜야 한다.

#### P5 재정정 (2026-06-30)

**도메인 이벤트: "입고 확정" = 재고 생성 + PO 종결 (단일 트랜잭션)**

`ReceivingNote.status = CONFIRMED` 시점에 단일 트랜잭션으로 다음을 원자적으로 수행한다:
1. `InventoryLot` 생성 + `InventoryTransaction(type=PURCHASE)` 적층
2. 발주↔입고 차이 발생 시 `ReceivingDiscrepancy` 스냅샷 기록
   - 4가지 타입: `QUANTITY_SHORT` / `QUANTITY_OVER` / `UNIT_PRICE_DIFF` / `ITEM_MISSING`
3. `PurchaseOrder.status → RECEIVED` **자동 전이** (발주 종결)

**설계 원칙**
- 입고 확정과 발주 종결은 "하나의 사용자 의사결정"으로 묶인다. 별도 버튼·별도 액션 없음.
- 수량 미달·초과·단가 차이는 **입고를 막지 않는다**. `ReceivingDiscrepancy` 에 스냅샷으로 기록하여 추후 재고 실사(Sprint 4) 및 원인 분석의 근거로 활용한다.
- "발주 목록의 입고 완료 버튼"은 존재하지 않는다. RECEIVED 는 오직 입고서 확정의 원자적 결과로만 도달한다.

**폐기된 안**
- 누적 수량 기반 자동 트리거 (부동소수 오차·시점 모호성)
- `markPurchaseOrderAsReceivedAction` (P5 를 두 도메인 이벤트로 분리한 잘못된 정정)

**분할 입고 정책 — Sprint 4 이후 검토**
현재 설계는 "1 발주 = 1 입고서" 단순 케이스 기준. N건 분할 입고 요구가 발생하면 별도 의사결정으로 확장한다.

#### P9 재정정 (2026-06-30)

**원칙: 발주 확정 = 거래 단가 확정**
- 단가 마스터 갱신은 **DRAFT → SUBMITTED 전이 시점에만** 발생한다.
  - `SupplierItemPriceHistory` 적층
  - `SupplierItem.currentPrice` 갱신
- 입고 확정 시점에는 단가 마스터를 **일절 갱신하지 않는다**.
  - `InventoryLot.unitPrice = PurchaseOrderItem.unitPrice` 를 그대로 사용 (PO 단가가 정본)
  - 입고 실 단가가 PO 와 다르면 `ReceivingDiscrepancy(UNIT_PRICE_DIFF)` 스냅샷만 기록
- **사유**: 발주 확정 = 공급업체와의 거래 단가 합의 완료(계약 성립). 입고 시점의 단가 불일치는 "거래 단가의 변경"이 아니라 "송장/실물 검증 실패"이며, 마스터를 갱신하면 동일 공급품의 다른 진행 중 PO 에 파급되어 거래 단가 확정 원칙이 깨진다.

#### P11 보강 — 마이너스 재고 금지 및 Pre-flight (2026-07-08)

**원칙**: 사용(Consumption)은 반드시 **잔량이 확보된 상태에서만** 가능하다. 마이너스 재고는 어떠한 경우에도 허용되지 않는다.

**결과**: 사용 처리를 하려면 반드시 아래 둘 중 하나가 선행되어야 한다.
1. **입고를 통해 재고 생성** — 발주 → 입고 확정 → InventoryLot 생성
2. **재고 이동을 통해 해당 Location 으로 재고 확보** — 다른 Location(예: WAREHOUSE) → 대상 FACTORY 로 `InventoryTransfer` CONFIRMED

**Pre-flight 검증** (`confirmConsumptionItem` 서비스 진입 시점):
1. 대상 ProductionLine 의 소속 Location 조회
2. 해당 Location 의 대상 자재 `InventoryLot` 중 `remainingQty > 0` 인 Lot 을 **FIFO 정렬** (`receivedAt ASC, lotId ASC`) 로 나열
3. 합계 잔량 `< consumptionQty` 이면 즉시 `INSUFFICIENT_STOCK` throw — 트랜잭션 진입 자체를 차단
4. 통과 시 순차 차감 + `ConsumptionLotDetail` 분할 기록

**예외**: `disposition = DISPOSED` (폐기) 는 이미 출고된 Lot 에 대한 상태 전환이므로 Pre-flight 재계산 없이 대상 Lot 잔량만 재확인.

#### 예약 (InventoryReservation) 정책 (2026-07-08 확정)

**결정: 예약 도입 (Sprint 4 Phase S4-2 CookingPlan 확정 시점에 예약 생성)**

이유: 마이너스 재고 금지(P11) 원칙 하에서, 조리 계획 확정과 실제 소비 사이의 시간 gap 동안 다른 조리 계획이 같은 재고를 이중 소비하는 것을 막아야 한다. 예약이 없으면 CookingPlan A 확정 → CookingPlan B 확정 시점에는 Lot 이 있어 보이지만, 실제 소비 시점에 A 가 먼저 차감하여 B 가 실패하는 상황이 발생.

**흐름**:
1. `CookingPlan.status → CONFIRMED` — 해당 CookingPlan 의 자재 요구량만큼 대상 Lot 을 FIFO 로 골라 `InventoryReservation` 생성. Lot 별 `reservedQty` 증가 (또는 별도 Reservation 레코드에 기록).
2. `ConsumptionItem.status → CONFIRMED` (disposition=USED) — 해당 Reservation 을 해제(`ReservationReleaseReason=CONSUMED`) 하면서 실제 Lot 차감(`InventoryTransaction(type=CONSUMPTION)`).
3. `ConsumptionItem` 이 취소/폐기되면 Reservation 도 해제(`MANUAL_CANCEL`).
4. `CookingPlanStatus → REPLACED` 또는 만료 시 Reservation 자동 해제(`AUTO_EXPIRED`) — 배치 작업(Vercel Cron).

**잔량 계산식**:
```
availableQty(Lot) = Lot.remainingQty − Σ(active Reservation.qty on this Lot)
```
Pre-flight 시 `availableQty` 로 판정. `remainingQty` 는 Lot 실물 기준.

#### 불일치 추적 도메인 분리 (2026-06-30)

본 시스템은 두 종류의 불일치를 별도 도메인으로 추적한다. 혼동하지 않는다.

| 도메인 | 시점 | 비교 대상 | 기록 모델 | 트랜잭션 영향 |
|---|---|---|---|---|
| **발주 ↔ 입고** | 입고 확정 (동시에 발주 종결) | PO 발주량 vs 입고량 / PO 단가 vs 입고 단가 | `ReceivingDiscrepancy` | 없음 (기록만, 마스터 무영향) |
| **이론재고 ↔ 실재고** | 재고 실사 완료 | InventoryLot 합계 vs 실측치 | `StockTake / StockTakeItem` | `InventoryTransaction(type=ADJUSTMENT)` |

- 발주↔입고 불일치는 **공급사·구매 프로세스** 원인 추적용.
- 이론재고↔실재고 불일치는 **현장 운영·재고 관리** 원인 추적용.
- 두 도메인은 서로의 트리거가 되지 않는다.

#### Lot 소진 정책 (2026-07-08 확정)

**결정: FIFO (선입선출법)**

- **정렬 키**: `InventoryLot.receivedAt ASC, lotId ASC` (동시 입고 tiebreaker)
- 여러 Lot 에 걸치는 소비는 `ConsumptionLotDetail` 로 자동 분할 기록.
- 유효기간(`expirationDate`) 은 실사·경고 지표로만 사용 (임박 알림 등). 자동 소진 순서에는 영향 없음.
- 원가 계산은 각 `ConsumptionLotDetail.unitPrice`(= 소진된 Lot 의 unitPrice) 를 기준.

**폐기된 안**: FEFO(유효기간 우선). FIFO 가 회계 관행과 일치하고, 유효기간 관리는 별도 알림 도메인(Sprint 5 S5-5) 으로 분리하는 것이 명확하다는 판단.

#### 원가 구성 정책 (2026-07-08 확정)

**원칙**: 초기 원가 산출은 **재료비 (원자재 + 부자재) 로 완결**된다. 간접비(인건비·물류비·유틸리티·감가 등)는 **추후 입력 가능한 구조**로 인프라만 마련한다.

**계산식**:
```
직접재료비 = Σ ConsumptionLotDetail.quantity × ConsumptionLotDetail.unitPrice
             (itemType ∈ {MATERIAL, SUBSIDIARY} 모두 포함)

총원가 (레퍼런스) = 직접재료비 + Σ OverheadCost.amount (배부 후)
```

- 데일리 라인업 원가의 **주 지표**는 **직접재료비**. 인건비 등이 시스템에 입력되지 않아도 원가 관리는 성립.
- `OverheadCost` 는 월별 입력받아 **가산 표시**. 배부 정책(D60)은 조리량 비례를 초기 안으로 채택하되, 데이터가 없으면 배부 자체가 비활성.
- 대시보드는 "직접재료비만" 뷰와 "직접재료비+간접비" 뷰를 토글로 전환 가능하게 구현.

#### 변경 이력
- 2026-07-08 — **P1'/P3/P4/P11 보강, 예약 도입 확정, FIFO 확정, 원가 구성 정책 확정, 수동 발주 경로 명문화.** 계층 분리 원칙(P2 보강) 명문화. Sprint 4 이후 도메인은 반드시 계층 축을 명시하여 설계한다.
- 2026-06-30 — P5·P9 **재정정**: 이전 보강(입고 확정 ↔ 발주 종결 분리, `markPurchaseOrderAsReceivedAction` 신설) 폐기하고, 입고 확정 시 PO 자동 종결로 통합. 발주 확정 = 거래 단가 확정 원칙을 P9 에 명시.
- 2026-06-30 — 초기 P5/P9 보강 (재정정으로 대체됨)

### 작업 전 체크리스트
새 Phase 시작 전 반드시 자문:
- [ ] 이 작업이 "실시간 원가" 또는 "재무 원가" 산출에 어떻게 기여하는가?
- [ ] Company / Location(FACTORY|WAREHOUSE|HYBRID) / ProductionLine 어느 계층에서 작동하는가?
- [ ] 재고를 다루는가? 다룬다면 소유 주체가 반드시 Location 인가? (P3)
- [ ] 사용을 다루는가? 다룬다면 Pre-flight(P11)가 구현되어 있는가?
- [ ] 헌법 P1 ~ P11 중 어느 것도 위반하지 않는가? (특히 P3 재고 위치, P4 사용 위치, P11 마이너스 재고 금지)
- [ ] 식단(Company) → 발주(롤업) → 입고(Location) → (이동) → 사용(FACTORY, ProductionLine) 흐름의 어느 위치인가?
- [ ] 원가 귀속 축(`lineupId`, `productionLineId`, `outboundDate`) 이 확보되는가?
- [ ] 신규 모델이 있다면 `SCHEMA_COVERAGE.md` 에 항목이 추가·갱신되었는가?
- [ ] 트랜잭션 서비스라면 `existingTx?: PrismaTransactionClient` 파라미터를 받는가?
- [ ] 감사가 필요한 액션이라면 `AuditLog` 기록 지점이 있는가? (부분 도입 중, Sprint 8 전면 표준화)
- [ ] 재고 도메인이라면 `StockGrade` 를 참조/편집하는가? 편집·유지 결정은 `AuditLog` 와 `StockGradeReviewLog` 에 이중 기록되는가?

---

## 📍 현재 상태 요약

- **현재 진행 중 Sprint**: 없음 (Sprint 3 종결, Sprint 3.5 착수 대기)
- **직전 종결 Sprint**: Sprint 3 (발주 + 입고, 2026-06-15 ~ 2026-07-07)
  > 상세 이력 → `docs/progress/SPRINT3.md`
  >
  > 요약: 발주 위저드(NEW/DELTA/REPLACE 3모드) + `PurchaseOrderBatch`·`POAdjustmentLog` 신설, 입고서 CRUD, `ReceivingDiscrepancy` 신설, 일자별 입고 통합 뷰, 라인업 다축 집계(`MaterialRequirement.lineupId`), MR 자동 산출 훅(G-1), `existingTx` 패턴 확립, PO 라이프사이클 재정의(RECEIVED 자동 전이), 헌법 P5·P9 재정정 + 계층분리·재고 소유 주체·마이너스 금지 원칙 명시.
- **이전 아카이브 Sprint**: Sprint 1 → `docs/progress/SPRINT1.md`, Sprint 2 → `docs/progress/SPRINT2.md`
- **최근 완료 항목**: 없음 (Sprint 3.5 착수 전)
- **다음 착수 항목**: **Sprint 3.5 — 수동(독립) 발주 보완** → 이어서 Sprint 4 Phase S4-0

---

## 🚧 다음 진행 항목

Sprint 3.5(보완) 및 Sprint 4 ~ Sprint 8 로드맵. 각 Sprint 는 스키마 실측(`prisma/schema.prisma`) 및 `SCHEMA_COVERAGE.md` 의 모델 배치를 SSOT 로 삼는다. Phase 번호는 착수 시점에 조정 가능.

---

### Sprint 3.5 — 수동(독립) 발주 보완 [Sprint 3 사후 보완]

**목적**: 식단 기반 발주 외 독립 발주 경로를 신설하여 P1' 를 코드로 구현. 라인업 귀속 축을 필수화하여 원가 산정 누락을 방지.

**스코프**: `PurchaseOrder.isManual=true` 브랜치. 스키마 실측 기반:
- `PurchaseOrder(isManual, locationId, productionLineId?, lineupId?)` — `isManual=true` 인 경우 `lineupId` 필수화(서비스 검증)

#### Phase S3.5-1 — 수동 발주 서비스·액션

- 서비스: `createManualPurchaseOrderDraft(input)` — MR 없이 사용자가 자재·수량·공급사·단가·outboundDate 직접 입력. 필수: `locationId`, `lineupId`. 선택: `productionLineId`.
- 액션: 기존 PO 위저드 서비스와 분리된 별도 진입점. 위저드는 식단 기반 전용.
- 스키마 보강 검토: `PurchaseOrder.lineupId` 를 nullable 유지하되, `isManual=true` 시 애플리케이션 레이어에서 NOT NULL 검증. (또는 CHECK 제약 도입 검토)

#### Phase S3.5-2 — 수동 발주 UI

- `/purchase-orders/manual/new` — 자재 선택(자재 마스터 검색) → 공급사·단가·수량 → Location·Lineup·ProductionLine 지정 → outboundDate → DRAFT 저장
- 기존 `/purchase-orders/[id]` 상세는 `isManual` 플래그에 따라 배지 표기.
- 목록 `/purchase-orders` 에서 `isManual` 필터 추가.

#### Phase S3.5-3 — 테스트·문서

- 서비스 유닛 테스트: lineupId 누락 시 실패, 정상 케이스 성공
- 문서: `docs/progress/PO_LIFECYCLE.md` 에 수동 발주 경로 섹션 추가

---

### Sprint 4 — 재고·이동·조리계획·사용·실사·대시보드

**목적**: 입고 이후의 재고 도메인을 완성하고, 재고 이동·조리 계획·사용(Consumption)까지 연결하여 "일별 라인업 원가"(P7 전반부) 의 데이터 소스를 확보한다.

**스키마 실측 기반 스코프**: `InventoryLot`, `InventoryTransaction`, `InventoryReservation`, `InventoryTransfer`/`InventoryTransferItem`, `StockTake`/`StockTakeItem`, `ConsumptionItem`/`ConsumptionLotDetail`, `CookingPlan`/`CookingPlanItem`/`CookingPlanSlot`.

#### Phase S4-0 — 스키마 보강 (Sprint 4 진입 게이트)

착수 전 반드시 완료해야 하는 준비 Phase. **정책은 헌법에서 이미 확정됨** — 여기는 스키마·마이그레이션만 처리.

- **S4-0-a**: `InventoryTransaction` 부자재 지원 스키마 보강
  - 현 상태: `materialMasterId` NOT NULL, `subsidiaryMasterId` 컬럼 없음
  - `ConsumptionItem` 은 이미 `itemType` (MATERIAL/SUBSIDIARY) + `subsidiaryMasterId` 지원
  - `InventoryLot` 도 이미 `itemType` + `subsidiaryMasterId` 지원
  - **적용**: `InventoryTransaction.materialMasterId` nullable + `subsidiaryMasterId` 컬럼 추가 + `itemType` 추가. `ReceivingNoteService.confirmReceivingNote` 의 `UnsupportedSubsidiaryReceivingError` 해소.
- **S4-0-b**: `InventoryReservation` 활성화 (정책 확정됨 — 예약 도입)
  - 필드 재점검: `lotId`, `qty`, `sourceType(CookingPlan)`, `sourceId`, `releasedAt?`, `releaseReason?`
  - Lot 잔량 계산 헬퍼: `getAvailableQty(lotId)` 및 `getAvailableQtyByMaterial(materialMasterId, locationId)`
  - Cron 스크립트 뼈대: `expireStaleReservations()` (Sprint 5 대시보드에서 실제 스케줄러 연결)
- **S4-0-c**: `AuditLog` 진입 유틸 표준화 (Sprint 8 전면 적용 전 최소 헬퍼)
  - `writeAuditLog(tx, {action, entityType, entityId, before, after, userId, companyId})` 헬퍼 신설
  - Sprint 3 의 bulk transition 코드에서 사용된 패턴을 공용 유틸로 승격

#### Phase S4-1 — 재고 조회 + 재고 이동 (동일 Company 내 재고 보유 주체 간 상호 이동)

**중요**: 재고 이동은 Sprint 4 의 핵심 축이다. **동일 Company 내에서 재고를 보유할 수 있는 모든 Location 간에 상호 이동이 가능**하다. 대표 유스케이스:
- 중앙 창고(WAREHOUSE) → 지점 공장(FACTORY) / 지점 창고(WAREHOUSE)
- **공장(FACTORY) ↔ 공장(FACTORY)**: 잉여 재고 재배치, 긴급 지원, 라인업 재편으로 인한 이관
- 공장(FACTORY) → 창고(WAREHOUSE): 미사용 재고 반납·재보관
- HYBRID Location 은 위 모든 조합의 참여 주체가 될 수 있음
- **Cross-Company 이동은 불가** — Lot 은 하나의 Company 내에서만 관리되는 단위(P3 보강)

- **모델**: `InventoryLot`(조회), `InventoryTransaction`(조회), `InventoryTransfer`/`InventoryTransferItem`(신규 서비스)
- **enum 활용**: `TransferType(PUSH/PULL)`, `TransferStatus(REQUESTED/DRAFT/CONFIRMED/RECEIVED/CANCELLED)`
- **PUSH vs PULL**:
  - `PUSH`: 출발지가 발신 주도 (예: 중앙 창고가 지점으로 밀어보냄)
  - `PULL`: 도착지가 요청 주도 (예: 지점이 중앙 창고에 요청)
- **서비스**:
  - `getLotsByLocation(locationId, options)` — Lot 단위 조회, `availableQty`(예약 차감 후) 포함
  - `getLotsByMaterial(materialMasterId, locationId?)` — 자재 단위 집계
  - `getRemainingQuantity(materialMasterId, locationId)` — 잔량 합계 (실물 기준)
  - `getAvailableQuantity(materialMasterId, locationId)` — 가용 잔량 (예약 차감)
  - `createInventoryTransfer(input)` — DRAFT/REQUESTED
  - `confirmInventoryTransfer(id, existingTx?)` — 출발지 `InventoryTransaction(type=TRANSFER_OUT)` + Lot `remainingQty` 차감
  - `receiveInventoryTransfer(id, existingTx?)` — 도착지 `InventoryTransaction(type=TRANSFER_IN)` + 도착지 신규 Lot 생성 (또는 기존 Lot merge 정책 결정 — 초기 안: 신규 Lot 생성으로 이력 보존)
- **원칙 준수**:
  - 출발지·도착지 모두 `LocationType ∈ {FACTORY, WAREHOUSE, HYBRID}` (P3 보강)
  - **출발지·도착지의 `companyId` 가 동일해야 함** — 불일치 시 `CROSS_COMPANY_TRANSFER_FORBIDDEN` (P3 보강)
  - 동일 Company 내 두 Location 간 조합에는 제약 없음. FACTORY↔FACTORY 도 허용.
  - `출발지 == 도착지` 자기 이동은 서비스 레벨에서 차단 (`SAME_LOCATION_TRANSFER_FORBIDDEN`)
  - ProductionLine 은 이동의 소스·목적지가 될 수 없다 (P3 보강)
  - 출발지 잔량 부족 시 CONFIRMED 차단 (P11 준용)
- **UI**: `/inventory` (Location 별 재고 조회), `/inventory/transfers` (이동 이력 + 신규)
- **테스트**: FIFO 조회 정렬, 이동 원자성, PUSH/PULL 흐름, 잔량 부족 차단, 예약 차감된 availableQty 정확성

#### Phase S4-2 — 조리 계획 (CookingPlan) + 예약 생성

- **모델**: `CookingPlan` + `CookingPlanItem` + `CookingPlanSlot` (bomSnapshotJson 로 BOM 스냅샷) + `InventoryReservation`(연동)
- **enum 활용**: `CookingPlanStatus(DRAFT/CONFIRMED/COMPLETED/REPLACED)`
- **관계**: `MealPlanSlot → CookingPlan(productionLineId, planDate) → ConsumptionItem`
- **BOM 스냅샷 정책**: `CookingPlanSlot.bomSnapshotJson` 에 사용 시점의 `RecipeBOM` 스냅샷을 저장 → BOM 마스터가 이후 변경되어도 원가 재계산이 흔들리지 않음
- **CONFIRMED 전이 시 예약 생성** (P11·예약 정책):
  1. 각 `CookingPlanItem` 마다 필요 자재·수량 계산 (BOM 스냅샷 기준)
  2. 대상 ProductionLine 의 소속 Location 에서 FIFO Lot 선정
  3. `availableQty` 합계 < 필요량 이면 `INSUFFICIENT_STOCK` throw
  4. 통과 시 `InventoryReservation` 생성 (Lot 별 분할)
- **자동 생성**: `MealPlanGroup` 상태가 `IN_PROGRESS → COMPLETED` 전이 시 `CookingPlan` 자동 생성 (`AutoGenLog` 기록)
- **REPLACED / DRAFT 재편집 시**: 기존 Reservation 자동 해제(`MANUAL_CANCEL`)
- **UI**: `/cooking-plans`, `/cooking-plans/[id]`

#### Phase S4-3 — 사용/소비 (Consumption)

- **모델**: `ConsumptionItem` + `ConsumptionLotDetail`
- **enum 활용**: `ConsumptionStatus(DRAFT/CONFIRMED)`, `ConsumptionDisposition(USED/RETURNED/DISPOSED)`, `DisposalReason(EXPIRED/DAMAGED/CONTAMINATED/OVER_PREPARED/OTHER)`
- **disposition 3분기 처리**:
  - `USED` → `InventoryTransaction(type=CONSUMPTION)` 발생, `ConsumptionLotDetail` 로 Lot 분할 기록, Reservation 해제(`CONSUMED`)
  - `RETURNED` → 트랜잭션 없음 (애초에 출고되지 않은 양). Reservation 있으면 해제(`MANUAL_CANCEL`)
  - `DISPOSED` → `InventoryTransaction(type=DISPOSAL)` 발생, `disposalReason` 필수, 손실 원가에 별도 집계. Reservation 해제(`CONSUMED` — 소진 처리)
- **손질 손실(정상 손실) vs 폐기(예외 손실)**: 손질 손실은 `BOM.yieldRate`(또는 `RecipeBOM.baseWeightG` 대비)에서 흡수. `DisposalReason` enum 에 포함하지 않음.
- **재고 차감 (P11 Pre-flight 필수)**:
  1. Reservation 이 있으면 → Reservation 대상 Lot 을 그대로 차감 (이중 예약 방지)
  2. Reservation 이 없으면 (예: 예약 없이 즉시 소비) → FIFO 로 재선정 + Pre-flight 검증
  3. 잔량 부족 시 `INSUFFICIENT_STOCK` throw — 재고 이동 또는 발주가 선행되어야 함
- **서비스**:
  - `createConsumptionItemDraft(input)` — DRAFT
  - `confirmConsumptionItem(id, existingTx?)` — Pre-flight → Lot 차감 + `InventoryTransaction` + `ConsumptionLotDetail` + Reservation 해제
  - `updateConsumptionDisposition(id, disposition, reason?, note?)` — USED/RETURNED/DISPOSED 전환
- **원가 raw data**: 각 `ConsumptionLotDetail.unitPrice` = 소진된 Lot 의 unitPrice. 이것이 P7 실시간 원가의 base.
- **감사**: 확정·폐기·수량 변경 시 `AuditLog` 자동 기록 (S4-0-c 헬퍼 사용)

#### Phase S4-4 — 재고 실사 (StockTake)

- **모델**: `StockTake` + `StockTakeItem`
- **enum 활용**: `StockTakeStatus(DRAFT/IN_PROGRESS/PENDING_REVIEW/COMPLETED)`
- **서비스**:
  - `createStockTakeDraft(locationId, takeDate)` — DRAFT
  - `startStockTake(id)` — IN_PROGRESS 로 전이, 시점의 `systemQty` 스냅샷을 각 `StockTakeItem.systemQty` 에 저장
  - `enterActualQty(itemId, actualQty)` — `difference = actualQty - systemQty` 자동 계산
  - `submitStockTake(id)` — PENDING_REVIEW
  - `completeStockTake(id, existingTx?)` — 원자적: 각 `StockTakeItem` 마다 `InventoryTransaction(type=ADJUSTMENT)` 적층 + `InventoryLot` 조정. 조정 대상 Lot 선정 정책 초기 안: **잔량 비례 분배**. 마이너스 조정 시에도 잔량 0 미만 금지(P11).
- **원칙**: 불일치 추적 도메인 분리 — `ReceivingDiscrepancy` 와 절대 상호 트리거하지 않는다.
- **UI**: `/stock-takes`, `/stock-takes/new`, `/stock-takes/[id]`
- **등급별 실사 빈도 판정** (StockGrade 연동, 원자재·부자재 공통):
  - 자재 마스터(`MaterialMaster.stockGrade`) 및 부자재 마스터(`SubsidiaryMaster.stockGrade`) 를 함께 조회하여 실사 도래 여부 판정.
    - A(가): 마지막 실사일 이후 사용(CONSUMPTION) 발생 시 즉시 도래. Consumption 확정 화면에서 A 등급 자재 실사 촉구 배너.
    - B(나): 마지막 실사일로부터 7일 경과 시 도래.
    - C(다): 마지막 실사일로부터 1개월 경과 시 도래.
  - 서비스: `getDueStockTakeMaterials(locationId, referenceDate)` — 등급별 대상 원자재+부자재 리스트 반환.
  - `StockTake` 생성 시 이 리스트를 프리셋으로 자동 채움 (사용자가 가감 가능).
  - **알림 연동**: Sprint 5 S5-5 에서 `STOCK_TAKE_DUE_A/B/C` 태그 발송. Cron 은 매일 실행하여 도래 판정.

#### Phase S4-5 — 재고 현황 대시보드

- **범위**:
  - Location × 자재별 잔량 (실물 / 가용)
  - 회전율 (자재별 최근 30/60/90일 소비량 대비 잔량)
  - **악성 재고 탐지**: 장기 미사용(N일 이상 소비 이력 없음) + 유효기간 임박 목록
  - 최근 이동/폐기 요약
  - `disposition` 비율 (USED/RETURNED/DISPOSED) 및 사유별 폐기 통계
  - 예약 현황 (활성 Reservation 요약)
- **UI**: `/dashboard/inventory`
- **의존**: S4-1 ~ S4-4 완료

---

### Sprint 5 — 원가·간접비 인프라·월말 마감·알림

**목적**: Sprint 4 에서 확보한 CONSUMPTION/DISPOSAL 데이터로 **재료비 기반 실시간 라인업 원가**를 산출하고, 월말 회계 원가 스냅샷과 크로스체크한다 (P7). 간접비는 **인프라만 마련**하여 향후 입력 시 자동 합산되도록 한다.

**스키마 실측 기반 스코프**: `CostSnapshot`/`CostSnapshotItem`, `CostCalculation`/`CostCalculationItem`, `OverheadCost`, `MonthEndSnapshot`/`MonthEndAdjustment`/`MonthEndAdjustmentItem`, `NotificationTagDef`/`NotificationRule`/`NotificationTemplate`/`NotificationLog`.

#### Phase S5-1 — 일별 라인업 원가 산출 (실시간, 재료비 기반)

- **모델**: `CostCalculation` (`CostType: ESTIMATED/ORDER_BASED/ACTUAL`) + `CostCalculationItem`
- **축**: `outboundDate × lineupId × productionLineId` (라인업이 최우선, 공장·제조라인은 레퍼런스)
- **소스**:
  - **ESTIMATED (예상 식수 원가)**: `MaterialRequirement (countSource=ESTIMATED) × SupplierItem.currentPrice`
  - **ORDER_BASED (확정 식수 발주 원가)**: `PurchaseOrderItem.qty × PurchaseOrderItem.unitPrice`
  - **ACTUAL (사용량 기반 실제 원가)**: `Σ ConsumptionLotDetail.quantity × ConsumptionLotDetail.unitPrice` (원자재+부자재 포함)
- **직접재료비 확정**: 위 3개 costType 은 모두 **재료비만** 포함. 간접비는 별도 필드(`overheadAmount`)로 표시.
- **서비스**: `computeCostCalculation(companyId, referenceType, referenceId, costType)`
- **재사용**: Sprint 3 `getLineupBreakdownAction` 을 원가 축으로 확장
- **BOM 적정성 판단축 (자동 산출 지표)**:
  - `예상수량 vs 확정수량 vs 실제사용량` 3축 편차
  - `BOM 이론 사용량 vs 실제 사용량` 편차 (자재별)
- **UI**: `/cost/daily` (라인업별 데일리), `/cost/comparison` (3종 costType 비교), `/cost/bom-adequacy` (BOM 적정성 진단)

#### Phase S5-2 — 간접비 인프라 (OverheadCost) — 입력만, 배부는 옵션

- **모델**: `OverheadCost(companyId, category, name, amount, month)`
- **범위**: 재료비 외 간접비(인건비, 유틸리티, 물류비, 감가 등). 월별 입력.
- **원칙**: 초기 원가 관리는 **재료비만으로 완결**. `OverheadCost` 는 사용자가 입력한 경우에만 대시보드에 가산 표시.
- **배부 정책 (D60)**: 기본 안 — **조리량 비례(라인업별 ConsumptionItem 수량 합계 기준)**. 데이터 없으면 배부 자체 비활성. 향후 매출액·시간 기반 등 추가 가능.
- **UI**: `/cost/overhead` — 카테고리·명칭·금액·월 입력. 배부 미리보기.
- **주의**: 이 Phase 는 **입력 UI + 조회 + 배부 계산 함수**까지만. 인건비 정산 시스템 등과의 연동은 범위 외.

#### Phase S5-3 — 월말 마감 (MonthEndSnapshot) — 회계 기반 원가 크로스체크

- **모델**: `MonthEndSnapshot` + `MonthEndAdjustment` + `MonthEndAdjustmentItem`
- **enum 활용**: `MonthEndStatus(DRAFT/LOCKED)`
- **회계 원가 산출식**:
  ```
  회계원가 = 기초재고 + 당월매입 − 기말재고
  ```
  - 기초재고: 전월 `MonthEndSnapshot.snapshotData` 의 기말재고
  - 당월매입: 해당 월의 `InventoryTransaction(type=PURCHASE)` 합계 (금액)
  - 기말재고: 마감 시점의 `InventoryLot.remainingQty × unitPrice` 합계
- **사용량 기반 원가 vs 회계 원가 교차 검증**:
  ```
  편차 = |사용량기반원가 − 회계원가|
  편차율 = 편차 / 회계원가
  ```
  편차율이 임계값(초기 안: 3%) 초과 시 알림(S5-5) + 대시보드 이상치 표시.
- **정책**:
  - `MonthEndSnapshot.snapshotData JSON` 에 마감 시점의 전체 원가/재고 상태 스냅샷
  - `LOCKED` 후 해당 월 데이터 편집 차단. 조정은 오직 `MonthEndAdjustment` 로만.
  - `MonthEndAdjustment` 는 before/after JSON 을 모두 보존 → 감사 로그 가능
- **서비스**:
  - `createMonthEndSnapshot(companyId, closingMonth)` — DRAFT 로 생성
  - `computeSnapshot(id)` — snapshotData 계산·저장 (기초/당월매입/기말/사용량기반원가/편차)
  - `lockMonthEnd(id)` — DRAFT → LOCKED
  - `createAdjustment(input)` — LOCKED 상태에서만
- **UI**: `/cost/monthly-close`

#### Phase S5-4 — 원가 대시보드 (경영 지표 흐름 뷰)

- **핵심 흐름 뷰** (2026-07-08 확정 요구사항):
  ```
  발주 금액 → 입고 금액 → 총 사용 금액 → 라인업별 사용 금액 → (예상 수량 원가 ↔ 확정 수량 원가)
  ```
  각 단계 간 편차가 강조되며, 클릭 시 원인 도메인으로 드릴다운:
  - 발주↔입고 편차 → `ReceivingDiscrepancy` 목록
  - 입고↔사용 편차 → 재고 잔존 or 미기록 소비
  - 총사용↔라인업합계 편차 → 미귀속 소비 (`lineupId` NULL)
  - 예상↔확정 편차 → MR 재산출 이력
- **부가 지표**:
  - 일/주/월 라인업 원가 트렌드
  - ESTIMATED vs ORDER_BASED vs ACTUAL 편차
  - 폐기율(DISPOSED) 및 사유별
  - 원가 편차 Top-N 라인업
  - **레퍼런스 축**: 공장별·제조라인별 사용 금액 (이상치 추적용, 최우선 지표는 아님)
  - 예산 대비 실적 (예산 데이터가 있을 때만)
- **토글**: "재료비만" ↔ "재료비 + 간접비" (OverheadCost 입력 여부에 따라)
- **UI**: `/dashboard/cost`

#### Phase S5-5 — 알림 관리 (Notification)

- **모델**: `NotificationTagDef` + `NotificationRule` + `NotificationTemplate` + `NotificationLog`
- **enum 활용**: `NotificationChannel(IN_APP/EMAIL)`, `NotificationLogStatus(PENDING/SENT/FAILED)`
- **구조**:
  - `NotificationTagDef` — 시스템 전역 태그 정의 (예: `INVENTORY_LOW`, `EXPIRATION_SOON`, `MONTH_END_UNLOCKED`, `PO_STUCK`, `COST_VARIANCE_HIGH`, `RESERVATION_STALE`, `STOCK_TAKE_DUE_A`, `STOCK_TAKE_DUE_B`, `STOCK_TAKE_DUE_C`, `STOCK_GRADE_REVIEW_PENDING`)
  - `NotificationRule` — 회사별 규칙 (eventType + channel + templateId)
  - `NotificationTemplate` — 공용 템플릿 (재사용 가능한 문구)
  - `NotificationLog` — 발송 이력 (recipientId, status)
- **트리거**: Vercel Cron + 서버 액션 (초기). 도메인 이벤트(입고/실사/마감/원가편차 등)에서 인라인 발송도 가능.
- **UI**: `/notifications` (인박스), `/settings/notifications` (규칙 편집)

---

### Sprint 6 — 조직 관리 UI (Company · Location · ProductionLine · Lineup · CompanyMealSlot)

**목적**: 계층 분리 원칙(P2 보강) 을 사용자가 편집할 수 있는 관리 UI 로 완결.
Sprint 1~3 에서 스키마와 서비스는 완성됨. Sprint 6 은 **관리 UI 통합·재점검**이 스코프.

**스키마 실측 기반 스코프**: `Company`, `Location`, `ProductionLine`, `Lineup`, `CompanyMealSlot`.

#### Phase S6-1 — Company 관리
- 등록·수정·(soft) 삭제. 사업자번호(`bizNo`)·주소·연락처.
- SYSTEM_ADMIN 만 접근 (Sprint 7 권한 연동).

#### Phase S6-2 — Location 관리 재점검
- 이미 Sprint 2 Phase 8.5-B 에서 마스터 UI 완료. Sprint 6 은 통합 시점 재점검.
- `LocationType(FACTORY/WAREHOUSE/HYBRID)` 별 UI 차등 (WAREHOUSE 는 ProductionLine 미노출 등)
- 재고를 보유한 Location soft-delete 시 P3 검증
- **P3 강화 검증**: Company·ProductionLine 이 재고 소유 시도하는 코드 경로가 없는지 정적 검사(스캔 스크립트)

#### Phase S6-3 — ProductionLine 관리 재점검
- Sprint 2 Phase 8.5-C 에서 완료. 통합 시점 재점검.
- `ProductionLineStatus(ACTIVE/INACTIVE/MAINTENANCE)` 상태 관리
- `LocationType=FACTORY|HYBRID` 소속만 허용 (검증)

#### Phase S6-4 — Lineup 관리
- Company 레벨 마스터. MealPlan·MaterialRequirement·(수동)PurchaseOrder·CostCalculation 의 축
- 라인업 통폐합 시 이력 보존 정책 (D70 예정) — 소프트 삭제 vs 병합 참조
- `Lineup.isActive`, `sortOrder` 관리

#### Phase S6-5 — CompanyMealSlot 관리
- Sprint 2 Phase 5-R Step 3.1 에서 스키마 신설. Sprint 6 관리 UI 완성.
- 자동 채번(`SLOT-001`, `SLOT-002` ...) + `displayName` 사용자 편집. `isActive` / `sortOrder`.

#### Phase S6-6 — 계층 트리 뷰어
- `/organization` — Company → Location → ProductionLine → Lineup 트리 뷰
- 각 계층별 현재 활성 사용자·재고 위치 요약

#### Phase S6-7 — 재고 등급 관리 (StockGrade, 상시 관리 프로세스)

- **목적**: 원자재·부자재의 관리 등급(A/B/C) 을 **사용자 편집 + 주기적 재평가**의 상시 프로세스로 관리하여 재고 실사 빈도·알림 우선순위를 자동화한다.
- **스키마 실측**:
  - `enum StockGrade { A B C }` — 이미 정의됨
  - `MaterialMaster.stockGrade` / `SubsidiaryMaster.stockGrade` — 두 마스터 모두에 필드 존재 (Sprint 6 착수 시 최종 재확인)
  - **신규 모델 `StockGradeReviewLog`** (Sprint 6 진입 시 스키마 보강):
    - 필드: `id`, `companyId`, `itemType(MATERIAL|SUBSIDIARY)`, `materialMasterId?`, `subsidiaryMasterId?`, `beforeGrade`, `suggestedGrade`, `decidedGrade`, `decision(APPLIED|KEPT)`, `usageAmountWindow`(참조된 기간), `usageAmount`, `decidedByUserId`, `decidedAt`, `reviewedInBatchId?`
    - 인덱스: `(companyId, decidedAt)`, `(materialMasterId)`, `(subsidiaryMasterId)`
    - enum `StockGradeDecision { APPLIED KEPT }`
  - **신규 모델 `StockGradeReviewBatch`** (재평가 배치 단위):
    - 필드: `id`, `companyId`, `runAt`, `windowMonths`, `thresholdA`, `thresholdB`, `status(PENDING|COMPLETED)`, `pendingCount`
- **정책 (기본값, 회사별 커스텀은 D85 로 유보 — 초기 안: 시스템 고정)**:
  - A(가): 사용 시마다 실사 촉구
  - B(나): 주 1회 실사 도래
  - C(다): 월 1회 실사 도래
  - 자동 재평가 주기: 매월 1일 00:00 (KST)
  - 사용액 산출 창(window): 최근 3개월
  - 파레토 임계값: A=상위 80% 누적, B=중간 15%, C=하위 5%
- **서비스**:
  - `updateItemStockGrade(itemType, itemId, grade, existingTx?)` — 직접 편집. `AuditLog` 필수, 결과를 `StockGradeReviewLog(decision=APPLIED, suggestedGrade=null)` 로도 적층 (편집 이력 통합).
  - `runStockGradeReviewBatch(companyId, windowMonths = 3)` — 배치 실행. 최근 windowMonths 의 `ConsumptionLotDetail` 합산으로 자재별 사용액 산출 → 파레토 판정 → 현재 등급과 다르면 `StockGradeReviewLog(decision=PENDING placeholder는 사용하지 않음)` 대신 **`StockGradeReviewBatch.pendingCount`** 로 미결 후보 카운트 관리. 실제 미결 후보는 배치 실행 결과 산출물(JSON 또는 별도 임시 테이블 검토 — Sprint 6 착수 시 확정).
  - `applySuggestedStockGrade(itemType, itemId, batchId, existingTx?)` — 사용자가 "변경 승인" 선택 시 호출. 마스터 필드 갱신 + `StockGradeReviewLog(decision=APPLIED)` 적층 + 감사 로그.
  - `keepCurrentStockGrade(itemType, itemId, batchId, note?, existingTx?)` — 사용자가 "유지" 선택 시 호출. `StockGradeReviewLog(decision=KEPT)` 적층. 마스터 변경 없음. 이후 재평가에서 최근 KEPT 결정은 재추천 우선순위를 낮추는 시그널로 활용.
  - `getPendingStockGradeReviews(companyId, itemType?)` — 미결 후보 목록 조회 (리뷰 UI 소스).
- **UI**:
  - `/settings/stock-grades` — 원자재·부자재 통합 목록 + 현재 등급 + 최근 N개월 사용액 컬럼 + 인라인 등급 편집 (직접 편집 진입점)
  - `/settings/stock-grades/review` — **미결 후보 리스트** + 자재별 `[변경 → suggestedGrade]` / `[유지]` 액션 버튼 + 결정 이력 tab
  - `/settings/stock-grades/history` — `StockGradeReviewLog` 기반 이력 뷰 (자재별 · 사용자별 · 기간별)
- **감사**: 모든 등급 변경·유지 결정은 `AuditLog` 필수 기록. `StockGradeReviewLog` 는 도메인 이력, `AuditLog` 는 시스템 감사 이력 — 이중 기록 원칙 유지.
- **의존**:
  - 직접 편집·이력 뷰: 선행 가능 (Sprint 6 착수 시 즉시)
  - 자동 재평가·리뷰 UI: S4-3(Consumption) 완료 후 사용액 데이터 확보 필요. Sprint 4 종결 이후 실질적 의미 발생.
- **알림 연동**: Sprint 5 S5-5 에서 `STOCK_GRADE_REVIEW_PENDING` 태그 신설. 매월 재평가 배치 완료 후 미결 후보 수를 담아 관리자에게 발송.

---

### Sprint 7 — 권한·사용자·초대

**목적**: **계층 스코프(어디에 소속) × 권한셋(무엇을 할 수 있음)** 이원 구조로 접근 제어 완성 + 초대 기반 사용자 온보딩.

**설계 원칙 (2026-07-08 재확인)**:
- **계층 분리** = 회사·공장·제조라인 계층별 **접근 스코프**를 정의 (누가 어느 데이터를 볼 수 있는가)
- **권한셋** = 각 자원(view + 기능)에 대한 **CRUD/APPROVE/EXPORT 허용 여부**를 정의 (본 수 있는 것 안에서 무엇을 할 수 있는가)
- 사용자는 `(계층 스코프, 권한셋)` 을 조합하여 최종 권한이 산출됨. 예: "A공장 스코프 + 재고관리 권한셋" 사용자는 A공장 재고만 편집 가능.

**스키마 실측 기반 스코프**: `User`, `UserScope`, `PermissionSet`, `PermissionSetItem`, `Invitation`.

#### Phase S7-1 — 권한 셋 (PermissionSet)

- **모델**: `PermissionSet(name, description)` + `PermissionSetItem(permissionSetId, resource, action)` — 자원×액션 M:N
- **enum 활용**: `PermissionAction(CREATE/READ/UPDATE/DELETE/APPROVE/EXPORT)` — 스키마에 이미 정의됨
- **`resource` 문자열 카탈로그** (Sprint 7 착수 시 각 도메인 서비스 스캔하여 확정, 아래는 초기 안):
  - `meal-plan` / `meal-plan-slot` / `material-requirement`
  - `purchase-order` / `purchase-order-manual` / `purchase-order-batch` / `receiving-note` / `receiving-discrepancy`
  - `inventory-lot` / `inventory-transaction` / `inventory-transfer` / `stock-take` / `inventory-reservation`
  - `consumption-item` / `cooking-plan`
  - `cost-calculation` / `overhead-cost` / `month-end-snapshot`
  - `notification-rule`
  - `company` / `location` / `production-line` / `lineup` / `company-meal-slot`
  - `user` / `permission-set` / `invitation` / `audit-log`
- **시스템 사전 정의 권한 셋** (`UserScope.role` 과 조합):
  - `ScopeRole.SYSTEM_ADMIN` — 전 자원 × 전 액션
  - `ScopeRole.COMPANY_ADMIN` — 회사 자원 × 전 액션
  - `ScopeRole.MEMBER` + 회사별 커스텀 `PermissionSet` — 자유 조합
- **뷰 통제**: 각 페이지 진입 시 `resource.READ` 미보유면 메뉴 자체 비노출. 편집 버튼은 `resource.UPDATE` 로 통제.
- **UI**: `/settings/permissions`

#### Phase S7-2 — 사용자 관리 (User + UserScope)

- **모델**: `User(providerUserId, email, name, status)` + `UserScope(userId, companyId, role, permissionSetId?)`
- **enum 활용**: `UserStatus(ACTIVE/INACTIVE/SUSPENDED)`, `ScopeRole`
- **계층 스코프 필터링**:
  - `UserScope` 는 회사·역할·권한셋 조합.
  - Location·ProductionLine 단위 스코프 확장 검토 (D80 예정) — 현 스키마상 `UserScope` 는 Company 단위이나, 자원 접근 시 애플리케이션 레이어에서 사용자별 허용 Location/ProductionLine 리스트를 추가로 매핑할 수 있는 여지 확인 필요.
- **UI**: `/settings/users`

#### Phase S7-3 — 초대 (Invitation)

- **모델**: `Invitation(companyId, email, role, invitedById, token, expiresAt, acceptedAt)`
- **흐름**:
  1. 관리자가 이메일 초대 발송 → `Invitation` 생성 (token 발급, 기본 7일 만료)
  2. 수신자 링크 클릭 → 계정 생성 or 기존 계정 연결
  3. `acceptedAt` 기록 + `UserScope` 자동 생성
- **정책**:
  - 만료(`expiresAt < now`) 시 재발송 필요
  - 재발송·취소·재활용 규칙
  - 초대자는 `invitation.CREATE` 권한 필수, 부여 가능한 역할은 초대자 역할의 하위 집합(권한 상승 방지)
- **UI**: `/settings/invitations`

---

### Sprint 8 — 감사로그 전면·자동생성 이력·통합 대시보드·UX 통일·최종 QA

**스키마 실측 기반 스코프**: `AuditLog`, `AutoGenLog`.

#### Phase S8-1 — 감사 로그 전면 표준화

- **모델**: `AuditLog(companyId?, userId?, action, entityType, entityId, before, after, ipAddress)`
- **enum 활용**: `AuditAction(CREATE/UPDATE/DELETE/APPROVE/REJECT/STATUS_CHANGE/LOGIN/OVERRIDE)`
- **범위**: Sprint 3(부분) + Sprint 4(S4-0-c 헬퍼) → Sprint 8 에서 **전 도메인 서비스에 미들웨어/데코레이터 패턴으로 자동 기록**. 민감 액션 전량 로그.
- **필수 커버 대상**: PO 상태 전이, 입고 확정, 재고 이동 확정, StockTake 완료, Consumption 확정/폐기, MonthEndSnapshot lock, PermissionSet 변경, User 상태 변경, Invitation 발송/수락.

#### Phase S8-2 — 자동 생성 이력 (AutoGenLog)

- **모델**: `AutoGenLog(companyId, triggerType, status, inputJson, outputJson, errorMsg)`
- **enum 활용**: `AutoGenStatus(PENDING/GENERATED/FAILED)`
- **적용 대상**: MR 자동 산출(Sprint 3 4-G G-1), CookingPlan 자동 생성(S4-2), 원가 스냅샷(S5-3), Reservation 자동 만료(S4-0-b Cron), 알림 발송(S5-5) 등 자동화 이벤트 전량

#### Phase S8-3 — 통합 대시보드 `/dashboard`

- 일별 원가·재고 요약·발주/입고 진행률·알림 최신 5건·마감 상태
- **경영 지표 흐름(S5-4)** 을 최상단 카드로 배치
- 계층/권한 스코프에 따라 위젯 가시성 자동 조정

#### Phase S8-4 — UX 통일
- 색상 팔레트·타이포·간격·상태 배지·에러 메시지 톤 재검토
- Sprint 3 의 `STATUS_LABEL/STATUS_COLOR` 패턴 전 도메인 확장

#### Phase S8-5 — 접근성 · i18n 후보 검토
- 기본 ko-KR. 다국어 요구 시 도입 여부 판단.

#### Phase S8-6 — 최종 QA
- 시나리오 기반 E2E, 부하 테스트, 백업/복구 리허설

---

## 📦 미착수 예약 모델 (스키마만 존재)

아래 모델은 스키마에 정의되어 있으나, 현재 요구사항 범위에 포함되지 않아 구현을 착수하지 않는다. 향후 요구가 확정되면 별도 Sprint 로 재개한다.

| 모델 | 상태 | 재개 트리거 |
|---|---|---|
| `ShippingOrder` / `ShippingOrderItem` | 스키마만 존재 | 완제품/포장 배송·출하 관리 요구가 명시적으로 확정될 때. 참고: "중앙 창고 → 지점" 물류는 `InventoryTransfer`(S4-1) 로 커버되므로 ShippingOrder 는 별개 도메인. |

---

## 📋 요구사항 커버리지 매트릭스

| 요구 사항 | 담당 Sprint / Phase | 상태 |
|---|---|---|
| 수동(독립) 발주 | Sprint 3.5 | 🟡 스키마 존재(`isManual`), 서비스/UI 미착수 |
| **사용(소비) 관리** | Sprint 4 / S4-3 (ConsumptionItem) | 🟡 스키마 완료, 서비스/UI 미착수 |
| **재고 관리 (조회)** | Sprint 4 / S4-1 | 🟡 스키마 완료, 서비스/UI 미착수 |
| **재고 이동 (동일 Company 내 재고 보유 Location 간 상호 이동, 공장↔공장 포함)** | Sprint 4 / S4-1 (InventoryTransfer) | 🟡 스키마 완료, 서비스/UI 미착수 |
| **재고 실사** | Sprint 4 / S4-4 | 🟡 스키마 완료, 서비스/UI 미착수 |
| **재고 등급 관리 (A/B/C, 상시 재평가 프로세스, 원자재+부자재)** | Sprint 6 / S6-7 (마스터 편집 + 리뷰 UI + `StockGradeReviewLog/Batch` 신설) + Sprint 4 / S4-4 (등급별 빈도 판정) + Sprint 5 / S5-5 (도래·리뷰 알림) | 🟡 `StockGrade` enum 완료, `stockGrade` 필드 존재, 재평가·리뷰 이력 모델 스키마 보강 필요, 서비스/UI/알림 태그 미착수 |
| **재고 현황 대시보드** | Sprint 4 / S4-5 | 📋 계획 |
| 조리 계획 (CookingPlan) | Sprint 4 / S4-2 | 🟡 스키마 완료 (CookingPlan 3모델), 서비스/UI 미착수 |
| 폐기 관리 | Sprint 4 / S4-3 (`disposition=DISPOSED` + `DisposalReason`) | 🟡 스키마 완료, 서비스/UI 미착수 |
| 재고 예약 (Reservation) | Sprint 4 / S4-0-b + S4-2 | 🟡 스키마 완료, 활성화 미착수 |
| **원가 관리 (재료비 기반, 실시간)** | Sprint 5 / S5-1 | 🟡 스키마 완료 (CostCalculation), 서비스/UI 미착수 |
| 간접비 인프라 (OverheadCost) | Sprint 5 / S5-2 | 🟡 스키마 완료, 입력 UI 미착수 |
| **월 단위 마감 (회계 원가 크로스체크)** | Sprint 5 / S5-3 | 🟡 스키마 완료 (MonthEndSnapshot 3모델), 서비스/UI 미착수 |
| **원가 관리 대시보드 (경영 지표 흐름)** | Sprint 5 / S5-4 | 📋 계획 |
| **알림 관리** | Sprint 5 / S5-5 | 🟡 스키마 완료 (Notification 4모델), 서비스/UI 미착수 |
| **계층 분리 (회사–공장–제조라인)** | Sprint 1~2 (스키마+마스터 UI) / Sprint 6 (통합 재점검) | 🟢 부분 완료 — 스키마·마스터 UI ✅, 통합 재점검 📋 |
| Lineup 관리 UI | Sprint 6 / S6-4 | 🟡 스키마 완료, UI 미착수 |
| CompanyMealSlot 관리 UI | Sprint 6 / S6-5 | 🟡 스키마 완료, UI 미착수 |
| **권한 셋 관리 (기능 사용 통제)** | Sprint 7 / S7-1 | 🟡 스키마 완료 (PermissionSet + Item), UI 미착수 |
| 사용자 관리 (계층 스코프 연결) | Sprint 7 / S7-2 | 🟡 스키마 완료 (User+UserScope), UI 미착수 |
| **초대 기능** | Sprint 7 / S7-3 | 🟡 스키마 완료 (Invitation), UI/이메일 발송 미착수 |
| 감사 로그 표준화 | Sprint 3 (부분) / Sprint 4 (헬퍼) / Sprint 8 (전면) | 🟠 부분 도입, 전면 표준화 계획 |
| 자동 생성 이력 | Sprint 8 / S8-2 | 🟡 스키마 완료 (AutoGenLog), 적용 미착수 |
| 통합 대시보드 | Sprint 8 / S8-3 | 📋 계획 |

**범례**: 🟢 완료 / 🟡 스키마 완료·구현 미착수 / 🟠 부분 구현 / 📋 계획

> Sprint 종결 시마다 상태 갱신. Sprint 4 종결 시 재고/이동/사용/실사/대시보드 5개 행이 🟢 로.

---

## 🔗 참고 문서

- `docs/progress/SPRINT1.md` — Sprint 1 아카이브 (기본 인프라·마스터)
- `docs/progress/SPRINT2.md` — Sprint 2 아카이브 (MealPlan 재정의·식단 캘린더·MaterialRequirement)
- `docs/progress/SPRINT3.md` — Sprint 3 아카이브 (발주+입고)
- `docs/progress/SCHEMA_COVERAGE.md` — 모델 구현 현황 (68 모델 + UnitMaster)
- `docs/progress/PO_LIFECYCLE.md` — POStatus 라이프사이클
- `docs/progress/RECEIVING_INVENTORY_POLICY.md` — 입고↔재고 정책
- `docs/progress/COST_LINEUP_ALIGNMENT.md` — 원가↔라인업 정합성
- `01_개발순서.md` ~ `07_HANDOFF.md` — 초기 설계 문서 (히스토리)
- `prisma/schema.prisma` — 스키마 SSOT (v5, Prisma 7)
