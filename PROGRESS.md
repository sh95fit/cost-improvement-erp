# LunchLab ERP — 프로젝트 진행 현황

> 본 문서는 **현재 진행 상황과 앞으로 할 일**을 관리하는 SSOT(단일 진실 공급원)이다.
> 종결된 Sprint의 상세 이력은 `docs/progress/SPRINT{n}.md` 로 이관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에서 관리한다.
>
> 마지막 갱신: 2026-06-22 (R1-c 완료 — SupplierItemPicker portal + 단위환산 인라인 모달 + D14 권한 정책 기록)

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
- **현재 기준 완료 지점**: Sprint 3 Phase R1-c (SupplierItemPicker portal + 단위환산 인라인 모달 완료)
- **최근 완료**:
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
- **다음 진행 항목**: **Phase 1.6** (D9 outboundDate 마이그레이션) → Fix-R2 (Step 5 품목별 예상 입고일·Step 4 라인업 뷰) → Phase 4-C (상세보기 + 상태 전이 다이얼로그, Fix-R2 완료 후 착수)
- **현재 블로커**: 없음
- **누적 테스트**: 404 PASS / 2 skipped / 0 fail
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
| **1.6** | **D9 적용**: PurchaseOrder.deliveryDate → outboundDate 마이그레이션 + 서비스·액션·UI 일괄 갱신 | ⬜ | - |
| **4-B'-5c-Fix-R2** | 위저드 UI 개선 R2 (Step 5 품목별 예상 입고일 / Step 3 단위환산 인라인 등록 / Step 4 라인업 뷰 — 백엔드 lineupBreakdown 추가) | ⬜ | - |
| 4-C | 상세보기 + 상태 전이 다이얼로그 (Fix-R2 완료 후 착수) | ⬜ | - |
| 4-D | 수동 발주 다이얼로그 (4-B' 컨벤션 재사용, `isManual=true`) | ⬜ | - |
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
