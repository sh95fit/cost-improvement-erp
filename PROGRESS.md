# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> Sprint 1·2 Phase별 상세 이력은 `docs/progress/SPRINT1.md`, `docs/progress/SPRINT2.md` 에 보관한다.
> 모델 구현 현황은 `docs/progress/SCHEMA_COVERAGE.md` 에 보관한다.
> 마지막 갱신: 2026-06-15 (Sprint 3 Phase 1·2·3 완료, Phase 4 UI 착수 대기)

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
- **현재 기준 완료 지점**: Sprint 3 Phase 3 (PO Server Actions) 완료
- **현재 프로젝트 상태**: Sprint 3 Phase 4 (PO UI: 목록 페이지, 폼 다이얼로그, 상태 전이 버튼) 착수 대기
- **현재 블로커**: 없음
- **최근 누적 테스트**: 263 PASS (Sprint 3 Phase 1·2 추가 19 + 24)
- **TypeScript errors**: 0

### Sprint 3 진행 상황

| Phase | 내용 | 상태 | 커밋 |
|-------|------|------|------|
| 사전 | 스키마 보강 + 결정사항 정의 | ✅ | `0ea5c9bd` |
| 1 | PO Zod 스키마 + 마이그레이션 | ✅ | `ce0ffd9a`, `fdc9e215`, `07095a5c`(approved_at 보강) |
| 2 | PO Service Layer | ✅ | `84e59dc2` (19 tests) |
| 3 | PO Server Actions | ✅ | `28b53151` |
| 4-A | PO 목록 페이지 + 검색/필터 | ⬜ | — |
| 4-B | PO 생성/수정 다이얼로그 + 품목 그리드 | ⬜ | — |
| 4-C | PO 상태 전이 버튼 + 취소 사유 입력 | ⬜ | — |
| 5 | ReceivingNote Service + Actions | ⬜ | — |
| 6 | ReceivingNote UI + 자동 RECEIVED 전이 | ⬜ | — |
| 7 | MaterialRequirement → PO 자동 생성 연결 | ⬜ | — |
| 8 | 작업지시서(CookingPlan) Service + UI | ⬜ | — |


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

#### Sprint 2 완료 범위 (요약)
- 기간: 2026-05-13 ~ 2026-06-11
- 핵심 산출물:
  - MealTemplate / MealPlanGroup / MealPlan / MealPlanSlot / MealCount / MealPlanAccessory / Lineup / CompanyMealSlot / Location / ProductionLine / MaterialRequirement 도메인 완성
  - Phase 5-R 구조 재정의 라운드 종결 (slot_type enum 제거, companyMealSlotId 1급 입력 전환)
  - Phase 7-F BOM 적격 가드 + SearchableSelect
  - Phase 8.5 Location/ProductionLine 마스터 + 위치 유형 가드
  - Phase 9-A MaterialRequirement 서비스 (UPSERT/UNDELETE/soft-delete diff, ESTIMATED/FINAL 2단계 산출)
  - Phase 9-B MaterialRequirement UI
  - Phase 9-C-Fix-R1 슬롯 수량 검증을 레시피 그룹 단위로 재설계
  - Phase 9-D-Sym MealPlanSlot 수량 대칭 분리 (estimatedQuantity / finalQuantity)
- 최종 테스트: 239 PASS / 2 skip / 0 fail TypeScript errors 0

> 상세 이력 → `docs/progress/SPRINT2.md`

### 남은 작업
#### Sprint 2 잔여 (Sprint 3로 이관 또는 백로그)

Sprint 2 종결 시점에 미착수 상태로 남은 항목. Sprint 3 진입 시 우선순위 재검토.

- ⬜ Phase 2-e — 부자재-공급업체 연결 UX
- ⬜ Phase 6 — 식단 캘린더 뷰 (독립 가능)
- ⬜ Phase 7-E — BOM 슬롯 totalWeightG 자동 합산 / 캘린더 UI 공용 컴포넌트
- ⬜ Phase 7-G — 단위 환산 가드 (Sprint 3 Phase 1 "자재 단위 v2"에 흡수 검토)
- ⬜ Phase 9-A-4 — MaterialRequirement 서비스 추가 테스트
- ⬜ Phase 9-D-Acc — 부자재 사용처(productionLineId) 지정 + 산출 + 독립 발주 트랙
- ⏳ Phase 9-D-Sym 후속 — `collectGroupSlotQtyIssues` countSource 매개변수 시그니처 열림 (기본 ESTIMATED). IN_PROGRESS→COMPLETED 가드에서 FINAL 호출은 확정식수 분배 정책 도입 시점에 활성화.
- ⬜ Phase 9-E — PO 자동 생성 연결 (Sprint 3 발주 트랙으로 이관)
- ⬜ Phase 10 — 테스트 보강
- ⬜ Phase 10-Lint — 별도 정리 스프린트
  - react-hooks/set-state-in-effect 24건
  - 테스트 파일 no-explicit-any 72건
  - react/no-unescaped-entities 2건
  - no-unused-vars 11건
