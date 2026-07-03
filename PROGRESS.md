# LunchLab ERP — 프로젝트 진행 현황

> 본 문서는 **현재 진행 상황과 앞으로 할 일**을 관리하는 SSOT(단일 진실 공급원)이다.
> 종결된 Sprint의 상세 이력은 `docs/progress/SPRINT{n}.md` 로 이관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에서 관리한다.
>
> 마지막 갱신: 2026-07-03 (D30 C-3 완료 — 입고서 CRUD·확정·불일치 이력·품목별 사유 UI 배포, RECEIVING_INVENTORY_POLICY §9 신설)

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

### 헌법 보강

**P5 재정정 (2026-06-30)**

[도메인 이벤트: "입고 확정"]
ReceivingNote.status = CONFIRMED 시점에 **단일 트랜잭션** 으로 다음을 원자적으로 수행한다:
1. InventoryLot 생성·InventoryTransaction(PURCHASE) 적층
2. 발주↔입고 차이 발생 시 `ReceivingDiscrepancy` 스냅샷 기록
   - QUANTITY_SHORT / QUANTITY_OVER / UNIT_PRICE_DIFF / ITEM_MISSING
3. PurchaseOrder.status → RECEIVED **자동 전이** (발주 종결)

[설계 원칙]
- 입고 확정과 발주 종결은 "하나의 사용자 의사결정" 으로 묶인다. 별도 버튼·별도 액션 없음.
- 수량 미달·초과·단가 차이는 **입고를 막지 않는다**. 대신 `ReceivingDiscrepancy` 에 스냅샷으로 기록하여 추후 재고 실사(D39~D41) 및 원인 분석의 근거로 활용한다.
- "발주 목록의 입고 완료 버튼" 은 존재하지 않는다. RECEIVED 는 오직 입고서 확정의 원자적 결과로만 도달한다.
- 폐기된 안:
  - 누적 수량 기반 자동 트리거 (부동소수 오차·시점 모호성)
  - `markPurchaseOrderAsReceivedAction` (P5 를 두 도메인 이벤트로 분리한 잘못된 정정)

[분할 입고 정책 — Sprint 4 이후 검토]
현재 설계는 "1 발주 = 1 입고서" 단순 케이스 기준. N건 분할 입고 요구가 발생하면 별도 의사결정으로 확장한다.

---

**P9 재정정 (2026-06-30)**

[원칙: 발주 확정 = 거래 단가 확정]
- 단가 마스터 갱신은 **DRAFT → SUBMITTED 전이 시점에만** 발생한다.
  - `SupplierItemPriceHistory` 적층
  - `SupplierItem.currentPrice` 갱신
- 입고 확정 시점에는 단가 마스터를 **일절 갱신하지 않는다**.
  - `InventoryLot.unitPrice = POItem.unitPrice` 를 그대로 사용 (PO 단가가 정본)
  - 입고 실 단가가 PO 와 다르면 `ReceivingDiscrepancy(UNIT_PRICE_DIFF)` 스냅샷만 기록
- 사유: 발주 확정 = 공급업체와의 거래 단가 합의 완료(계약 성립). 입고 시점의 단가 불일치는 "거래 단가의 변경" 이 아니라 "송장/실물 검증 실패" 이며, 마스터를 갱신하면 동일 공급품의 다른 진행 중 발주에 영향을 주어 거래 단가 확정 원칙이 깨진다.

---

**불일치 추적 도메인 분리 (2026-06-30, D30/D39 결정)**

본 시스템은 두 종류의 불일치를 별도 도메인으로 추적한다. 혼동하지 않는다.

| 도메인 | 시점 | 비교 대상 | 기록 모델 | 트랜잭션 영향 |
|---|---|---|---|---|
| **발주 ↔ 입고** | 입고 확정 (동시에 발주 종결) | PO 발주량 vs 입고량 / PO 단가 vs 입고 단가 | `ReceivingDiscrepancy` (D30) | 없음 (기록만, 마스터 무영향) |
| **이론재고 ↔ 실재고** | 재고 실사 완료 | InventoryLot 합계 vs 실측치 | `StockTake / StockTakeItem` (D39~D41) | `InventoryTransaction(type=ADJUSTMENT)` |

- 발주↔입고 불일치는 **공급사·구매 프로세스** 원인 추적용.
- 이론재고↔실재고 불일치는 **현장 운영·재고 관리** 원인 추적용.
- 두 도메인은 서로의 트리거가 되지 않는다. 입고 단가 차이가 있어도 SupplierItem 마스터는 갱신하지 않으며(P9 보존), 실사 차이가 있어도 PO 상태에 영향을 주지 않는다.

---

**변경 이력**
- 2026-06-30 — P5·P9 **재정정**: 이전 보강(입고 확정 ↔ 발주 종결 분리, markPurchaseOrderAsReceivedAction 신설)을 폐기하고, 입고 확정 시 PO 자동 종결로 통합. 발주 확정 = 거래 단가 확정 원칙을 P9 에 명시.
- 2026-06-30 — 초기 P5/P9 보강 (현재 재정정으로 대체됨)

### 작업 전 체크리스트
새 Phase 시작 전 반드시 자문:
- [ ] 이 작업이 "실시간 원가" 또는 "재무 원가" 산출에 어떻게 기여하는가?
- [ ] 회사 / 공장 / 제조라인 어느 계층에서 작동하는가?
- [ ] 헌법 P1 ~ P10 중 어느 것도 위반하지 않는가?
- [ ] 식단(회사) → 발주(롤업) → 입고(Location) → 사용(FACTORY) 흐름의 어느 위치인가?

---

## 📍 현재 상태 요약

