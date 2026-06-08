# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> Sprint 1·2 Phase별 상세 이력은 `docs/progress/SPRINT1.md`, `docs/progress/SPRINT2.md` 에 보관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에 보관한다.
> 마지막 갱신: 2026-06-08 (Phase 9-A-1.5 — countSource enum 도입 + 산출 정책 명시)

---

## 📌 작업 프로세스 규칙

모든 Phase는 아래 6단계를 순서대로 따른다. 단계를 건너뛰지 않는다.

| 순서 | 단계 | 설명 | 완료 기준 |
|------|------|------|-----------|
| 1 | **깃 배포** | 코드 수정 → `npx tsc --noEmit` → `git commit` → `git push origin main` | push 성공, GitHub에서 커밋 확인 |
| 2 | **레포 검증** | GitHub 레포에서 변경 파일 목록·diff 확인, 의도하지 않은 파일 누락/포함 점검 | 변경 파일이 계획과 일치 |
| 3 | **프로세스 검증** | `npm run dev` 실행 → 해당 Phase의 기능을 UI에서 직접 조작하여 확인 | 모든 시나리오 통과 |
| 4 | **테스트** | `npm run test` 실행 → 관련 서비스 테스트 통과 확인, 필요 시 새 테스트 작성 | 전체 테스트 PASS |
| 5 | **보완** | 검증에서 발견된 버그·누락 수정 → 1~4 반복 | 재검증 통과 |
| 6 | **PROGRESS.md 갱신** | 본 문서의 해당 Phase 상태를 ✅로 변경하고 커밋 해시·변경 파일·이슈를 기록. Sprint 진행 중에는 본 문서가 단일 진실 공급원(SSOT) | 본 문서 커밋·푸시 완료, GitHub에서 갱신 확인 |
| 7 | **다음 단계 진행 또는 Sprint 종결 처리** | Phase가 Sprint 내부면 다음 Phase로 진행. Phase가 Sprint 마지막이면 아래 "스프린트 종결 절차"를 수행한 뒤 다음 Sprint 진입 | 다음 Phase 착수 또는 Sprint 아카이브 커밋 완료 |

---

### 📁 문서 최신화 정책 (SSOT 규칙)

본 프로젝트의 진행 상태 문서는 **Sprint 단위 라이프사이클**을 따른다.

#### 1. Sprint 진행 중 (Active Sprint)
- 현재 진행 중인 Sprint의 모든 Phase 이력은 **`PROGRESS.md` 본문**에 직접 기록한다.
- 모든 Phase 완료 시 다음 항목을 동일 커밋에 포함한다:
  - 해당 Phase 상태 ✅ 표시 (또는 ⏳/⬜ 갱신)
  - 커밋 해시(짧은 해시), 변경 파일 목록, 주요 의사결정/이슈
  - 누적 테스트 수, TypeScript 오류 수, 미해결 후속 항목
- 스키마 모델이 추가·확장되면 같은 커밋에서 **`docs/progress/SCHEMA_COVERAGE.md`** 의 해당 행 상태와 "변경 이력" 섹션을 함께 갱신한다.
- **금지**: Sprint 진행 중에 해당 Sprint 이력을 `docs/progress/SPRINT{n}.md`에 미리 이동하지 않는다 (이중 기록 방지).

#### 2. Sprint 종결 시점 (Sprint Closure)
Sprint의 마지막 Phase + 최종 QA가 모두 ✅가 된 시점에 다음 절차를 수행한다.

1. Sprint 통계 확정: 총 Phase 수, 커밋 수, 변경 파일 수, 테스트 수, TS 오류 수, any 사용 수, 해소 이슈 번호.
2. `PROGRESS.md`에 누적되어 있는 해당 Sprint 상세 이력을 **`docs/progress/SPRINT{n}.md`** 로 이동(컷·앤·페이스트, 누락 금지).
3. `PROGRESS.md` 본문에는 다음만 남긴다:
   - Sprint 한 줄 요약 (기간, 총 Phase, 누적 테스트, 0 errors 등)
   - `> 상세 이력 → docs/progress/SPRINT{n}.md` 링크