- ⬜ Phase 11 — 페이지 통합 + 최종 QA

#### 미해결 정리 항목 (라이트 후속)
- `page.tsx`의 `openMealCountEditor` / `closeMealCountEditor` / `handleSaveMealCount` 들여쓰기 정리 (기능 영향 없음, 다음 page.tsx 편집 시 함께 처리)

---

## 🔮 다가오는 결정사항 (Sprint 3 — 발주 산정 / 작업지시서)

본 섹션은 Sprint 3 착수 전 사용자와 합의된 정책 사양을 사전 기록한다.
Sprint 3 Phase 진입 시 각 항목을 별도 결정사항 섹션으로 확장하고 구현한다.

### 1. 자재 단위 관리 v2 (재설계)
- **카테고리는 표시용**: `UnitMaster.category` (WEIGHT/VOLUME/COUNT/PACKAGE) 는 분류 정보로만 사용. 환산 가능 여부의 가드로 쓰지 않는다.
- **포장 단위 신설**: 포(包), 팩, 박스 등을 자재 단위로 1급 취급. `UnitCategory` 에 `PACKAGE` 추가.
- **환산 정책**: 포/팩/KG → g 변환은 `UnitConversion.factor` 로 처리 (예: 1포 = 1000g, factor = 1000). BOM 산출과 발주 산정에서 동일 환산기 사용.
- **공급업체 단가 단위는 UnitMaster FK 강제**: `SupplierItem.supplyUnit` (string) → UnitMaster.code 참조로 변경. 공급업체 등록 단위가 마스터에 없으면 등록/수정 불가 (사전 등록 강제).
- **공급업체 단위 선택 UI**: 무게/부피/수량 카테고리 무관, UnitMaster 전체에서 선택 (운영자가 자유롭게 1포/1팩 등 지정 가능).

### 2. MaterialRequirement 페이지 역할 재정의
- "소요량" 페이지 → **"필요량/작업지시서/발주서 생성 단계"** 로 역할 확장.
- 용어 통일: **"소요량" → "필요량"** (UI 전역).
- 표시 컬럼 확장:
  - 자재 코드 / 자재명
  - 지정 도시락 (레시피 목록)
  - BOM 인분 중량 (g)
  - 필요량 (총 g)
  - 환산 후 발주 단위 수량 (포/팩 등)
- "유니크 자재" → **"중복 사용 자재 수"** (의미 명확화).
- 산출 결과를 기반으로 **공장별 작업지시서(조리 지시서)** 와 **공장별 발주서 초안** 자동 생성.

### 3. 작업지시서 (조리 지시서) 컬럼 정의
- 메뉴 / 식단 / 용기 / 인분(servings) / 식자재 / 포장 단위(공급업체 단위) / **투입량(역환산)** / 총 필요량 / 1인분 BOM 중량
- "투입량" 은 발주 받은 포장 단위 기준 (예: 2.5포). UI 표기는 통일 단위 (g) 와 발주 단위 둘 다 표시.

### 4. 발주 산정 공식
- 변환식: `필요량(g) ÷ 환산계수 → 포장 단위 수량`
- 재고 차감: `발주 수량 = 환산 후 필요량 - 현재 재고(동일 단위)`
- 반올림 정책:
  - 잔여 ≤ 30% → 절사 (버림)
  - 잔여 > 30% → 절상 (올림)
  - 운영자 수동 조정 허용 (DRAFT 단계에서만)

### 5. 발주 라이프사이클
- 상태 흐름: **DRAFT → REGISTERED → MODIFIED → CONFIRMED** (CONFIRMED는 잠금)
- CONFIRMED 이후의 변경 (오배송, 누락, 추가 발주) 은 **별도 "보정 발주"** 로 분리 기록.
- 사유: 원가 추적 정합성 확보, 발주 이력의 immutability 보장.

