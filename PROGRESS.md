# LunchLab ERP — 프로젝트 진행 현황

> 본 문서는 **현재 진행 상황과 앞으로 할 일** 을 관리하는 SSOT(단일 진실 공급원)이다.
> 종결된 Sprint 의 상세 이력은 `docs/progress/SPRINT{n}.md` 로 이관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에서 관리한다.
>
> 마지막 갱신: 2026-07-21 (Sprint 4 Phase S4-3-c R0·R1·R2·R3-a 완료 — R0 감사서 편입, R1 Shipping 잔재 정리, R2 발주단위 개념 폐기·UI 다이얼로그 3종 폐기·라벨 정합화, R3-a 필드명 batch rename (theoreticalQty→suggestedQty, packagingUnit→supplyUnit, packagingFactor→supplyUnitQty, hasOrderUnit→hasSupplyUnit, initialUsedQtyBase→initialSuggestedQtyBase, roundToOrderUnit→roundToSupplyUnit) + c-4-3 legacy Phase 표기 5곳 정합화. 상세 감사 이력: `docs/audits/2026-07-21-consumption-receiving-audit.md`)

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

### 헌법 (P1 ~ P13)

| # | 원칙 | 비고 |
|---|------|------|
| P1 | **발주는 식단(MealPlan) 기반이 원칙이되, 독립(수동) 발주도 지원**. 수동 발주는 `PurchaseOrder.isManual=true` 로 분리 | 수동 발주는 유형에 따라 라인업 귀속 규칙이 다름: **MANUAL_JIT 은 lineup NOT NULL, STOCK_KEEPING 은 lineup 무귀속 허용** (P1' 정정 + P12 참조) |
| P1' | **수동 발주(MANUAL_JIT)의 필수 지정 항목**: 공장(Location), 라인업(Lineup), 출고예정일(outboundDate). 선택: ProductionLine. **SK 발주(STOCK_KEEPING)**: 공장/창고 Location 만 필수. lineup·outboundDate 무귀속. | 식단 기반 발주는 MealPlan 이 계층을 지정. MANUAL_JIT 은 사용자가 명시하여 원가 축 확보. SK 는 사용 처리 시점의 MealPlan.lineupId 상속으로 라인업 귀속을 이연 확보 (P12/P13 참조) |
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
| P12 | **이원 발주 흐름 (Dual Purchase Flow)** — 모든 발주는 α축(Stock-Keeping) 또는 β축(Just-In-Time)으로 명확히 분류된다. `PurchaseOrder.purchaseKind ∈ {WIZARD, MANUAL_JIT, STOCK_KEEPING}` | SK 발주는 lineup·outboundDate 무귀속 허용. JIT 발주(MANUAL_JIT)는 P1' 그대로 lineup·outboundDate NOT NULL. UI 진입점 3분할 (P12 보강 참조) |
| P13 | **사용 처리(Consumption) 이중 레이어** — Layer A(식단 자동 산출, 의무) + Layer B(수동 추가, 선택). 사용 처리는 `MealPlan.status=COMPLETED` 이후에만 진입 가능 | Layer A/B 모두 FIFO 소진 + Pre-flight(P11) + 잔여분 재고/폐기 분기. Layer B는 SK 재고·대체 사용·식단 변경 추가분을 모두 포함. **Consumption 은 재고 소진의 단일 통로 — Shipping 도메인 폐지 (P13 보강 "출고 통합" 참조, S4-3-INT)** |
| P14 | **사용/폐기 분리 저장 원칙** — 소진 이벤트는 성격에 따라 `disposition ∈ {USED, DISPOSED}` 로 **행 분리** 저장. USED는 원가 지표, DISPOSED는 손실 지표. BOM 손질손실은 `BOM.yieldRate` 로 흡수 (별도 폐기 대상 아님). 잔여분은 별도 행 없이 `InventoryLot.remainingQty` 로 자연 존치 | 사용 화면에서 사용자는 `finalUsedQty` + `disposalQty` 를 각각 입력. FIFO 는 두 행 각각에 대해 독립 실행. 검증: `finalUsedQty + disposalQty ≤ totalAvailable` (P11 확장) |
| P15 | **사용 처리 Header/Item 생성 축 (2축 분리)** — 자동(System Auto): MealPlan.status=COMPLETED 트리거로 `ConsumptionHeader(source=AUTO_MEAL_PLAN)` + BOM 파생 Items 자동 생성. 수동은 두 종류로 명확히 구분: **축 A "행 추가"** (기존 PENDING Header 내부에 Item 추가, 권한 게이팅 없음, `Item.sourceType=MANUAL_ADDITION`) + **축 B "헤더 생성"** (신규 `ConsumptionHeader(source=MANUAL)` 생성, SYSTEM/COMPANY_ADMIN 만, 4요소+manualReason 필수) | 2026-07-21 신설. 상세: 헌법 보강 하위 "P15 — 사용 처리 Header/Item 생성 축" 참조 |
| P16 | **가용재고 정본 공식** — `가용재고 = (해당 식단·라인업 예약 재고) + (기존 재고: 예약 미걸림 remainingQty) − (다른 일자 예약 재고) − (다른 라인업/공장 예약 재고)`. 예약 재고는 (InventoryLot ACTIVE) + (useDate=대상일) + (referenceType=MEAL_PLAN_SLOT & lineupId 일치) + (Location·ProductionLine 일치) 4요소 모두 충족 | 2026-07-21 신설. 음수는 0 clamp. P11 Pre-flight 판정 축. 구현: `src/features/inventory/services/available-stock.service.ts` (R6 신설) |
| P17 | **계층 스코프 자동 필터 (전 도메인 롤업)** — 발주·입고·사용·재고·MealPlan·BOM 의 목록/상세 API 및 write 액션은 로그인 사용자의 `UserScope` 로 자동 필터·검증. UI 는 회사 계층에만 사업장 필터 드롭다운 제공, 하위 계층은 미렌더 | 2026-07-21 신설. 구현: `src/lib/auth/scope.ts` (R7). Sprint 6 권한 관리 하위 원칙으로 편입 예정 |
| P18 | **발주 출고일·입고예정일 제약** — 식단 기반(WIZARD): `outboundDate = MealPlan.baseDate` 강제. MANUAL_JIT: `outboundDate` 사용자 지정 필수. SK: `outboundDate` 없음, `expectedReceivedDate` 필수. SK 도착 Location 은 FACTORY/WAREHOUSE/HYBRID 모두 허용 | 2026-07-21 신설. 스키마: `PurchaseOrder.expectedReceivedDate DateTime?` 신설 (R10) |
| P19 | **Shipping 도메인 폐지 확정 (P13 재보강)** — `/shipping` 관련 라우트·서비스·컴포넌트 잔재 전량 제거. 재고 소진의 단일 통로는 Consumption. 스키마 drop 은 S4-3-INT 에서 이미 완료 (마이그레이션 `20260715015044_drop_shipping_domain`) | 2026-07-21 신설. 코드 잔재 정리는 R1 에서 수행 |

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

#### P14 보강 — 사용/폐기 분리 저장 및 라운딩 정책 (2026-07-16 도입)

**저장 원칙**
- 한 번의 사용 처리 액션(`confirmConsumption`)이 하나의 (itemType, itemId, lineupId) 슬롯에 대해 `finalUsedQty > 0` 이면 **USED 행 1건**, `disposalQty > 0` 이면 **DISPOSED 행 1건** 을 각각 생성한다. 둘 다 0이면 행 생성 없음.
- 각 행은 별도의 `ConsumptionLotDetail` 을 갖고, FIFO 는 **행 단위 독립 실행**. USED 와 DISPOSED 가 동일 Lot 을 나눠 쓰는 경우도 자연스럽게 각각의 detail 로 분할.
- 잔여 재고는 별도 행 없이 `InventoryLot.remainingQty` 로 자연 존치 → 다음 사용 처리 또는 실사에서 활용.

**검증 (P11 확장)**
- Pre-flight: `finalUsedQty + disposalQty ≤ totalAvailable` (같은 itemId 그룹 내 라인업 전체 합산 기준)
- `disposalQty > 0` 시 `disposalReason ∈ DisposalReason` 필수. `disposalReason=OTHER` 시 `disposalNote` 필수.
- BOM 손질손실(`TRIMMING_LOSS`) 은 폐기 사유 목록에서 제외 — `BOM.yieldRate` 로 흡수하는 것이 정본.

**라운딩 정책**
- 최종 사용량 초기값은 `theoreticalQty = finalMealCount × bomQtyPerServing` (기본 단위) 를 발주단위로 환산한 값을 `Math.round` 로 정수화한다.
- `theoreticalQty > 0` 이지만 라운딩 결과가 `0` 이면 `1` 로 승격 (재료가 조금이라도 필요하면 최소 1 발주단위는 소진).
- 사용자는 이 초기값을 자유롭게 조정 가능. UI 는 이론값과 실제 입력값의 차이를 함께 표시.

**단위 정책 (발주단위 = 사용단위)**
- 사용 화면의 표시·입력 단위는 **발주서 생성 시점에 확정된 `PurchaseOrderItem.orderUnit`** 을 그대로 사용.
- DB 저장(`ConsumptionItem.consumedQty` / `unit`) 은 **기본 단위(`MaterialMaster.unit` / `SubsidiaryMaster.unit`)** 로 환산 저장 → FIFO·재고 차감·InventoryTransaction 과 단위 일치 보장.
- 환산 계수는 `UnitConversion` 테이블 조회. SK 자재/부자재로 발주 이력이 없는 경우는 기본 단위 사용(`factor=1`).
- 사용화면 진입 시 환산 계수 없는 자재 발견 → 인라인 "발주단위 설정" 미니 다이얼로그로 `UnitConversion` 신규 등록 후 재계산 (발주서 생성 단계의 흐름 재사용).

**라인업별 행 분리**
- 같은 자재라도 `MaterialRequirement(lineupId)` 가 다르면 **사용 화면에서 별도 행**으로 노출·입력.
- `ConsumptionItem` 은 이미 `MealPlan → MealPlanSlot → Lineup` 경로로 lineup 을 자동 상속하므로 별도 컬럼 신설 불필요 (`ConsumptionItem.lineupId` 파생 컬럼 명시 저장 여부는 S4-3-c-4-2 시점 재검토).
- 재고(`availableQty`, `totalAvailable`) 는 라인업 무관 자재 총량 → 같은 자재의 여러 라인업 행에 같은 재고값이 반복 표시됨. UI 는 ⓘ 툴팁 + 그룹 내 실시간 합산 검증으로 대응.

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

#### P1' 정정 — 수동 발주의 라인업 필수 요건 세분화 (2026-07-10)

수동 발주(`isManual=true`)라도 유형에 따라 라인업·출고일 필수 규칙이 다르다. Sprint 3.5 종결 시점의 "수동 발주 = 라인업 NOT NULL" 일괄 규칙은 P12 이원 발주 흐름 도입으로 다음과 같이 정정된다.

| 발주 유형 | `purchaseKind` | `isManual` | `lineupId` | `outboundDate` | 사유 |
|---|---|---|---|---|---|
| 식단 위저드 | `WIZARD` | `false` | 서비스에서 자동 매핑 (MR 경유) | MealPlan 헤더에서 자동 | 기존과 동일 |
| 수동 JIT | `MANUAL_JIT` | `true` | **NOT NULL** | **NOT NULL** | 특정 라인업의 특정 출고일에 사용 확정 |
| 재고 확보 (SK) | `STOCK_KEEPING` | `true` | NULL 허용 | NULL 허용 | 발주 시점에 소비 시점 미확정. 사용 처리 시점에 원가 축 확보 |

**SK 발주의 라인업 귀속 확보 메커니즘 (이연 확보 원칙)**:
- SK 발주로 쌓인 재고는 결국 어떤 형태로든 소진됨 → 소진 통로는 반드시 사용 처리(Consumption).
- 사용 처리는 P13에 따라 `MealPlan.status=COMPLETED`인 (companyId, targetDate, locationId) 컨텍스트에서만 진입 가능. `MealPlan.lineupId`는 NOT NULL 이므로 이 컨텍스트에는 반드시 lineup 이 존재.
- Layer A 자동 산출분은 `MealPlan → MealPlanSlot → ConsumptionItem` 관계로 lineup 을 자동 상속.
- Layer B(수동 추가) 도 진입 컨텍스트의 `MealPlan.lineupId` 를 상속 대상으로 삼음.
- 결과적으로 **모든 소진은 예외 없이 라인업에 귀속**되며, P1 의 원가 귀속 누락 방지 원칙은 발주 시점이 아닌 사용 처리 시점에 완결적으로 성립한다.

**추후 검토 항목**: `ConsumptionItem.lineupId` 를 파생 컬럼으로 명시 저장할지 여부는 S4-3 착수 시점에 다시 결정. 명시 저장 시 롤업 쿼리 성능·감사 추적이 유리하고, 저장하지 않을 경우 `MealPlan` 조인만으로 도출 가능.

#### P12 보강 — 이원 발주 흐름 상세 (2026-07-10 도입)

품목의 소진 리듬에 따라 발주는 두 축 세 진입점으로 분류된다. 세 진입점은 UI 상 명확히 분리되어 있으나, 내부 서비스는 단일 `createPurchaseOrdersBatch` 가 `purchaseKind` 축으로 분기한다.

**α축 — Stock-Keeping (SK)**
- **성격**: "언제 얼마나 쓸지 정확히 모르지만 미리 확보해두는 발주"
- **대상 품목**: 부자재, OEM 자재 (`MaterialMaster.isStockKeeping = true`), 재고 확보가 필요한 일반 식재료 등 **품목 유형 제한 없음**. UI 는 SK 대상 자재를 우선 노출하되 필터 스위치로 전체 자재 접근 가능.
- **필수 필드**: 입고지 Location.
- **선택 필드**: 예상 입고일(참고), 비고.
- **무귀속**: `lineupId`, `mealPlanGroupId`, `outboundDate`.
- **`PurchaseOrder.purchaseKind`**: `STOCK_KEEPING`.
- **UI 진입점**: `/purchase-orders/stock/new`.
- **원가 귀속**: 사용 처리 시점에 이연 확보 (P1' 정정 참조).
- **입고 후 재고 위치**: `Location.type ∈ {FACTORY, WAREHOUSE, HYBRID}`. 창고 입고는 `receivingNote:warehouse` 권한 필요 (기본 COMPANY_ADMIN).

**β축 — Just-In-Time (JIT)**
- **성격**: "특정 라인업의 특정 출고일에 쓸 것이 명확한 발주"
- 두 하위 진입점:

| 진입점 | `purchaseKind` | `isManual` | 트리거 | 필수 |
|---|---|---|---|---|
| 식단 위저드 (`/purchase-orders/wizard`) | `WIZARD` | `false` | MaterialRequirement 자동 산출 → 위저드 확정 | `mealPlanGroupId` NOT NULL (lineup 은 MR 경유 자동 매핑) |
| 수동 JIT (`/purchase-orders/manual/new`) | `MANUAL_JIT` | `true` | 식단 변경으로 즉시 필요한 자재/부자재 수동 발주 | `lineupId` NOT NULL, `outboundDate` NOT NULL |

**서비스 계층 규칙**
- `createPurchaseOrdersBatchSchema` 에 `purchaseKind` 를 도입. 기존 `isManual` 은 `purchaseKind` 로부터 파생 (하위 호환).
  - `WIZARD` → `isManual = false`
  - `MANUAL_JIT` → `isManual = true`, `lineupId`/`outboundDate` NOT NULL 검증
  - `STOCK_KEEPING` → `isManual = true`, `lineupId`/`outboundDate`/`mealPlanGroupId` 강제 NULL
- **그룹키 규칙**:
  - `WIZARD`: `supplier | location | productionLine`
  - `MANUAL_JIT`: `supplier | location | productionLine | lineup` (기존 S3.5-2b)
  - `STOCK_KEEPING`: `supplier | location | productionLine`
- **신규 에러 코드**: `PURCHASE_KIND_LINEUP_MISMATCH`, `PURCHASE_KIND_OUTBOUND_MISMATCH`, `STOCK_KEEPING_REQUIRES_LOCATION`, `MANUAL_JIT_REQUIRES_LINEUP` (기존 `LINEUP_REQUIRED_FOR_MANUAL` 대체).

**권한 리소스 매핑**
- `purchaseOrder:wizard`
- `purchaseOrder:manualJit`
- `purchaseOrder:stockKeeping`
- `receivingNote` (공장 입고)
- `receivingNote:warehouse` (창고 입고 — 기본 COMPANY_ADMIN, PermissionSet 로 공장 위임 가능)

**품목 유형 자유도 (2026-07-10 확정)**
SK 발주 대상을 부자재·OEM 로 국한하지 않는다. 부자재 전체 + `MaterialMaster.isStockKeeping = true` 자재를 기본 노출하되, 필요 시 일반 식재료도 발주 가능하도록 필터 스위치를 UI 에 제공한다. 이는 실제 운영에서 특정 시즌·특가 매입 등으로 일반 식재료를 미리 확보해야 하는 케이스를 포용하기 위함이다.

#### P13 보강 — 사용 처리 이중 레이어 상세 (2026-07-10 도입)

사용 처리는 재고 관리·원가 관리의 **완결 지점**이다. 다음 원칙과 UX 구조를 반드시 따른다.

**진입 조건 (필수 가드)**
- 대상 컨텍스트: `(companyId, targetDate, locationId)`
- 해당 컨텍스트의 `MealPlan.status = COMPLETED` (확정 식수 입력 완료) 인 경우에만 진입 가능.
- 서비스 진입점: `assertMealPlanCompletedForConsumption(companyId, targetDate, locationId)` 가드.
- 미완료 상태 진입 시 `MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION` throw.

**Layer A — 자동 산출 (의무)**
- 소스: `MealPlan × finalCount × BOM 전개`.
- `ConsumptionItem.sourceType = MEAL_PLAN_AUTO`.
- 대상: 식재료 전량 + 부자재 중 `MealTemplateAccessory.consumptionType = PER_MEAL_COUNT` 항목.
- 자동 채워지는 예상 사용량은 사용자가 실사용량으로 수정 가능.

**Layer B — 수동 추가 (선택)**
- `ConsumptionItem.sourceType = MANUAL_ADDITION`.
- 세 가지 케이스를 포용:
  - **B1 대체 사용**: 원래 A로 나갔어야 했지만 재고 부족·품질 이슈로 다른 품목으로 대체.
  - **B2 식단 변경 추가분**: 식단 확정 후 급히 추가 구매(MANUAL_JIT)한 자재의 실사용 입력.
  - **B3 SK 재고 소진**: 부자재·OEM·기타 SK 재고에서 꺼내 쓴 자재의 사용 입력.
- 사용자가 "품목 추가" 버튼으로 자재/부자재 임의 행 추가.

**UX 필수 표시 항목 (각 품목 행)**
- 예상 식수, 확정 식수 (헤더 영역, MealPlan 에서)
- **총 재고량** — 대상 Location 의 해당 자재 `InventoryLot.remainingQty` 합계에서 활성 Reservation 을 제외한 `availableQty` (P11 정합)
- **해당 출고일 위해 입고된 수량** — `outboundDate = targetDate` 인 PO 로부터 입고된 해당 자재의 수량 (레퍼런스)
- **사용량 입력란** — 사용자가 실사용량을 직접 입력
- **잔여분 처리** — 사용량 차감 후 남는 재고에 대한 처분 입력 (아래 규칙)

**잔여분 처리 규칙 (필수)**
- 기본 동작: 사용량만큼만 Lot 차감, 나머지는 InventoryLot 에 잔존 (재고로 유지). 별도 기록 없음.
- 폐기 발생 시: 각 행마다 **폐기 수량 + 폐기 사유** 입력.
  - 폐기 사유: `DisposalReason` enum (`EXPIRED | DAMAGED | CONTAMINATED | OVER_PREPARED | OTHER`).
  - `OTHER` 선택 시 `disposalNote` 필수 (자유 입력).
  - **부분 폐기 지원**: 사용량 + 폐기량 < 총 재고량 인 경우, 나머지는 재고로 잔존.
- 사용/폐기 처분 매핑:
  - `disposition = USED`: 사용량 부분 (`InventoryTransaction(CONSUMPTION)`)
  - `disposition = DISPOSED`: 폐기량 부분 (`InventoryTransaction(DISPOSAL)`)
  - `disposition = RETURNED`: 미사용 반환 (트랜잭션 없음, 개념적)

**FIFO 소진 (기존 정책 준수)**
- 사용량은 `receivedAt ASC, lotId ASC` 로트 순으로 자동 소진.
- `ConsumptionLotDetail` 에 로트별 분할 기록.
- 원가는 각 로트의 `unitPrice` 사용.

**Pre-flight 검증 (P11 준수)**
- `사용량 + 폐기량 > availableQty` 이면 즉시 `INSUFFICIENT_STOCK` throw. 저장 차단.
- 마이너스 재고는 어떠한 경우에도 허용되지 않는다.

**원가 산출 축**
- `ConsumptionItem` 의 직접재료비 = `Σ ConsumptionLotDetail.quantity × ConsumptionLotDetail.unitPrice`.
- 라인업별 원가는 `MealPlan → MealPlanSlot → ConsumptionItem` 관계로 롤업.
- Layer A vs Layer B 를 sourceType 필터로 별도 집계하여 "식단 이론 원가" vs "실제 원가" vs "식단 이탈 원가" 를 도출.

**프로세스 요약**
식단 확정(finalCount 입력) → MealPlan.status = COMPLETED → 사용 처리 목록 자동 생성 (Layer A) → 품목별 사용량 입력 (레퍼런스: 예상/확정 식수, 총 재고, 당일 입고량) → 잔여분 처분 입력 (재고 잔존 / 부분 폐기 + 사유) → 확정 (Reservation 해제 + InventoryTransaction 원자적 기록)

**Reservation 해제 정책 (핵심 정합성)**
사용자 확인 사항(2026-07-10)에 따라 Reservation 생명주기는 다음과 같이 확정된다.

**JIT 경로 (WIZARD / MANUAL_JIT 발주)**:
1. **생성**: `CookingPlan.status → CONFIRMED` 시점. 자재 요구량만큼 대상 Lot 을 FIFO 배정. `InventoryReservation` 생성.
2. **유지**: 다른 사용 처리의 Pre-flight 는 `availableQty(Lot) = remainingQty − Σ(active Reservation.qty)` 로 판정.
3. **해제**: 사용 처리 확정 시점에 다음 3분기.
   - `disposition = USED` → Reservation 해제(`CONSUMED`) + `InventoryTransaction(CONSUMPTION)` 실제 차감.
   - `disposition = RETURNED` → Reservation 해제(`MANUAL_CANCEL`) + 트랜잭션 없음 (원래 출고되지 않은 양).
   - `disposition = DISPOSED` → Reservation 해제(`CONSUMED`) + `InventoryTransaction(DISPOSAL)`.
4. **자동 해제**: `CookingPlan.status → REPLACED` 또는 만료 → Reservation 자동 해제(`AUTO_EXPIRED`, 배치).

**SK 경로 (STOCK_KEEPING 발주)**:
- **예약 없음**: SK 재고는 특정 lineup·outboundDate 에 사전 예약되지 않음.
- `availableQty = remainingQty` (Reservation 차감 없음).
- Layer B 에서 사용자가 사용량 입력 시 즉시 FIFO 차감.
- 동시성 방어: Pre-flight 및 `InventoryTransaction` 생성은 단일 트랜잭션 내 `SELECT FOR UPDATE` 잠금으로 경쟁 조건 차단.

**이 구분의 함의**
- JIT 재고는 예약을 통해 "어느 조리 계획을 위한 재고인지"가 명시적으로 확보됨 → 동시 조리 계획들의 재고 이중 소비 방지.
- SK 재고는 익명 버퍼 → 예약 오버헤드 없이 자유롭게 소진.
- 두 축은 같은 Location 의 같은 자재에 대해서도 공존 가능. 이 경우 로트 단위로 Reservation 유무가 나뉘며, FIFO 소진 순서는 두 축 로트를 통합 정렬 후 예약된 로트는 예약자만 접근 가능.

#### P13 보강 — 출고(Shipping) 도메인 폐지 및 Consumption 흡수 (2026-07-15 확정, S4-3-INT)

**배경**:
- 최초 스키마(2026-06 초) 설계 시 `ShippingOrder` / `ShippingOrderItem` 을 별도 도메인으로 분리했다. Company → Factory 출고를 별도 상태(`ShippingStatus: PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED`) 로 추적하려는 의도였다.
- 그러나 Sprint 3.5 (P12 이원 발주 흐름) 및 Sprint 4 S4-0 ~ S4-3-b (P13 사용 처리 이중 레이어) 를 확정하는 과정에서, "**엔드라인 사용일 = 실제 출고일 = `PurchaseOrder.outboundDate`**" 라는 등식이 P8 로 명문화됐다.
- 동시에 P13 이 "**Consumption 은 (Layer A 자동 + Layer B 수동) 재고 소진의 유일한 통로**" 임을 확정하면서, `ShippingOrder` 는 (1) 발주의 `outboundDate` 와 (2) Consumption 의 실사용 확정을 이중 기록하는 **중복 도메인**이 됐다.

**결론 (2026-07-15)**:
1. `ShippingOrder` / `ShippingOrderItem` 모델과 `ShippingStatus` enum 을 **완전 폐지**한다.
2. "재고 출고" 의미는 **두 축으로 완결 표현**된다:
   - **의도된 출고일**: `PurchaseOrder.outboundDate` (발주 시점에 확정, P8 추적 키)
   - **실제 사용/소진**: `ConsumptionItem.status = CONFIRMED` 시 `InventoryLot` FIFO 차감 + `ConsumptionLotDetail` 스냅샷 (P13 Layer A/B)
3. 별도의 "Shipped/Delivered" 중간 상태는 **의미론적으로 존재하지 않는다** — 발주(outboundDate)와 소비(Consumption CONFIRMED) 사이의 물리적 이동은 `InventoryTransfer` (WAREHOUSE → FACTORY 등, P3 보강) 로 이미 표현 가능하기 때문.
4. 향후 "공급사 → 공장 배송 추적" 요구가 발생하면 `ReceivingNote` 의 pre-arrival 상태(예: `IN_TRANSIT`) 로 확장해 흡수한다 (별도 도메인 재도입 금지).

**적용 범위 (커밋 `c2dd65f6`, 마이그레이션 `20260715015044_drop_shipping_domain`)**:
- 스키마: enum `ShippingStatus` 삭제, model `ShippingOrder` / `ShippingOrderItem` 삭제, `Company` · `Location` · `MaterialMaster` · `SubsidiaryMaster` · `MealPlanGroup` · `Lineup` 6개 모델의 역참조 필드 삭제.
- 서비스: `lineup.service.ts` · `location.service.ts` 의 의존성 카운트에서 `shippingOrders` 제거.
- 테스트/mock: shippingOrder 관련 mock 및 assertion 정리.
- UI/seed: 사이드바 "출고 관리" 링크·`Truck` import 삭제, `sysAdminResources` 에서 `"shipping"` 제거 (권한 시드 수 108로 축소).
- DB 데이터 손실: 없음 (`shipping_orders` / `shipping_order_items` 모두 0 rows).

**향후 재도입 조건**:
공급사 발주 이후 실물 도착까지의 **다단계 물류 추적** (컨테이너/트럭 단위 실시간 위치 등) 요구가 명시적으로 발생하는 경우에 한하여 재검토. 그 경우에도 `ShippingOrder` 부활이 아니라 `ReceivingNote` 확장 또는 `ShipmentTracking` (신설) 이 후보.

#### P14 재보강 — 품목(SupplierItem) 단위 정본화 (전 도메인 적용) (2026-07-21)

**원칙**: 발주·입고·사용·재고 lot 4개 도메인 모두에서 최소 관리 단위는 자재가 아닌 **품목(SupplierItem)** 이다. 자재(MaterialMaster/SubsidiaryMaster) 는 UI 그루핑·필터·BOM 연결의 분류 축으로만 사용하고, 실물·단가·재고·원가의 정본은 품목.

- 예) 자재 "당근" → 품목 {공급A·당근 1kg, 공급A·햇당근 2kg, 공급B·당근 1kg …}
- **각 도메인 적용**:
  - 발주(`PurchaseOrderItem.supplierItemId`) NOT NULL (기존 준수)
  - 입고(`ReceivingNoteItem.supplierItemId`) NOT NULL (기존 준수)
  - 재고(`InventoryLot.supplierItemId`) NOT NULL — Lot 은 특정 품목에 귀속 (FIFO 정본 축)
  - **사용(`ConsumptionItem.supplierItemId`) NOT NULL 승격** (R3 마이그레이션)
- **BOM 예외**: 회사 계층 BOM 은 자재만 지정. 발주·입고 시점에 SupplierItem 확정. SK 방식 부자재로 사용 처리 시 SupplierItem 미확정이면 "품목 수동 매핑" 다이얼로그로 확정한 뒤에만 사용량 입력 허용.
- **원가 정본**: `ConsumptionLotDetail.unitPrice` (= 소진된 Lot 의 SupplierItem 기준 단가).

#### P15 — 사용 처리 Header/Item 생성 축 (2축 분리) (2026-07-21)

용어·데이터·권한을 완전 분리하여 혼선을 제거한다.

**축 A "행 추가" (Row Append)**
- 대상: 기존 `ConsumptionHeader (status=PENDING)` 내부
- 행위: 그 Header 에 `ConsumptionItem` 신규 추가
- 용도: BOM 에 없던 품목 사용, SK 부자재의 SupplierItem 수동 매핑
- 표기: `ConsumptionItem.sourceType = MANUAL_ADDITION`
- 권한: Header 접근 가능한 모든 사용자 (P17 스코프 통과)
- 제약: `Header.status = PENDING` 인 경우만. CONFIRMED 후 불허 (R12)
- UI 진입: `/consumption/[headerId]` 상세 페이지 하단 `[+ 품목 추가]` 버튼

**축 B "헤더 생성" (Header Create)**
- 대상: `ConsumptionHeader` 자체
- 행위: `source=MANUAL, status=PENDING` 신규 Header 생성
- 용도: 정규 MealPlan 파생이 아닌 별도 사용 이벤트 (시식, 긴급 대체, 임시 조리)
- 필수 지정 4요소 + 사유: ① consumedDate, ② locationId, ③ productionLineId, ④ lineupId, ⑤ manualReason (자유텍스트)
- 자동 연결: `(companyId, consumedDate)` 로 `MealPlanGroup` 자동 참조. 해당 그룹 부재 시 수동 생성 불허 → UI 안내 "해당 일자에 확정된 식단이 없어 수동 헤더를 만들 수 없습니다"
- 표기: `Header.source = MANUAL`, 안의 모든 Item 최초 `sourceType = MANUAL_ADDITION` (BOM 자동 파생 없음)
- BOM 파생 없음: 사용자가 축 A "행 추가" 로 items 를 하나씩 채움
- 권한: 초기 SYSTEM_ADMIN / COMPANY_ADMIN 만. Sprint 6 권한 관리에서 `CONSUMPTION_MANUAL_CREATE` 권한으로 분리하여 공장 계층 확장 가능
- UI 진입: `/consumption` 목록 상단 `[+ 수동 헤더 생성]` 버튼 (권한자에만 렌더)

**자동 생성 (System Auto — 축 B 와 대비)**
- 트리거: `MealPlan.status = COMPLETED` 전이 (기존 확정 액션과 동일 트랜잭션)
- 결과: (Location, ProductionLine) 조합별 `ConsumptionHeader(source=AUTO_MEAL_PLAN, status=PENDING)` + BOM 파생 Items 자동 채움 + `InventoryReservation` 동시 생성
- 표기: `Header.source = AUTO_MEAL_PLAN`, Items 초기 `sourceType = MEAL_PLAN_AUTO`
- 이후 사용자가 축 A 로 추가한 행만 `MANUAL_ADDITION`

**스키마 (R3 도입)**
enum ConsumptionHeaderSource {
  AUTO_MEAL_PLAN
  MANUAL
}

enum ConsumptionHeaderStatus {
  PENDING
  CONFIRMED
  CANCELLED  // Sprint 5 이후 재편집 UI 도입 시 활성화 (R12 유예)
}

대시보드 함의: "예상 대비 실제 사용량 편차 = sourceType=MEAL_PLAN_AUTO 만 카운트", "비계획 사용 원가 = sourceType=MANUAL_ADDITION 만 카운트" 등 명확한 필터 축.

P16 — 가용재고 정본 공식 (2026-07-21)
Copy가용재고 = (해당 식단·라인업의 예약 재고)
        + (기존 재고: 예약 미걸림 remainingQty)
        − (다른 일자 예약 재고)
        − (다른 라인업/공장 예약 재고)
예약 재고 정의 (다음 4요소 모두 충족한 InventoryReservation):

InventoryLot.status = ACTIVE (입고 확정 완료)
InventoryReservation.useDate = 대상 소비일
referenceType = "MEAL_PLAN_SLOT" 이며 참조된 MealPlanSlot 의 lineupId 일치
참조된 MealPlanSlot 의 소속 Location·ProductionLine 일치
음수는 0 clamp
SK Lot 등 isReservationEligibleLot=false 인 lot 은 제외
구현: src/features/inventory/services/available-stock.service.ts (R6 신설, 기존 reservation.service.ts 의 getAvailableQty 를 lot 단위 → 아이템·라인업·일자 단위로 확장)
P11 Pre-flight 판정 축: usedQty + Σ(LayerB.qty for same supplierItem) ≤ availableQty (기존 totalStock 대체)
P17 — 계층 스코프 자동 필터 (전 도메인 롤업) (2026-07-21)
발주·입고·사용·재고·MealPlan·BOM 의 목록·상세 API·write 액션은 로그인 사용자의 UserScope 로 자동 필터·검증.

ScopeRole	접근 범위	필터
SYSTEM_ADMIN	전체 (Company 무관)	없음
COMPANY_ADMIN	해당 companyId 전체	WHERE companyId = :userCompanyId
MEMBER + locationId	해당 Location + 하위 ProductionLine	WHERE locationId IN (:userLocationIds)
MEMBER + productionLineId	해당 ProductionLine	WHERE productionLineId IN (:userLineIds)
UI 규칙: 회사 계층에만 사업장 필터 드롭다운 제공. 하위 계층은 필터 UI 자체 미렌더.
구현: src/lib/auth/scope.ts (R7 신설) — getUserScope(userId) + applyScopeFilter(where, scope, domain) + assertScopeAccess(user, targetLocationId, targetProductionLineId). 도메인별 컬럼 매핑 테이블 관리.
관리 도메인: 이 원칙은 권한셋(role·permission) 관리의 하위 원칙으로 편입. Sprint 6 권한 관리 Phase 에서 UI·정책 관리자 화면과 통합.
P18 — 발주 출고일·입고예정일 제약 (2026-07-21)
식단 기반 발주 (purchaseKind = WIZARD): outboundDate = MealPlan.baseDate 강제. 위저드는 baseDate 를 자동 세팅하고 편집 불가. 예외가 필요하면 MANUAL_JIT 로 재분류.
MANUAL_JIT: outboundDate 사용자 지정 필수 (P1' 준수).
STOCK_KEEPING (SK): outboundDate 없음. 대신 expectedReceivedDate 필수. PurchaseOrder.expectedReceivedDate DateTime? 필드 R10 에서 신설.
SK 도착 Location: FACTORY / WAREHOUSE / HYBRID 모두 허용 (기존 창고 전용 제약 완화 — P3 정합).
P19 — Shipping 도메인 폐지 확정 (P13 재보강) (2026-07-21)
/shipping 관련 라우트·서비스·컴포넌트 잔재는 전량 제거. 재고 소진의 단일 통로는 Consumption.

스키마 drop 은 S4-3-INT 에서 이미 완료 (마이그레이션 20260715015044_drop_shipping_domain).
R1 에서 코드 잔재 (라우트·컴포넌트·import 등) 만 정리.

---

#### 변경 이력
- 2026-07-10 — **P12(이원 발주 흐름) / P13(사용 처리 이중 레이어) 신설**. P1/P1' 정정: SK 발주(`STOCK_KEEPING`)는 lineup·outboundDate 무귀속 허용, 원가 귀속은 사용 처리 시점의 `MealPlan.lineupId` 상속으로 이연 확보. 기존 "예약 (InventoryReservation) 정책 (2026-07-08 확정)" 소섹션은 P13 보강 안으로 통합·흡수 (방안 2). SK/JIT 축별 예약 정책 분기 명문화 (SK 는 예약 없음, `SELECT FOR UPDATE` 로 경쟁 조건 차단). Sprint 4 로드맵 재편성 — S4-0 ~ S4-4 로 확장.
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
- [ ] 이 발주가 P12 의 어느 축(WIZARD / MANUAL_JIT / STOCK_KEEPING)에 해당하는가? purchaseKind 필드가 정확히 설정되는가?
- [ ] SK 발주라면 lineup·outboundDate·mealPlanGroupId 가 NULL 강제되는가? 원가 귀속은 사용 처리 시점으로 이연 확보되는가? (P1' 정정)
- [ ] 사용 처리 작업이라면 P13 이중 레이어(Layer A 의무 + Layer B 선택)를 준수하는가? Pre-flight(P11) 및 FIFO 소진이 구현되어 있는가?
- [ ] Reservation 을 다루는가? JIT 경로에만 예약 생성, SK 로트는 예약 미적용 원칙을 준수하는가?

---

## 📍 현재 상태 요약

- **현재 진행 중 Sprint**: Sprint 4 (Phase S4-0-b 완료, S4-0-c 착수 대기)
- **직전 종결 Sprint**: Sprint 3.5 (수동 발주 보완, 2026-07-08 ~ 2026-07-09)
  > 상세 이력 → `docs/progress/SPRINT3.5.md`
  >
  > 요약: `PurchaseOrder.lineupId` 스키마 보강 + 마이그레이션, `assertLineupForPO`·`assertLineupsForManualBatch` 헬퍼 신설로 P1' 코드 실현, 수동 발주 UI(`/purchase-orders/manual/new`) 신설 + `SearchableSelect` 통합, 배치 서비스에 `isManual` 축·다중 공급업체 자동 그룹핑·`sourceType=MANUAL`·마스터 미변경(P9') 구현, 수동 발주 배치 서비스 테스트 9건, 도메인 문서 `MANUAL_PURCHASE_ORDER.md` 신설.
- **이전 아카이브 Sprint**: Sprint 1 → `docs/progress/SPRINT1.md`, Sprint 2 → `docs/progress/SPRINT2.md`, Sprint 3 → `docs/progress/SPRINT3.md`
- **최근 완료 항목**:
  - Sprint 3.5 종결 아카이브 (`docs/progress/SPRINT3.5.md`) ✅
  - Sprint 4 착수 준비: **헌법 P12(이원 발주 흐름) · P13(사용 처리 이중 레이어) 신설** — 2026-07-10 ✅
  - Sprint 4 Phase S4-0-a 완료 — 2026-07-10 ✅
    - `PurchaseKind` / `ConsumptionSourceType` enum 도입
    - `MaterialMaster.isStockKeeping` / `PurchaseOrder.purchaseKind` / `ConsumptionItem.sourceType` 필드 + 인덱스 추가
    - 백필: `isManual=true → purchaseKind=MANUAL_JIT` (4건) / 나머지 default `WIZARD` (35건)
    - 프로젝트 snake_case 규약 정정: `@map("purchase_kind")`, `@map("is_stock_keeping")`, `@map("source_type")` 추가 + 컬럼 rename 보정 마이그레이션
    - 마이그레이션: `20260710015720_s4_0_a_add_purchase_kind_and_source_type`, `20260710020509_s4_0_a_2_rename_new_columns_to_snake_case`
    - 커밋: `b288df6`, `6007c03`
  - Sprint 4 Phase S4-0-b 완료 — 2026-07-10 ✅
    - `InventoryTransaction`에 `itemType ItemType @default(MATERIAL) @map("item_type")` 필드 + 인덱스 추가
    - `materialMasterId` nullable 전환, `materialMaster` 관계 optional 조정
    - `subsidiaryMasterId String? @map("subsidiary_master_id")` 신규 + FK + 인덱스
    - `SubsidiaryMaster.inventoryTransactions InventoryTransaction[]` 역방향 관계 추가
    - XOR CHECK constraint `inventory_transactions_item_type_xor` 적용 (raw SQL, migration.sql 하단)
    - 기존 데이터 40건: DEFAULT 'MATERIAL' 로 자동 백필 (추가 UPDATE 불필요, `SELECT item_type, COUNT(*) …` 검증 완료 — MATERIAL 40건)
    - 마이그레이션: `20260710023135_s4_0_b_extend_inventory_transaction_for_subsidiary`
    - 커밋: `e37a477`
- **다음 착수 항목**: **Sprint 4 Phase S4-0-c** — `InventoryReservation` 활성화 (스키마 실측·필드 보강 검토, `getAvailableQty` 헬퍼 신설, 만료 배치 스켈레톤). SK 로트는 예약 대상 제외.


---

## 🚧 다음 진행 항목

Sprint 3.5(보완) 및 Sprint 4 ~ Sprint 8 로드맵. 각 Sprint 는 스키마 실측(`prisma/schema.prisma`) 및 `SCHEMA_COVERAGE.md` 의 모델 배치를 SSOT 로 삼는다. Phase 번호는 착수 시점에 조정 가능.

---

### Sprint 3.5 — 수동(독립) 발주 보완 ✅ 종결 (2026-07-09)

> 상세 이력 → `docs/progress/SPRINT3.5.md`
>
> 요약: 헌법 P1' 코드 실현. `PurchaseOrder.lineupId` 스키마 보강, `assertLineupForPO`·`assertLineupsForManualBatch` 서비스 헬퍼, 수동 발주 UI(`/purchase-orders/manual/new`) 신설, 배치 서비스 `isManual` 축·다중 공급업체 자동 그룹핑·`sourceType=MANUAL`·마스터 미변경(P9') 구현. 배치 서비스 수동 발주 테스트 9건, 도메인 문서 `MANUAL_PURCHASE_ORDER.md` 신설.

---

### Sprint 4 — 이원 발주 완결 + 부자재/OEM 재고 처리 + 사용 처리 (P12/P13 반영)

**목표**: P12(이원 발주 흐름)와 P13(사용 처리 이중 레이어)을 코드·UI·문서에 완결적으로 구현. 부자재/OEM/일반 식재료를 아우르는 SK 발주 경로를 신설하고, 식단 확정 이후의 사용 처리를 Layer A(자동) + Layer B(수동) 이중 구조로 완성한다.

**Sprint 4 시작 전 확정된 결정 사항 (2026-07-10)**
- SK 발주 대상 품목 제한 없음 — 부자재·OEM·일반 식재료 모두 허용 (필터 스위치 제공)
- Location CRUD UI 최소 확장 (Q6 안A) — 기존 공장 등록 폼에 `type` 라디오 추가
- `MaterialType` enum 그대로 유지 (Q7 안A) — OEM 여부는 `MaterialMaster.isStockKeeping` 으로만 판별
- 창고 입고 권한: 전체 창고 일괄 위임 (`receivingNote:warehouse`) 방식, 창고별 세분화는 이후 phase
- SK 재고는 Reservation 없음, JIT 재고만 Reservation 적용
- `ConsumptionItem.lineupId` 파생 컬럼 저장 여부는 S4-3 착수 시 재검토

---

#### Phase S4-0 · 스키마 보강 게이트

**S4-0-a — 이원 발주 · 사용 처리 스키마 도입 ✅ 완료 (2026-07-10)**

*   `MaterialMaster.isStockKeeping Boolean @default(false) @map("is_stock_keeping")` + `@@index([isStockKeeping])`
*   `PurchaseOrder.purchaseKind PurchaseKind @default(WIZARD) @map("purchase_kind")` + `@@index([purchaseKind])`
*   `enum PurchaseKind { WIZARD, MANUAL_JIT, STOCK_KEEPING }`
*   `ConsumptionItem.sourceType ConsumptionSourceType @default(MEAL_PLAN_AUTO) @map("source_type")` + `@@index([sourceType])`
*   `enum ConsumptionSourceType { MEAL_PLAN_AUTO, MANUAL_ADDITION }`
*   백필: `isManual=true` → `purchaseKind=MANUAL_JIT`(4건), `isManual=false` → `WIZARD`(35건, default). `ConsumptionItem.sourceType` / `MaterialMaster.isStockKeeping` 은 default 자동 백필.
*   `SCHEMA_COVERAGE.md` 업데이트 완료.
*   **마이그레이션**:
    *   `20260710015720_s4_0_a_add_purchase_kind_and_source_type` — enum·필드·index 추가 + 백필
    *   `20260710020509_s4_0_a_2_rename_new_columns_to_snake_case` — 프로젝트 규약 일치를 위한 컬럼명 rename (camelCase → snake_case) + `@map` 지시자 추가
*   **커밋**: `b288df6`, `6007c03`
*   **교훈**: Prisma 는 `@map` 지시자가 없으면 컬럼명을 필드명 그대로 camelCase 로 생성한다. 이 프로젝트는 컬럼명 snake_case 규약이므로 신규 필드 추가 시 반드시 `@map("snake_case_name")` 를 붙여야 한다. S4-0-b 부터는 처음부터 반영.

**S4-0-b — InventoryTransaction 부자재 대응 ✅ 완료 (2026-07-10)**

*   `InventoryTransaction.itemType ItemType @default(MATERIAL) @map("item_type")` + `@@index([itemType])`
*   `InventoryTransaction.materialMasterId` nullable 전환 (`String?`), `materialMaster` 관계 optional (`MaterialMaster?`)
*   `InventoryTransaction.subsidiaryMasterId String? @map("subsidiary_master_id")` 신규 + FK + `@@index([subsidiaryMasterId])`
*   `SubsidiaryMaster.inventoryTransactions InventoryTransaction[]` 역방향 관계 추가
*   XOR CHECK constraint (마이그레이션 SQL 하단에 raw SQL 로 추가):

    ```sql
    ALTER TABLE "inventory_transactions"
      ADD CONSTRAINT "inventory_transactions_item_type_xor" CHECK (
        (item_type = 'MATERIAL'   AND material_master_id   IS NOT NULL AND subsidiary_master_id IS NULL)
     OR (item_type = 'SUBSIDIARY' AND subsidiary_master_id IS NOT NULL AND material_master_id   IS NULL)
      );
    ```

*   백필: 기존 40건 모두 DEFAULT 'MATERIAL' 로 자동 채워짐 (추가 UPDATE 불필요). 검증 쿼리 `SELECT item_type, COUNT(*) FROM inventory_transactions GROUP BY item_type` → `MATERIAL: 40` 확인.
*   FK 정책 변경 참고: Prisma 가 `material_master_id` NOT NULL 해제를 위해 기존 FK 를 DROP 후 재생성하며 `ON DELETE SET NULL ON UPDATE CASCADE` 로 정책이 변경됨. `subsidiary_master_id` FK 도 동일 정책. 서비스 계층에서 자재 삭제 시나리오 재검토 필요.
*   **마이그레이션**: `20260710023135_s4_0_b_extend_inventory_transaction_for_subsidiary`
*   **커밋**: `e37a477`
*   **교훈**: nullable 전환은 Prisma 마이그레이션에서 FK DROP → ADD 로 재구성되며, 이 과정에서 참조 무결성 정책(ON DELETE/UPDATE)이 기본값(`SET NULL / CASCADE`)으로 재설정된다. 삭제 정책이 중요한 FK 는 마이그레이션 SQL 검토 시 명시적으로 확인해야 한다.

**S4-0-c — InventoryReservation 활성화 ✅ 완료 (2026-07-10)**
- 마이그레이션: `20260710081554_s4_0_c_add_inventory_lot_purchase_kind` (commit `c904c07`)
- 백필 재적용: `*_s4_0_c_2_backfill_manual_jit_purchase_kind` (commit `308a205`)
- 서비스: `src/features/inventory/services/reservation.service.ts` (commit `96c6d83`)
  - `getAvailableQty(lotId)` — remainingQty − Σ 활성 예약
  - `createReservation(input)` — 자격·수량·회사 검증 후 생성
  - `releaseReservation({reservationId, reason})` — CONSUMED / MANUAL_CANCEL / AUTO_EXPIRED
  - `detectStaleReservations(companyId, referenceDate?)` — 알림 트리거용 목록만 반환 (자동 해제 없음)
- eligibility: `SUBSIDIARY`, `purchaseKind=null`, `STOCK_KEEPING` 제외
- 데이터: InventoryLot 40행 = WIZARD 40, PO 39행 = WIZARD 35 + MANUAL_JIT 4
- 정책 결정: stale reservation 자동 EXPIRED 처리하지 않음 → S5 배치/알림 phase에서 알림 발송
- NOT NULL 승격: 수동조정 lot 정책 확정 후 후속 phase

**S4-0-d — AuditLog 헬퍼 표준화 ✅ 완료 (2026-07-10)**
- 신설: `writeAuditLog(client, params)` — `src/lib/utils/audit.ts`
  - `client`는 `Prisma.TransactionClient | typeof prisma` (트랜잭션/일반 모두 지원)
  - 실패 시 throw (트랜잭션 내부에서 원자성 보장, 상태 변경과 함께 롤백)
  - `Date` 등 특수 값은 `JSON.parse(JSON.stringify())` 로 안전 정규화
- 유지: `createAuditLog({session, ...})` — Actions 레이어 전용, 내부에서 `writeAuditLog(prisma, ...)` 재사용, 실패 시 `logger.error` 만 남기고 통과
- 적용: `reservation.service.ts` (`createReservation`, `releaseReservation`) 에 `actorUserId` 필수 파라미터 추가 및 감사 로그 기록 (CREATE / UPDATE)
- 정책 결정: `AuditAction` enum 확장 없이 기존 8종(CREATE/UPDATE/DELETE/APPROVE/REJECT/STATUS_CHANGE/LOGIN/OVERRIDE) 활용. 예약 도메인은 CREATE / UPDATE 로 매핑
- 컨벤션: 서비스 레이어(트랜잭션 내부) = `writeAuditLog(tx)`, Actions 레이어(트랜잭션 외부) = `createAuditLog(session)` — `CONVENTIONS.md` 반영
- 테스트: `audit.test.ts` 8건 + `reservation.service.test.ts` 감사 로그 케이스 4건 추가 (총 26건 PASS)

---

#### Phase S4-1 · 발주 UI 3분할 완성
> **Phase 상태**: ✅ 종결 (2026-07-14). 하위 phase S4-1-a ~ S4-1-f 모두 완료. 후속 항목 "발주 상세 화면 부자재 표기 강화" 및 "subsidiary 권한 seed 자동 부여" 는 Sprint 4 후반부 또는 Sprint 6/7 로 분리.

#### S4-1-a — 수동 발주에 부자재 축 통합 ✅ (2026-07-14, {de24565})
- **범위**: `manual-purchase-order-form.tsx` 1개 파일 수정 (배치 스키마·서비스는 이미 itemType 지원 완료).
- **변경**:
  - Row 타입에 `itemType: "MATERIAL" | "SUBSIDIARY"` 및 `itemMasterId` / `itemName` 통합 필드 도입.
  - 마운트 시 `getSubsidiariesAction` 병렬 로드, 공급 품목은 `getSupplierItemsBy{Material,Subsidiary}Action` 분기.
  - 행 단위 세그먼트 토글(자재/부자재), 전환 시 관련 필드 초기화.
  - 제출 payload 는 `batchPOItemSchema` superRefine 규약대로 `itemType` + `materialMasterId` / `subsidiaryMasterId` 상호배타 전송.
- **P12 정합**: STOCK_KEEPING × SUBSIDIARY 조합 정상 동작 (lineup/outboundDate 무귀속 유지, batch 스키마 superRefine 통과).
- **미포함(별도 phase)**: WAREHOUSE 로케이션 지원, 발주 목록/상세에서 부자재 표기 강화, subsidiary 권한을 발주 담당 롤 seed 에 자동 부여.
- **다음**: S4-1-? (발주 목록 부자재 표기 및 상세 화면 반영) 또는 사용자 지정 다음 phase.

#### S4-1-b — STOCK_KEEPING 발주 UI 신설 ✅ (2026-07-14, {1bcda25})

- **변경 파일**:
  - `src/features/purchase-order/components/manual-purchase-order-form.tsx` (Props에 `purchaseKind` 추가, 라인업/출고예정일 조건부 렌더링, 성공 토스트 분기)
  - `src/app/(dashboard)/purchase-orders/stock/new/page.tsx` (신규)
  - `src/features/purchase-order/components/purchase-order-list.tsx` (`onStockNew` prop + 버튼)
  - `src/app/(dashboard)/purchase-orders/page.tsx` (라우팅)
- **P12 규칙 준수 확인**:
  - STOCK_KEEPING: `lineupId=null`, `outboundDate=undefined`, `mealPlanGroupId=undefined` 전송
  - MANUAL_JIT: 기존 로직 무회귀 (라인업/출고예정일 필수 유지)
- **회귀 테스트**: 배치 스키마 superRefine (STOCK_KEEPING) 이 이미 기존 테스트에서 검증 중이므로 신규 서비스 테스트 불요. UI 수동 확인으로 완료.
- **후속(S4-1-f)**: 발주 목록 화면에 `purchaseKind` 배지 및 필터 도입.


**S4-1-c — Location 옵션 헬퍼 ✅ 완료 (2026-07-13)**
- 신설: `getLocationOptions(companyId, { types?, includeInactive? })` — `src/features/location/services/location.service.ts`
  - `types: LocationType[]` 배열 필터 지원 (in 절로 확장)
  - `includeInactive: false` 기본, `deletedAt: null` 상시 적용
  - `select: { id, code, name, type }` 로 최소 컬럼만 노출
  - 정렬: `sortOrder asc → name asc`
- 신설: `getLocationOptionsAction(rawQuery)` — `src/features/location/actions/location.action.ts`
  - `assertPermission(session, "location", "READ")` 적용
  - `locationOptionsQuerySchema` 로 입력 검증
- 신설: `locationOptionsQuerySchema` + `LocationOption` / `LocationOptionsQuery` 타입 — `src/features/location/schemas/location.schema.ts`
- 사용 지침:
  - SK 발주 (S4-1-b): `types: ["FACTORY", "WAREHOUSE", "HYBRID"]`
  - JIT / 소비 (S4-1-a, S4-3): `types: ["FACTORY", "HYBRID"]`
  - 미지정: 전체 활성 Location
- 테스트: `location-options.service.test.ts` 6건 PASS
- 서비스 · CRUD UI 확장 (`type` 필드 표시 · 편집)는 Sprint 6 S6-2 에서 별도 진행

**S4-1-d — 권한 리소스 키 컨벤션 정합성 확인** ✅ (2026-07-14, 코드 변경 없음)
- 실제 코드 컨벤션 재확인 완료: `assertPermission(session, resource, action)` 형태로 `resource`는 kebab-case 문자열(`"purchase-order"`, `"receiving-note"`, `"location"`), `action`은 UPPER_CASE(`"CREATE"`, `"READ"`, `"UPDATE"`, `"DELETE"`, `"APPROVE"`, `"EXPORT"`)로 분리 저장.
- 수동 JIT / STOCK_KEEPING / WIZARD 세 경로는 동일한 `"purchase-order"` 리소스를 공유하며, 도메인 분기는 `purchaseKind` 스키마 검증(S4-1-e/e-2)에서 이미 처리됨. 별도 서브리소스(`purchaseOrder:wizard` 등) 도입 불필요.
- 부자재 인프라(S4-1-a) 도입 시 `"subsidiary"` 리소스 키를 신규 추가 예정 (seed.ts 반영 필요).
- `prisma/seed.ts` 의 `sysAdminActions` 루프에는 별도 마이그레이션 불필요 (SYSTEM_ADMIN은 assertPermission 우회).

**S4-1-e — 배치 스키마 확장 ✅ 완료 (2026-07-13)**
- `createPurchaseOrdersBatchSchema` 에 `purchaseKind: z.nativeEnum(PurchaseKind).default("WIZARD")` 추가 (`src/features/purchase-order/services/purchase-order-batch.service.ts`)
- superRefine 으로 정합성 검증:
  - WIZARD ↔ isManual=false, mealPlanGroupId NOT NULL
  - MANUAL_JIT ↔ isManual=true, outboundDate NOT NULL, 모든 item.lineupId NOT NULL
  - STOCK_KEEPING ↔ isManual=true, mealPlanGroupId/outboundDate/item.lineupId 모두 NULL
- 신규 에러 코드 5종 추가: `PURCHASE_KIND_LINEUP_MISMATCH`, `PURCHASE_KIND_OUTBOUND_MISMATCH`, `STOCK_KEEPING_REQUIRES_LOCATION`, `MANUAL_JIT_REQUIRES_LINEUP`, `WIZARD_REQUIRES_MEAL_PLAN_GROUP`
- 테스트: `create-purchase-orders-batch-schema.test.ts` 12건 PASS (WIZARD 3 + MANUAL_JIT 4 + STOCK_KEEPING 4 + default 1)
- ✅ S4-1-e-2 (2026-07-14): 서비스 실체 완료 — `createPurchaseOrdersBatch` 의 3개 PO 생성 지점(NEW / DELTA newGroups / REPLACE)에 `purchaseKind` 저장. NEW 는 `input.purchaseKind` 그대로, DELTA/REPLACE 는 위저드 전용 경로이므로 `"WIZARD"` 하드코딩. STOCK_KEEPING 은 lineup 무귀속(P1' 정정)이므로 `assertLineupsForManualBatch` 호출 조건을 `isManual && purchaseKind === "MANUAL_JIT"` 로 좁힘.
- 테스트: `purchase-order-batch.service.test.ts` 에 purchaseKind 저장 검증 3건 추가 (WIZARD / MANUAL_JIT / STOCK_KEEPING). `makeManualInput` 기본값을 `MANUAL_JIT` + `outboundDate` 로 보정. 전체 553 → 556 PASS (실제로는 helper 보정 반영 후 최종 수치는 로컬 결과 참고).
- 커밋: `dc5aa11`
- 파일: `src/features/purchase-order/services/purchase-order-batch.service.ts`, `src/tests/purchase-order-batch.service.test.ts`

**S4-1-e-2 후속 회귀 수정 (2026-07-14)**
- **문제**: `ManualPurchaseOrderForm` 이 `purchaseKind` 를 명시하지 않아 배치 스키마 default(`WIZARD`) + `isManual: true` 조합으로 superRefine 검증 실패 (`WIZARD 발주는 isManual=false 여야 합니다`).
- **원인**: S4-1-e-2 서비스 반영 시 UI 클라이언트 측 필드 전달 누락.
- **수정**: `manual-purchase-order-form.tsx` L296 부근 호출부에 `purchaseKind: "MANUAL_JIT"` 추가.
- **회귀 테스트**: `purchase-order-batch.service.test.ts` 기존 MANUAL_JIT 통합 케이스가 이미 동일 조합을 검증 중이므로 신규 테스트 불요. UI 수동 확인 필요.

#### S4-1-f — 발주 목록 purchaseKind 배지·필터 ✅ (2026-07-14, {커밋해시})

- **변경 파일**:
  - `src/features/purchase-order/schemas/purchase-order.schema.ts` (`purchaseOrderListQuerySchema.purchaseKind` 추가)
  - `src/features/purchase-order/services/purchase-order.service.ts` (`getPurchaseOrders` where 절)
  - `src/features/purchase-order/components/purchase-kind-badge.tsx` (신규)
  - `src/features/purchase-order/components/purchase-order-list.tsx` (`manualFilter` → `purchaseKindFilter`, 배지 렌더)
- **호환성**: 서비스 `isManual` 필터는 API 호환용으로 남겨두되 UI 에서는 노출하지 않음. 향후 사용처 없으면 별도 phase 로 제거.
- **후속**: S4-1-a (부자재 인프라·폼 확장) — subsidiary feature 모듈 신설 및 `manual-purchase-order-form.tsx` 의 `itemType: "MATERIAL"` 하드코딩 제거.

---

#### Phase S4-2 · 입고 서비스 부자재 완결

**S4-2-a — confirmReceivingNote 부자재 분기**
- `UnsupportedSubsidiaryReceivingError` throw 제거 (클래스는 롤백용 안전망으로 유지, 정상 경로에서 미사용)
- `InventoryLot` 생성 시 이미 있는 `itemType` 분기 로직은 그대로
- `InventoryTransaction` 생성부에 `itemType`/`subsidiaryMasterId` 대칭 분기 추가
- 창고(`Location.type ∈ {WAREHOUSE, HYBRID}`) 입고 시 권한 체크 (`receivingNote:warehouse`)

##### S4-2-b — 입고 확정 부자재 테스트 정합 (2026-07-14, {cdf9289})
- `src/tests/receiving-note.service.test.ts`
  - 기존 "SUBSIDIARY 차단" 케이스 → "SUBSIDIARY 대칭 Lot/Tx 생성" 케이스로 교체
  - XOR 위반 케이스 2건 추가 (MATERIAL+subsidiaryMasterId, SUBSIDIARY+materialMasterId)
- `src/tests/confirm-receiving-note.action.test.ts`
  - UNSUPPORTED_SUBSIDIARY 매핑 케이스 제거
  - `prisma.location.findUnique` mock 추가, NOT_WAREHOUSE / HYBRID 통과 케이스 2건 추가

---

#### Phase S4-3 · 사용 처리 UI + 서비스 (P13 구현)

##### S4-3-a — 진입 가드 서비스 ✅ (2026-07-14, {2cd7bd2})
- `assertMealPlanCompletedForConsumption(companyId, targetDate, locationId)` 헬퍼 신설
  - 파일: `src/features/consumption/services/consumption-guard.service.ts`
  - 판정 축: `MealPlanGroup(companyId, planDate).status === COMPLETED` (스키마 실측: MealPlan 자체엔 status 없음)
- 커스텀 에러 `MealPlanNotCompletedForConsumptionError` (action 계층에서 `MEAL_PLAN_NOT_COMPLETED_FOR_CONSUMPTION` 로 매핑 예정)
- `locationId` 는 시그니처 계약 유지 (판정에는 사용하지 않음 — MealPlanGroup 이 locationId 를 갖지 않음)
- targetDate 는 `@db.Date` 매치를 위해 UTC 자정 정규화
- 테스트 6건 (COMPLETED 통과 / NOT_FOUND / DRAFT / CONFIRMED / IN_PROGRESS / CANCELLED / 시분초 정규화)
- **S4-3 착수 결정 사항** (P13 미결 항목 종결):
  - `ConsumptionItem.lineupId` 파생 컬럼: **저장하지 않음** — 조인으로 이연 도출 (`CookingPlan → ProductionLine → Location`, `MealPlan.lineupId`)
  - `ConsumptionHeader` 별도 모델 **없음** — `ConsumptionItem` 이 flat 모델. 그룹 키는 `(companyId, consumedDate, cookingPlanId?)`
  - `buildConsumptionDraft` 는 header 를 생성하지 않고 순수 계산 결과 반환 (`ConsumptionItem` 은 confirmConsumption 에서 처음 INSERT)

##### S4-3-b — buildConsumptionDraft 서비스 ✅ (2026-07-14, {d4bbc54})
- 파일: `src/features/consumption/services/consumption-draft.service.ts`
- 순수 계산·조회 서비스 (DB 쓰기 없음, ConsumptionItem 은 S4-3-d 에서 INSERT)
- **Layer A 자재**: `MaterialRequirement(countSource=FINAL, mealPlanGroupId, locationId)` 조회 → 자재별 SUM
  - meal-plan.service 의 COMPLETED 전이 로직이 동일 트랜잭션에서 자동 생성 (재전개 불필요)
- **Layer A 부자재**: `MealPlanAccessory(consumptionMode=PER_MEAL_COUNT).quantity × MealCount.finalCount`
  - 부자재는 MaterialRequirement 대상 외 (material-requirement.service 주석 근거)
- **availableQty**: `InventoryLot` 별 `getAvailableQty()` 합계 (Reservation 반영)
- **inboundQtyOnDate**: `ReceivingNote(status=CONFIRMED, receivedDate=targetDate, PO.locationId=locationId)` 의 items receivedQty 합계
  - P13 원문의 "당일 위해 입고된 수량" 은 `PurchaseOrder.outboundDate` 가 아니라 실제 입고일 축으로 확정 (실무 UX 정합)
- 반환 형태: `{ header: { mealPlanGroupId, planDate, totalEstimatedCount, totalFinalCount }, layerAItems: [...], references }`
- 자재+부자재는 이름 오름차순 정렬
- **CONSUMPTION_ERRORS 상수 신설**: `src/features/consumption/constants/errors.ts` — action 계층 매핑용
- 커스텀 에러: `MaterialRequirementNotGeneratedError` (데이터 무결성 방어), `MealPlanGroupNotFoundError`
- 테스트 7건 (자재 SUM / 부자재 산출 / availableQty / 당일입고 / MR 부재 / 그룹 부재 / 정렬)


##### S4-3-INT — Shipping 도메인 폐지 및 Consumption 흡수 ✅ (2026-07-15, {c2dd65f})

- **배경**: S4-3-b 착수 후 Consumption 이 재고 소진의 유일한 통로임이 P13 로 확정되면서, 별도 `ShippingOrder` 도메인이 `PurchaseOrder.outboundDate` (P8) 와 이중 기록되는 중복임을 인식.
- **결정**: `ShippingStatus` enum + `ShippingOrder` / `ShippingOrderItem` 모델 완전 폐지. 상세는 위 "P13 보강 — 출고 도메인 폐지 및 Consumption 흡수" 참조.
- **적용 커밋**: `c2dd65f` (스키마·마이그레이션·서비스·테스트·UI·seed 일괄 정리)
- **마이그레이션**: `20260715015044_drop_shipping_domain` (FK 7건 → tables 2 → enum 1 순서로 DROP, 데이터 손실 0)
- **검증**: `npx tsc --noEmit` ✅ / `npm test` ✅ / dev 서버 사이드바에서 "출고 관리" 사라짐 확인 ✅
- **후속**: S4-3-c-2 (Layer B UI) 진행. 문서 정리(SPRINT3.md 각주, SCHEMA_COVERAGE.md 상태 갱신) 는 S4-3-INT-2 로 별도 커밋.

##### S4-3-c-3 — 사용 이력 목록 UI + 신규 진입 다이얼로그 ✅ (2026-07-16, {af41b7b} → {41a514d} → {32d835e})
- **c-3-1** (`af41b7b`) — 서비스/액션/스키마 3파일 신설
  - `src/features/consumption/schemas/consumption-list.schema.ts` — 필터·페이지네이션 Zod 스키마
  - `src/features/consumption/services/consumption-list.service.ts` — `listConsumptionItems(companyId, query)` (기간·사업장·유형·출처·상태 필터, `consumedDate desc, createdAt desc`, 20/limit 100)
  - `src/features/consumption/actions/list-consumption-items.action.ts` — `consumption:READ` + `assertScope(LOCATION)` + `actionOk/handleActionError`
  - 사업장 필터는 `cookingPlan.productionLine.locationId` 경로 (ConsumptionItem 직접 locationId 없음)
- **c-3-2** (`41a514d`) — 리스트 페이지 UI
  - `src/features/consumption/components/consumption-list.tsx` (~370 lines)
  - `src/app/(dashboard)/consumption/page.tsx` — placeholder 교체
  - 기본 기간: 오늘 + 지난 6일(UTC 자정), 8컬럼 (사용일/사업장/유형/품목/수량/출처/상태/비고), 페이지네이션·loading·empty state 처리
- **c-3-3** (`32d835e`) — 신규 진입 다이얼로그
  - `src/features/consumption/components/consumption-new-entry-dialog.tsx` 신설
  - `consumption-list.tsx` — Link → Dialog trigger 교체
  - **P4 준수**: 사업장 옵션 `types: ["FACTORY", "HYBRID"]` 필터 (WAREHOUSE 배제)
  - **P13 준수**: 진입 가드는 `buildConsumptionDraftAction` 재사용, 다이얼로그는 라우팅만
  - 오늘(UTC) 기본값, 사업장 미선택 시 "다음" 버튼 비활성화, cancelled 플래그로 race condition 방지

##### S4-3-d hotfix — InventoryTransaction 원장 기록 ✅ (2026-07-16, {3307ad9})
- `src/features/consumption/services/confirm-consumption.service.ts` — FIFO 차감 루프 내 `consumptionLotDetail.create` 직후·`lot.remainingQty` 갱신 직전에 `tx.inventoryTransaction.create` 삽입
- 부호 관례 B (quantity 양수 저장, 방향은 `transactionType` 으로 판정) — receiving-note PURCHASE 관례 일치
- `referenceType="CONSUMPTION_ITEM"`, `referenceId=consumptionItem.id`
- P4 (원장 기록 완결) / P8 (FIFO 유지) / P11 (음수 재고 금지 유지) 모두 준수 — 기존 검증 계층 무변


### S4-3-c (재편, 2026-07-21) — Consumption/Receiving 도메인 전면 재정비

> **폐기**: 기존 S4-3-c-4-1 ~ c-4-5 전량 폐기 (헌법 P14/P15/P17 위반 다수 확인 — 2026-07-21 감사서 참조: `docs/audits/2026-07-21-consumption-receiving-audit.md`).
> **원자적 커밋 원칙**: 각 Phase 는 단일 커밋. 커밋 실패 시 이전 Phase 로 롤백.
> **진행 방식**: 저(어시스턴트)가 매 Phase 착수 시 최신 레포를 확인하여 수정 대상 파일·위치·붙여넣을 내용을 확정 → 사용자가 복사·붙여넣기·`npx tsc --noEmit`·커밋 → 저가 커밋 diff 검증 → PROGRESS.md 상태 ✅ 갱신 → 다음 Phase 로.

| Phase | 상태 | 명칭 | 산출물 |
|---|---|---|---|
| S4-3-c-R0  | ✅ | 감사서 편입·헌법 보강·Phase 재편 | 본 진행표 및 헌법 P14~P19 갱신 완료 (`4839f6b`, 2026-07-21) — `docs/audits/2026-07-21-consumption-receiving-audit.md` 신규, PROGRESS.md 헌법 P15~P19 추가, S4-3-c 표 재편 |
| S4-3-c-R1  | ✅ | Shipping 코드 잔재 제거 | 완료 (`7ac7612`, 2026-07-21) — 전수 grep 결과 라우트·서비스·컴포넌트·사이드바 잔재는 S4-3-INT 시점에 이미 제거된 상태 확인. 잔여 항목은 lineup/location 두 액션의 폐기된 shipping 참조 에러 문구 2건으로, "출고" → "발주"/"입고" 로 정합화 |
| S4-3-c-R2  | ✅ | 기존 c-4-x 롤백 (발주단위 폐기 + UI 정리) | 완료 (`b8a7a11`, 2026-07-21) — 감사서 V1/V6/V13 반영: (1) `unit-conversion-mini-dialog`·`consumption-new-entry-dialog`·`pending-meal-plan-banner` 3개 파일 `git rm`, (2) 발주단위 TableHead/TableCell 블록 삭제 및 관련 import/state/JSX 정리, (3) Tooltip "발주단위 환산" → "공급단위 환산", DraftItem 타입 주석 "발주 단위" → "공급 단위" 정합화, (4) UI 라벨 "이론량" → "제안 사용량" 리네이밍 (필드명 `theoreticalQty`·`packagingUnit`·`initialUsedQtyBase` 는 서버 액션 스키마/22개 지점 batch rename 대상으로 R3 병합). `orderUnit` alias 및 `expectedQty` 잔재는 c-4-x 및 c-4-5 시점에 이미 제거 확인. c-4-3 legacy Phase 표기 5곳 (confirm-consumption.action.ts, consumption-draft-form.tsx L54, consumption.errors.ts, confirm-consumption.service.ts) 은 R3 batch rename 에 병합 |
| S4-3-c-R3-a | ✅ | R3 batch rename (필드명 정합화) | 완료 (`f9318cc`, 2026-07-21) — 6개 파일 40+ 지점 리네이밍: `theoreticalQty`→`suggestedQty`, `packagingUnit`→`supplyUnit`, `packagingFactor`→`supplyUnitQty` (`SupplierItem.supplyUnitQty` 와 정합), `hasOrderUnit`→`hasSupplyUnit`, `initialUsedQtyBase`→`initialSuggestedQtyBase`, `roundToOrderUnit`→`roundToSupplyUnit` (내부 변수 `inOrderUnit`→`inSupplyUnit` 포함). c-4-3 legacy Phase 표기 5곳 정합화 (`errors.ts:9` JSDoc 이력 주석은 감사 추적성 목적 보존). 신규 심볼 정착 검증: suggestedQty 25건·supplyUnit 10건·supplyUnitQty 16건·hasSupplyUnit 9건·roundToSupplyUnit 3건·initialSuggestedQtyBase 2건 |
| S4-3-c-R3-b | ⬜ | ConsumptionHeader 스키마 도입 (Prisma + 마이그레이션) | 신규 enum `ConsumptionHeaderStatus (PENDING/CONFIRMED/CANCELLED)`, `ConsumptionHeader` 모델 (12필드) 도입 + `ConsumptionItem.headerId` FK 추가 + `ConsumptionItem.supplierItemId` **신설** (기존 `SupplierItem` 모델과 FK 연결; 감사서 §3 "승격" 표현을 "신설"로 재조정) + `ConsumptionItem.status` 컬럼 이관 (Item→Header). 기존 `ConsumptionSourceType` enum 재활용 검토. 마이그레이션 `add_consumption_header` + `SCHEMA_COVERAGE.md` 갱신 + 감사서 §3 재조정 patch |
| S4-3-c-R3-c | ⬜ | Header 참조 로직 개편 (서비스·서버액션·테스트) | `buildConsumptionDraft` 가 Header 를 반환하도록 재설계 + `confirmConsumptionAction` 이 Header (PENDING→CONFIRMED) 상태 전환 로직 편입 + `confirm-consumption.service.ts` drift 검증에 Header 컨텍스트 확장 + 관련 테스트 갱신 |
| S4-3-c-R4  | ⬜ | 기존 데이터 purge (범위 제한) | 마이그레이션 `purge_stale_consumption` + `scripts/recompute-lot-remaining.ts`. `CONSUMPTION`/`DISPOSAL` 타입만 삭제, 예약 released_at 롤백 포함 |
| S4-3-c-R5  | ⬜ | Eager PENDING Header + 예약 자동 생성 | `autoCreatePendingConsumptionHeaders` 서비스 + MealPlan 확정 트랜잭션 확장 + `InventoryReservation` 동시 생성 + 회귀 테스트 |
| S4-3-c-R6  | ⬜ | 가용재고 정본 서비스 | `available-stock.service.ts` 신설 (P16 공식) + 단위 테스트 |
| S4-3-c-R7  | ⬜ | 롤업 스코프 유틸 (read + write) | `src/lib/auth/scope.ts` (`getUserScope`, `applyScopeFilter`, `assertScopeAccess`) + Consumption/PO/Receiving/Inventory 목록·write 액션 전 도메인 적용 |
| S4-3-c-R8  | ⬜ | Consumption 서비스 재작성 | `buildConsumptionDraft` (품목 축, 8개 표준 항목, 이론량 제거) + `confirmConsumption` (Header 상태 전이, USED/DISPOSED 분리, FIFO SupplierItem 단위) + `append-consumption-item.service.ts` (축 A) + `create-manual-consumption-header.service.ts` (축 B) + `subsidiary-supplier-item-mapping.service.ts` (SK 매핑) + 서비스 테스트 재작성 |
| S4-3-c-R9  | ⬜ | 사용 처리 UI 재구성 | `/consumption` 목록 (PENDING Header 노출, 권한자에 `[+ 수동 헤더 생성]` 버튼) + `/consumption/[headerId]` 상세 (8항목, 라인업 행 분리, SK 매핑 다이얼로그, `[+ 품목 추가]` 다이얼로그) + `manual-header-create-dialog.tsx` + `consumption-item-append-dialog.tsx` |
| S4-3-c-R10 | ⬜ | 발주 제약 확장 | `PurchaseOrder.expectedReceivedDate` 신규 필드 + SK Location 완화 (FACTORY 허용) + 식단 발주 `outboundDate = MealPlan.baseDate` 강제 검증 |
| S4-3-c-R11 | ⬜ | 입고 총액 비교 UI | 새 입고서/목록/상세/일괄 4화면 3-3-1 컬럼 재구성 (품목/발주3열/입고3열/차이) |
| S4-3-c-R12 | ⬜ | 재편집 유예 명시 | `ConfirmedConsumptionEditError` + 서비스 레벨에서 CONFIRMED Header 편집 시도 시 에러. Sprint 5 재오픈 UI 이관 표기 |
| S4-3-c-R13 | ⬜ | 통합 회귀 + Sprint 종결 준비 | 전체 테스트 통과 확인 + PROGRESS.md 최종 갱신 + SPRINT4.md 아카이브 준비 |

**표준 진행 사이클 (매 Phase 반복)**:
1. 어시스턴트: 착수 직전 최신 레포 검증 → 수정 대상 파일 read → 수정 가이드 작성
2. 사용자: 복사·붙여넣기 → `npx tsc --noEmit` → `git commit` → `git push` → 커밋 해시 회신
3. 어시스턴트: 커밋 반영 확인 → diff 검토 → 프로세스 검증 시나리오 안내
4. 사용자: `npm run test` → 결과 회신
5. 어시스턴트: PROGRESS.md Phase 상태 ✅ 갱신 커밋 초안 제공
6. 사용자: 갱신 커밋 → 다음 Phase 착수

##### S4-3-c-4 — 사용 화면 재설계 (진행 예정, 2026-07-16 착수 결정)

**배경 (현행 사용화면 한계 5가지)**
1. 포장/발주단위·1인분 BOM·확정식수·이론 사용량 컬럼 부재 → 사용자가 정확한 초기값 판단 불가
2. 라인업별 자재 귀속이 UI에 노출되지 않음 (`MaterialRequirement.lineupId` 는 저장되나 draft 집계 시점에 누락) → 데일리 라인업 원가 산출 근거 불투명
3. 폐기/잔여 재고 처리 UI 부재 → P14 손실 관리 미충족
4. `MealPlanAccessory.consumptionMode=FIXED_QUANTITY` 부자재 미처리 (`buildConsumptionDraft` 는 `PER_MEAL_COUNT` 만 집계)
5. MealPlanGroup 확정 대기 식단 노출 채널 부재 → 사용자가 "왜 사용처리 안 되는지" 인지하기 어려움

**서브 단계**
- **c-4-1** — 확정 대기 식단 상단 배너
  - 신규: `src/features/consumption/services/list-pending-meal-plans.service.ts` — `MealPlanGroup.status=CONFIRMED` (COMPLETED 직전) 만 대상. DRAFT 는 발주서 생성 불가하므로 노출 제외.
  - 신규: `src/features/consumption/actions/list-pending-meal-plans.action.ts`
  - 신규: `src/features/consumption/components/pending-meal-plan-banner.tsx` — 기본 접힘, 건수 뱃지, 카드 클릭 시 `/meal-plan/[id]` 이동
  - 수정: `consumption-list.tsx` — 필터 상단에 배너 삽입
- **c-4-2** — `buildConsumptionDraft` 확장
  - 집계 키 변경: `(itemType, itemId)` → `(itemType, itemId, lineupId)` (부자재는 lineupId=null)
  - 반환 필드 추가: `orderUnit`, `orderUnitFactor`, `baseUnit`, `bomQtyPerServing`, `expectedMealCount`, `finalMealCount`, `theoreticalQtyBase`, `theoreticalQtyOrder`, `roundedFinalQty`, `totalAvailable`, `lineupId`, `lineupName`, `consumptionMode`
  - FIXED_QUANTITY 부자재 처리 추가: `theoreticalQty = fixedQuantity` (식수 무관)
  - `orderUnit` 소스: `PurchaseOrderItem` (해당 MealPlanGroup 연결분) → 없으면 baseUnit + `factor=1`
  - **버그 수정 동반**: `computeAvailability` 내 `getAvailableQty(lot.id)` 호출에 트랜잭션 클라이언트 `client(tx)` 미전달 → 격리 수준 밖 조회 이슈 (같은 커밋에서 수정)
- **c-4-3** — Smart Consumption Row UI + 폐기 자동 계산 + confirmConsumption 서비스 통합 (2026-07-20 재정의, c-4-3 ∪ c-4-4 원자적 통합)

  **재정의 배경**: 사용자 UX 재검토 결과, "사용량과 폐기량을 각각 입력"하는 방식은 심리적 부담이 크고 폐기의 자연스러움(=사용 후 남은 잔량 처리)을 반영하지 못함. 이에 **"사용량 + 재고 잔량 입력 → 폐기는 자동 계산"** 방식으로 전환. 저장 원칙(P14 USED/DISPOSED 행 분리)은 그대로 유지되므로 DB·회계 정합성 영향 없음. UI/서비스가 원자적으로 함께 바뀌어야 하므로 기존 c-4-3(UI)와 c-4-4(서비스)를 단일 Phase 로 통합.

  **용어 사전 (P14 보강)**
  | 표현 | 정의 | 필드명 |
  |---|---|---|
  | 총 재고 현황 | 해당 시점 사용 가능한 재고 총량 = 잔존 재고 + 입고분 | `totalAvailable` |
  | 사용량 | 실제 조리에 투입된 수량 | `finalUsedQty` |
  | 재고 잔량 | 사용 후 다음 회차로 이월할 수량 (음수 불가) | `remainingToStock` |
  | 폐기량 (자동) | `totalAvailable − finalUsedQty − remainingToStock` | `disposalQty` (파생) |
  > 구 용어 "조달량"은 폐기. UI·문서 전반에서 "총 재고 현황"으로 통일.

  **입력 UX 정책**
  - 사용자는 `finalUsedQty` 와 `remainingToStock` 2개 필드만 입력
  - `disposalQty` 는 자동 계산·읽기전용 뱃지로 표시
  - `disposalQty > 0` 시 `disposalReason` 인라인 셀렉트 필수 활성화, `OTHER` 선택 시 `disposalNote` 입력란 필수 노출
  - 실시간 클램프: `finalUsedQty ≥ 0`, `remainingToStock ≥ 0`, `finalUsedQty + remainingToStock ≤ totalAvailable` (P11 음수 재고 금지 강화)

  **UI 구현 (Smart Consumption Row)**
  - `consumption-draft-form.tsx`: 라인업별 그룹 헤더 + 각 행마다 라인업/라인 이름 표시 (병합 미사용, 사용자 결정 사항)
  - 컬럼: `자재/부자재 명 | 라인업 | 생산라인 | 이론 사용량(툴팁: BOM×식수) | 총 재고 현황 | 사용량[입력] | 재고 잔량[입력] | 폐기(자동) | 폐기 사유[조건부] | 발주단위 뱃지`
  - `hasOrderUnit=false` 자재: 행 우측 `⚙ 발주단위 설정` 버튼 → 인라인 미니 다이얼로그 (`unit-conversion-mini-dialog.tsx` 신설, 기존 `createUnitConversionAction` 재사용)
  - Layer B (수동 추가) 편집기: 이론 사용량 컬럼 제외, 나머지 동일 (자재/부자재 선택 후에도 재고 전제 유지 — 사용자 확인 사항)
  - 시각 요소: 세그먼트 프로그레스 바(사용/재고/폐기 비율), 미등록 자재 뱃지, sticky 라인업 헤더
  - 폐기 예정 사유 인라인 셀렉트(shadcn `Select`), motion/react 로 조건부 표시 애니메이션

  **서비스 확장 (`confirm-consumption.service.ts`)**
  - 입력 스키마 (Zod): `{ itemId, itemType, lineupId?, productionLineId?, totalAvailable, finalUsedQty, remainingToStock, disposalReason?, disposalNote?, orderUnit, orderUnitFactor }`
  - 파생 계산 (서버측 재검증): `disposalQty = totalAvailable − finalUsedQty − remainingToStock` (0 미만 → `INVALID_INPUT`)
  - Pre-flight (P11): `finalUsedQty ≥ 0 && remainingToStock ≥ 0 && finalUsedQty + remainingToStock ≤ totalAvailable`
  - 필수 검증: `disposalQty > 0 → disposalReason 필수`, `disposalReason=OTHER → disposalNote 필수`
  - 저장 로직 (원자적 트랜잭션):
    1. `finalUsedQty > 0` → USED 행 1건 (FIFO 소진, `ConsumptionLotDetail` 분할, `InventoryTransaction(CONSUMPTION)` 생성)
    2. `disposalQty > 0` → DISPOSED 행 1건 (FIFO 소진, `ConsumptionLotDetail` 분할, `InventoryTransaction(DISPOSAL)` 생성)
    3. `remainingToStock` 은 **저장하지 않음** — `InventoryLot.remainingQty` 잔존으로 자연 이월 (음수 방지 원칙 P11 활용)
  - 단위 환산: 입력값(`orderUnit`) → `baseUnit` 환산 후 `ConsumptionItem.consumedQty` 저장 (UnitConversion factor)
  - `expectedQty` alias 완전 제거 (`theoreticalQty` 로 전면 통일)

  **원칙 준수 매트릭스**
  | 원칙 | 검증 방식 |
  |---|---|
  | P4 (FACTORY 사용) | 기존 유지 (c-4-1/c-4-2 배너·집계 단계에서 이미 필터) |
  | P8 (FIFO) | USED/DISPOSED 행 각각 독립 FIFO |
  | P11 (음수 재고 금지) | UI 클램프 + 서버 Pre-flight 이중 방어. `remainingToStock` 저장하지 않음으로써 재고 자연 이월 (인위적 조정 없음) |
  | P12 (이원 발주) | 미등록 자재 인라인 UnitConversion 등록으로 다음 발주부터 정상 흐름 편입 |
  | P13 (Layer A/B) | Layer B 에도 동일한 사용량/재고/폐기 UX 적용, `sourceType` 만 다름 |
  | P14 (사용/폐기 분리) | DB 는 여전히 USED/DISPOSED 행 분리 저장. UI 입력방식만 개선 (자동 계산). 폐기 사유 필수 원칙 유지 |

  **완료 기준 (7단계 프로세스 규칙 준수)**
  - `npx tsc --noEmit` 통과
  - `/consumption/new` 진입 → Layer A 자동 산출 확인 → 사용량·재고 입력 시 폐기 실시간 자동 계산 확인
  - 폐기량 > 0 발생 시 사유 셀렉트 필수 활성화, `OTHER` 시 노트 필수 확인
  - 확정 후 리스트에서 USED/DISPOSED 행 각각 확인, `InventoryLot.remainingQty` 자연 이월 확인
  - Layer B 수동 추가 시나리오 동일 UX 확인
  - 미등록 자재 (`hasOrderUnit=false`) 행 → 인라인 다이얼로그 → 저장 → 즉시 재계산 확인

- **c-4-4** — ~~confirmConsumption 스키마·서비스 확장~~ **[c-4-3 로 흡수, 삭제]**

- **c-4-5** — 미등록 자재 인라인 보정 다이얼로그 검증 + 에러 UX 통일
  - `unit-conversion-mini-dialog.tsx` 회귀 테스트 (발주서 생성 흐름과의 정합성 확인)
  - `/consumption/new` 페이지의 페이지 전체 오류 박스 → `/consumption?error=...` redirect + 리스트 페이지 toast 표시
  - E2E 시나리오 3종 회귀 테스트: (a) Layer A 자동 + 폐기 발생, (b) Layer B 수동 추가 + 재고만 이월, (c) SK 재고 + Layer B + 미등록 자재 인라인 보정

**원칙 준수 매트릭스**
| 원칙 | 검증 방식 |
|---|---|
| P4 | c-4-1 배너·c-4-3 라인업 표시 모두 FACTORY/HYBRID 한정 |
| P8 (FIFO) | c-4-4 에서 USED/DISPOSED 행별 독립 FIFO |
| P11 (음수 재고 금지) | c-4-4 Pre-flight (`finalUsedQty + disposalQty ≤ totalAvailable`) |
| P12 (이원 발주) | c-4-3 미등록 자재는 SK 재고·긴급 추가분 케이스 → 인라인 UnitConversion 등록으로 다음 발주부터 정상 흐름 편입 |
| P13 (COMPLETED 진입) | c-4-1 배너는 CONFIRMED 만 노출, COMPLETED 는 정상 리스트 |
| P14 (사용/폐기 분리) | c-4-4 USED/DISPOSED 행 분리 저장, 라운딩 `Math.round + 0→1 승격` |

**완료 기준**
- `npx tsc --noEmit` 통과
- `/consumption` 진입 → 배너(있으면) 확인 → 신규 진입 → 라인업별 행 분리 확인 → 확정 → 리스트에 USED/DISPOSED 행 확인
- `InventoryLot.remainingQty` 잔여 재고 자연 존치 확인 (다음 진입 시 이월)

**S4-3-d — confirmConsumption 서비스**
- 원자적 트랜잭션 안에서:
  1. Pre-flight (P11): 각 행별 `사용량 + 폐기량 ≤ availableQty` 검증. 실패 시 `INSUFFICIENT_STOCK` throw
  2. FIFO 소진: `receivedAt ASC, lotId ASC` 로트 순으로 사용량·폐기량 분할
  3. `ConsumptionLotDetail` 로트별 분할 기록 (unitPrice 포함)
  4. `InventoryLot.remainingQty` 차감
  5. `InventoryTransaction(CONSUMPTION)` 및 `InventoryTransaction(DISPOSAL)` 생성
  6. JIT 재고 경로: 관련 Reservation 해제 (`CONSUMED`)
  7. `ConsumptionItem.status → CONFIRMED`, `disposition` 기록
  8. AuditLog 기록

**S4-3-e — 관련 테스트**
- Layer A 자동 산출 시나리오 (식단 완료 → 진입 → 자동 채움)
- Layer B 수동 추가 시나리오
- Pre-flight 실패 케이스 (`INSUFFICIENT_STOCK`)
- 부분 폐기 시나리오 (사용량 + 폐기량 + 재고 잔존)
- FIFO 로트 분할 검증
- JIT vs SK 로트 혼재 시 Reservation 정합성

**S4-3-f — 도메인 문서**
- `docs/progress/CONSUMPTION_FLOW.md` 신설: 진입 조건, Layer A/B 구조, UX 흐름도, 서비스 계층, 오류 코드

---

#### Phase S4-4 · 재고 뷰 & 실사 도래 자재 추출

**S4-4-a — 재고 대시보드 축별 표시**
- 재고 목록에 "축 필터" 추가 (전체 / JIT 재고 / SK 재고 / 혼합)
- JIT/SK 판별 기준: 로트가 생성된 발주의 `purchaseKind`
- 각 로트에 발주 유형 배지 표시

**S4-4-b — 실사 도래 자재 자동 추출**
- 자재별 `StockGrade` (A/B/C) 기반 실사 주기 계산
- 도래 대상 목록 조회 서비스 (`getStockTakeDueItems(companyId, locationId)`)
- 실사 도래 배지·알림 (실제 발송은 S5-5)

---

**Sprint 4 종결 조건**
- P12 이원 발주 흐름이 스키마·서비스·UI·문서에 완결 구현
- P13 사용 처리 이중 레이어가 UI·서비스에 완결 구현
- 부자재 발주→입고→사용 전 흐름 통합 테스트 통과
- SK 재고→사용(Layer B) 통합 테스트 통과
- 신규 테스트 최소 20건 추가, TS 오류 0
- 도메인 문서 3종 갱신·신설: `PURCHASE_FLOWS.md` (신설, `MANUAL_PURCHASE_ORDER.md` 흡수), `CONSUMPTION_FLOW.md` (신설), `SCHEMA_COVERAGE.md` (갱신)

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

#### Phase S5-6 — 폐기 대시보드 (2026-07-20 신설, S4-3-c-4-3 후속)

**배경**: c-4-3 에서 폐기가 자동 계산·저장되면서 폐기 데이터 축적이 시작됨. 폐기율·사유별 분포·라인업별 폐기 추이는 원가 정합성 검증의 핵심 레퍼런스이므로 별도 대시보드로 분리 노출한다.

**서브 단계**
- S5-6-a: 폐기 집계 서비스 (`getDisposalStats(companyId, dateRange, filters)`) — 사유별/라인업별/자재별 그룹 집계
- S5-6-b: `/disposal-dashboard` 페이지 — 폐기율 KPI 카드, 사유별 도넛, 라인업별 추이 라인차트, 자재 Top10 테이블
- S5-6-c: CSV/Excel 내보내기 (기존 export util 재사용)

**완료 기준**: 임의 기간 조회 → 3개 뷰(사유별/라인업별/자재별) 모두 데이터 렌더 → 원가 스냅샷과의 편차 검증 근거로 활용 가능

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
| 수동(독립) 발주 | Sprint 3.5 (종결) | 🟢 완료 — 스키마·서비스·액션·UI·테스트·문서 (`docs/progress/SPRINT3.5.md`) |
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
- `docs/progress/SPRINT3.5.md` — Sprint 3.5 아카이브 (수동 발주 보완)
- `docs/progress/SCHEMA_COVERAGE.md` — 모델 구현 현황 (68 모델 + UnitMaster)
- `docs/progress/PO_LIFECYCLE.md` — POStatus 라이프사이클
- `docs/progress/MANUAL_PURCHASE_ORDER.md` — 수동 발주 도메인 정책
- `docs/progress/RECEIVING_INVENTORY_POLICY.md` — 입고↔재고 정책
- `docs/progress/COST_LINEUP_ALIGNMENT.md` — 원가↔라인업 정합성
- `01_개발순서.md` ~ `07_HANDOFF.md` — 초기 설계 문서 (히스토리)
- `prisma/schema.prisma` — 스키마 SSOT (v5, Prisma 7)