4. `SCHEMA_COVERAGE.md` 변경 이력에 "Sprint {n} 종결" 라인을 추가한다.
5. 커밋 메시지 컨벤션:
   - `docs(progress): close sprint {n} — archive history to SPRINT{n}.md`
6. 동일 푸시 안에서 다음 Sprint의 `PROGRESS.md` 상단 "현재 상태 요약"의 기준 Sprint 번호를 갱신한다.

#### 3. 문서 책임 매트릭스

| 문서 | Sprint 진행 중 갱신 | Sprint 종결 시 갱신 | 역할 |
|------|---------------------|---------------------|------|
| `PROGRESS.md` | 매 Phase 완료마다 | 해당 Sprint 섹션을 요약으로 축소 | 현재 상태 SSOT, 대시보드 |
| `docs/progress/SPRINT{n}.md` | **갱신하지 않음** | Sprint 종결 시 일괄 이관 | 종결된 Sprint 아카이브 |
| `docs/progress/SCHEMA_COVERAGE.md` | 모델 상태 변동 시마다 | "변경 이력" 라인 추가 | 모델 구현 현황 트래커 |

#### 4. 예외
- 핫픽스/회귀 수정은 진행 중인 Sprint에 새 Phase 번호(예: `7-D hotfix`)로 추가하고 동일 규칙을 따른다.
- 이미 종결된 Sprint에 대한 회고/추가 메모는 해당 `SPRINT{n}.md` 하단에 "사후 추가" 섹션으로 append하되, `PROGRESS.md`는 건드리지 않는다.

---

## 📍 현재 상태 요약 / 완료 범위 / 남은 작업 / 보류 범위 / handoff 기준

### 현재 상태 요약
- **현재 기준 완료 지점**: Sprint 2 / Phase 8.5 완료 (Location · ProductionLine 마스터 + 테스트 + 본 문서 분리)
- **현재 프로젝트 상태**: Sprint 2 진행 중 — Phase 2-e → 6 → 7-E → 9 → 10 → 11 (Phase 9 다음 착수)
- **현재 블로커**: 없음
- **해소된 과거 블로커** (Phase 5-R 라운드에서 해결):
  1. ✅ `MealPlanGroup.lineupId` 제거 — Step 1.x에서 schema 분리
  2. ✅ `MealPlan`이 (식사타입 × lineup) 조합 단위로 재정의 — `(mealPlanGroupId, companyMealSlotId, lineupId)` 합성 unique
  3. ✅ `MealPlanSlot`에 `supplierItemId`, `productionLineId`, `slotKind(CONTAINER|DIRECT)` 등 실행 배정 필드 확보
  4. ✅ `MealSlotType` enum / `slot_type` 컬럼 완전 제거 → `companyMealSlotId` 단일 입력 (Step 3.2b-2-β)
  5. ✅ `MealCount`가 `MealPlan`과 (slot × lineup) 키로 1:1 매칭, UI에서 통합 뷰 제공 (Step 6-3c-A2)

### 완료 범위
#### Sprint 1 완료 범위
- Sonner toast 인프라 도입
- 레시피/BOM/Container 관련 이슈 재현 및 해결
- UnitMaster 중앙 관리 체계 구축
- Container 삭제 의존성 검증 및 경고 UI
- duplicateRecipeBOM 서비스/액션 및 BOM UI 보강
- Container / Supplier / UnitMaster 테스트 보강
- handleActionError 패턴 통일
- Error Boundary 추가
- CONVENTIONS 12규칙 점검 완료
- Sprint 1 최종 QA 완료

> 상세 이력 → `docs/progress/SPRINT1.md`

#### Sprint 2 현재까지 완료 범위
- MealTemplate schema/service/test
- MealTemplate action/UI/sidebar
- v5 Prisma 구조 전환
- v5 UI/로직 보완 및 supplier 패턴 통일
- MealPlanGroup / MealPlan / MealPlanSlot 기본 schema/service/action
- 식단 그룹 CRUD UI
- **Phase 5-R (구조 재정의 보강 라운드)** 완료:
  - Step 1.x: MealPlanGroup 단순화, MealPlan/MealPlanSlot 재설계, MealCount partial unique
  - Step 2.x: seed / schema (Zod) / service / action 정렬
  - Step 3.2b-2-α/β: `companyMealSlotId` 1급 입력 전환, `slot_type` 컬럼 및 `MealSlotType` enum 완전 제거
  - Step 6-3c-A: MealCount 입력 UI 최소 구현 (commit `9ba2d21`)
  - Step 6-3c-A2: MealCount × MealPlan 1:1 통합 뷰 (commit `9078d01`)