### 6. 발주/입출고 사이클 키
- 모든 입출고 트랜잭션은 `outboundDate` (출고일/사용일) 를 1급 키로 사용.
- `orderDate` (발주일) 는 보조 키.
- 사유: 식단은 1~2주 선행 작성되고 발주는 더 일찍 나가지만, 사용/비용 인식은 실제 출고일 기준.

### 7. 식단 외 독립 발주 트랙 (소모품)
- 용기, 수저, 청소 용품 등 식단과 연동되지 않는 자재는 **공장이 직접 발주** 하는 별도 트랙.
- `MaterialRequirement` 와 무관, `PurchaseOrder` 만 사용. 사용처리는 동일 ConsumptionItem 모듈로 통합.

### 8. 부자재 사용처 지정 (Phase 9-D-Acc 흡수)
- `MealPlanAccessory.productionLineId` 컬럼 추가.
- PER_MEAL_COUNT 모드: estimated→final 흐름 동일 적용.
- FIXED_QUANTITY 모드: 고정값 그대로 산출.

### 9. 원가/재고 검증식
- 일별 사용량 기반 원가 계산.
- 재고 검증식: **`기초 재고 + 매입 - 기말 재고 = 사용량`**
- 예: 기초 10팩 + 6월 매입 100팩 - 기말 30팩 → 사용 80팩, 비용 = 80팩 × 단가.
- 월말 마감 시 `MonthEnd*` 모델로 스냅샷.

---

## 🧪 Sprint 3 Phase 1 결정사항 (PurchaseOrder 라이프사이클 정책)

### POStatus enum 라벨 매핑 (옵션 A 채택)

기존 schema.prisma의 `POStatus` enum을 그대로 유지하고 운영 라벨을 다음과 같이 매핑한다.
PROGRESS.md 초안에 적힌 `DRAFT→REGISTERED→MODIFIED→CONFIRMED` (옵션 B) 는
다음 사유로 폐기:
- `MODIFIED`는 라이프사이클 상태가 아니라 행동(action) — AuditLog로 추적
- `RECEIVED` 누락 시 "입고완료" 상태를 derived state로 만들어야 하는 부담
- 부분 입고 정책이 enum 단계 분리 없이도 `PurchaseOrderItem.receivedQty`로 충분히 표현됨

| enum 값 | 운영 라벨 | 수정 가능 여부 | 입고 가능 여부 | 비고 |
|---------|-----------|----------------|----------------|------|
| DRAFT | 작성중 | ✅ 자유 | ❌ | 초안 |
| SUBMITTED | 발주등록 | ✅ 자유 | ❌ | 공급업체 통보 전 자유 편집 |
| APPROVED | 발주확정 | ⚠️ 사유 기록 시 허용 | ✅ | 부분 입고 진행 가능 |
| RECEIVED | 입고완료 | ❌ 잠금 | — | 전량 입고 완료, 보정은 별도 트랙 |
| CANCELLED | 취소 | ❌ 잠금 | ❌ | 취소 사유 기록 필수 |

### 라이프사이클 추적 필드

`PurchaseOrder`에 다음 필드 추가 (본 커밋에 스키마 반영):
- `submittedAt` — DRAFT→SUBMITTED 전환 시각
- `approvedAt` (기존) + `approvedByUserId` (신규) — 결재자 추적
- `cancelledAt`, `cancelledByUserId`, `cancelReason` — 취소 추적

### 부분 입고 정책

- 한 PO에 N개 ReceivingNote 생성 가능 (현재 스키마 그대로 지원)
- `PurchaseOrderItem.receivedQty`가 누적되어 `quantity`에 도달하면
  PO 전체를 `APPROVED → RECEIVED`로 자동 전환 (서비스 레이어 가드)
- 일부만 입고된 상태에서 PO 수정은 사유 기록 필수, 이미 입고된 항목 수량은 잠금

### 보정 발주 (별도 트랙)

CONFIRMED/RECEIVED 이후 발견된 오배송·누락은 본 PO를 수정하지 않고 별도 보정 PO 생성.
`PurchaseOrder.note`에 원본 PO 참조 기록. 별도 상태 enum은 도입하지 않음.

---


## ✅ Sprint 3 Phase 2 완료 (PO Service Layer)

**커밋**: `84e59dc2` (2026-06-15)
**변경 파일**:
- `src/features/purchase-order/services/purchase-order.service.ts` (신규, ~250 LOC)
- `src/tests/purchase-order.service.test.ts` (신규, 19 tests)
- `src/tests/mocks/prisma.ts` (purchaseOrder/purchaseOrderItem/receivingNote/receivingNoteItem 모델 추가)