- **현재 진행 중 Sprint**: Sprint 3 (발주 + 입고)
- **현재 기준 완료 지점**: Sprint 3 Phase 4-C2 (UI) + D25-4 (Step 4 라인업 다축 집계 뷰 + 레거시 StepSplitPreview 정리)
- **최근 완료**:
  - **D30 C-3-d3** (commit `85302dc9`) — 확정 시 품목별 불일치 사유 개별 입력:
    - 서비스: `previewReceivingNoteDiscrepancies` 신설 (확정 전 DB 무영향 사전 계산), `resolveReason(key, autoReason)` 우선순위 도입 (품목별 > 통일 > 자동)
    - 유틸: `buildDiscrepancyKey(type, poItemId, rItemId)` 신규 — UI/서비스 간 안정 키 규약
    - 스키마: `confirmReceivingNoteSchema.discrepancyReasons` (Record) 추가, `previewReceivingDiscrepanciesSchema` 신규. 하위호환 `discrepancyReason` 유지
    - 액션: `preview-receiving-discrepancies.action.ts` 신규 (READ 권한), `confirm-receiving-note.action.ts` 에 `discrepancyReasons` 전달
    - UI: `ConfirmReceivingNoteDialog` 재작성 — Dialog 로 전환, 열림 시 preview 로드, 불일치 0/N건 분기, 통일 모드 토글, 항목별 Textarea (autoReason placeholder)
    - 테스트: `preview-receiving-discrepancies.action.test.ts` 6건 + `confirm-receiving-note.action.test.ts` 에 사유 전달 검증 1건 추가 (총 39건 PASS)
  - **D30 C-3-d1·d2** (commit `20c7f75b`) — 회사 전사 불일치 이력 페이지 + 확정 시 사유 입력 (통일 모드):
    - `/receiving/discrepancies` 라우트 + `ReceivingDiscrepancyList` (월/타입/검색 필터 + 페이지네이션)
    - `getReceivingDiscrepancies` 서비스 (배치 조회, 관계 격리 정책 §7 준수)
    - `getReceivingNotes` 반환에 `totalAmount` 파생 필드 추가
    - 대시보드에 불일치 이력 링크 카드 부착
  - **D30 C-3-c hotfix** (commit `70cb64f5`) — DRAFT 입고서 삭제 시 FK 위반 수정: cascade 미설정 스키마 보호 위해 items 명시 삭제 후 note 삭제
  - **D30 C-3-b1·c** (commit `d96ad317`) — 입고서 CRUD 완성:
    - 서비스: `createReceivingNoteDraft`, `updateReceivingNoteDraft`, `deleteReceivingNoteDraft` (DRAFT 가드)
    - UI: `/receiving/notes/new`, `/receiving/notes/[id]`, `/receiving/notes/[id]/edit`, `DeleteReceivingNoteDialog`
    - 테스트 5건 추가
  - **PO 라이프사이클 재정의** (commits `14b2d20c`, `13b1d5f8`) — 발주서 도메인 명확화:
    - **도메인 정의**: 발주서는 공급사에 전송되는 공식 문서가 아니라 "이번 발주에서 어떤 자재를 얼마에 받기로 했는가"를 사내에서 관리·추적하는 **내부 관리 문서**. 실제 발주는 카톡·SMS·공급사 웹사이트 등 외부 채널.
    - **POStatus 라벨 재정의**: SUBMITTED="발주 확정"(단가 이력 적층 시점, P9'와 정합), APPROVED="결재 승인"(현재 미사용, 결재 도입 시 활성화), RECEIVED="입고 완료". 라벨만 변경, enum/마이그레이션 무변경.
    - **전이 매트릭스 보강**: `SUBMITTED → RECEIVED` 직접 전이 허용. APPROVED 단계는 결재 도입 전까지 우회 가능. 결재 도입 시 매트릭스 좁히면 됨.
    - **RECEIVED 트리거 — 수량 자동 폐기, 입고 확정 시 통합**: 누적 수량 도달 기반 자동 트리거는 폐기(부동소수 오차·시점 모호성). 대신 **입고서 확정(ReceivingNote CONFIRMED) 시 동일 트랜잭션 내에서 PO를 RECEIVED로 자동 종결**한다. 미달/초과/단가 차이는 입고를 막지 않고 `ReceivingDiscrepancy` 스냅샷으로 기록.
    - **책임 통합**: `ReceivingNoteService.confirm` 단일 트랜잭션이 (a) InventoryLot/InventoryTransaction 생성 (b) ReceivingDiscrepancy 기록 (c) PO RECEIVED 전이 까지 원자적으로 수행. 별도 `markPurchaseOrderAsReceivedAction` 은 **폐기** (UI 버튼 없음).
    - **하드코딩 라벨 정합화**: 7개 파일 안내문·에러 메시지 정합화 (`14b2d20c`). 후속 공백 정정 2개 파일 보강 (`13b1d5f8`).
    - **신규 문서**: `docs/progress/PO_LIFECYCLE.md` — 5단계 정의, 전이 매트릭스, APPROVED 보존 정책, RECEIVED 트리거 결정 기록.
    - **헌법 P5·P9 재정정 (2026-06-30 정정)**: 입고 확정과 발주 종결을 **단일 도메인 이벤트** 로 재통합. 발주 확정 = 거래 단가 확정 원칙을 P9 에 명시. 상세는 `### 헌법 보강` 섹션 참조.
  - **Phase 4-C2 (UI)** (commit `bf103b1a`) — Step 4 라인업 다축 집계 뷰 (D29 프런트):
    - `POItemCandidate` 에 `lineupId` / `lineupName` 전파 (`build-po-items-from-mr.ts`)
    - `loadPOWizardDataAction`: MR select 에 `lineupId` + `lineup.name` 포함 후 평탄화
    - 신규 `GroupByTabs` 컴포넌트 (4축 탭: 공장 / 제조라인 / 공급업체 / 라인업) — `scopeLevel` 별 기본 축 차등
    - `NewModePreview` 에 라인업 · 기준량(g) 컬럼 추가 + 다축 집계 뷰 섹션 부착
    - `WizardPreviewPanel` 에 `scopeLevel` prop 전파, `po-wizard.tsx` 임시 `scopeLevel="COMPANY"` (TODO: 세션 userScope 연결)
    - 쓰기 경로 무수정 (PC2/DC4 보존), 읽기 전용 뷰만 추가 (DC5)
  - **D25-4** (commit `{Stage1_SHA}`) — 레거시 `StepSplitPreview` 정리: D25-3 에서 `WizardPreviewPanel` 경유로 사용처가 모두 교체된 이후 deprecated 상태이던 `step-split-preview.tsx` 삭제. `NewModePreview` 가 단일 SSOT. `po-wizard.tsx` / `new-mode-preview.tsx` 의 D25-3/D25-4 주석 갱신.
  - **Phase 4-C2 pre / GAP-1** (commits `318d602`, `cc086e25`, `61e8da48`, `b9d043c1`, `9ea97f88`) — 원가 ↔ 라인업 차원 정합성:
    - 스키마: `MaterialRequirement.lineupId` 추가 + 5컬럼 unique (`uq_mr_group_line_lineup_material_source`) + 마이그레이션 `20260629024328_phase_4_c2_pre_mr_lineup_id` (S1)
    - 서비스: `AggregatedRequirement.lineupId` + `makeKey` 3-arg + BOM 전개 시 `mealPlan.lineupId` 전파 + INSERT 영속화 + list include/filter (S2). 테스트 +3 (S3, 22/22 PASS)
    - 신규 read-only 액션 `getLineupBreakdownAction` (S5+S5-A) — 라인업 × {자재 / 공급사 / PO} 3종 집계. PO 역추적은 `PurchaseOrderItem.materialRequirementId`, CANCELLED PO 제외, 같은 PO 가 여러 라인업에 contributedAmount 로 분배
    - 쓰기 경로(PO 그룹핑 키, 재고 차감) 무수정 (PC2/DC4 보존)
    - 근거: `docs/progress/COST_LINEUP_ALIGNMENT.md` PC1~5 / DC1~5 / DoD1~7
  - R1-a (commit `5afb0113`) — 위저드 4분류 (mapped / partial / full / unmapped)
  - R1-a-fix-2 — `stockOffsetAmount` raw 기준 + `Math.round` 정수 안정화
  - **R1-b1** (commit `a32e255`) — 멱등성 키 (`PurchaseOrderBatch.idempotencyKey`) + Step 1·5 기존 PO 사전 안내 카드 (`ExistingPONotice`)
  - **R1-b2** (commit `6e1afb5` + `a32e255`) — 위저드 모드 선택 UI (`WizardModeSelector`) — NEW/DELTA/REPLACE 라디오 + PO 상태별 활성화 로직
  - **R1-b3** (commit `a32e255`, `a952a95`, `ee1f47b`, `32544bb`, `f65c582`) — DELTA 모드 완전 구현:
    - 백엔드: `po-delta.service.ts` 순수 함수 + `executeDeltaMode` 분기 (`POAdjustmentLog` 적층)
    - 프리뷰: `previewDeltaPlanAction` (DB 부수효과 없음) + `DeltaPreviewCard` Step 2/5 통합
    - 수동 조정 가시화: Step 3 매핑 테이블에 시스템 권장값 표시 + 수동 편집 시 색상·되돌리기 버튼
    - 테스트: +14 (`po-delta.service`) +13 (`purchase-order-batch.service` DELTA) = 27건
  - **사이드바 hotfix** (commit `b3c787c`) — 발주 관리 메뉴 href를 `/purchasing` → `/purchase-orders` 로 교정
  - **R1-b4** (commit `6dbbfb3`) — REPLACE 모드 완전 구현: 차단 기준은 `status NOT IN (DRAFT, SUBMITTED)` (APPROVED 이상 차단, CANCELLED 제외). `executeReplaceMode` 신규 함수 — 기존 DRAFT/SUBMITTED PO 를 CANCELLED 로 일괄 전이(`POAdjustmentLog` 에 `REMOVE`+`fieldName="po_status"` 기록) + 신규 DRAFT PO 원자적 생성. 오류 키: `REPLACE_BLOCKED_BY_LOCKED_PO`, `REPLACE_MISSING_BASED_ON_POS`. 단가 이력은 보존(롤백 없음) — DRAFT→SUBMITTED 전이 시 자동 재적층.
  - **R1-b4-Test** (commit `f385f43`) — REPLACE 모드 통합 테스트 8건 추가 (`purchase-order-batch.service.test.ts`).  
  - **R1-c** (commit `07b7181`) — Step 3 SupplierItemPicker portal(뷰포트 상하단 자동 플립 + 검색 + ✓ 표시) + 단위환산 인라인 다이얼로그(WEIGHT/toUnit=g 고정, 등록 즉시 해당 자재 모든 행 클라이언트 재계산). 기존 `supplier-item-picker.tsx` 는 보존(향후 4-D 수동 발주에서 재사용 여지).
  - **Phase 1.6** (commit `75f07d6` 등) — D9 적용: `PurchaseOrder.deliveryDate` → `outboundDate` 마이그레이션 + 서비스·액션·UI 일괄 갱신
  - **Phase 1.7-D16** (commit `fe046d11`) — `UnitConversionInlineDialog`에 `UnitCombobox` 도입, 카테고리 제약 제거, fromUnit 자유 텍스트 입력 폐지
  - **Phase 1.7-D17** (commit `9255b78`) — 공급단위 기준 단일 단계 환산 `gPerSupplyUnit = factor × supplyUnitQty`, `fromUnit === supplyUnit.code` 강제, supplyUnit='g' 자동 처리
  - **Phase 1.7-D17-8** (commit `032f872`, `a6c4d15`) — 시스템 전반 단위 비교 키를 `UnitMaster.code`로 일원화 (name은 표시 전용). `POItemCandidate.supplierItem`에 `supplyUnitCode` 추가, `RESOLVE_UNMAPPED` / `REFRESH_ROW_AFTER_CONVERSION` 양쪽 reducer가 `calculateOrderQuantity` 단일 진실원천 사용
  - **Phase 1.7-D17-9** (이번 작업) — UnitConversion factor 입력 가드: 클라(`> 100000` 차단, 비정수 confirm), 서버(`max(1_000_000)`). 사유: `factor=1000.0001` 오타로 발주량 1박스 부풀림 회귀 발견
  - **Phase 1.6** (commit `5afb0113` 이후 갱신분) — `deliveryDate` → `outboundDate` 마이그레이션, `expectedReceiveDate = outboundDate − leadTimeDays` 표시 도입
  - **Phase 1.7 / D17** (commit `9255b785`) — 공급단위 기준 환산 + 미등록 시 등록 요구. UnitMaster.code 기반 매칭 일관화 (commit `032f8727`)
  - **D17-8 / D17-9 / D17-10** (commit `a6c4d151` + 본 푸시) — 단위 환산 입력 3중 가드:
    - D17-9: factor 상한 (100,000 / 서버 1,000,000) + 비정수 입력 시 confirm
    - D17-10: 미매핑 행에서 ↗ 단위 환산 등록 버튼 숨김, 매핑 후 `supplyUnit.code` 잠금 전달, `DUPLICATE_CONVERSION` → 정상 흐름 + 재계산
    - 서버 schema: `factor.max(1_000_000)` 추가 (`unit-conversion.schema.ts`)
    - **R1-b5-1** (commit `c83c1e80`) — NEW 모드 표시조건 보정 (D18). 활성 PO 0건일 때만 NEW 노출, 1건 이상이면 DELTA/REPLACE 자동 전환
  - **R1-b5-2** (commit `0ed1d8cf`) — Step 2 DeltaPreviewCard 제거 (D20). 차분 가이드는 Step 3 인라인 + Step 5 요약으로 이전
  - **R1-b5-3** (commit `d3ca6b2c`) — Step 5 DeltaPreviewCard 접힘 + 발주량 정수 강제 (D20, D23). `Math.ceil` 라운드업 정책, `step={1}` 입력, reducer `safeValue` 가드
  - **R1-b5-4** (commit `5b8edc7c` + hotfix `91967e3b`) — Step 3 인라인 차분 컬럼 (D20). DeltaCell 신설 (변경없음/신규 PO/추가/수량·단가·금액 델타). DELTA 모드에서만 노출, NEW/REPLACE 영향 없음. Hotfix: mapped 섹션이 unmapped 행을 받던 prop 오타 (rows={unmapped}/mode="unmapped" → rows={allMapped}/mode="mapped")
  - **D27** (commits `e8a0e2c4`, `acf0f295`, `b19a9273`, `3e80834e`) — 멱등성 가드 + PO 목록 취소 정책:
    - 서버: `createPurchaseOrdersBatch` 의 idempotent replay 가 batch 내 PO `status` 미검사로, 전량 CANCELLED 인 batch 도 replay 매칭되던 버그 수정. 매칭 시 활성 PO 만 응답에 포함, 전량 취소면 신규 토큰(suffix `_r{timestamp}`) 발급 후 신규 batch 생성. (`idempotencyKey`는 Prisma 스키마상 non-nullable 이므로 null 갱신 대신 신규 토큰 전략 채택)
    - 클라이언트: `step-meal-plan-group-select.tsx` 의 `handleExistingPOsLoaded` 에서 활성 PO 0건이면 localStorage 의 모든 모드 토큰 폐기 (`clearAllIdempotencyTokensFor`)
    - PO 목록 (C-1 정책): 기본 필터 `"active"` (CANCELLED 제외), "활성" / "전체" / 개별 상태 6개 옵션. 백엔드 `excludeCancelled` 쿼리 파라미터 추가, `purchaseOrderListQuerySchema` 확장

## 다음 진행 항목 (확정 순서)
  ### Sprint 3 잔여
  1. **Phase 3-D30-Ex1 — 일자별 입고 통합 뷰 (옵션 α)** [착수 대기]:
    - 요구: 회사 계층에서 매일 4개 PO(가정식 핫/콜드, 프레시밀, 라이트밀 × 공장별)가 발생. 라인업 다양화에 따라 계속 증가 예정. 일자별로 PO 목록을 모아 한 화면에서 개별/일괄 입고 처리 필요.
    - 설계: **옵션 α — N개 `CreateReceivingNoteForm` 병렬 렌더**. 1 PO = 1 ReceivingNote 유지(감사 추적성 보존), 스키마 무변경.
    - 신규 라우트: `/receiving/daily?date=YYYY-MM-DD` (기본 오늘).
    - 서비스: `getDailyReceivingBundle(companyId, date)` (읽기 전용 집계), `bulkCreateOrUpdateReceivingNoteDrafts` (단일 트랜잭션), `bulkConfirmReceivingNotes` (**All-or-Nothing** — 사용자 확정에 따라 전체 트랜잭션, 실패 시 어떤 노트가 왜 실패했는지 반환하여 재시도).
    - UI: `DailyReceivingView`(자재 요약 상단 + PO 섹션 아코디언), `BulkConfirmDialog`(실패 노트 하이라이트 + 재시도).
    - 청크: E(서비스) → F(액션·스키마) → G(UI) → H(테스트) → I(대시보드 링크·문서).

  2. **Phase 4-F-1 — 발주 일괄 상태 전이** (Phase 4-F-1):
  1. **Phase 4-F-1 — 발주 일괄 상태 전이** (Phase 4-F-1):
    - `bulkTransitionPOStatusAction` 신설 (트랜잭션·skip·INVALID_TRANSITION 분류·부분 실패 시 전체 롤백).
    - 발주 목록 페이지에 행 체크박스 + 액션바("선택 발주 확정", "선택 입고 완료", "선택 취소").
    - 결재 미도입 상태에서 APPROVED 관련 액션 미노출.
    - 단가 이력 적층(P9') 은 단건 transition 위임으로 자동 보존.

  2. **Phase 4-G — 자재 소요량 페이지 재정의 (대시보드화)**:
    - G-1 식단 IN_PROGRESS 전환 hook 에 MR 자동 산출 동기 호출. 실패 시 식단 IN_PROGRESS 차단(부분 상태 방지).
    - G-2 발주 위저드 진입 조건은 기존 그대로 (`IN_PROGRESS / COMPLETED`). G-1 정상 동작 시 MR 항상 존재.
    - G-3 자재 소요량 페이지의 상태 변경 버튼 일체 제거 → 읽기 전용 대시보드. `getLineupBreakdownAction` 활용 집계 카드 + unmapped/이상치 알림.
    - G-4 라벨 일원화: 식단 IN_PROGRESS = "식단 진행중", MR 측은 정보 라벨만.

  3. **D30 — 입고서 (ReceivingNote) 확정 통합 + 불일치 기록 (ReceivingDiscrepancy)** [부분 완료]:

    **C-1·C-2 (스키마 + 서비스) ✅ 완료 (2026-06-30)**
    - 마이그레이션 `phase_3_d30_receiving_discrepancy_and_confirmed_meta` (commit `67a60e34`).
    - enum `DiscrepancyType { QUANTITY_SHORT, QUANTITY_OVER, UNIT_PRICE_DIFF, ITEM_MISSING }` (4개).
    - 모델 `ReceivingDiscrepancy` (append-only 스냅샷): `purchaseOrderId / purchaseOrderItemId? / receivingNoteId / receivingNoteItemId? / type / expectedQty? / actualQty? / expectedUnitPrice? / actualUnitPrice? / diffValue / reason? / recordedAt / recordedByUserId`.
    - `ReceivingNote.confirmedAt / confirmedByUserId` 추가.
    - 서비스 `confirmReceivingNote(companyId, noteId, actorUserId)` 단일 트랜잭션으로 (commits `35773f1b → 64924006 → f8764185`):
      1. InventoryLot 생성 (`unitPrice = PO 단가`, P9 고정) + InventoryTransaction(PURCHASE) 적층
      2. PurchaseOrderItem.receivedQty 누적
      3. 수량·단가 불일치 스냅샷 (`QUANTITY_SHORT/OVER`, `UNIT_PRICE_DIFF`, `ITEM_MISSING`)
      4. `ReceivingNote.status = CONFIRMED` + `confirmedAt/By` 기록
      5. `transitionPurchaseOrderStatus(..., toStatus: RECEIVED, ..., tx)` 같은 트랜잭션 합류 — **P5 재정정 반영**
    - 테스트 10/10 PASS (정상/수량부족/수량초과/단가차이/PO외항목/입고누락/중복확정/회사불일치/없음/SUBSIDIARY 차단).
    - **제약**: SUBSIDIARY 입고는 현 스키마(`InventoryTransaction.materialMasterId` NOT NULL, `subsidiaryMasterId` 컬럼 없음)에서 미지원 → `UnsupportedSubsidiaryReceivingError` throw. Sprint 4 Phase 10에서 스키마 보강 예정.

    **C-3 (액션 + UI) ✅ 완료 (2026-07-03, commits `d96ad317` → `70cb64f5` → `20c7f75b` → `85302dc9`)**
    - `confirmReceivingNoteAction`: `assertScope(LOCATION)` + 서비스 호출 + audit + revalidatePath 3곳 (pending / 노트 상세 / PO 상세) ✅
    - 실제 배포 UI 5종:
      - `/receiving` — 대시보드 (초안·확정·발주 대기·최근 노트·불일치 이력 카드)
      - `/receiving/notes` — 입고서 목록 (상태/기간/검색 필터)
      - `/receiving/notes/new?poId=...` — 초안 생성
      - `/receiving/notes/[id]` — 상세 + 확정 다이얼로그 + 불일치 이력 섹션 + 삭제(DRAFT) / 편집 링크
      - `/receiving/notes/[id]/edit` — DRAFT 수정
      - `/receiving/discrepancies` — 회사 전사 불일치 이력 (월/타입/검색)
    - 확정 다이얼로그 확장 (C-3-d3): 열림 시 `previewReceivingDiscrepanciesAction` 호출 → 불일치 목록별 개별 사유 입력 + "전 항목 동일 사유" 토글
    - 사유 우선순위: 품목별(`discrepancyReasons[key]`) > 통일(`discrepancyReason`) > 자동(`autoReason`)
    - 하위호환: 통일 사유(`discrepancyReason`) 유지, 기존 32건 테스트 무파괴 (총 39건 PASS)

    **후속 잔여 (D30 범위 밖, 다른 Phase 로 이관)**
    - "발주 대비 초과·불일치 시 관리자 사유 필수 게이트" → P5 재정정으로 폐기 (모든 불일치는 차단 없이 기록만)
    - 일자별 입고 통합 뷰 (옵션 α, N개 PO 동시 확정) → **Phase 3-D30-Ex1 신규 (다음 착수)**
    - SUBSIDIARY 입고 지원 → Sprint 4 Phase 10 스키마 보강 후

    **문서 갱신 완료**
    - `RECEIVING_INVENTORY_POLICY.md` §9 (사유 해결 우선순위 정책) 추가 — 본 커밋
    - `SCHEMA_COVERAGE.md` — 모델 #41 상태는 이미 🔄로 갱신됨(C-1·C-2 시점), 별도 조치 불필요

    **D30 범위에서 제외된 항목 (의사결정 2026-06-30)**
    - `overReceivedQty / overReceivedReason` 컬럼 추가 — `ReceivingDiscrepancy(QUANTITY_OVER)` 스냅샷으로 통합되므로 불필요.
    - `createDraft / createCorrection` 서비스 — D31(부분 입고 진행률) 또는 Sprint 4로 이관.
    - 부분 입고(split receiving) — "1 PO = 1 ReceivingNote" 단순 모델 유지, Sprint 4 이후 확장.
    - 관리자 과입고 사유 필수 게이트 — 모든 불일치는 차단 없이 기록만(P5 재정정).
    - 별도 `markPurchaseOrderAsReceivedAction` — `confirmReceivingNote` 단일 트랜잭션에 통합되어 폐기.
    - `ITEM_UNEXPECTED` enum — 실제로는 `ITEM_MISSING`이 양방향(발주에만 있음 / 입고에만 있음) 케이스를 모두 표현.

    **문서 갱신**
    - C-1·C-2 시점: `SCHEMA_COVERAGE.md` 갱신 완료 (모델 #41 🔄), 변경 이력 D30 라인 추가.
    - C-3 시점에 추가 갱신: `RECEIVING_INVENTORY_POLICY.md` (신규), `PO_LIFECYCLE.md` §3-A 에 "발주 종결은 ReceivingNote 확정과 단일 트랜잭션" 한 줄.

  4. **Phase 4-D** — 수동 발주 UI (위저드 우회 단건 발주).
  5. **Phase 4-F-2** — 발주 엑셀 내보내기 / 일괄 export.
  6. **Phase 4-E** — scopeLevel 동적화 (현재 위저드 `"COMPANY"` 하드코딩 해제 → 세션 userScope 연결).

  ### Sprint 4 — 사용(출고) + 재고
  - D32 가용재고 조회 + FIFO 출고 엔진 (선행 의존).
  - D35 ConsumptionItem (PER_MEAL_COUNT / FIXED_QUANTITY) + MealCount 트리거 + ConsumptionLotDetail 기록 + ConsumptionDisposition (USED/RETURNED/DISPOSED) + DisposalReason.
  - D33 InventoryReservation 자동 생성/해제 + MR.stockQtyG 정합 (excludeReserved).
  - D34 InventoryTransfer 지점간 이동 + Lot 분할 + 원가 승계.

  ### Sprint 4 후반 / Sprint 5 진입 직전 — 재고 실사 (StockTake)

  > 사용 처리 완료 후 일정 주기로 실사를 진행하여 이론 재고와 실재고의 차이를 검출·기록·조정한다.
  > Sprint 5 원가 정산(D36 재고 차분 방식)의 기말재고 입력원.
  > ReceivingDiscrepancy(D30 발주↔입고 불일치) 와는 별개 도메인 — 시점·원천·트랜잭션 타입이 다르다.

  - **D39 — StockTake 워크플로우** (DRAFT → IN_PROGRESS → PENDING_REVIEW → COMPLETED):
    - 실사 시작 시 InventoryLot 스냅샷 → StockTakeItem 일괄 생성(이론 재고 freeze).
    - 현장 측정값 입력 UI (공장·라인·자재 단위 분할 입력).
    - PENDING_REVIEW 단계에서 차이 검토 + 사유 입력. COMPLETED 전이는 COMPANY_ADMIN 권한.

  - **D40 — 실사 차이 자동 검출 + StockGrade 기록**:
    - StockTakeItem expected(이론) vs actual(실측) 비교 → 차이 행 자동 추출.
    - StockGrade(A/B/C) 입력으로 자재 상태 기록.
    - 차이 사유 enum 신설 검토 (LOSS / DAMAGE / MISCOUNT / UNRECORDED_USE / OTHER — 스키마에 동등 enum 존재 여부 본격 진입 시 확인).

  - **D41 — COMPLETED 전이 시 일괄 보정**:
    - 차이만큼 `InventoryTransaction(type=ADJUSTMENT)` 적층, `referenceType='STOCK_TAKE' / referenceId=stockTakeId` 기록.
    - InventoryLot.remainingQty 자동 보정.
    - 음수 조정 = 손실원가, 양수 조정 = 미기록 입고로 별도 집계 가능 (Sprint 5 D37 정합성 리포트 입력원).
    - 잔량 음수화 케이스 차단 정책은 본격 진입 시 스키마 확인 후 확정.

  - **사전 확인 항목 (D39 진입 시점에 1회 점검)**:
    - StockTake / StockTakeItem 모델 본문 (필드 셋, 라인업 귀속 컬럼 유무).
    - 차이 사유용 enum 존재 여부 — 없으면 GAP-4 로 별도 마이그레이션 1건 분리.
    - StockTakeItem.lineupId 누락 시 DC5(라인업 차원 보존) 위배 — GAP-4 와 함께 처리.

  ### Sprint 5 — 원가 정산
  - D36 월말 원가 정산 (소비 기반 vs 재고 차분, 라인업별 양립).
  - D37 ESTIMATED / ORDER_BASED / ACTUAL 3중 정합성 리포트.
  - D38 라인업·지점·라인 단위 원가 분해 대시보드.

  ### Phase A (병행 트랙 — Sprint 4 진입 시 본격화)
  - A1 권한 매트릭스 정합화 (`docs/progress/ACCESS_MATRIX.md`).
  - A2 서버 가드 일원화 (`assertScope` 일괄 적용).
  - A3 UI 가드.
  - A4 초대 (`Invitation` 모델 이미 존재 — 서비스 + UI 만).
  - A5 감사 로그 (`AuditAction` enum 이미 존재).


- **현재 블로커**: 없음
- **누적 테스트**: 410 PASS / 2 skipped / 0 fail (D17 회귀 6건 추가)
- **TypeScript errors**: 0
- **백엔드 위저드 파이프라인**: 완성 (NEW + DELTA + REPLACE 3개 모드 모두 동작)

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
| **4-B'-5a** | 위저드 server actions 3종 (`getMealPlanGroupsForOrderAction`, `loadPOWizardDataAction`, `createPurchaseOrdersBatchAction`) + `loadPOWizardDataSchema` | ✅ | `cff165e4` |
| **4-B'-5b** | 위저드 UI 골격 (`/purchase-orders/new` 라우트 + POWizard 컨테이너 + Step 1·2) | ✅ | `d48a9e2` |
| 4-B'-5c | 위저드 UI 메인 (Step 3 매핑·편집 + Step 4 분할 미리보기 + Step 5 일괄 생성) | ✅ | `655da30` |
| **M-Fix** | MaterialMaster (companyId, name) unique 가드 + 마이그레이션 | ✅ | `bc8bcadd` |
| **M-Fix-R1** | MaterialMaster/SubsidiaryMaster isActive 생명주기 + DependencyActionDialog | ✅ | `dc52645a` |
| **S-Fix** | SupplierItem isActive + 의존성 가드 + 도메인 에러 메시지 | ✅ | `b5405c21`, `f24f273d` |
| **R1-a** | 위저드 Step 2 4분류 도입 (mapped / partial / full / unmapped) + Step 3 통합 섹션 | ✅ | `5afb0113` |
| **R1-a-fix-2** | stockOffsetAmount raw 기준 + Math.round 정수 안정화 + invariant 교정 + "충당"→"활용" 라벨 통일 | ✅ | (이번 작업) |
| **R1-b1** | 멱등성 키 (`PurchaseOrderBatch` 모델 + `idempotencyKey` unique) + Step 1·5 기존 PO 사전 안내 카드 | ✅ | `a32e255` |
| **R1-b2** | 위저드 모드 선택 UI (NEW / DELTA / REPLACE 라디오) + PO 상태별 활성화 로직 | ✅ | `6e1afb5`, `a32e255` |
| **R1-b3** | DELTA 모드 본격 구현 — `po-delta.service` + `executeDeltaMode` + `POAdjustmentLog` 적층 + Preview Action + DeltaPreviewCard (Step 2/5) + Step 3 수동 조정 가시화 | ✅ | `a32e255`, `a952a95`, `ee1f47b`, `32544bb`, `f65c582` |
| **R1-b3-Fix** | 사이드바 발주 관리 href 교정 (`/purchasing` → `/purchase-orders`) | ✅ | `b3c787c` |
| **R1-b4** | REPLACE 모드 (DRAFT·SUBMITTED 일괄 CANCELLED + 신규 DRAFT PO 원자적 생성, `POAdjustmentLog` REMOVE 적층, `REPLACE_BLOCKED_BY_LOCKED_PO`/`REPLACE_MISSING_BASED_ON_POS` 오류 키) + 통합 테스트 8건 | ✅ | `6dbbfb3`, `f385f43` |
| **R1-c** | Step 3 SupplierItemPicker portal(뷰포트 플립 + 검색 + ✓ 표시) + 단위환산 인라인 모달(WEIGHT/toUnit=g 고정) | ✅ | `07b7181` |
| **1.6** | **D9 적용**: PurchaseOrder.deliveryDate → outboundDate 마이그레이션 + 서비스·액션·UI 일괄 갱신 | ✅ | `75f07d6` 등 |
| **1.7** | **D16/D17 적용**: UnitCombobox 통합 + 공급단위 기준 단일 단계 환산 + UnitMaster.code 일원화 + factor 입력 가드 | ✅ | `fe046d11`, `9255b78`, `032f872`, `a6c4d15`, (이번 커밋) |
| **4-B'-5c-Fix-R2** | 위저드 UI 개선 R2 — Step 3 단위환산 인라인 등록(✅ 완료) + Step 5 품목별 예상 입고일(⬜) + Step 4 라인업 뷰 백엔드(⬜) | 🟡 부분 | `07b7181` 등 |
| **R1-b5** | 위저드 UX 정합 패치 (D18~D22 적용) — NEW 모드 표시조건 + Step 2 DeltaPreviewCard 제거 + Step 3 인라인 차분 컬럼 + Step 5 DeltaPreviewCard 접힘 + 정수 수량 강제 | ✅ | `c83c1e80`, `0ed1d8cf`, `d3ca6b2c`, `5b8edc7c`, `91967e3b` |
| **D27** | 멱등성 가드 (전량 취소 batch 제외) + PO 목록 취소 기본 숨김 (C-1) | ✅ | `e8a0e2c4`, `acf0f295`, `b19a9273`, `3e80834e` |
| **4-C** | 상세보기 + 상태 전이 다이얼로그 + 품목별 입고일 컬럼 (D28) + Step 5 D-N 배지. 입고 수량 컬럼은 placeholder (`receivedQty/quantity`), Phase 5에서 활성화 | ✅ | `{D28 커밋해시들}` |
| **4-C2 (pre)** | GAP-1 해소 (MR.lineupId) + `getLineupBreakdownAction` 백엔드 3종 집계 (D29 백엔드) | ✅ | `318d602`, `cc086e25`, `61e8da48`, `b9d043c1`, `9ea97f88` |
| **4-C2 (UI)** | Step 4 라인업 다축 집계 뷰 UI (D29 프런트) — `GroupByTabs` 4축 탭 + 라인업/기준량(g) 컬럼 + `scopeLevel` prop 체인 | ✅ | `bf103b1a` |
| **D25-4** | 레거시 `StepSplitPreview` 삭제 — D25-3 에서 사용처 교체 완료 후 정리. `NewModePreview` 단일 SSOT 확정 | ✅ | `{Stage1_SHA}` |
| 4-D | 수동 발주 페이지 `/purchase-orders/manual` — 식단 외 발주 트랙, `isManual=true`, 4-B' 컨벤션 재사용 (D19) | ⬜ | - |
| 4-E | PO 권한 스코프 — 회사/공장/라인 읽기 가시성, 헌법 P2 적용 (D21-B, 다중 사용자 환경 진입 시) | ⬜ | - |
| 4-F | PO 목록 다축 뷰 (출고일/공급사/라인업, D21-A) — D29와 일부 중첩, 통합 검토 | ⬜ | - |
| 5 | ReceivingNote 백엔드 (수량만, 단가는 P9' 에 따라 발주 단계로 위임) | ⬜ | - |
| 6 | ReceivingNote UI | ⬜ | - |
| 7 | MaterialRequirement → PO 자동 생성 파이프라인 | ⬜ | - |
| 8 | CookingPlan / Consumption 연계 | ⬜ | - |

### Sprint 3 폐기 의사결정 보존 (Phase 4-B 구버전)

본 Sprint 진행 중 폐기된 설계가 있어 의사결정 사유를 보존한다.

**폐기 항목**: 구 Phase 4-B "공급사 선두 폼 다이얼로그" (`f83eeab2`).

**폐기 사유**:
- 헌법 P1 위반 — "발주는 식단 기반"이 원칙인데, 공급사를 먼저 선택하고 품목을 추가하는 흐름은 식단과의 연결 고리를 끊는다.
- 자재→공급사 자동 매핑(즐겨찾기)과 다공급업체 분할 발주 시나리오를 표현할 수 없다.
- 운영 현장 멘탈 모델("식단 보고 발주 만든다")과 역방향.

**대체 설계**: Phase 4-B' (식단 기반 발주 위저드). `MealPlanGroup` → MR 자동 로드 → 자재별 공급사 매핑 → 공급사 × 공장 단위 PO N개 자동 분할.

**Phase 0-A 정리 작업** (`98c4cdb1`):
- 폐기된 Phase 4-B 컴포넌트 3개 제거 (`purchase-order-form-dialog.tsx`, `purchase-order-item-rows.tsx`, 관련 훅)
- `purchase-orders/page.tsx`의 "신규 발주" 버튼 동작을 임시 비활성화 (Phase 4-B'-5b 에서 `/purchase-orders/new` 라우팅으로 교체 예정)
- 기존 PO 목록 페이지 단독으로 정상 동작하도록 안정화

**Phase 0-B 작업** (`b4c9143a`):
- `SupplierItem` action 시그니처 정리 (Sprint 1 패턴과 일치시킴): `(companyId, id, input)` 통일, `findDuplicateSupplierItem` 파라미터 명료화, 잔여 SOL(Sprint outline log) 정리.
- 위저드 자재→공급사 매핑 단계에서 호출되는 진입점이므로 4-B' 전에 반드시 정돈 필요.

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

#### Phase 1.5 — locationId / productionLineId 추가 결정
- **결정**: `PurchaseOrder.locationId` 는 **NOT NULL**, `productionLineId` 는 nullable.
- **사유**:
  - 헌법 P2 (Roll-up: Company → Location → ProductionLine) 준수. 회사 직발은 PO 가 아닌 "공장별 PO N개"로 표현.
  - 식단 외 소모품 발주(공장 자체 발주)도 항상 공장 단위로 발생 → `locationId` 강제 가능.
  - `productionLineId` 는 라인 전용 자재(특정 제조라인 소모품) 추적용으로만 사용, 공장 공통 자재는 NULL.
- **가드**: `LINE_LOCATION_MISMATCH` — `productionLineId` 지정 시 해당 라인의 `locationId` 와 PO 의 `locationId` 가 반드시 일치해야 함.
- **마이그레이션**: `20260615114719_sprint3_phase1_5_po_location_rollup` (`58da2a1e`). 기존 dev DB PurchaseOrder 행 0개 확인 후 NOT NULL 직접 적용.

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

#### D16. 단위 환산 다이얼로그 통합 (Phase 1.7)

- **결정**: `UnitConversionInlineDialog`의 `fromUnit` 입력을 자유 텍스트(`<input>`)에서 `UnitCombobox`로 교체.
- **사유**: 자유 텍스트는 사용자가 `"포(包)"`, `"팩 "`, `"box"` 같이 임의 값을 입력해 `UnitConversion.fromUnit`이 `SupplierItem.supplyUnit.code`와 불일치하는 데드락을 만들었음.
- **부속 결정 (D16-4')**: 카테고리 제약 폐지. `fromUnitCategory`는 UnitCombobox에서 자동 도출하고 다이얼로그는 카테고리 미선택 시 `WEIGHT` 폴백. 자재별로 PACKAGE→g, VOLUME→g 등 카테고리 횡단 환산 허용.
- **영향 파일**: `unit-conversion-inline-dialog.tsx`, `UnitCombobox` (`itemType="MATERIAL"`, `valueMode="code"`, `excludeValue="g"`).

#### D17. 공급단위 기준 단일 단계 환산 (Phase 1.7)

- **결정**: 발주량 계산식을 `gPerSupplyUnit = factor × supplyUnitQty` 단일 단계로 통일.
  - `orderQuantityRaw = netRequiredG / gPerSupplyUnit`
  - `orderQuantity = Math.ceil(orderQuantityRaw - 1e-9)` (부동소수 경계 보정)
- **가드**:
  - `fromUnit === supplyUnit.code` 강제 — 불일치 시 `requiresManualInput=true`, 경고 발생, UNMAPPED 유지.
  - `supplyUnit.code === "g"` 예외 — factor=1 자동 적용 (환산 등록 불필요).
  - `supplyUnitQty <= 0` → `requiresManualInput=true` (1 fallback 폐기).
  - 환산 미등록 시 g 폴백 폐기 → 사용자에게 등록 다이얼로그 노출.
- **회귀 테스트**: 6건 추가 (`unit-conversion.test.ts`).

#### D17-8. UnitMaster.code 시스템 전반 일원화 (Phase 1.7)

- **결정**: 모든 도메인의 단위 비교 키를 `UnitMaster.code`로 통일. `UnitMaster.name`은 표시 전용.
- **사유**: PO 위저드만 `SupplierItem.supplyUnit.name`으로 비교해 `name="포(包)"` vs `code="포"`인 자재에서 영구적 "환산 미등록" 데드락 발생.
- **변경 파일**:
  - `build-po-items-from-mr.ts` — UnitConversion 조회 키 `supplyUnit.name` → `supplyUnit.code`.
  - `POItemCandidate.supplierItem`에 `supplyUnitCode: string` 추가 (`supplyUnitName`은 표시용으로 유지).
  - `po-wizard.tsx` `RESOLVE_UNMAPPED`: `calculateOrderQuantity` 단일 진실원천 사용. 옛 D3 fallback 제거.
  - `po-wizard.tsx` `REFRESH_ROW_AFTER_CONVERSION`: D17 단일 단계 환산 + `supplyUnitCode !== fromUnit` 시 등록 거부 + unmapped→mapped 승격 가드.
  - `step-mapping-table.tsx` — 등록 버튼 노출 키워드에 D17 메시지 추가.
  - `unit-conversion-inline-dialog.tsx` — `suggestedFromUnit`은 항상 `supplyUnit.code`로 전달.

#### D17-9. UnitConversion factor 입력 가드 (Phase 1.7, 회귀 패치)

- **계기**: 사용자가 `factor=1000.0001` (`팩→g`) 입력 → DB에 그대로 저장 → 19포 발주 케이스에서 `Math.ceil`이 19.0000019를 20으로 올림 → 1박스 부풀림.
- **결정**: 3계층 방어.
  - **DB 청소**: `factor <> ROUND(factor) AND to_unit IN ('g','mL')` 행 검토 후 명백한 오타 보정.
  - **클라이언트**: `unit-conversion-inline-dialog.tsx` — factor > 100000 즉시 차단, 비정수 입력 시 `confirm` 명시적 확인.
  - **서버**: `unit-conversion.schema.ts` — `createUnitConversionSchema.factor`, `updateUnitConversionSchema.factor`에 `.max(1_000_000)` 추가.
- **상한 근거**: 1톤=1,000,000g이 실용적 상한. 외식업 식자재 환산에 이를 초과하는 케이스는 없음.
- **영향 없는 부분**: 기존 정상 데이터(factor=1000 등) 전혀 영향 없음. 미래 합리적 환산도 통과.

#### D18. NEW 모드 표시 조건 (R1-b2 보정)

- **결정**: `WizardModeSelector`는 선택된 식단군에 **활성 PO**(=DRAFT/SUBMITTED/APPROVED/RECEIVED)가 1건이라도 있으면 NEW 옵션을 **표시하지 않는다**. CANCELLED만 있는 경우는 0건과 동일하게 취급 → NEW 단독 표시.
- **사유**:
  - 위저드 발주는 `(mealPlanGroupId, outboundDate)` 멱등성 키로 중복 차단되므로 (R1-b1), 활성 PO 존재 시 NEW 시도는 어차피 실패한다.
  - 라디오에 비활성 NEW를 두면 사용자가 "왜 안 되는가" 추측하게 만든다. 표시 자체를 없애 의사결정 공간을 좁힌다.
  - 식단 외 발주는 위저드가 아닌 Phase 4-D 수동 발주 트랙에서 처리한다 (D19).
- **표시 규칙**:

  | 식단군 활성 PO 상태 | NEW | DELTA | REPLACE |
  |---|---|---|---|
  | 0건 (활성 PO 없음) | ✅ (단독) | — | — |
  | DRAFT / SUBMITTED만 | ❌ | ✅ | ✅ |
  | APPROVED 이상 포함 | ❌ | ✅ | ❌ (b4 정책 유지) |
  | 전건 CANCELLED | ✅ (단독) | — | — |

- **영향 파일**: `wizard-mode-selector.tsx` (`options` 배열에서 활성 PO > 0이면 NEW 필터 제거 + "식단 외 추가 자재" 문구 삭제), `existing-po-notice.tsx` (카운트는 활성 PO 기준), `step-meal-plan-group-select.tsx` (`handleExistingPOsLoaded` — 활성 PO 0건일 때만 자동 NEW).

#### D19. 수동 발주 트랙 분리 (D2 확장, Phase 4-D 명세)

- **결정**: 식단과 무관한 발주(잡자재·일회성·예외 케이스)는 위저드가 아닌 **별도 페이지** `/purchase-orders/manual` 에서 처리한다.
- **데이터 모델 차이**:

  | 필드 | 위저드 (4-B') | 수동 (4-D) |
  |---|---|---|
  | `isManual` | false | **true** |
  | `sourceType` | `WIZARD_AUTO` | `MANUAL` |
  | `mealPlanGroupId` | NOT NULL | **NULL** |
  | `idempotencyKey` | `(mealPlanGroupId, outboundDate)` | `(supplierId, outboundDate, manualBatchId)` 별도 키 |
  | 그룹핑 키 (D5) | `supplierId × locationId × productionLineId` | 동일 |
  | 단가 적층 (P9') | DRAFT→SUBMITTED 시점 자동 적층 | 동일 |

- **진입점**: 발주 목록 페이지 우측 상단에 버튼 2개 — "식단 기반 발주"(`/purchase-orders/new`, 위저드) / "수동 발주"(`/purchase-orders/manual`, 4-D).
- **재사용**: Phase 4-D는 R1-c의 `SupplierItemPicker` portal + 단위환산 인라인 다이얼로그를 그대로 활용. `createPurchaseOrdersBatch` 백엔드 공유, `isManual`·`sourceType` 플래그로 분기.
- **착수 시점**: Phase 4-C 완료 후.

#### D20. 미리보기 책임 분배 (R1-b3 보정, D25 시리즈 정정)

- **계기**: Step 2에서 차분 표만 보여주면 사용자가 매핑·수량을 보지 못한 상태라 의사결정에 쓸 수 없다. 실제 편집은 Step 3에서 가능하므로 차분 가이드는 Step 3에 있어야 한다. D25-2 (WizardPreviewPanel 신설) 자체는 유효하지만 Step 2 호출 위치가 잘못됐다.
- **재분배 규칙**:

  | Step | 역할 | 컴포넌트 |
  |---|---|---|
  | Step 1 | 식단군 선택 + 모드 선택 + 사전 안내(있음/없음·카운트) | `ExistingPONotice` + `WizardModeSelector` |
  | Step 2 | 4분류 요약(mapped/partial/full/unmapped). **차분 표 없음** | `step-load-summary.tsx` (`DeltaPreviewCard` 호출 제거) |
  | Step 3 | **품목별 인라인 차분**: 행마다 `기존 발주량 → 권장량 (Δ) → 발주량(편집)` 컬럼. DELTA/REPLACE에서만 노출 | `step-mapping-table.tsx` (컬럼 확장) |
  | Step 4 | PO 분할 미리보기 (공급사 × 공장 × 라인) — 모든 모드 공통 | `WizardPreviewPanel` (D25-2 유지, Step 4 한정) |
  | Step 5 | 최종 차분 요약(**접힘 기본**) + 신규 PO 그룹 카드 | `DeltaPreviewCard` (collapsed) |

- **R1-b5에서 일괄 작업**:
  1. Step 2의 `DeltaPreviewCard` 호출 제거.
  2. `step-mapping-table.tsx`에 컬럼 4개 추가 (`기존 발주량`, `권장량(시스템)`, `Δ`, `발주량`) — DELTA/REPLACE 모드에서만 표시. 데이터는 `previewDeltaPlanAction.itemChanges` 재사용 (백엔드 변경 없음).
  3. Step 5 `DeltaPreviewCard`를 `<details>` 접힘으로 변경, 헤더에 총 Δ 금액 + 변경 품목 수만 표시.
  4. `new-mode-preview.tsx`는 D18 이후 NEW 진입 = "활성 PO 0건"이므로 차분 분기 제거, 신규 그룹 카드만 표시.

#### D21. 계층별 뷰 — 권한 스코프 + 다축 그루핑 (D7 확장)

D7 "회사 계층 발주"는 PO **생성** 측면만 다뤘고 **조회 가시성**(롤업 기반 뷰)은 미정의였다. 이를 두 축으로 분리한다.

##### D21-A. PO 목록 다축 뷰 (Phase 4-F, 우선)

- **결정**: PO 목록 페이지에 **그루핑 토글** 3종 — `출고일` / `공급사` / `라인업(공장 × 라인)`.
- **기본값**: 출고일 그루핑 (운영자 멘탈 모델: "오늘/내일 나갈 발주").
- **구현 방식**: 백엔드 동일, 클라이언트 `groupBy`만 변경. 그룹 헤더에 소계(건수 + 총액) 표시.
- **예시 (출고일 그루핑)**:
  📅 2026-07-01 (목) ── 12건 / ₩4,820,000 ├ 김치공장 · A공급사 · 라인1 ₩1,200,000 ├ 김치공장 · B공급사 · (공통) ₩2,200,000 └ 반찬공장 · A공급사 · 라인2 ₩1,420,000 📅 2026-07-02 (금) ── 8건 / ₩3,100,000 ...


- **공급사 그루핑**: 공급사별 정산·납품 일정 확인 시.
- **라인업 그루핑**: 공장×라인 단위 원가 배분 확인 시 (헌법 P2 롤업의 직접 시각화).

##### D21-B. 권한 스코프 (Phase 4-E, 후순위)

- **결정**: 사용자의 `ScopeRole`에 따라 PO 조회 범위 제한.

| ScopeRole | PO 조회 범위 |
|---|---|
| SYSTEM_ADMIN / COMPANY_ADMIN | 회사 내 전체 |
| LOCATION_MANAGER (신규) | 해당 `locationId` PO만 |
| LINE_MANAGER (신규) | 해당 `productionLineId` PO만 (`productionLineId IS NULL`인 공통자재는 LOCATION_MANAGER만 조회) |

- **구현 위치**: `purchase-order.service.ts`의 `listPurchaseOrders` `where` 조건 추가.
- **착수 시점**: 다중 사용자 환경 진입 시 (현재는 단일 운영자 가정 → 후순위).

#### D22. 위저드 컴포넌트 책임 정리 (R1-b5 적용 후)

R1-b5 패치 적용 후 위저드 컴포넌트 트리의 책임 분담은 다음과 같다.

po-wizard.tsx (state machine + step orchestration) 
├─ step-meal-plan-group-select.tsx [Step 1] 
│ 
├─ ExistingPONotice ← 활성 PO 카운트만 (D18) 
│ 
└─ WizardModeSelector ← NEW/DELTA/REPLACE (D18 표시 규칙) 
├─ step-load-summary.tsx [Step 2] 
│ 
└─ (DeltaPreviewCard 제거) ← 4분류 요약만 (D20) 
├─ step-mapping-table.tsx [Step 3] 
│ 
├─ SupplierItemPicker (portal) 
│ 
├─ UnitConversionInlineDialog 
│ 
└─ DELTA/REPLACE: 인라인 차분 컬럼 ← 신규 (D20) 
├─ WizardPreviewPanel [Step 4] 
│ 
├─ NewModePreview (NEW) ← 신규 그룹 카드만 
│ 
└─ StepSplitPreview (DELTA/REPLACE) ← PO 분할 표시 
└─ step-confirm-create.tsx [Step 5] 
├─ ExistingPONotice (재사용) 
└─ DeltaPreviewCard (collapsed) ← D20 접힘  


#### D23. 발주 수량 정수 강제 (Phase 1.7, R1-b5-3)

- **결정**: 모든 발주량(`PurchaseOrderItem.quantity`) 은 정수만 허용. 소수 입력은 라운드업.
- **사유**: 박스/포대 단위 발주는 분할 불가 — 사용자가 `12.5` 입력 시 13으로 자동 보정해 운영 사고 예방.
- **적용**:
  - 클라이언트: `QuantityCell` `step={1}`, `inputMode="numeric"`, onChange 에서 `parseInt + Math.ceil`. 시스템 권장값과 직접 비교(부동소수 임계값 폐기).
  - reducer: `UPDATE_QUANTITY` 의 payload value 에 `safeValue = Math.max(0, Math.ceil((value ?? 0) - 1e-9))` 가드.
  - 표시: `DeltaPreviewCard` 의 `ChangeRowsTable` 과 `newGroups` 도 `Math.round` 로 표시 안전성.
- **테스트 시나리오**: 12.5 → 13, 빈 입력 → 0, 권장값으로 되돌리기 동작 검증.

#### D27. 멱등성 가드 — 전량 취소 batch 제외 + PO 목록 취소 기본 숨김 (R1-b5 부속)

- **계기**: 위저드로 5건 생성 → REPLACE/수동으로 모두 CANCELLED → 같은 식단그룹·모드로 재진입 시 "동일 세션으로 생성된 발주서 0건이 있어 기존 결과를 반환합니다" 토스트가 떠 신규 발주가 영구 차단되던 회귀.
- **원인**: `createPurchaseOrdersBatch` 의 idempotent lookup 이 `existingBatch.purchaseOrders` 의 `status` 를 검사하지 않아 전량 취소된 batch 도 replay 매칭. localStorage 토큰 24h TTL.
- **결정**:
  1. 서버에서 매칭된 batch 의 PO 가 전량 CANCELLED 이면 replay 가 아니라 신규 생성 경로로 fall-through. 단 `PurchaseOrderBatch.idempotencyKey` 가 Prisma 스키마상 non-nullable + unique 이므로 null 갱신 불가 → **신규 토큰을 suffix `_r{timestamp}` 로 발급해 이번 호출만 새 batch 생성**. 기존 batch 행/PO 는 감사 추적용 보존.
  2. 활성 PO 가 1건이라도 있으면 정상 replay (응답에서 CANCELLED 는 제외해 표시 정합 유지).
  3. 클라이언트 보조 가드: `step-meal-plan-group-select.tsx` 의 `handleExistingPOsLoaded` 에서 활성 PO 0건이면 localStorage 의 모든 모드 토큰을 일괄 폐기.
- **PO 목록 정책 (C-1)**: CANCELLED 는 감사 추적용 보존하되 목록 기본은 숨김.
  - `purchase-order-list.tsx`: STATUS_OPTIONS 에 "활성 (취소 제외)" / "전체 (취소 포함)" 분리, 기본 `statusFilter = "active"`.
  - `purchase-order.schema.ts`: `excludeCancelled` 쿼리 파라미터 추가.
  - `purchase-order.service.ts`: `status` 미지정 + `excludeCancelled=true` 이면 `where.status = { not: "CANCELLED" }`.
- **회귀 방어**: 위저드 5건 생성 → 전량 취소 → 재진입 → 신규 발주 정상 생성 시나리오 수동 검증 완료.

- **Phase 4-C / D28** (commits `{커밋해시들}`) — 품목별 예상 입고일 표시 정책 통일:
  - `format-lead-time.ts` 유틸 3종 (`formatLeadTimeBadge`, `calculateExpectedReceiveDate`, `formatExpectedReceiveDate`) — Step 5 위저드와 상세 화면이 공유
  - `POItemCandidate.supplierItem` 에 `leadTimeDays` 노출 (`build-po-items-from-mr.ts`)
  - `po-wizard.tsx` `RESOLVE_UNMAPPED` 리듀서가 새로 매핑되는 행에도 `leadTimeDays` 전달 (회귀 1건 fix)
  - Step 5 (`step-confirm-create.tsx`) 에 품목별 `D-N · YYYY-MM-DD` 리스트 추가 — 출고일 입력 전에는 안내 문구
  - 상세 (`purchase-order-detail.tsx`) "예상 입고일" 셀을 `formatDate(ko-KR)` → `formatExpectedReceiveDate(YYYY-MM-DD)` 로 통일
  - 정책 분리: Step 5 = D-N + 절대일자(미리보기), 상세 = 절대일자만(확정값), 헤더 = 표시 안 함 (D20 와 정합)

#### D28. 품목별 예상 입고일 표시 정책 (2026-06-26, D20 보강)

- **결정**: 출고일(outboundDate) 기준으로 품목별 리드타임을 적용한 예상 입고일을 두 화면에 일관되게 표시.
  - **Step 5 위저드**: 출고일이 지정되면 각 품목 row에 `D-N` 배지 표시 (예: 리드타임 1일 → "D-1 (출고 하루 전)")
  - **발주서 상세 화면**: 출고일 헤더와 함께 품목별 `expectedReceiveDate = outboundDate − leadTimeDays` 절대일자(YYYY-MM-DD) 컬럼
- **D20과의 관계**: D20에서 폐기한 것은 "PO 목록·위저드 헤더의 단일 입고일 칸"이며, 본 D28은 품목 단위 표기를 부활시키는 게 아니라 D20 이후 정합화. 헤더 단일 칸은 여전히 없음.
- **구현 위치**: Phase 4-C(발주서 상세)에서 컬럼 추가, Step 5 D-N 배지는 동일 PR에서 가볍게 부착.

#### D29. Step 4 라인업 3종 뷰 (2026-06-26, Fix-R2 재정의)

- **결정**: Step 4(분할 미리보기) 및 발주서 목록의 다축 뷰를 3가지 탭으로 제공.
  1. **공급업체별 뷰** — 현재 `StepSplitPreview`(supplier × location × line 그룹핑)를 흡수
  2. **라인업별 뷰** — 제조라인 → 품목 (해당 라인에서 필요한 자재)
  3. **계층 분리 뷰** — 회사 → 공장 → 제조라인 트리
- **백엔드**: `lineupBreakdownAction` 신설 — 발주 후보를 3축으로 집계 반환
- **구현 위치**: Phase 4-F(PO 목록 다축 뷰, D21-A)와 통합하거나 **별도 Phase 4-C2로 분리**. 우선순위가 4-C(상세) 다음, 4-D(수동발주) 이전.
- **Fix-R2 잔여 처리**: Step 4 `lineupBreakdown` 백엔드 항목은 본 D29로 흡수되어 닫힘. Fix-R2의 또다른 항목인 Step 5 품목별 입고일은 D28로 흡수됨. 따라서 Fix-R2 자체는 닫힘 처리.

#### D30 (예고). 입고서 ↔ 발주서 관계 모델 (Phase 5 착수 전 확정)

- **방향**: 1 ReceivingNote ↔ N PurchaseOrderItem (다대다, ReceivingNoteItem이 PO item을 FK로 참조).
- **사유**:
  - 운영 현장 멘탈 모델 = "오늘 공장에 들어온 물건" 1건 = 1 입고서
  - 같은 일자에 여러 PO의 자재가 섞여 들어와도 1 입고서로 처리 가능
  - 헌법 P2/P3 정합 (입고는 공장 단위, 재고도 공장 단위)
- **트리거 구조**:
  - 발주서 APPROVED 전이 = 입고서 작성 가능 시점 (발주 담당자의 마지막 행위)
  - 입고서 확정 = `PurchaseOrderItem.receivedQty` 증분 (입고 담당자의 행위)
  - `SUM(receivedQty) === SUM(quantity)` 조건 충족 시 PO 자동 `APPROVED → RECEIVED` (서비스 가드)
- **입고 작성 UX (Phase 5)**: 입고일·공장 선택 시 "그 일자 예상 입고인 모든 활성 PO 품목" 자동 표출. 출고일 + 품목별 leadTimeDays로 계산.
- **Phase 4-C와의 인터페이스**: 발주서 상세 품목 테이블에 "입고 수량" 컬럼 자리만 미리 잡고 Phase 5 완료까지는 `0 / quantity` 표기.
- **확정 시점**: Phase 4-D 완료 직후, Phase 5 착수 직전 D30으로 정식 확정.

### D30 (2026-06-30 ~ 2026-07-01) 입고서 확정 & 재고 반영

- ✅ C-1 스키마: ReceivingDiscrepancy 모델 + ReceivingNote.confirmedAt/confirmedByUserId
  (migration: phase_3_d30_receiving_discrepancy_and_confirmed_meta, commit 67a60e34)
- ✅ C-2 서비스: confirmReceivingNote 단일 트랜잭션 구현, 10/10 tests pass
  (commit f8764185, 4da325a)
- ✅ C-3-a 액션: confirmReceivingNoteAction + 6 tests pass
  - 권한 리소스 seed 추가: "receiving-note" (seed.ts sysAdminResources)
  - 정책 문서화: docs/progress/RECEIVING_INVENTORY_POLICY.md 신규 (§1-7)
- ⏳ C-3-b UI: /receiving 신규 라우트 (목록 + 상세 + 확정 다이얼로그) — 다음 진행

### D30 진행 상황 갱신 (2026-07-01)

- ✅ C-3-a 액션: confirmReceivingNoteAction 구현 완료
  - 권한 리소스 seed 추가: `"receiving-note"` (prisma/seed.ts sysAdminResources, 108개 PermissionSetItem 반영 확인)
  - 정책 문서 신규: `docs/progress/RECEIVING_INVENTORY_POLICY.md` (§1-7: 도메인/단가/위치/Discrepancy 부호/부자재/멱등성/변경이력)
  - 도메인 에러 매핑: NOT_FOUND / ALREADY_CONFIRMED / FORBIDDEN / UNSUPPORTED_SUBSIDIARY
  - 테스트 6/6 pass (`src/tests/confirm-receiving-note.action.test.ts`)
- ⏳ C-3-b UI: /receiving 신규 라우트 (목록 + 상세 + 확정 다이얼로그) — 다음 진행

## D30-8. ReceivingDiscrepancy 관계 격리 정책

`ReceivingDiscrepancy`는 감사·스냅샷 성격의 이력 테이블이다.
`purchaseOrderItemId`, `receivingNoteItemId` FK 스칼라는 유지하되 Prisma 관계 라인은
의도적으로 정의하지 않는다. 이유:

- 스냅샷 값(expectedQty, actualQty, expectedUnitPrice, actualUnitPrice, diffValue)은
  기록 시점에 이미 박제되어 있어 관계로 현재 상태를 다시 끌어올 필요가 없다.
- 상위 엔티티(PurchaseOrderItem/ReceivingNoteItem)가 변경·삭제되어도 이력의 진실성이
  유지되도록 soft dependency 를 유지한다.

UI에서 품목명 등 부가 정보가 필요한 경우, 이미 로드된 `receivingNote.purchaseOrder.items`
에서 `purchaseOrderItemId` 로 클라이언트 사이드 조인한다.

### 발견된 별건 이슈 (D30 스코프 외)

- **seed.ts MealPlan 멱등성 버그**: `existingPlanB_LunchFresh` 조건이 unique key `(meal_plan_group_id, company_meal_slot_id, lineup_id)` 와 어긋나 재실행 시 P2002 발생. `receiving-note` 권한 seed 반영에는 영향 없음 (해당 단계 이후 실패). 별건 D 항목으로 분리 처리 예정.
- **권한 리소스 키 불일치**: `bulk-transition-po-status.action.ts` 등이 `"purchase-order"` 리소스 키를 사용하나 seed 의 `sysAdminResources` 에는 `"purchasing"` 만 존재. SYSTEM_ADMIN·COMPANY_ADMIN 은 `assertPermission` 앞단에서 통과하므로 현재 운영은 문제없지만, MEMBER 롤 사용자는 FORBIDDEN 이 발생하는 잠재 버그. 별건으로 정리 필요.

#### D31 (예고). 부분 입고 진행률 UX (Phase 5)

- 발주서 상세에서 입고 진척률을 품목별 `receivedQty / quantity` (예: "5/10 박스")로 표시.
- APPROVED 상태이고 1품목이라도 `receivedQty > 0` 이면 "입고 진행중" 배지.

---

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

**R1-b 추가 신규 파일** (R1-b1·b2·b3):
- `src/features/purchase-order/services/po-delta.service.ts` — `computeDeltaPlan` 순수 함수 (DELTA 차분 계산)
- `src/features/purchase-order/components/wizard/wizard-mode-selector.tsx` — NEW/DELTA/REPLACE 모드 라디오
- `src/features/purchase-order/components/wizard/existing-po-notice.tsx` — Step 1·5 기존 PO 사전 안내 카드
- `src/features/purchase-order/components/wizard/delta-preview-card.tsx` — Step 2·5 차분 미리보기 카드
- `src/tests/po-delta.service.test.ts` — `computeDeltaPlan` 유닛 테스트 (14건)


**Phase 4-B'-5a 추가** (`cff165e4`):
- `purchase-order.schema.ts` 에 `loadPOWizardDataSchema` / `LoadPOWizardDataInput` 추가
- `purchase-order.action.ts` 에 3개 위저드 action 추가:
  - `getMealPlanGroupsForOrderAction()` — IN_PROGRESS/COMPLETED 그룹, 최근 30일, planDate desc, take 100
  - `loadPOWizardDataAction(input)` — `loadPOWizardDataSchema` 파싱 → MR 조회 → `buildPOItemsFromMR` 호출
  - `createPurchaseOrdersBatchAction(input)` — `companyId`/`createdByUserId` 세션 강제 주입, 배치 생성 후 PO 1건당 감사 로그 1개
- 모두 thin wrapper (별도 서비스 미생성), 권한: READ 또는 CREATE, 도메인 에러 매핑은 service 의 에러 코드 재사용

**테스트**: `unit-conversion (16) + build-po-items-from-mr (9) + purchase-order-batch (17) + stack-price-history (8) + purchase-order.service (27 — 8 신규 포함) + purchase-order.schema (27)` = Sprint 3 신규 104 tests.

**도메인 에러 코드**:
`NOT_FOUND` / `PO_LOCKED` / `PO_NOT_DRAFT` / `INVALID_TRANSITION` / `LOCATION_NOT_FOUND` / `PRODUCTION_LINE_NOT_FOUND` / `LINE_LOCATION_MISMATCH` / `EMPTY_ITEMS` / `SUPPLIER_NOT_FOUND` / `SUPPLIER_ITEM_NOT_FOUND`

**권한 키**: `purchase-order:READ` / `:CREATE` / `:UPDATE` / `:DELETE` (Sprint 7 PermissionSet seed 등록 예정)

**Phase 4-B'-5b 추가** (`d48a9e2`):
- `src/app/(dashboard)/purchase-orders/new/page.tsx` — 라우트 + 권한 가드 (requireCompanySession + assertPermission)
- `src/features/purchase-order/components/wizard/po-wizard.tsx` — useReducer 기반 5-step 컨테이너, 진행바, 네비게이션
- `src/features/purchase-order/components/wizard/step-meal-plan-group-select.tsx` — Step 1 식단 그룹 선택 + countSource 토글
- `src/features/purchase-order/components/wizard/step-load-summary.tsx` — Step 2 자동 로드 + 4-카드 요약
- 기존 `purchase-orders/page.tsx` 의 "신규 발주" 버튼 → `/purchase-orders/new` 라우팅으로 변경, 재설계 안내 배너 제거
- Step 3~5 는 placeholder (4-B'-5c 에서 구현)
- 테스트: 신규 없음 (UI thin wrapper, 5a 액션 재사용)

**Phase 4-B'-5c 추가** (`655da30`):
- `step-mapping-table.tsx` — 3섹션(미매핑/매핑됨/재고충당) 인라인 편집 테이블
- `supplier-item-picker.tsx` — 자재별 공급업체×품목 콤보박스 (`getSupplierItemsByMaterialAction` 재사용)
- `step-split-preview.tsx` — 공급업체×공장×라인 그룹 미리보기
- `step-confirm-create.tsx` — 주문일/납기일/메모 + `createPurchaseOrdersBatchAction` 호출 + 리스트 리다이렉트
- `use-wizard-persistence.ts` — localStorage 저장 훅 (복구는 별도 작업)
- `po-wizard.tsx` reducer 확장: UPDATE_QUANTITY/UPDATE_UNIT_PRICE/RESOLVE_UNMAPPED/SET_ORDER_DATE/SET_DELIVERY_DATE/SET_NOTE
- 미매핑 매핑 시 `supplyUnitQty` 기반 자동 ceil 재계산
- Step 3 가드: `unmapped.length > 0` 이면 "다음" 차단
- 테스트: 신규 없음 (UI-only)

**4-B'-5c 이월 항목**: localStorage 복구(reload 시 자동 복원) — Phase 4-D hotfix 후보. 단가 변경 시각 강조 — currentPrice 비교 로직 필요, 추후 보완.

### Sprint 3 Phase 4-B'-5c 후속 결정사항 (사용자 피드백 기반)

본 결정사항은 2026-06-17 위저드 UI 1차 완성 직후 사용자 피드백을 기반으로 합의된 6단계 후속 Fix 계획이다.

#### D9. 출고일 기반 발주 관리 (헌법 P8 구체화)

**용어 통일** (전 시스템 적용):

| 기존 용어 | 새 용어 | 정의 |
|---|---|---|
| 납기일 (deliveryDate) | **출고일 (outboundDate)** | 우리 공장 → 고객사 배송일 = 식단 실행일 |
| (없음) | **예상 입고일 (expectedReceiveDate)** | `outboundDate − SupplierItem.leadTimeDays` (표시 전용 파생값) |
| (없음) | **입고일 (receivedDate)** | 실제 우리 공장 도착일 (ReceivingNote 에서 기록, Phase 5) |

**원칙**:
- 일반적으로 출고일 = 입고일 (당일 입고 후 당일 출고). 리드타임 D-1 → 하루 전 입고.
- PO 의 1차 키 일자는 **출고일** (헌법 P8 `outboundDate` 와 일치).
- 품목별 예상 입고일은 **표시 전용 파생값** — 컬럼화 금지. 실제 입고는 ReceivingNote 에서 기록.
- 위저드 Step 5 출고일 입력 시 품목별 예상 입고일 즉시 리스트업.

**스키마 변경 (Phase 1.6 에서 일괄 적용)**:
- `PurchaseOrder.deliveryDate` → `outboundDate` 컬럼 개명 (의미 재정의).
- `SupplierItem.leadTimeDays` 는 이미 존재 (`Int @default(1)`) — 신규 추가 없음.
- 마이그레이션: `RENAME COLUMN delivery_date TO outbound_date`. 기존 데이터 보존.

#### D10. Step 2 재고 활용 카테고리 4분류

현재 3분류 (mapped/unmapped/noOrderNeeded) → 4분류로 세분.

| 카테고리 | 정의 | UI 위치 |
|---|---|---|
| `mapped` | 매핑 완료 + 재고 0 (전량 발주) | 자동 매핑됨 |
| `mappedPartialStock` | 매핑 완료 + 재고 일부 활용 (감량 발주) | 자동 매핑됨 + 일부 활용 뱃지 |
| `mappedFullStock` | 매핑 완료 + 재고 전량 활용 (발주 0) | 자동 매핑됨 + 전체 활용 뱃지 |
| `unmapped` | 공급업체 선택 필요 | 미매핑 (별도 섹션) |

**Step 2 요약 카드 재설계**: 전체 / 자동 매핑됨(매핑금액) / 재고 활용(일부·전체 활용 합산, 활용금액) / 미매핑.

**금액 계산 정책 (R1-a-fix-2)**:
- `mappedGrossAmount`, `stockOffsetAmount` — **raw 박스수량(소수)** × 단가, `Math.round` 정수화.
- `estimatedTotalAmount` — `Math.ceil` 박스수량 × 단가 (실제 발주 금액).
- invariant: `estimatedTotalAmount ≥ mappedGrossAmount − stockOffsetAmount` (박스 올림 차이만큼 ≥).
- 등식이 아닌 부등식이 되는 이유: 박스 단위 발주는 항상 올림이므로, raw 차이(`gross-offset`)는 항상 올림 발주 금액 이하.

**Step 3 섹션 구성 변경**: noOrderNeeded 별도 섹션 폐지 → 매핑됨 안에 흡수 (뱃지로 구분).

#### D11. Step 3 사용성 4종 개선

1. **드롭다운 가림 해결**: `SupplierItemPicker` 가 뷰포트 하단에서 자동으로 위로 펼침 (Radix Popover 또는 자체 flip 로직).
2. **순필요량 / 포장단위 필요량 열 분리**: 한 셀에 작은 글씨 표기를 두 개 열로 분리.
3. **UnitConversion 미등록 시 인라인 등록**: 경고 행에 "단위 환산 등록" 버튼 → 모달 → 등록 후 해당 행만 `calculateOrderQuantity` 재실행.
4. **단위환산 모달 정책**: `(materialMasterId, fromUnit, toUnit='g', factor)` 1건 등록, 회사 단위 unique 위반 시 기존 행 갱신 또는 에러.

#### D11. 위저드 동시성·재산출 정책 (R1-b 그룹)

##### 배경
1. **동시 실행 사고**: 회사에 발주 담당자가 복수 존재할 때, 동일 식단그룹으로 두 명이 위저드를 모르고 동시에 실행하여 PO 가 두 벌 생성되는 사고 우려.
2. **식수 변경/식단 수정 후 재발주**: 예상식수가 변경되거나 식단이 수정되면 기존 PO 를 수정/덮어쓰는 워크플로우 필요.

##### 결정 — 위저드 3가지 모드

| 모드 | 정의 | 적용 가능 상태 | 동작 |
|------|------|----------------|------|
| **NEW (신규)** | 별도 PO 추가 생성 | 무관 (기존 PO 유지) | 기존 PO 유지 + 신규 PO 생성. 분할 발주 / 신규 자재 추가 발주 |
| **DELTA (차분)** | 기존 PO 에 병합 | DRAFT / SUBMITTED / APPROVED | 동일 (material × line × location × supplier) item 수량 합산 + `adjustedQuantity` 갱신, 신규 자재는 item 추가. `POAdjustmentLog` 시계열 이력 적층 |
| **REPLACE (덮어쓰기)** | 기존 PO 취소 후 재생성 | **DRAFT 전용** | 대상 PO 전체를 `CANCELLED` 전이 (사유: "REGENERATED_FROM_WIZARD_REPLACE: {새 batchId}") + 신규 PO 채번 생성을 단일 트랜잭션. SUBMITTED·APPROVED 는 차단 |

`RECEIVED` / `CANCELLED` PO 는 어느 모드에서도 대상 제외.

##### 멱등성 키 (R1-b1)
- 모든 모드 공통으로 위저드 세션마다 `idempotencyKey` 발급 — Step 1 진입 시 1회 (`wiz_${mealPlanGroupId}_${countSource}_${randomUUID()}`).
- batch service 는 `PurchaseOrderBatch.idempotencyKey` unique 제약으로 중복 제출 멱등 처리. 동일 키 재호출 시 기존 batch 의 PO 목록을 그대로 반환.
- 세션 토큰은 클라이언트 `localStorage` 에 `mealPlanGroupId + countSource` 단위로 저장 — 새로고침·재진입 시 같은 토큰 재사용. 위저드 완료(`onClearPersistence`) 시 또는 24시간 경과 시 삭제.

##### 사전 안내 카드 (R1-b1)
Step 1 (식단 그룹 선택 직후) 및 Step 5 (생성 직전) 에 동일 식단그룹의 활성 PO 목록 표시 (`status NOT IN (CANCELLED)`).

표시 정보: 발주번호 / 상태 뱃지 / 라인 / 공급사 / 총액 / 생성자 / 생성시각 + 상세보기 링크.

차단이 아닌 **정보 제공**. 사용자가 모드를 명시 선택하면 그에 맞춰 진행.

##### DELTA 병합 규칙 (R1-b3)
- 병합 키: `(mealPlanGroupId, materialMasterId, locationId, productionLineId, supplierId)` — 즉 공급사가 다르면 별도 item.
- 합산 시:
  - `PurchaseOrderItem.quantity` = 기존 + 추가분
  - `PurchaseOrderItem.systemQuantity` = 새 MR 산출 raw 값
  - `PurchaseOrderItem.adjustedQuantity` = 합산 후 최종 발주 수량
  - `PurchaseOrderItem.adjustmentReason` = "식수 변경 재산출 (N→M명, by {user}, {timestamp})"
- 신규 자재(기존 PO 에 없는 매칭)는 적합한 기존 PO 또는 신규 PO 로 추가.
- `POAdjustmentLog` 시계열 이력 행별 적층 (before/after qty, reason, actorUserId, sourceBatchId).
- `PurchaseOrder.totalAmount` 재계산.
- 상태 전이 발생하지 않음 (DRAFT 유지 / SUBMITTED 유지 / APPROVED 유지).
- SUBMITTED·APPROVED PO 수정 시 `AuditLog` 에 추가 기록.

##### REPLACE 가드 (R1-b4)
- 대상 PO 중 하나라도 `status NOT IN (DRAFT, CANCELLED)` 이면 차단.
- 에러: `REPLACE_BLOCKED_BY_NON_DRAFT_PO` — UI 메시지: "발주등록 이상 상태의 PO 가 있어 덮어쓸 수 없습니다. 차분 발주(DELTA)로 진행하거나 해당 PO 를 먼저 취소하세요."
- 트랜잭션: 대상 DRAFT PO 전체 `CANCELLED` 전이 + 신규 PO **신규 채번** 생성 + 새 batch 행 생성 — 단일 `prisma.$transaction`.
- 신규 PO 의 `note` 메타에 "REPLACED PO-001, PO-002 by {user}" 기록.
- **신규 채번 채택 사유**: 채번 충돌 방지, 감사 추적 명확, "어떤 PO 가 어떤 PO 를 대체했는지" 추적은 `batch.basedOnPOIds` 와 `note` 로 표현.

##### 새 모델 — `PurchaseOrderBatch` (R1-b1 도입)
\`\`\`prisma
model PurchaseOrderBatch {
  id              String         @id @default(cuid())
  companyId       String         @map("company_id")
  idempotencyKey  String         @map("idempotency_key")
  mealPlanGroupId String?        @map("meal_plan_group_id")
  countSource     MealCountSource
  mode            POBatchMode
  basedOnPOIds    String[]       @map("based_on_po_ids")
  createdByUserId String         @map("created_by_user_id")
  createdAt       DateTime       @default(now()) @map("created_at")

  company        Company         @relation(fields: [companyId], references: [id])
  mealPlanGroup  MealPlanGroup?  @relation(fields: [mealPlanGroupId], references: [id])
  createdByUser  User            @relation(fields: [createdByUserId], references: [id])
  purchaseOrders PurchaseOrder[]

  @@unique([companyId, idempotencyKey])
  @@index([mealPlanGroupId])
  @@index([createdAt])
  @@map("purchase_order_batches")
}

enum POBatchMode {
  NEW
  DELTA
  REPLACE

  @@map("po_batch_mode")
}
\`\`\`

`PurchaseOrder` 에 `batchId: String?` nullable 컬럼 추가 (기존 PO 는 NULL, 새 위저드 생성 PO 만 batch 추적).

##### 새 모델 — `POAdjustmentLog` (R1-b3 도입)
\`\`\`prisma
model POAdjustmentLog {
  id                   String              @id @default(cuid())
  purchaseOrderId      String              @map("purchase_order_id")
  purchaseOrderItemId  String?             @map("purchase_order_item_id")
  action               POAdjustmentAction
  fieldName            String?
  beforeValue          String?             // JSON 직렬화
  afterValue           String?             // JSON 직렬화
  reason               String
  sourceBatchId        String?             @map("source_batch_id")
  actorUserId          String              @map("actor_user_id")
  createdAt            DateTime            @default(now()) @map("created_at")

  purchaseOrder     PurchaseOrder      @relation(fields: [purchaseOrderId], references: [id])
  purchaseOrderItem PurchaseOrderItem? @relation(fields: [purchaseOrderItemId], references: [id])
  sourceBatch       PurchaseOrderBatch? @relation(fields: [sourceBatchId], references: [id])
  actorUser         User               @relation(fields: [actorUserId], references: [id])

  @@index([purchaseOrderId])
  @@index([sourceBatchId])
  @@index([createdAt])
  @@map("po_adjustment_logs")
}

enum POAdjustmentAction {
  ADD
  UPDATE_QUANTITY
  UPDATE_UNIT_PRICE
  REMOVE
  NOTE_CHANGE

  @@map("po_adjustment_action")
}
\`\`\`

##### R1-b 이후 백로그
- 실시간 위저드 lock (`MealPlanGroupLock` 30분 TTL) — R1-b 운영 피드백 후 결정.
- 라인업 단위 PO 트래킹 — 현재는 라인(ProductionLine) 단위 PO. Phase 1.6 또는 별도 phase 에서 검토.
- DELTA 시 단가 변경 처리 — 현재 설계상 단가 미변경(수량만 합산). 단가도 재산출하려면 별도 정책 필요 (P9' 와 충돌 가능).
- 차분 발주 후보 분류 표시 — 기존 PO 대비 변동 없는 행을 위저드 Step 2/3 에서 별도 카테고리(`UNCHANGED`) 또는 회색 처리로 표시할지 검토.

#### D12. Step 4 분할 미리보기 멀티뷰 (3종)

| 뷰 | 그룹키 | 의미 |
|---|---|---|
| **계층 뷰** (기본) | `supplierId × locationId × productionLineId` | 실제 PO 분할 단위 |
| **공급업체 뷰** | `supplierId` | "이 업체에 총 얼마짜리 발주가 나가나" |
| **라인업 뷰** | `lineupId` | "이 상품 1식 원가 = ?" 의 출발점 — 원가 추적 핵심 차원 |

**라인업 뷰 구현 정책**:
- 한 자재가 여러 라인업에서 사용 → 라인업별 `weightG × estimatedCount` 비율로 가중 분배.
- MR 자체에 lineup 차원 없음 → `buildPOItemsFromMR()` 결과에 `lineupBreakdown` 필드 추가 필요 (백엔드 변경).
- **Fix-R1 에서는 계층뷰·공급업체뷰만 구현, 라인업뷰는 Fix-R2 로 분리.**

#### D13. Step 5 표현 3종 개선

1. **"납기일" → "출고일"** 라벨 변경 (Fix-R1 시점에 라벨만 변경, 컬럼 실 변경은 Phase 1.6).
2. **품목별 예상 입고일 리스트업**: 출고일 입력 즉시 매핑된 자재마다 `outboundDate − leadTimeDays` 표시 (Fix-R2 에서 구현, Phase 1.6 의존).
3. **"N개 발주서 생성" → "N개 품목 → M개 발주서 생성"** 정확한 문구로 변경.

#### D13. REPLACE 모드 정책 (R1-b4)

##### 차단 기준
- 차단: 대상 PO 중 하나라도 `status IN (APPROVED, RECEIVED)` 인 경우.
- 허용: 대상 PO 가 모두 `status IN (DRAFT, SUBMITTED)` 인 경우. (CANCELLED 는 대상에서 자동 제외)
- 사유: SUBMITTED 도 아직 "발주확정" 전이므로 수량·단가 변경에 의한 재발주가 정당. APPROVED 부터는 입고 흐름이 시작될 수 있어 차단.

##### 동작
- 기존 PO 의 상태를 `CANCELLED` 로 일괄 전이, `cancelReason` 에 `[REPLACE] 위저드에서 덮어쓰기로 인한 취소` 자동 기입.
- 동일 트랜잭션 안에서 신규 PO 들을 DRAFT 상태로 생성 (NEW 모드 분기의 그룹핑·번호생성·검증 로직 재사용).
- 신규 PO 의 `note` 에 `[REPLACE] 취소된 원본 PO: <원본 발주번호들>` 자동 기입.
- `POAdjustmentLog` 에 PO 1건당 1행: `action="REMOVE"`, `fieldName="po_status"`, `beforeValue=<원래 상태>`, `afterValue="CANCELLED"`, `reason="REPLACE 모드 — 위저드 재실행"`, `sourceBatchId=<배치 ID>`.

##### 단가 이력 정책 (P9·P9' 와의 정합성)
- REPLACE 로 SUBMITTED PO 를 CANCELLED 로 전이해도 `SupplierItemPriceHistory` 및 `SupplierItem.currentPrice` 는 **롤백하지 않는다** (보존).
- 사유: 이미 적층된 이력은 "그 시점에 그 가격이 유효했다"는 사실의 기록이므로 사후 취소와 무관. FIFO 원가관리는 `InventoryLot` 단위로 독립 동작하므로 충돌 없음.
- 신규 DRAFT PO 가 SUBMITTED 로 전이되는 시점에 변경된 항목이 있다면 `stackPriceHistoryForPO` 가 다시 적층 — 이력 누락 없음.

##### 오류 키
- `REPLACE_BLOCKED_BY_LOCKED_PO` — 대상 PO 중 APPROVED/RECEIVED 가 1건이라도 포함된 경우.
- `REPLACE_MISSING_BASED_ON_POS` — REPLACE 모드인데 `basedOnPOIds` 가 비어있는 경우.
- 이전 가안의 `REPLACE_BLOCKED_BY_NON_DRAFT_PO` 명칭은 채택 직전 폐기 (SUBMITTED 도 허용으로 정책 변경).

##### UI 영향
- `wizard-mode-selector.tsx`: `replaceEnabled = draftCount + submittedCount > 0 && lockedCount === 0` 로 활성화 조건 완화 (SUBMITTED 단독으로도 REPLACE 가능).
- `step-confirm-create.tsx`: REPLACE 차단 토스트 제거, REPLACE 배지 빨강, 성공 토스트에 취소된 원본 PO 수 + 신규 PO 수 표시.

##### 미해결 사항 — Phase 4-C 진입 시 재논의
- Q. 상태 전이 다이얼로그 권한 키 분리 — `purchase-order:APPROVE` 도입 여부. 본 R1-b4 단계에서는 보류, Phase 4-C 착수 시 PROGRESS.md "권한 키" 라인을 정식 갱신할지 함께 결정.

## D14 — MaterialMaster / SubsidiaryMaster 동명 자재 방지 (M-Fix)

### 배경
Sprint 3 Phase 4-B'-5c 위저드 Step 3 사용자 피드백:
같은 이름의 자재(예: "다진마늘")가 여러 건 존재하여 공급업체 매핑이 차단됨.
DB·서비스 차원에서 사전 방지 필요.

### 결정사항
- **D14-1**: 동일 companyId 내 살아있는 자재(`deletedAt IS NULL`)의 name 중복 금지
- **D14-2**: Partial unique index (`WHERE deleted_at IS NULL`)로 구현
  → soft-delete 이력 보존 가능, 동일 name으로 재등록 가능
- **D14-3**: Prisma `@@unique`는 partial 조건 미지원
  → 마이그레이션 SQL에 수동 정의, schema.prisma에 코멘트로 명시
- **D14-4**: SubsidiaryMaster도 동일 정책 적용 (일관성)
- **D14-5**: 2중 보호
  - 서비스 가드: 친절한 한국어 에러 ("이미 동일한 이름의 자재가 존재합니다")
  - DB 제약: race condition 대응 (서비스 가드 통과 후 다른 트랜잭션이 먼저 INSERT 한 경우)

### 검토된 선택지 비교

| 옵션 | 방식 | 채택 | 사유 |
|------|------|------|------|
| 1 | 일반 unique + soft-delete 시 name suffix 부여 | ✗ | 기존 soft-delete 행 변형 필요, 도메인 의도 부정확 표현 |
| 2 | 일반 unique + soft-delete 행 하드 삭제 | ✗ | 감사·BOM 이력 손실 위험, FK 의존성 점검 부담 |
| 3 | **Partial unique index** | **✓** | **데이터 무변형, 도메인 의도 정확 표현, 이력 보존** |

### 마이그레이션
`prisma/migrations/<timestamp>_add_partial_unique_name_to_material_subsidiary/migration.sql`

### 테스트
- 자재 6건, 부자재 6건 = 총 12건 신규
- 누적 테스트: 343 → 355 PASS

### D14 추가 결정 (M-Fix-R1, 2026-06-17)

- **D14-7**: MaterialMaster·SubsidiaryMaster에 `isActive` Boolean 추가 (기본 true). SupplierItem의 S-Fix(D15) 패턴과 동일.
- **D14-8**: `deleteMaterial`·`deleteSubsidiary`에 의존성 가드 적용 — SupplierItem(alive)/MR(alive)/RecipeIngredient/RecipeBOMSlotItem/BOMItem/PurchaseOrderItem/MealPlanAccessory/MealPlanSlot/ContainerSlot/MealTemplateContainer/MealTemplateAccessory/RecipeBOMSlot 어느 하나라도 참조 시 `HAS_USAGE_HISTORY` 에러. soft-delete만 허용하며 hard-delete 경로는 의존성 0건 케이스에서도 soft-delete로 통일.
- **D14-9**: `getMaterialDependencies`·`getSubsidiaryDependencies` 신규 — UI 모달에서 사전 카운트 표시용.
- **D14-10**: `setMaterialActive(false)`·`setSubsidiaryActive(false)` — 진행 중 식단/발주 보유 시 `IN_USE_BY_ACTIVE_MEAL_PLAN` 에러로 차단, 통과 시 산하 SupplierItem 자동 비활성화. 재활성화는 단방향(SupplierItem 수동 복구 필요).
- **D14-11**: 위저드 `build-po-items-from-mr` — `POItemCandidate.isMaterialActive` 추가, 비활성 자재는 자동 매핑되지 않고 UNMAPPED으로 분류 + warning 표시.
- **D14-12**: 데이터 복구 — 다진마늘 MAT-018, 국간장, 닭가슴살 alive 복원 완료 (2026-06-17). 다진마늘 MAT-014는 의존성 있는 채로 soft-deleted 유지 (개발 데이터, 테스트 종료 후 정리).

### D14-7 ~ D14-12 — M-Fix-R1 (2026-06-17)

**목표**: 자재/부자재의 "사용 이력이 있는 항목 삭제 시 데이터 무결성 손상" 문제를 해결하고, 운영 중 자재 수명주기 관리(활성/비활성/삭제)를 도입.

#### 데이터 정합성 복구
- 잘못 soft-delete 되어 위저드에서 "(자재 정보 없음)"으로 표시되던 행 복원
  - MAT-018 (다진마늘, 윌스토 2,000원) — 활성 PO/MR/Recipe 의존성 유지
  - 국간장 (cmq4yxg4p01bkxci8yv3w7xh1)
  - 닭가슴살 (cmpza49nv0039s8i8p6i6rn46)
- 참기름(MAT-005)은 미사용 결정 → 그대로 soft-delete 유지
- MAT-014 (다진마늘) 테스트 목적 soft-delete 유지 → UI 비활성 필터로 가시화 확인

#### 스키마 변경 (D14-7)
- `MaterialMaster.isActive: Boolean @default(true)` 추가 + `@@index([isActive])`
- `SubsidiaryMaster.isActive: Boolean @default(true)` 추가 + `@@index([isActive])`
- 마이그레이션: `m_fix_r1_material_subsidiary_active`

#### 서비스 가드 (D14-8 ~ D14-10)
- `MATERIAL_ERRORS` / `SUBSIDIARY_ERRORS`에 `HAS_USAGE_HISTORY`, `IN_USE_BY_ACTIVE_MEAL_PLAN` 추가
- `getMaterialDependencies` / `getSubsidiaryDependencies`: 공급품목·MR·레시피·BOM·PO·식단 카운트 + `canHardDelete` / `canDeactivate` 계산
- `setMaterialActive` / `setSubsidiaryActive`:
  - 비활성화 시 진행 중 식단(`CONFIRMED`/`IN_PROGRESS`)·진행 중 PO(`DRAFT`/`SUBMITTED`/`APPROVED`) 검사
  - 통과 시 산하 SupplierItem 자동 비활성화 (재활성화는 수동)
- `deleteMaterial` / `deleteSubsidiary`: 의존성 0건일 때만 soft-delete + `isActive=false`, 아니면 `HAS_USAGE_HISTORY` 차단
- `getMaterials` / `getSubsidiaries`: `orderBy: [{ isActive: 'desc' }, ...]` — 활성 우선 정렬, `isActive` 필터 지원
- `getSubsidiariesByType`: 활성 항목만 반환 (위저드 노출 차단)

#### 액션 (D14-11)
- `getMaterialDependenciesAction`, `setMaterialActiveAction`
- `getSubsidiaryDependenciesAction`, `setSubsidiaryActiveAction`
- 모두 권한 검사 + 감사 로그(`UPDATE`)

#### 위저드 가드 (D14-11)
- `build-po-items-from-mr.ts`: `isActive: false`인 자재는 UNMAPPED 분류 + 경고 "비활성 자재 — 활성화 후 진행하거나 대체 자재 선택 필요"

#### UI (D14-12)
- 공용 `DependencyActionDialog` + `Stat` 컴포넌트
  (`src/features/material/components/dependency-action-dialog.tsx`)
- `MaterialList` / `SubsidiaryList` 전면 개편
  - "상태" 컬럼(emerald/gray 칩) 추가
  - "활성/비활성/전체" 드롭다운 필터 추가
  - 기존 Trash 단순 삭제 버튼 → ⚙️ Settings 버튼 → 의존성 다이얼로그
  - 비활성 행은 회색조 + 텍스트 흐림 처리

#### 스키마 (zod)
- `materialListQuerySchema` / `subsidiaryListQuerySchema`에 `isActive: z.coerce.boolean().optional()` 추가

#### 테스트
- `material-fix-r1.test.ts` / `subsidiary-fix-r1.test.ts` 추가 (각 9건)
- 기존 회귀: `material.service.test.ts` / `subsidiary.service.test.ts` / `build-po-items-from-mr.test.ts` 보강
- 최종: **Test Files 25 passed / Tests 367 passed | 2 skipped**

#### 후속 과제 (Backlog)
- supplier-item-list.tsx도 동일 패턴으로 일원화 (Sprint 3 종료 후 별도 마이크로 작업)
- `DependencyActionDialog`를 `src/components/shared/`로 이동해 feature 경계 정리
- 비활성 자재가 즐겨찾기/기본 공급품목으로 지정된 경우 일괄 정리 배치

#### D14. 위저드 인라인 단위 환산 등록 권한 정책 (R1-c)

**결정**: 위저드 Step 3 의 단위 환산 인라인 등록 다이얼로그는 `createUnitConversionAction` 을 재사용한다. 권한 키는 기존대로 **`material:CREATE`** 를 요구한다 (옵션 A 채택).

**대안 검토 및 폐기**:
- (옵션 B) `purchase-order:CREATE` 만으로 통과시키는 우회 경로 — 권한 우회 통로가 생기면 감사 추적이 약화되고, 위저드 외부의 단위 환산 등록과 정책이 불일치하게 됨. 폐기.

**운영 가이드**:
- 위저드 사용 권한 부여 시 `material:CREATE` 를 함께 부여하는 것이 정상 운영 패턴.
- `material:CREATE` 가 없는 사용자는 다이얼로그에서 등록 시도 시 `FORBIDDEN` 응답을 받고 "공급업체 / 자재 마스터 관리자에게 단위 환산 등록을 요청하세요" 안내를 받음 (Phase 5 PermissionSet seed 시 함께 점검).

**모달 입력 정책**:
- `materialMasterId`: 다이얼로그가 props 로 받음 (위저드 행 컨텍스트).
- `subsidiaryMasterId`: 항상 `null` (위저드는 자재 발주에만 사용).
- `fromUnit`: 사용자 입력 (추천값 = 해당 행의 `fromUnitName`).
- `toUnit`: `"g"` 고정.
- `factor`: 양수 (소수 허용).
- `unitCategory`: `"WEIGHT"` 고정 (위저드 발주 시 자재 중량 환산만 필요).
- 중복 등록 시 `DUPLICATE_CONVERSION` 토스트 노출 후 다이얼로그 유지.

**등록 후 동작**:
- 등록 성공 시 위저드는 서버 재요청 없이 `dispatch({ type: "REFRESH_ROW_AFTER_CONVERSION", ... })` 로 동일 `materialMasterId` 의 모든 행(`mapped`/`mappedPartialStock`/`mappedFullStock`/`unmapped`)을 클라이언트에서 재계산한다 (`Math.ceil` 동일 정책 적용).
- 경고 메시지에서 "단위 환산 정보 미등록" / "단위 환산 계수 …" 항목은 제거된다.


### Phase 1.6 — outboundDate 리네임 + expectedReceiveDate 도입 (D15)

#### 배경
- 기존 `PurchaseOrder.deliveryDate` 의 의미가 모호 (출고일/입고일/납기일?)
- 운영팀 합의: "출고일"(공급업체가 우리 창고로 출고하는 날) 로 명확화

#### 결정사항 (D15)
- **D15-1**: `deliveryDate` → `outboundDate` 리네임 (DB 컬럼 `delivery_date` → `outbound_date`)
- **D15-2**: `expectedReceiveDate` 신규 컬럼 추가
  - 계산식: `outboundDate + MAX(items.supplierItem.leadTimeDays)`
  - DB 저장 (Option A) — PO 생성/수정 시 계산해서 컬럼에 저장
  - `outboundDate` 가 null 이면 `expectedReceiveDate` 도 null
  - items 의 모든 `leadTimeDays` 가 누락되면 기본값 **1일** 사용
- **D15-3**: 품목별 입고일 (`itemExpectedReceiveDate`) 은 런타임 derived
  - 계산식: `outboundDate + item.supplierItem.leadTimeDays` (default 1)
  - DB 미저장, `getPurchaseOrderById` 응답에서만 제공
- **D15-4**: DELTA 모드는 `outboundDate` 를 변경하지 않음
  - items 변경 시 기존 `outboundDate` 기준으로 `expectedReceiveDate` 재계산만 수행

#### 변경 파일
- `prisma/schema.prisma`: PurchaseOrder 모델 필드 리네임 + 신규 컬럼 + 인덱스 2건 추가
- `prisma/migrations/20260622080946_phase_1_6_outbound_date_and_expected_receive_date/migration.sql`
- `src/features/purchase-order/schemas/purchase-order.schema.ts`
- `src/features/purchase-order/services/purchase-order.service.ts` (+ `calculateExpectedReceiveDate` 헬퍼)
- `src/features/purchase-order/services/purchase-order-batch.service.ts` (+ `calculateExpectedReceiveDateForBatch`)
- `src/features/purchase-order/components/purchase-order-list.tsx` (타입만 임시 수정 — UI는 다음 커밋)
- `src/tests/purchase-order-batch.service.test.ts` (DELTA 재계산 assertion 업데이트)

#### 검증
- ✅ `npx prisma migrate dev` 성공
- ✅ `npx tsc --noEmit` 0 errors
- ✅ `npm run test` — 406 tests / 404 passed / 2 skipped / 0 failed

#### 후속 작업 (Phase 1.6 UI — 다음 커밋)
- `po-wizard.tsx`: state/action/reducer 리네임
- `step-confirm-create.tsx`: 라벨 "출고일", "예상 입고일" 미리보기
- `purchase-order-list.tsx`: 테이블 헤더 "출고일" + 신규 "입고예정일" 컬럼

---

### M-Fix · S-Fix 결정사항 (위저드 외 운영 버그)

#### M-Fix: MaterialMaster 품목명 중복 방지
- **현 상태**: `(companyId, code)` unique 만 존재, `name` 중복 허용.
- **변경**: `(companyId, name)` unique 추가 + 서비스 사전 가드 + 사용자 친화 에러 `DUPLICATE_MATERIAL_NAME`.
- **마이그레이션**: 기존 중복 데이터 사전 점검 (dev DB 확인 후 일괄 적용 또는 충돌 행 수동 해소).

#### S-Fix: SupplierItem 삭제 의존성 가드
- **현 상태**: 삭제 실패 시 원인 불명, 일반 에러로 처리.
- **의존성 5종**: `PurchaseOrderItem`, `MealPlanSlot`, `MaterialMaster.defaultSupplierItem`, `SubsidiaryMaster.defaultSupplierItem`, `SupplierItemPriceHistory`.
- **변경**: 삭제 전 의존성 카운트 조회 → 0이 아니면 도메인 에러 `SUPPLIER_ITEM_IN_USE` 반환, 메시지에 어떤 엔티티에 N건 연결되어 있는지 명시.
- **예외**: `SupplierItemPriceHistory` 는 가격 이력이므로 함께 삭제 (CASCADE 또는 사전 정리).

#### Phase 4-B'-5c-Fix-R1 — 위저드 모드 분리 결정 (R1-b 그룹)

##### 배경
사용자 피드백:
1. 회사에 발주 담당자가 복수 존재할 때, 동시 위저드 실행으로 PO가 두 벌 생성되는 사고 우려
2. 식단 식수가 변경/조정되면 기존 PO를 수정하거나 덮어쓸 수 있어야 함

##### 결정 — 위저드 3가지 모드 도입

| 모드 | 정의 | 적용 가능 상태 | 동작 |
|------|------|----------------|------|
| **NEW (신규)** | 별도 PO 추가 생성 | 무관 | 기존 PO 유지 + 신규 PO 생성. 분할 발주 / 신규 자재 발주 |
| **DELTA (차분)** | 기존 PO에 병합 | DRAFT / SUBMITTED / APPROVED | 동일 (material × line × location × supplier) item은 수량 합산 + `adjustedQuantity` 기록, 신규 자재는 item 추가. `POAdjustmentLog`에 시계열 이력 적층 |
| **REPLACE (덮어쓰기)** | 기존 PO 취소 후 재생성 | **DRAFT 전용** | 대상 PO 전체를 `CANCELLED` 전이 (사유: "재산출에 의한 덮어쓰기") + 신규 PO 생성을 단일 트랜잭션. SUBMITTED·APPROVED는 차단 |

`RECEIVED` / `CANCELLED` PO는 어느 모드에서도 대상 제외.

##### 멱등성 키 정책 (R1-b1)
모든 모드 공통으로 위저드 세션마다 `idempotencyKey` 발급 (Step 1 진입 시 1회). batch service는 `PurchaseOrderBatch.idempotencyKey` unique 제약으로 중복 제출을 멱등 처리. 동일 키 재호출 시 기존 batch의 PO 목록을 그대로 반환.

세션 토큰은 클라이언트의 `localStorage` 에 `mealPlanGroupId + countSource` 단위로 저장 — 새로고침·재진입 시 같은 토큰 재사용. 위저드 완료(`onClearPersistence`) 또는 24시간 경과 시 삭제.

##### 사전 안내 카드 (R1-b1)
Step 1 (식단 그룹 선택 직후) 및 Step 5 (생성 직전) 에 동일 식단그룹의 활성 PO(`status NOT IN (CANCELLED)`) 목록을 표시.

표시 정보: 발주번호 / 상태 뱃지 / 라인 / 공급사 / 총액 / 생성자 / 생성시각 + 상세보기 링크.

차단 아닌 **정보 제공**. 사용자가 모드를 명시 선택하면 그에 맞춰 진행.

##### DELTA 병합 규칙 (R1-b3)
- 병합 키: `(mealPlanGroupId, materialMasterId, locationId, productionLineId, supplierId)` — 즉 같은 자재가 같은 라인·공장·공급사로 이미 발주되어 있으면 동일 PO의 동일 item에 합산
- 합산 시:
  - `PurchaseOrderItem.quantity` = 기존값 + 추가분
  - `PurchaseOrderItem.systemQuantity` = 새 MR 산출의 raw 값
  - `PurchaseOrderItem.adjustedQuantity` = 합산 후 최종 발주 수량
  - `PurchaseOrderItem.adjustmentReason` = "식수 변경 재산출 (N→M명, by {user}, {timestamp})"
- 신규 자재 (기존 PO에 없는 자재)는 적합한 PO(같은 라인·공장·공급사) 또는 신규 PO로 추가
- `POAdjustmentLog` 시계열 이력에 행별로 적층 (before/after qty, reason, actorUserId, createdAt)
- `PurchaseOrder.totalAmount` 재계산
- 상태 전이는 발생하지 않음 (DRAFT는 DRAFT 유지, SUBMITTED는 SUBMITTED 유지)
- SUBMITTED·APPROVED PO 수정 시 `AuditLog`에 추가 기록

##### REPLACE 가드 (R1-b4)
- 대상 PO 중 하나라도 `status NOT IN (DRAFT, CANCELLED)` 이면 차단. 에러: `REPLACE_BLOCKED_BY_SUBMITTED_PO` — UI 메시지: "발주등록 또는 발주확정 상태의 PO가 있어 덮어쓸 수 없습니다. 차분 발주(DELTA)로 진행하거나 해당 PO를 먼저 취소하세요."
- 트랜잭션: 대상 PO 전체를 `CANCELLED` 전이 (cancelReason="REGENERATED_FROM_WIZARD_REPLACE: {새 batchId}") + 신규 PO 생성 + 새 batch 행 생성 — 모두 단일 `prisma.$transaction`
- 신규 PO의 `note` 메타에 "PO-001, PO-002 대체 (REPLACE by {user})" 기록

---

## 📋 Sprint 3 다음 단계 상세 (Phase 4-B'-5b · 5c)

### 4-B'-5b: 위저드 UI 골격 (다음 진행)


**신규 파일**:
- `src/app/(dashboard)/purchase-orders/new/page.tsx` — 라우트 + 인증 가드
- `src/features/purchase-order/components/wizard/po-wizard.tsx` — 클라이언트 위저드 컨테이너
- `src/features/purchase-order/components/wizard/step-meal-plan-group-select.tsx` — Step 1
- `src/features/purchase-order/components/wizard/step-load-summary.tsx` — Step 2

**페이지 연결**: `purchase-orders/page.tsx` 의 "신규 발주" 버튼 → `router.push('/purchase-orders/new')`.

**연동 액션** (4-B'-5a 완료분 재사용):
 - Step 1 드롭다운 → `getMealPlanGroupsForOrderAction()`
 - Step 2 진입 시 자동 호출 → `loadPOWizardDataAction({ mealPlanGroupId, countSource })`
 - 최종 확정 → `createPurchaseOrdersBatchAction(input)`

**상태 관리 전략**: 위저드 전체 상태는 `useState`/`useReducer` 클라이언트 상태로 관리. DB 임시 저장 없음 (Phase 1.6 DraftItem 모델 도입 결정 시 폐기됨). localStorage 키 `po-wizard-draft-{mealPlanGroupId}` 로 새로고침 복구만 지원.

### 4-B'-5c: 위저드 UI 메인

- Step 3: 매핑 테이블 (미매핑 강조, 단가 변경 색 구분, 자동 ceil 알림)
- Step 4: 공장 × 공급업체 분할 미리보기 (배너 + 행 아이콘)
- Step 5: 일괄 생성 모달 + 토스트 + 리다이렉트
- localStorage 임시 저장, 환산 불가 행 메모 기능 포함

### Phase 1.7 — 단위 환산 인라인 다이얼로그 UI 통일 (D16)

#### 배경
- R1-c 에서 추가한 위저드 인라인 단위 환산 등록이 직접 타이핑 방식이었음
- 자재 관리 페이지(`UnitConversionForm`)는 이미 `UnitCombobox` 사용
- 단위 중앙 관리 정책: 모든 단위는 단위 관리에 등록된 것만 셀렉트로 선택

#### 결정사항 (D16)
- **D16-1**: 위저드 인라인 단위 환산 등록도 `UnitCombobox` 사용 (직접 타이핑 금지)
- **D16-2**: `UnitCombobox.onChange(v, unit)` 의 unit 객체에서 `unitCategory` 자동 도출
- **D16-3**: `itemType="MATERIAL"`, `valueMode="code"` 로 자재 관리 폼과 동일 설정
- **~~D16-4 (철회)~~**: ~~WEIGHT 카테고리만 허용~~
  - 운영 현장 시나리오와 충돌: 포장단위(PACKAGE)→g, ml(VOLUME)→g 환산이 자재별 비중에 따라 자연 발생
- **D16-4' (정정)**: **카테고리 제약 없음**
  - fromUnit 은 모든 카테고리(WEIGHT/VOLUME/COUNT/LENGTH/PACKAGE) 자유 선택
  - `excludeValue="g"` 로 toUnit 중복만 차단
  - `UnitConversion.unitCategory` 는 fromUnit 마스터의 카테고리를 그대로 저장 (정보용, 검증 없음)
  - **toUnit='g' 고정은 유지** — 자재 환산 체인(`lib/unit-conversion.ts`)이 g 기준이므로 변경 시 영향 범위 큼
  - 예시 시나리오:
    - WEIGHT: 1 kg = 1000 g (중량 단위 변환)
    - PACKAGE: 1 포 = 1000 g (포장 → 내용물 중량)
    - VOLUME: 1 ml = 0.92 g (기름 비중), 1 ml = 1 g (물)
    - COUNT/LENGTH: 운영에서 필요 시 자유 정의

#### 변경 파일
- `src/features/purchase-order/components/wizard/unit-conversion-inline-dialog.tsx`

#### 검증
- ✅ `npx tsc --noEmit` 0 errors
- ✅ `npm run test` 404 passed (회귀 없음)
- ✅ 수동 UI: PACKAGE/VOLUME/COUNT 모든 카테고리 등록 가능, 'g' 중복 차단, 토스트 경고 없음

#### 후속 메모
- `step-mapping-table.tsx` 가 전달하는 `suggestedFromUnit` 이 UnitMaster.code 와 매칭되지 않으면 빈 상태로 열림 → 향후 UX 개선 검토
- 자재 환산 체인의 'g' 기준 변경 검토는 별도 의사결정 필요 (현재는 g 고정 유지)

#### D17. 공급단위 기준 환산 (Phase 1.7, 2026-06-22)

R1-c 단위환산 인라인 모달 적용 후 사용자 검증에서 발견된 환산 로직 오류 정정.

**배경**: 기존 D3 의 2단계 체인(필요량g → UnitConversion fromUnit → SupplierItem.supplyUnit)이
`UnitConversion.fromUnit` 과 `SupplierItem.supplyUnit.name` 불일치 케이스에서 단위가 어긋난 채로
계산을 진행하는 결함이 있었음. 예: 자재A의 환산이 'kg→g'(factor 1000)인데 공급단위가 '포'(supplyUnitQty=3)인 경우,
"19kg ÷ 3포" 같은 의미 없는 나눗셈이 발생.

**결정사항**:
- **D17-1**: UnitConversion 조회 키를 `(materialMasterId, fromUnit=SupplierItem.supplyUnit.name, toUnit='g')`로 고정.
  한 자재에 여러 fromUnit(포→g, kg→g 등) 등록 가능 — 스키마의 `@@unique([companyId, materialMasterId, subsidiaryMasterId, fromUnit, toUnit])` 5-튜플 unique 로 중복 방지.
- **D17-2**: 글로벌 fallback 우선순위 = ① 자재별 일치 → ② 글로벌(`materialMasterId=null, subsidiaryMasterId=null`). 둘 다 없으면 등록 요구.
- **D17-3**: 계산 = `gPerSupplyUnit = factor × supplyUnitQty`, `orderQuantityRaw = netRequiredG / gPerSupplyUnit`, `orderQuantity = Math.ceil(raw - EPSILON)`.
  예: 19000g, 포→1000g, supplyUnitQty=3 → 19000/3000 = 6.33 → ceil → 7포.
- **D17-4**: UnitConversion 미등록 시 `requiresManualInput=true` 반환 (이전 g 폴백 폐기). UI 에서 인라인 다이얼로그로 등록 유도.
- **D17-5**: `supplyUnitName === 'g'` 예외 — UnitConversion 불필요, `factor=1` 자동 적용.
- **D17-6**: `supplyUnitQty=0` → `requiresManualInput=true` (이전 1 fallback 폐기).
- **D17-7**: 결과 시그니처 의미 변경 — `netRequiredInFromUnit` = 공급단위 기준 raw (= `orderQuantityRaw` 와 동일).
  D3 시절 "환산전 단위 기준 정수(19포)" 의미는 폐기.

**구현 파일**:
- `src/features/purchase-order/lib/unit-conversion.ts` — 1단계 직접 환산
- `src/features/purchase-order/lib/build-po-items-from-mr.ts` — 조회 키 변경 + resolveConversion() 헬퍼 + 글로벌 fallback
- `src/tests/purchase-order-unit-conversion.test.ts` — D3 가정 테스트 10건 D17 정책으로 갱신 + 회귀 6건 추가
- `src/tests/build-po-items-from-mr.test.ts` — mock 데이터 D17 정책 정렬 (UnitConversion.fromUnit = supplyUnit.name)

**검증**:
- `npx tsc --noEmit`: 0 errors
- `npm run test`: 410 passed / 2 skipped / 0 failed
- 회귀 시나리오: 포→1000g + supplyUnitQty=3 + 19000g → 7포 ✅

**Phase 1.7 진입점**: Phase 1.6 (D9 outboundDate) 완료 후 R1-c 단위환산 인라인 모달의 결함 발견으로 시작된 보강 작업.
다음 단계는 R1-c UI 트리거 보강 (공급단위 기준 환산 미등록 시 인라인 다이얼로그 자동 제안 — `step-mapping-table.tsx`) 및 Fix-R2.

#### D17-10. 단위 환산 다이얼로그 3중 가드 (2026-06-23)

**배경**: 사용자가 미매핑 행(공급업체 미선택)에서 단위 환산을 등록하면, `build-po-items-from-mr.ts`의 `resolveConversion`이 `defaultSupplierItem` 부재로 환산 lookup을 건너뛰어, 새로고침 시 등록한 환산이 사라진 것처럼 보이는 데드락이 발생.

**결정**:

1. **Guard A — 미매핑 행에서 ↗ 단위 환산 등록 버튼 숨김**
   - `step-mapping-table.tsx`: 버튼 노출 조건에 `r.supplierItem !== null` 추가
   - 정상 흐름: SupplierItemPicker로 공급업체 매핑 → mapped 승격 → 그때 환산 미등록이면 버튼 노출 → 등록 후 `REFRESH_ROW_AFTER_CONVERSION` 으로 재계산

2. **Guard B — suggestedFromUnit 잠금**
   - `unit-conversion-inline-dialog.tsx`: `suggestedFromUnit && fromUnit !== suggestedFromUnit` 이면 토스트로 차단
   - 호출 시 `r.supplierItem!.supplyUnitCode` 명시적 전달 (UnitMaster.code 기준)

3. **Guard C — DUPLICATE_CONVERSION 정상 흐름 처리**
   - `ActionFailure` 타입은 `{ code, message }` 만 노출 (`details` 없음)
   - `res.error.code === "DUPLICATE_CONVERSION"` 판별 → `onSuccess` 트리거 + 다이얼로그 닫기
   - 메시지 fallback (`includes("이미 등록")`) 으로 i18n/메시지 변경 대비

**검증**: tsc 0 errors, 410 PASS / 2 skipped

**한계 / 추후 검토 (D-LOT-TRACKING 후속 안건)**:
- 본 가드는 "공급업체가 결정된 후에만 환산 등록"이라는 UX 원칙을 강제. 공급업체 미정 자재에 대한 사전 환산 요구가 빈번하다면 build-po-items-from-mr 에서 `MaterialMaster.unit` fallback lookup을 도입해야 함.

---

### 미해결 설계 안건 (Sprint 4 이전 결정 필요)

| 안건 | 상태 | 결정 시점 |
|---|---|---|
| **D-FIFO** — 동일 날짜 입고 시 단가 소비 우선순위 (최신 등록분 우선 vs 등록 순) | 미결정 | Phase 5 (입고) 진입 전 |
| **D-LOT-TRACKING** — 재고 lot 단위 단가 추적 모델 (Option A: InventoryLot 테이블 신설 / Option B: 가상 lot 계산) | 미결정 | Phase 5 진입 전 |
| **D-RESERVATION** — PO 생성 시 예약(Reservation) 자동 생성, 가용 재고 = totalQtyG − reservedQtyG. 리드타임 D+3,+4로 미리 입고된 자재가 신규 발주 wizard에서 가용 재고로 잘못 잡히지 않도록 차단 | 미결정 | Phase 5 진입 전 |

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

## 📚 종결 Sprint 결정사항 인덱스

종결된 Sprint 의 핵심 결정사항이 어디에 보존되어 있는지 빠르게 찾기 위한 인덱스.

| 영역 | 결정사항 | 보존 위치 |
|------|----------|-----------|
| MaterialRequirement 산출 정책 | 2단계 분리 (ESTIMATED/FINAL), CONTAINER 슬롯만, MR_INVALID_UNIT strict, SEMI_PRODUCT 1단계 재귀, UPSERT/UNDELETE/soft-delete diff | `SPRINT2.md` Phase 9-A |
| 슬롯 수량 검증 (그룹 단위) | `recipeBomId` 그룹핑, OK_FALLBACK/OK_DISTRIBUTED/SUM_MISMATCH/PARTIAL_INPUT 4상태 | `SPRINT2.md` Phase 9-C, 9-C-Fix-R1 |
| 슬롯 수량 대칭 분리 | `quantity` → `estimatedQuantity` + `finalQuantity Int?`, 검증 함수 countSource 매개변수 | `SPRINT2.md` Phase 9-D-Sym |
| 부자재 사용처 지정 | `MealPlanAccessory.productionLineId` 추가 (예정), PER_MEAL_COUNT/FIXED_QUANTITY 모드, 식단 외 독립 발주 트랙 | `SPRINT2.md` Phase 9-D-Acc (이관 시), 본 문서 "Sprint 2 잔여" |
| UnitMaster SSOT · PACKAGE 카테고리 | `SupplierItem.supplyUnit → supplyUnitId` FK, 카테고리 사전 선택 UI 제거, `UnitCombobox` | `SPRINT2.md` Sprint 2.5 섹션 |
| PO 라이프사이클 정책 (POStatus 매핑) | DRAFT/SUBMITTED/APPROVED/RECEIVED/CANCELLED 라벨, submittedAt/approvedByUserId/cancelledAt 등 | 본 문서 Sprint 3 결정사항 |
| 발주 위저드 정책 D1~D8 | PO 의미론, 위저드 vs 수동, 단위 환산 체인, PriceHistory 적층 (P9'), 그룹핑 키, 미매핑 처리, 회사 계층, InventoryAdapter | 본 문서 Sprint 3 Phase 4-B' 결정사항 |

## 🔮 다음 Sprint 진입 시 확장할 합의된 정책 (사전 보존)

향후 Sprint 진입 시 본 정책들을 결정사항 섹션으로 확장한다. 사전 합의된 내용을 잃지 않기 위해 보존.

### Sprint 4 — ConsumptionItem · 재고 도메인

- **처분 enum**: `USED` (정상사용→CONSUMPTION, 확정원가) / `RETURNED` (잔량 환원→트랜잭션 없음) / `DISPOSED` (폐기→DISPOSAL, 손실원가).
- **DisposalReason enum**: `EXPIRED` / `DAMAGED` / `CONTAMINATED` / `OVER_PREPARED` / `OTHER`. `TRIMMING_LOSS` 는 `BOM.yieldRate` 흡수, 폐기 미포함.
- **서비스 가드**: `USED|RETURNED` → `disposalReason` null 필수. `DISPOSED` → 사유 필수. `OTHER` → `disposalNote` 필수.
- **부자재 통합**: `ConsumptionItem.itemType` + `subsidiaryMasterId` 추가하여 자재·부자재 단일 모델 처리 (Phase 9-D-Acc 결정사항 흡수).
- **재고 검증식**: `기초 + ∑PURCHASE − ∑CONSUMPTION(USED) − ∑DISPOSAL(DISPOSED) ± ∑TRANSFER ± ∑ADJUSTMENT = 기말` (단일 `InventoryTransaction` 테이블, `transactionType` GROUP BY).
- **InventoryLot 보강**: `materialMasterId` String → String? nullable 전환 (부자재 표현). `itemType` 인덱스 추가.
- **InventoryAdapter 교체**: Sprint 3 의 `noopInventoryAdapter` → 실제 어댑터로 연결.

### Sprint 5 — 원가 산출

| 원가 종류 | 산출식 | 입력 |
|-----------|--------|------|
| 예상원가 | BOM × MealCount.estimatedCount × 단가 | MaterialRequirement(ESTIMATED) |
| 확정원가 | ∑ ConsumptionItem(USED) × Lot 단가 | ConsumptionLotDetail |
| 손실원가 | ∑ ConsumptionItem(DISPOSED) × Lot 단가 | ConsumptionLotDetail |
| 원가편차 | 확정원가 − 예상원가 | (계산) |
| 손실률 | 손실원가 ÷ (확정원가 + 손실원가) | (계산) |

- `CostType { ESTIMATED, ORDER_BASED, ACTUAL }` 유지. 손실원가는 별도 enum 없이 `disposition` 컬럼으로 분기.
- ORDER_BASED 의 의미: 발주 시점 확정 단가 (PO 단가 × MR 수량). Sprint 3 의 P9' 정책과 연동.

### 발주 산정 공식 (Phase 4-B' 위저드에 일부 반영, 잔여 정책은 진입 시 확장)

- 변환식: `필요량(g) ÷ 환산계수 → 포장 단위 수량` (Phase 4-B'-1 `calculateOrderQuantity` 에 구현 완료).
- 재고 차감: `발주 수량 = 환산 후 필요량 − 현재 재고(동일 단위)` (Phase 4-B'-2 에 어댑터 인터페이스 적용, Sprint 4 에서 실 구현 연결).
- 반올림 정책 (현재 `Math.ceil` 단일, 향후 검토):
  - 잔여 ≤ 30% → 절사 (버림)
  - 잔여 > 30% → 절상 (올림)
  - 운영자 수동 조정은 DRAFT 단계에서만 허용 (현재는 항상 허용)
- 보정 발주 정책: CONFIRMED/RECEIVED 이후 변경은 별도 보정 PO 로 분리. `PurchaseOrder.note` 에 원본 PO 참조.

+ 발주 단위 = `Math.ceil(필요량 / 환산계수)` — Phase 4-B'-1 에서 구현 완료
+ 출고일 기반 키 일자 = `PurchaseOrder.outboundDate` (Phase 1.6 에서 컬럼 개명 적용)
+ 예상 입고일 = `outboundDate − SupplierItem.leadTimeDays` (파생값, 컬럼화 금지)

### 작업지시서 (조리 지시서) — Sprint 3 Phase 8 또는 별도 Sprint
- 컬럼: 메뉴 / 식단 / 용기 / 인분 / 식자재 / 포장 단위 / 투입량(역환산) / 총 필요량 / 1인분 BOM 중량.
- "투입량" 은 발주 받은 포장 단위 기준 (예: 2.5포). UI 는 g 와 발주 단위 둘 다 표시.

### MaterialRequirement 페이지 역할 재정의 (Sprint 3 Phase 7 에서 확장)
- "소요량" → **"필요량/작업지시서/발주서 생성 단계"** 로 역할 확장.
- 용어 통일: **"소요량" → "필요량"**.
- "유니크 자재" → **"중복 사용 자재 수"**.
- 환산 후 발주 단위 수량 컬럼 추가.
- 산출 결과 → 공장별 작업지시서 + 공장별 발주서 초안 자동 생성.

### 식단 외 독립 발주 트랙 (Sprint 3 Phase 4-D 또는 Sprint 4)
- 용기·수저·청소 용품 등 식단과 무관한 자재는 공장 직접 발주.
- `MaterialRequirement` 미사용, `PurchaseOrder.isManual = true` + 위저드 D2 컨벤션 재사용.

### 원가/재고 검증식 (Sprint 5)
- 일별 사용량 기반 원가 계산.
- 월말 마감 시 `MonthEnd*` 모델로 스냅샷.
- 예: 기초 10팩 + 6월 매입 100팩 − 기말 30팩 → 사용 80팩, 비용 = 80팩 × 단가.

---

## 📋 Prisma 스키마 모델 커버리지

요약: 총 69 모델 중 식단·자재 도메인은 ✅, 발주·재고·원가·조직·권한·알림은 ⬜ 또는 🔄.
- PurchaseOrder / PurchaseOrderItem: 🔄 (Sprint 3 Phase 1.5 에서 `locationId` / `productionLineId` 추가, Phase 4-B' 위저드 백엔드 진행 중)
- 상세 표 → `docs/progress/SCHEMA_COVERAGE.md`