- **Phase 7-A/B/C** 완료 (별도 섹션 — 슬롯 상세 에디터 1차)
- **Phase 7-D** 완료: 레시피·반제품 상세 다이얼로그 자동 닫힘 회귀 제거 (commit `f36a630`)
- **Phase 7-D hotfix** 완료: 반제품 BOM 자재 셀렉트 비어있던 회귀 해소 (commit `d782f7b`)
- **Phase 7-F1** 완료: BOM 적격 가드 + 서버 검증 (commit `1f15999`)
- **Phase 7-F2/F3** 완료: UI 적격 필터 + SearchableSelect 적용 (commit `ff12ed6`)
- **Phase 7-F2/F3 cleanup** 완료 (commit `f56b312`)
- **Phase 8 Step 8-A** 완료: meal-plan 도메인 서비스 테스트 18 케이스 추가 (commit `6cef14e`)
- **Phase 8.5-A** 완료: Location/ProductionLine 스키마 확장 (commit `dfdb7f1c`)
- **Phase 8.5-B** 완료: Location 마스터 기능 (commits `9d8b10b2`, `4977fdc2`)
- **Phase 8.5-C** 완료: ProductionLine 마스터 기능 (commits `10f4584c`, `3686206b`)
- **Phase 8.5-D** 완료: 서비스 테스트 + PROGRESS.md 분리

> 상세 이력 → `docs/progress/SPRINT2.md`

### 남은 작업
#### Sprint 2 기존 미완료 작업

- Phase 2-e — 부자재-공급업체 연결 UX (대기)
- Phase 6 — 식단 캘린더 뷰 (대기 / 독립 가능)
- Phase 7-E — BOM 슬롯 totalWeightG 자동 합산 (Mid, Sprint 2 보강 라운드 잔여)
- Phase 7-E (UX) — 식단 캘린더/달력 뷰 (UX 강화, 독립 가능, 후순위)
- Phase 7-G — 단위 환산 가드 (Phase 9 진입 전 권장)
- Phase 8 — MealCount(✅) + MealPlanAccessory(✅) + meal-plan 테스트(✅ Step 8-A) — **완료**
- Phase 8.5 — Location/ProductionLine 마스터 (✅ 완료, 본 라운드)
- Phase 9-A — 소요량 자동 산출 서비스 (materialRequirement)
  - ✅ 9-A-0 스키마 + 마이그레이션 (NOT NULL 승급, soft-delete, FK RESTRICT)
  - ✅ 9-A-1 Zod 스키마 (초안)
  - ✅ 9-A-1.5 countSource enum + 유니크 키 확장 + 산출 정책 명시
    - schema.prisma: MealCountSource enum + countSource 컬럼 + 합성 유니크
    - 마이그레이션: 20260608043309_phase_9_a_material_requirement_count_source (멱등 SQL)
    - material-requirement.schema.ts: countSource, 신규 에러코드, stats 확장
    - PROGRESS.md: 산출 정책 7개 항목 명시 (계산식 포함)
  - ⏳ 9-A-2 service (UPSERT/UNDELETE/soft-delete 재생성 로직)
  - ⏳ 9-A-3 action
  - ⏳ 9-A-4 테스트
- Phase 9-B — UI 페이지 (대기)
- Phase 9-C — PO 자동 생성 연결 (대기)
- Phase 10 — 테스트 작성
- Phase 11 — 페이지 통합 + Sprint 2 QA

#### Sprint 2 내부 추가 보강 작업
(모두 완료 — Phase 5-R 라운드 종료)
- ✅ MealPlan 도메인 구조 재정의 기준 확정
- ✅ `schema.prisma` / migration 수정 (slot_type 제거 포함 2건)
- ✅ `seed.ts` 보강
- ✅ `meal-plan.schema.ts` / `meal-plan.service.ts` / `meal-plan.action.ts` 재정비
- ✅ `/meal-plans/page.tsx` 구조 재구성 (1:1 통합 뷰 포함)
- ⏳ 자동생성 연결 계약 정리 — Phase 9에서 진행
- ⏳ 관련 테스트 보강 — Phase 10에서 진행
- ✅ 문서 동기화 및 Sprint 2 재개 판정 완료