**구현 함수**:
- `getPurchaseOrders(companyId, query)` — 페이지네이션 + 필터 + 정렬
- `getPurchaseOrderById(companyId, id)` — 모든 관계 include
- `createPurchaseOrder(companyId, input)` — `PO-YYYYMMDD-XXX` 자동 채번, totalAmount/totalPrice 자동 계산
- `updatePurchaseOrder(companyId, id, input)` — `PO_LOCKED` 가드 (RECEIVED/CANCELLED 거부)
- `transitionPurchaseOrderStatus(companyId, id, input)` — 라이프사이클 timestamp 자동 기록
- `deletePurchaseOrder(companyId, id)` — DRAFT만 허용

**상태 전이 timestamp 매핑**:
- DRAFT → SUBMITTED: `submittedAt`
- SUBMITTED → DRAFT (회수): `submittedAt = null`
- SUBMITTED → APPROVED: `approvedAt` + `approvedByUserId`
- * → CANCELLED: `cancelledAt` + `cancelledByUserId` + `cancelReason`

**도메인 에러 코드**: `NOT_FOUND` / `PO_LOCKED` / `PO_NOT_DRAFT` / `INVALID_TRANSITION`

**컨벤션 준수**:
- `(companyId, id, input)` 시그니처
- `{ items, pagination: {...} }` 응답
- `throw new Error("CODE")` 에러 패턴
- `mockPrisma` 헬퍼 사용

---

## ✅ Sprint 3 Phase 3 완료 (PO Server Actions)

**커밋**: `28b53151` (2026-06-15)
**변경 파일**:
- `src/features/purchase-order/actions/purchase-order.action.ts` (신규, ~190 LOC)

**구현 Action**:
- `getPurchaseOrdersAction(rawQuery)` — READ 권한
- `getPurchaseOrderByIdAction(id)` — READ 권한
- `createPurchaseOrderAction(rawInput)` — CREATE 권한, `companyId`/`createdByUserId` 세션 강제 주입
- `updatePurchaseOrderAction(id, rawInput)` — UPDATE 권한
- `transitionPurchaseOrderStatusAction(id, rawInput)` — UPDATE 권한, `actorUserId` 세션 강제 주입
- `deletePurchaseOrderAction(id)` — DELETE 권한

**감사 로그 정책**:
- CREATE/DELETE: 전체 객체
- UPDATE: before/after
- 상태 전이: `before={ status }`, `after={ status, *At, *ByUserId, cancelReason }` (라이프사이클 필드만 추적)

**권한 매핑**: `assertPermission(session, "purchase-order", ACTION)`
- 등록 필요 권한 (Sprint 6 PermissionSet seed):
  - `purchase-order:READ`
  - `purchase-order:CREATE`
  - `purchase-order:UPDATE`
  - `purchase-order:DELETE`

**도메인 에러 매핑** (PO_DOMAIN_ERRORS):
- `NOT_FOUND` → "발주서를 찾을 수 없습니다"
- `PO_LOCKED` → "확정 입고 또는 취소된 발주서는 수정할 수 없습니다"
- `PO_NOT_DRAFT` → "작성중 상태의 발주서만 삭제할 수 있습니다. 그 외 상태는 취소 전이를 사용하세요"
- `INVALID_TRANSITION` → "허용되지 않는 상태 전이입니다"

---

## 📋 Sprint 3 Phase 4 작업 범위 (PO UI)

UI 작업 분량이 크므로 3개 sub-phase로 분할.

### Phase 4-A: 목록 페이지 + 검색/필터/페이지네이션

**파일 (예정)**:
- `src/app/(dashboard)/purchase-orders/page.tsx`
- `src/features/purchase-order/components/purchase-order-table.tsx`
- `src/features/purchase-order/components/purchase-order-filters.tsx`
- `src/features/purchase-order/components/purchase-order-status-badge.tsx`

**기능**:
- 목록 테이블: 발주번호, 공급업체, 발주일, 인도일, 상태 배지, 합계 금액, 품목 수
- 필터: 상태(전체/DRAFT/SUBMITTED/APPROVED/RECEIVED/CANCELLED), 공급업체, 발주일 범위, 검색어
- 정렬: 발주일/발주번호/합계 (asc/desc 토글)
- 페이지네이션 (limit 20)
- "신규 발주" 버튼 → Phase 4-B 다이얼로그 호출