#### 미해결 정리 항목 (라이트한 후속)
- `page.tsx`의 `openMealCountEditor` / `closeMealCountEditor` / `handleSaveMealCount` 세 함수가 한 단계 추가 들여쓰기로 작성되어 있음. 기능엔 영향 없음. Phase 7-A 패치 시 동일 파일을 열 때 함께 정리.

### 보류 범위
아래는 구조 재정의 보강 완료 전 본격 착수하지 않는다.
- InventoryReservation
- InventoryTransfer
- StockTake
- ShippingOrder
- ConsumptionItem
- CookingPlan 본 구현
- CostSnapshot / CostCalculation / OverheadCost / MonthEnd*
- Notification*
- 조직/권한/초대
- AuditLog 조회 UI
- AutoGenLog 조회 UI

### handoff 기준
다음 모델 또는 개발자는 아래 순서로 읽고 시작한다.
1. `PROGRESS.md` (본 문서)
2. `docs/progress/SPRINT2.md` (최근 작업 컨텍스트)
3. `docs/progress/SCHEMA_COVERAGE.md` (모델별 구현 상태)
4. `docs/progress/SPRINT1.md` (Sprint 1 이력)
5. `01_개발순서.md`
6. `02_개발문서.md`
7. `03_개발가이드문서.md`
8. `04_전체 구현 체크리스트 및 코드기준안.md`
9. `05_불일치 정리 및 통합기준 제안.md`
10. `06_Phase 3. 식단 관리 프로세스.md`
11. `07_HANDOFF.md`

### 현재 구조 재정의 공식 판단
- `MealPlanGroup`는 날짜 중심 그룹으로 단순화한다
- `MealPlan`은 식사타입 × lineup 조합으로 재정의한다
- `MealPlanSlot`은 실제 실행 배정 단위로 확장한다
- `MealCount`는 상태가 아니라 데이터 입력값으로 유지한다
- `MaterialRequirement` / `CookingPlan` / 자동생성 연결의 기준 입력은 `MealPlanSlot`으로 정렬한다

---

## 🧪 Phase 9-A 결정사항 (MaterialRequirement 산출 정책)

본 Phase에서 채택한 산출 정책은 다음과 같다. 이후 Phase에서 동일 정책을 따른다.

### 산출 흐름 분리 (1차 / 2차)
- **1차 산출 (`countSource=ESTIMATED`)**: 식단 확정 직후 `MealCount.estimatedCount` 기반.
  발주서·작업지시서 산출의 입력으로 사용.
- **2차 산출 (`countSource=FINAL`)**: 식수 확정 후 `MealCount.finalCount` 기반.
  원가 산출(예상 vs 실제 비교)의 입력으로 사용.
- 두 산출은 동일 알고리즘이며, `MaterialRequirement` 테이블에 `countSource` 컬럼으로
  별도 행으로 보존된다. 유니크 키: `(mealPlanGroupId, productionLineId, materialMasterId, countSource)`.

### 산출 대상 슬롯
- ✅ `MealPlanSlot.kind = CONTAINER` 이고 `recipeBomId IS NOT NULL` 인 슬롯만 산출 대상.
- ❌ `kind = DIRECT` (부자재 직접 지정): MR에서 제외. `stats.directSlotsSkipped`에만 카운트.
  사용처리(소비)는 Sprint 4의 ConsumptionItem 모듈에서 별도 처리.
- ❌ `MealPlanAccessory`: MR에서 제외. 동일하게 Sprint 4 소비 모듈로 위임.

### 단위 검증 정책 — **strict (Phase 7-G 환산기 도입 전까지)**
- 본 Phase에서는 단위 변환을 수행하지 않는다.
- `RecipeBOMSlotItem.unit` 이 "g"가 아니거나 `MaterialMaster.unit`과 일치하지 않으면
  서비스 레이어에서 `MR_INVALID_UNIT` 에러를 throw한다 (산출 중단).
- 환산이 필요한 케이스는 Phase 7-G에서 `unit-conversion.service`를 정비한 뒤,
  Phase 9-A 코드의 단위 검증 분기를 환산기 호출로 교체한다 (Phase 9-A-후속 마이크로 패치).
- 운영 데이터 입력 시 이 제약을 사전 안내할 것 (자재 마스터 단위 일관성 확보 책임).

### MealCount 누락 처리 — **필수 (산출 차단)**
- 해당 `(companyMealSlotId, lineupId)` 조합의 `MealCount`가 없거나, 사용할 카운트
  필드(`estimatedCount` 또는 `finalCount`)가 NULL이면 `MR_MISSING_MEAL_COUNT` 에러를
  throw한다. 0은 명시 입력된 정상값으로 본다.

### 반제품(SEMI_PRODUCT) 재귀 정책
- `RecipeBOMSlotItem.ingredientType = SEMI_PRODUCT`인 경우, 반제품의 `BOM`(status=ACTIVE)을
  1단계 펼쳐 자재로 환원한다. 반제품 내부에 반제품이 있는 경우는 Phase 9-A에서 처리하지 않는다
  (Phase 9-B 또는 후속에서 다단 재귀 지원 검토).

### 데이터 타입 정책
- `MaterialRequirement.requiredQty`는 `Float` 유지. Decimal 정확도 강화는 별도 Phase로 분리.
- 합산 계산은 서비스 레이어에서 `Prisma.Decimal`로 누적 후 `.toNumber()` 변환.

### 재산출 패턴 (UPSERT / UNDELETE / soft-delete)
- 동일 키 존재 + 활성 + 동일 값 → unchanged
- 동일 키 존재 + 활성 + 값 다름 → update (`generationVersion++`)
- 동일 키 존재 + soft-deleted → undelete (`deletedAt=null`, `generationVersion++`)
- 동일 키 없음 → insert (`generationVersion=1`)
- 활성 행 중 새 산출에 없는 키 → soft-delete (`deletedAt=now()`, `generationVersion++`)

### 산출 계산식 (1인분 기준)
- `RecipeBOMSlotItem.weightG`는 1인분당 자재 사용 중량(g)으로 해석한다.
  (`RecipeBOM.baseWeightG`는 레시피 전체 표준 중량으로, 9-A 산출과 무관)
- 자재 소요량: `requiredQty = slotItem.weightG × mealCount`
- 합산 키: `(productionLineId, materialMasterId)`
- 한 슬롯의 BOM 안에 같은 자재가 여러 번 등장하거나, 여러 슬롯에서 같은
  자재를 사용하면 모두 합산하여 단일 MR 행으로 통합한다.
---

## 📋 Prisma 스키마 모델 커버리지

요약: 총 69모델 중 식단·자재 기반 도메인은 ✅, 발주·재고·원가·조직·권한·알림은 ⬜.
상세 표 → `docs/progress/SCHEMA_COVERAGE.md`.

---

## 🏗️ Sprint 1: 안정화 + 품질 기반 확보 (5/4 ~ 5/12) ✅

- 총 14 Phase 완료, 16 커밋, 12파일 / 158 tests / 0 failures
- TypeScript errors: 0, any 타입: 0건
- 발견 이슈 #1~#7 전건 해소
- 상세 → `docs/progress/SPRINT1.md`

---

## 🏗️ Sprint 2: 식단 템플릿·식단 계획 (5/12 ~ 진행 중)

- 총 예상 공수: ~48h
- Phase 1 ~ 8.5 완료, Phase 9 다음 착수
- 테스트: 16 files / 219 tests / 2 skipped / 0 failures
- 상세 → `docs/progress/SPRINT2.md`

---

## 🏗️ Sprint 3: 발주 + 입고 (5/23 ~ 5/31, ~32h)

### Phase 1 — PO Zod 스키마 작성 ⬜ (3h)
- **대상 모델**: PurchaseOrder, PurchaseOrderItem

### Phase 2 — purchase-order.service.ts ⬜ (5h)
- **작업**: 발주 CRUD, 자동/수동 발주 생성, 상태 전이, 소요량→발주 변환