### Phase 4-B: 생성/수정 다이얼로그 + 품목 그리드

**파일 (예정)**:
- `src/features/purchase-order/components/purchase-order-form-dialog.tsx`
- `src/features/purchase-order/components/purchase-order-item-rows.tsx`

**기능**:
- 헤더: 공급업체 SearchableSelect, 발주일/인도일 DatePicker, 비고 textarea
- 품목 그리드 (RHF `useFieldArray`):
  - 행: SupplierItemCombobox (선택 시 itemType/materialMasterId/subsidiaryMasterId 자동 채움, 단가 prefill)
  - 수량, 단가 (편집 가능), 합계 (자동)
  - 행 삭제, 행 추가 버튼
- 합계 자동 계산 (footer)
- 잠금 상태(RECEIVED/CANCELLED) 시 read-only

### Phase 4-C: 상태 전이 버튼 + 취소 사유 다이얼로그

**파일 (예정)**:
- `src/features/purchase-order/components/purchase-order-status-actions.tsx`
- `src/features/purchase-order/components/purchase-order-cancel-dialog.tsx`

**기능**:
- 현재 상태 기반 허용 전이 버튼만 표시 (`getNextAllowedStatuses` 활용)
- 라벨 매핑: 발주등록 / 회수 / 발주확정 / 취소
- CANCELLED 전이: 모달로 취소 사유 입력 (필수)
- 전이 성공 시 toast + 페이지 refresh


## 🧪 Sprint 4 Phase 10 결정사항 (ConsumptionItem 처분 유형 정책)

### 처분 유형 enum

| disposition | 의미 | InventoryTransaction | 원가 분류 |
|-------------|------|----------------------|-----------|
| USED | 정상 사용 (식단 투입) | CONSUMPTION (−OUT) | 확정원가 |
| RETURNED | 잔량 재고 환원 | 없음 (애초에 미출고) | — |
| DISPOSED | 폐기 | DISPOSAL (−OUT) | 손실원가 |

### 폐기 사유 enum (DisposalReason)

EXPIRED / DAMAGED / CONTAMINATED / OVER_PREPARED / OTHER

손질손실(TRIMMING_LOSS)은 `BOM.yieldRate`에서 흡수, 폐기에 포함하지 않음
(정상 손실 vs 예외 손실 구분).

### 서비스 레이어 가드

- disposition === USED|RETURNED → disposalReason은 null이어야 함
- disposition === DISPOSED → disposalReason 필수
- disposalReason === OTHER → disposalNote 필수

### 부자재 사용처리 통합

`ConsumptionItem`에 `itemType` + `subsidiaryMasterId` 추가하여 자재·부자재를 단일 모델에서 처리.
Phase 9-D-Acc(부자재 사용처) 결정사항을 본 Phase로 흡수.
- itemType === MATERIAL → materialMasterId 필수
- itemType === SUBSIDIARY → subsidiaryMasterId 필수

### 재고 검증식

기초재고 + ∑PURCHASE − ∑CONSUMPTION(USED) − ∑DISPOSAL(DISPOSED) ± ∑TRANSFER_IN/OUT ± ∑ADJUSTMENT = 기말재고

`InventoryTransaction` 한 테이블에서 `transactionType` GROUP BY로 자연 계산.
StockTake 차이는 ADJUSTMENT 트랜잭션으로 보정.

---

## 🧪 Sprint 4 Phase 10 보조 결정사항 (InventoryLot 부자재 표현 보강)

### 배경

기존 `InventoryLot.materialMasterId`가 NOT NULL이어서 부자재 재고 표현 불가.
입고 시 부자재용 더미 자재를 만들어야 하는 우회가 필요했음 — 스키마 결함으로 판단.

### 변경

- `InventoryLot.materialMasterId` String → String? (nullable 전환)
- `InventoryLot.itemType` 인덱스 추가
- 가드:
  - itemType === MATERIAL → materialMasterId 필수, subsidiaryMasterId null
  - itemType === SUBSIDIARY → subsidiaryMasterId 필수, materialMasterId null

### 마이그레이션 영향

기존 행은 모두 자재이므로 데이터 손실 없음 (NOT NULL → NULL 완화는 안전).

---

## 🧪 Sprint 5 Phase 3 결정사항 (예상/확정/손실 원가 분리 산출)

### 원가 산출 공식

| 원가 종류 | 산출식 | 입력 |
|-----------|--------|------|
| 예상원가 | BOM × MealCount.estimatedCount × 단가 | MaterialRequirement(countSource=ESTIMATED) |
| 확정원가 | ∑ ConsumptionItem(disposition=USED) × Lot 단가 | ConsumptionLotDetail |
| 손실원가 | ∑ ConsumptionItem(disposition=DISPOSED) × Lot 단가 | ConsumptionLotDetail |
| 원가편차 | 확정원가 − 예상원가 | (계산) |
| 손실률 | 손실원가 ÷ (확정원가 + 손실원가) | (계산) |

### CostType enum 매핑

기존 `CostType { ESTIMATED, ORDER_BASED, ACTUAL }` 그대로 사용:
- ESTIMATED → 예상원가
- ORDER_BASED → 발주 시점 확정 단가 기반 (PO 단가 × MR 수량)
- ACTUAL → 확정원가 (USED 기반)
- 손실원가는 별도 enum 값 추가하지 않고 `CostCalculationItem`에서 disposition을 별도 컬럼으로 추적할지 Sprint 5 진입 시 결정.

---

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

## 🧪 Phase 9-C 결정사항 (슬롯 수량 정합성 정책 — 레시피 그룹 단위)

### 배경 — Fix-K1/K2/K3 결함

Fix-K1(commit `1fb666e1`), Fix-K2(`79e545cf`), Fix-H2+K3(`91c5696e`)는
`validateSlotQuantitiesForMealPlan`이 "한 MealPlan의 모든 CONTAINER 슬롯 합계"를
mealCount와 비교하는 구조로 구현되었으나, 다음 두 가지 의미적 오류가 있었다:

1. **검증 의미 오류**: 한 MealPlan의 슬롯들은 서로 다른 메뉴(레시피)를 담음
   (예: 슬롯1=흑미밥, 슬롯2=오리불고기). 이를 합산해서 mealCount와 비교하는 것은
   의미가 없다. 같은 메뉴(같은 recipeId) 단위로 묶어 합산·비교해야 한다.

2. **자재 산출 중복 위험**: 같은 레시피가 슬롯 N개로 나뉘어 모두 quantity=0이면
   fallback이 N번 적용되어 자재 소요량이 N배로 산출되는 잠재 버그.

### Phase 9-C-Fix-R1 채택 정책

- **그룹핑 키**: `recipeId` 단일 (BOM 구분 없음. 추후 케이스 발생 시 BOM 추가 검토)
- **그룹 단위**: MealPlan 안에서 `recipeId`별로 묶음. ProductionLine은 그룹핑에서 제외
  (식단 입력 정합성은 라인 무관, 자재 산출 결과는 자연스럽게 라인별로 분리됨)
- **각 레시피 그룹별 독립 판정**:
  - 그룹의 모든 슬롯 quantity=0 → OK_FALLBACK (그 레시피만 mealCount 전량 1회 적용)
  - 모두 quantity>0, 합계 = mealCount → OK_DISTRIBUTED
  - 모두 quantity>0, 합계 ≠ mealCount → SUM_MISMATCH (차단)
  - 일부만 quantity>0 → PARTIAL_INPUT (차단)
  - recipeId=null 슬롯 → 검증/산출에서 제외
- **자재 산출**: 슬롯 단위 루프 → MealPlan × recipeId 그룹 단위 루프로 재작성.
  그룹당 effectiveCount(슬롯 합계 또는 mealCount)를 BOM에 **1회만** 곱한다.
- **저장 단위**: `MaterialRequirement`의 `(productionLineId, materialMasterId)` 합산 유지
  (스키마/유니크 키 변경 없음)
- **사용자 메시지**: 에러/배지에 레시피명 포함, 위반 레시피별로 배지 N개 표시,
  토스트는 첫 위반 1건 상세 + 외 N건 형식

### 검증 대상 / 제외

| 트랙 | 검증 | 사유 |
|------|------|------|
| CONTAINER 슬롯 (recipeId 있음) | ✅ | 식재료 산출의 본진 |
| CONTAINER 슬롯 (recipeId=null) | 제외 | 검증 키 없음, 산출에서도 자연 제외 |
| DIRECT 슬롯 | 제외 | 이벤트상품_A/B 등으로 슬롯 구분하여 우회 가능 (실용성) |
| MealPlanAccessory | 제외 | 식수 입력 없음. consumptionMode 기반 자동 산출 (Phase 9-D-Acc) |

---

## 🧪 Phase 9-D-Sym 결정사항 (슬롯 수량 대칭 정책)

본 Phase에서 채택한 슬롯 수량 정책은 다음과 같다. 이후 Phase에서 동일 정책을 따른다.