### Phase 3 — purchase-order.action.ts ⬜ (3h)

### Phase 4 — 발주 UI + /purchasing/page.tsx ⬜ (5h)

### Phase 5 — 입고 Zod 스키마 ⬜ (2h)

### Phase 6 — receiving.service.ts ⬜ (4h)

### Phase 7 — receiving.action.ts + 입고 UI ⬜ (4h)

### Phase 8 — /receiving/page.tsx 통합 ⬜ (2h)

### Phase 9 — 테스트 + E2E + Sprint 3 QA ⬜ (4h)

## 🏗️ Sprint 4: 재고 + 재고이동 + 재고실사 + 출고 + 소비 + 조리계획 (6/1 ~ 6/15, ~62h)

### Phase 1 — 재고 조회 서비스 ⬜ (4h)

### Phase 2 — 재고 UI + /inventory/page.tsx ⬜ (4h)

### Phase 3 — InventoryReservation 서비스 ⬜ (3h)

### Phase 4 — InventoryTransfer 서비스 + 액션 ⬜ (4h)

### Phase 5 — InventoryTransfer UI + /transfers/page.tsx ⬜ (4h)

### Phase 6 — StockTake 서비스 + 액션 ⬜ (4h)

### Phase 7 — StockTake UI + /stock-takes/page.tsx ⬜ (3h)

### Phase 8 — ShippingOrder 서비스 + 액션 ⬜ (4h)

### Phase 9 — ShippingOrder UI + /shipping/page.tsx ⬜ (3h)

### Phase 10 — ConsumptionItem 서비스 + 액션 ⬜ (4h)

### Phase 11 — ConsumptionItem UI + /consumption/page.tsx ⬜ (3h)

### Phase 12 — CookingPlan 서비스 + 액션 ⬜ (5h)

### Phase 13 — CookingPlan UI + /cooking-plans/page.tsx ⬜ (4h)

### Phase 14 — 테스트 (재고/이동/실사/출고/소비/조리) ⬜ (4h)

### Phase 15 — Sprint 4 E2E + QA ⬜ (3h)

## 🏗️ Sprint 5: 원가 + 간접비 + 월말 마감 + 알림 (6/16 ~ 6/28, ~52h)

### Phase 1 — 원가 스냅샷 서비스 ⬜ (4h)

### Phase 2 — 원가 스냅샷 UI ⬜ (3h)

### Phase 3 — CostCalculation 서비스 ⬜ (5h)

### Phase 4 — CostCalculation UI + /cost/page.tsx ⬜ (4h)

### Phase 5 — OverheadCost 서비스 + 액션 ⬜ (3h)

### Phase 6 — OverheadCost UI + /overhead-costs/page.tsx ⬜ (3h)

### Phase 7 — MonthEndSnapshot 서비스 ⬜ (5h)

### Phase 8 — MonthEnd UI + /month-end/page.tsx ⬜ (4h)

### Phase 9 — NotificationTemplate/Rule 서비스 ⬜ (4h)

### Phase 10 — Notification UI + /notifications/page.tsx ⬜ (4h)

### Phase 11 — 테스트 (원가/간접비/월말/알림) ⬜ (4h)

### Phase 12 — Sprint 5 E2E + QA ⬜ (3h)

## 🏗️ Sprint 6: 조직 관리 — 회사·거점·라인·라인업 (6/29 ~ 7/7, ~38h)

### Phase 1 — Company 서비스 + 액션 ⬜ (3h)

### Phase 2 — Company UI + /companies/page.tsx ⬜ (3h)

### Phase 3 — Location 서비스 + 액션 ⬜ (3h)
> 비고: Phase 8.5-B에서 Location 마스터(`/locations`, CRUD UI, 사이드바 메뉴) 완료. Sprint 6 본 Phase는 조직 단위 통합 검증 시점에 재점검.

### Phase 4 — ProductionLine 서비스 + 액션 ⬜ (3h)
> 비고: Phase 8.5-C에서 ProductionLine 마스터(`/production-lines`, CRUD UI, 사이드바 메뉴, 공장 가드) 완료. Sprint 6 본 Phase는 조직 단위 통합 검증 시점에 재점검.