### 슬롯 수량 컬럼 분리
- `MealPlanSlot.quantity` (구) → `MealPlanSlot.estimatedQuantity` (Int, default 0) 로 개명.
- `MealPlanSlot.finalQuantity` (Int?, nullable) 신설.
- 마이그레이션은 기존 `quantity` 값을 `estimatedQuantity` 로 백필, `finalQuantity` 는 NULL 유지.

### 검증 대칭 (estimated ↔ final 동일 fallback 규칙)
- **예상 검증** (CONFIRMED → IN_PROGRESS): `estimatedQuantity` 합계 vs `MealCount.estimatedCount`
- **확정 검증** (IN_PROGRESS → COMPLETED): `finalQuantity` 합계 vs `MealCount.finalCount`
- 각 검증은 `validateSlotQuantitiesForMealPlan` 단일 함수를 공유. 호출부가 어느 컬럼을 quantity로 채워 넘길지 결정.
- 5분기 판정(OK_FALLBACK / OK_DISTRIBUTED / PARTIAL_INPUT / SUM_MISMATCH / MULTI_LINE_REQUIRES_QUANTITY)은 양쪽 모두 동일하게 적용.

### Fallback 규칙
- 슬롯 수량이 모두 0 (final의 경우 0 또는 null) → 그 레시피 그룹은 mealCount 전량 적용 (FALLBACK)
- 단, 같은 recipeId 그룹이 2개 이상의 productionLine 에 걸쳐 있으면 fallback 불가 → MULTI_LINE_REQUIRES_QUANTITY

### 산출 분기 (material-requirement.service)
- `countSource === ESTIMATED` → `estimatedQuantity` 와 `estimatedCount` 사용
- `countSource === FINAL` → `finalQuantity ?? 0` 과 `finalCount` 사용
- 산출 결과는 `MaterialRequirement` 의 `countSource` 컬럼으로 분리 보관 (Phase 9-A 정책 유지).

### UI 정합
- 슬롯 표시 셀: 두 줄 ("예상 N" / "확정 N" or "확정 —")
- 슬롯 편집 모드: estimatedQuantity 입력 (필수, 정수, ≥0) + finalQuantity 입력 (선택, 빈값 = null)
- `checkMealPlanSlotQty(mp, mealCount, countSource)` 파라미터로 어느 컬럼을 검증할지 결정

### 상태 라벨 정책
- `MealPlanStatus.CONFIRMED` 라벨을 "확정" → **"준비중"** 으로 조정.
  - 사유: "확정"이 식수 확정(`finalCount`) 의미와 혼동되어 운영 현장 멘탈 모델과 불일치.
  - enum 값과 DB는 그대로 (`CONFIRMED`), 표시 라벨만 변경.
- 상태 진행: 작성중(DRAFT) → 준비중(CONFIRMED) → 진행중(IN_PROGRESS) → 완료(COMPLETED)

### 후속 메모
- `collectGroupSlotQtyIssues` 는 현재 ESTIMATED 만 검증.
  IN_PROGRESS→COMPLETED 가드에서 확정식수 분배 정책을 도입하는 시점에 countSource="FINAL" 분기 추가 필요.
- 확정식수의 슬롯 분배는 운영 정책이 확정되면 PARTIAL_INPUT/SUM_MISMATCH 적용 여부 재논의.

---

## 🧪 Phase 9-D-Acc 결정사항 (부자재 사용처 지정 — 별도 트랙)

### 배경

`MealPlanAccessory`는 현재 `productionLineId` 컬럼이 없어 "어느 공장에서 사용처리할지"
지정할 수단이 없다. 부자재 산출/사용처리 로직 자체가 미구현 상태로, 식재료(Phase 9-C)와
분리해서 별도 Phase로 다룬다.

### 정책

- **PER_MEAL_COUNT 모드** (식수 비례): MealCount.estimatedCount로 1차 산출 →
  finalCount 입력 시 비교 산출 + 확정수량 사용처리 유도
- **FIXED_QUANTITY 모드** (고정 소모품): fixedQuantity 그대로 사용. 식수 무관
- **공장 지정**: `productionLineId String?` (nullable) 컬럼 추가. 미지정은 "공장 지정 필요" 표시
- **식단 밖 독립 발주**: 식단에 포함하지 않는 소모품은 공장이 직접 발주하는 별도 트랙 제공

### 작업 순서 (Phase 9-C-Fix-R1 완료 후)