### Phase 5 — Lineup 서비스 + 액션 ⬜ (3h)

### Phase 6 — Location/ProductionLine/Lineup UI ⬜ (5h)

### Phase 7 — 테스트 (조직 관리 전체) ⬜ (3h)

### Phase 8 — Sprint 6 E2E + QA ⬜ (2h)

### Phase 9 — 사이드바 재구성 (조직 메뉴 추가) ⬜ (2h)

## 🏗️ Sprint 7: 권한 관리 + 사용자 + 초대 (7/8 ~ 7/16, ~42h)

### Phase 1 — User/UserScope 관리 서비스 ⬜ (4h)

### Phase 2 — User 관리 UI + /users/page.tsx ⬜ (4h)

### Phase 3 — PermissionSet 서비스 + 액션 ⬜ (5h)

### Phase 4 — PermissionSet UI + /permission-sets/page.tsx ⬜ (5h)

### Phase 5 — Invitation 서비스 + 액션 ⬜ (5h)

### Phase 6 — Invitation UI + /invitations/page.tsx ⬜ (4h)

### Phase 7 — 사이드바 재구성 (사용자/권한 메뉴 추가) ⬜ (2h)

### Phase 8 — 테스트 (사용자/권한셋/초대) ⬜ (4h)

### Phase 9 — Sprint 7 E2E + QA ⬜ (3h)

## 🏗️ Sprint 8: 대시보드 + 감사로그 + UX 통일 + 최종 QA (7/17 ~ 7/25, ~38h)

### Phase 1 — 메인 대시보드 서비스 ⬜ (4h)

### Phase 2 — 메인 대시보드 UI + /(dashboard)/page.tsx ⬜ (5h)

### Phase 3 — AuditLog 조회 서비스 ⬜ (2h)

### Phase 4 — AuditLog UI + /audit-logs/page.tsx ⬜ (3h)

### Phase 5 — CONVENTIONS.md 최종 점검 ⬜ (3h)

### Phase 6 — UI/UX 통일 ⬜ (4h)

### Phase 7 — AutoGenLog 조회 UI ⬜ (2h)

### Phase 8 — 사이드바 최종 정리 ⬜ (2h)

### Phase 9 — 전체 E2E 풀 플로우 검증 ⬜ (5h)

### Phase 10 — 문서화 + 배포 설정 + 최종 QA ⬜ (4h)

---

## 📚 핵심 문서 연결 / 기준선 / 다음 시작 파일

### 문서 역할
- `PROGRESS.md` — 전체 진행 이력 + 현재 상태 + 남은 작업 (대시보드)
- `docs/progress/SPRINT1.md` — Sprint 1 Phase별 상세 이력
- `docs/progress/SPRINT2.md` — Sprint 2 Phase별 상세 이력 (보강 라운드 포함)
- `docs/progress/SCHEMA_COVERAGE.md` — Prisma 모델별 구현 상태
- `01_개발순서.md` — 전체 실행 순서
- `02_개발문서.md` — 구조 설계와 계층 규칙
- `03_개발가이드문서.md` — 현재 라운드 실행 절차
- `04_전체 구현 체크리스트 및 코드기준안.md` — 검증 기준 / 파일별 TODO / DoD
- `05_불일치 정리 및 통합기준 제안.md` — 공식 변경 이력
- `06_Phase 3. 식단 관리 프로세스.md` — 현재 작업 현황과 실제 단계
- `07_HANDOFF.md` — 다음 작업자 인수인계 패키지

### 현재 개발 기준선
- Sprint 1 완료
- Sprint 2는 Phase 8.5까지 완료
- Sprint 2는 아직 종료되지 않았음 (Phase 9 ~ 11 잔여)
- Sprint 2 원래 계획은 유지

### 다음 시작 파일
1. `prisma/schema.prisma`
2. `prisma/seed.ts`
3. `src/features/meal-plan/schemas/meal-plan.schema.ts`
4. `src/features/meal-plan/services/meal-plan.service.ts`
5. `src/features/meal-plan/actions/meal-plan.action.ts`
6. `src/app/(dashboard)/meal-plans/page.tsx`
7. 관련 테스트 파일