1. 9-D-Acc-1: 스키마 변경 + 마이그레이션
2. 9-D-Acc-2: 부자재 다이얼로그에 ProductionLine 선택 UI
3. 9-D-Acc-3: 부자재 산출 로직 (MaterialRequirement 별도 영역 또는 신규 모델)
4. 9-D-Acc-4: 잔존 필드 `quantity Float` 정리
5. 9-D-Acc-5: 독립 발주 트랙 UI

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
- Phase 1 ~ 9-C 완료 (Fix-R1-3~R1-6 적용 완료), Phase 9-D-Sym 착수 예정
- 테스트: 16 files / 219 tests / 2 skipped / 0 failures (Phase 9-D-Sym 후 슬롯 수량 대칭 테스트 보강 예정)
- 최근 커밋 체인: `d09b2e85`(R1-4) → `ee3dfdfe`(R1-4-Cleanup) → `6554362c`(R1-5) → `6762c97d`(R1-6)
- 상세 → `docs/progress/SPRINT2.md`

---

## 🏗️ Sprint 2.5: 단위 관리 중앙화 (6/12, ~6h, 임시 스프린트) ✅

Sprint 3 진입 전 사전 합의된 "자재 단위 관리 v2" 정책을 선반영한 별도 라운드.
공급업체 단위가 자유 텍스트로 분산되어 있어 발주/원가 산출 정합성을 해치는 문제를
선결한 뒤 Sprint 3에 진입하기 위해 분리.

### 정책
- UnitMaster를 단위의 SSOT(Single Source of Truth)로 확립
- 카테고리는 UnitMaster 관리 페이지에서만 의미 있는 분류 (다른 화면에서 카테고리 선택 UI 제거)
- 모든 단위 선택 UI는 카테고리 사전 선택 없이 자유 선택
- 단위 선택 시 unitCategory는 자동 도출

### Phase 10-A — DB 스키마 + 시드 ✅
- UnitCategory enum에 PACKAGE 추가 (포·팩·박스·캔·병·봉·망 등)
- SupplierItem.supplyUnit (string) → supplyUnitId (FK to UnitMaster)
- 마이그레이션 3건 적용
- 시드 데이터 재정비 (8개 패키지 단위 PACKAGE로 재분류)

### Phase 10-B — UnitCombobox 컴포넌트 신설 ✅
- 위치: `src/features/unit-master/components/unit-combobox.tsx`
- cmdk 기반, 한·영·코드 통합 검색, 카테고리별 그룹 헤더
- SupplierItem 폼에 적용

### Phase 10-C — UnitConversion 자동화 ✅
- 카테고리 Select UI 제거
- from/to Unit 자유 선택, unitCategory 자동 도출
- excludeValue로 동일 단위 선택 차단
- PACKAGE 카테고리 라벨 정상 표시

### Phase 10-D — Material/Subsidiary 폼 ✅
- 카테고리 + 단위 2단계 UI 제거 → UnitCombobox 단일 컴포넌트로 통합
- unitCategory state는 자동 도출용으로 유지 (서버 전송)

### Phase 10-E — Detail dialog 단위 표시 정리 ✅
- "중량 / kg" 2단 표기 → "kg (중량)" 단위 우선 표기

### Phase 10-F — 데드코드/타입 정리 ⏸ (보류, Phase 10-H로 분리)
- supplier-item-form.tsx 잔여 데드코드 (UnitOption type, UNIT_CATEGORY_LABELS,
  getUnitOptionsAction, groupedUnits 등)
- material-list.tsx, subsidiary-list.tsx의 defaultSupplierItem.supplyUnit
  타입을 string → 객체 형태로 정정
- npm run lint: 103 errors / 18 warnings 일괄 처리
- SupplierItemRow 타입 공용 추출 (5개 파일에서 중복 정의)

### 최종 상태 (10-F 제외)
- TypeScript errors: 0
- 테스트: 239 passed / 2 skipped / 0 failures
- 검증 위치: supplier-item-form, unit-conversion-form, material-form,
            subsidiary-form, material-detail-panel, subsidiary-detail-panel

### 후속 (Sprint 3 진입 시 반영될 정책)
- Sprint 3 Phase 1에서 `필요량(g) ÷ supplyUnit 환산계수 → 발주 단위 수량` 변환에
  본 단위 체계 그대로 사용
- BOMItem.unit (string)도 향후 UnitMaster FK 전환 검토 (Phase 10-H 또는 Sprint 3 이후)

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