# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> 마지막 갱신: 2026-06-04 (Phase 7-D 다이얼로그 유지 + 자재 셀렉트 회귀 해소 + Phase 7-F BOM 적격 가드 완료)

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
| 6 | **PROGRESS.md 갱신 → 다음 단계** | 본 문서의 해당 Phase 상태를 ✅로 변경, 변경사항·이슈 기록 후 다음 Phase 진행 | 문서 커밋 완료 |

---

## 📍 현재 상태 요약 / 완료 범위 / 남은 작업 / 보류 범위 / handoff 기준

### 현재 상태 요약
- **현재 기준 완료 지점**: Sprint 2 / Phase 7-D + 7-F 완료 (다이얼로그 유지·자재 셀렉트 회귀 해소·레시피×용기 BOM 적격 가드 + UI 적격 필터)
- **현재 프로젝트 상태**: Sprint 2 재개 진행 중 — Phase 2-e → 6 → **7 (진행 중, 7-E 또는 8 다음 착수)** → 8 → 9 → 10 → 11
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

### 남은 작업
#### Sprint 2 기존 미완료 작업
- Phase 2-e — 부자재-공급업체 연결 UX (대기)
- Phase 6 — 식단 캘린더 뷰 (대기 / 독립 가능)
- **Phase 7 — 슬롯 상세 에디터 (다음 착수, Step 7-A부터)**
- Phase 8 — MealCount(✅ 기본 완료) + MealPlanAccessory(미착수) 서비스/UI
- Phase 9 — 소요량 자동 산출 서비스
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
1. `PROGRESS.md`
2. `01_개발순서.md`
3. `02_개발문서.md`
4. `03_개발가이드문서.md`
5. `04_전체 구현 체크리스트 및 코드기준안.md`
6. `05_불일치 정리 및 통합기준 제안.md`
7. `06_Phase 3. 식단 관리 프로세스.md`
8. `07_HANDOFF.md`

### 현재 구조 재정의 공식 판단
- `MealPlanGroup`는 날짜 중심 그룹으로 단순화한다
- `MealPlan`은 식사타입 × lineup 조합으로 재정의한다
- `MealPlanSlot`은 실제 실행 배정 단위로 확장한다
- `MealCount`는 상태가 아니라 데이터 입력값으로 유지한다
- `MaterialRequirement` / `CookingPlan` / 자동생성 연결의 기준 입력은 `MealPlanSlot`으로 정렬한다

---

## 📋 Prisma 스키마 모델 커버리지 (68모델 + UnitMaster)

> 아래 표는 schema.prisma v4의 모델이 어느 Sprint의 어느 Phase에서 구현되는지를 추적한다.
> 기존 Sprint 계획과 Phase 매핑은 삭제하지 않는다.
> MealPlanGroup / MealPlan / MealPlanSlot은 기본 구현 완료 상태를 유지하되, Sprint 2 내부 구조 재정의 보강 작업 대상임을 함께 표시한다.

| # | 모델 | Sprint | Phase | 상태 |
|---|------|--------|-------|------|
| 1 | Company | S6 | P1 | ⬜ |
| 2 | Location | S6 | P3 | ⬜ |
| 3 | ProductionLine | S6 | P4 | ⬜ |
| 4 | User | S7 | P1-2 | ⬜ |
| 5 | UserScope | S7 | P1-2 | ⬜ |
| 6 | PermissionSet | S7 | P3-4 | ⬜ |
| 7 | PermissionSetItem | S7 | P3-4 | ⬜ |
| 8 | Invitation | S7 | P5-6 | ⬜ |
| 9 | MaterialMaster | 구현완료 | — | ✅ |
| 10 | SubsidiaryMaster | 구현완료 | — | ✅ |
| 11 | Supplier | 구현완료 | — | ✅ |
| 12 | SupplierItem | 구현완료 | — | ✅ |
| 13 | SupplierItemPriceHistory | 구현완료 | — | ✅ |
| 14 | ~~ContainerGroup~~ | 구현완료 | — | ✅ (v5: SubsidiaryMaster에 흡수, 모델 삭제) |
| 15 | ContainerSlot | 구현완료 | — | ✅ |
| 16 | ~~ContainerAccessory~~ | 구현완료 | — | ✅ (v5: MealTemplateAccessory로 대체, 모델 삭제) |
| 17 | Recipe | 구현완료 | — | ✅ |
| 18 | RecipeIngredient | 구현완료 | — | ✅ |
| 19 | RecipeBOM | 구현완료 | — | ✅ |
| 20 | RecipeBOMSlot | 구현완료 | — | ✅ |
| 21 | RecipeBOMSlotItem | 구현완료 | — | ✅ |
| 22 | SemiProduct | 구현완료 | — | ✅ |
| 23 | BOM | 구현완료 | — | ✅ |
| 24 | BOMItem | 구현완료 | — | ✅ |
| 25 | UnitConversion | 구현완료 | — | ✅ |
| 26 | UnitMaster | 구현완료 | S1-P3 | ✅ |
| 27 | MealTemplate | S2 | P1-2 | ✅ |
| 28 | MealTemplateContainer | S2 | P1-2 | ✅ (v5: MealTemplateSlot 폐지) |
| 29 | MealTemplateAccessory | S2 | P1-2 | ✅ |
| 30 | MealPlanGroup | S2 | P3-4 / 5-R | ✅ (Phase 5-R 완료: 날짜 그룹 단순화) |
| 31 | MealPlan | S2 | P3-4 / 5-R | ✅ (Phase 5-R 완료: 식사타입 × lineup, companyMealSlotId 단일 키) |
| 32 | MealPlanSlot | S2 | P3-4 / 5-R / 7-A~F | ✅ schema·service·action·UI 완료 (Phase 7-F까지: 슬롯 에디터 + BOM 적격 가드 + 적격 레시피 필터) |
| 33 | MealCount | S2 | P8 / 5-R | ✅ schema·service·action·UI 완료 (Step 6-3c-A2, MealPlan 1:1) |
| 34 | MealPlanAccessory | S2 | P8 | ⬜ |
| 35 | Lineup | S6 | P5 | ⬜ |
| 36 | LineupLocationMap | S6 | P5 | ⬜ |
| 37 | AutoGenLog | S8 | P7 | ⬜ |
| 38 | MaterialRequirement | S2 | P9 | ⬜ |
| 39 | PurchaseOrder | S3 | P1-4 | ⬜ |
| 40 | PurchaseOrderItem | S3 | P1-4 | ⬜ |
| 41 | ReceivingNote | S3 | P5-8 | ⬜ |
| 42 | ReceivingNoteItem | S3 | P5-8 | ⬜ |
| 43 | InventoryLot | S4 | P1-2 | ⬜ |
| 44 | InventoryTransaction | S4 | P1-2 | ⬜ |
| 45 | InventoryReservation | S4 | P3 | ⬜ |
| 46 | InventoryTransfer | S4 | P4-5 | ⬜ |
| 47 | InventoryTransferItem | S4 | P4-5 | ⬜ |
| 48 | StockTake | S4 | P6-7 | ⬜ |
| 49 | StockTakeItem | S4 | P6-7 | ⬜ |
| 50 | ShippingOrder | S4 | P8-9 | ⬜ |
| 51 | ShippingOrderItem | S4 | P8-9 | ⬜ |
| 52 | ConsumptionItem | S4 | P10-11 | ⬜ |
| 53 | ConsumptionLotDetail | S4 | P10-11 | ⬜ |
| 54 | CookingPlan | S4 | P12-13 | ⬜ |
| 55 | CookingPlanItem | S4 | P12-13 | ⬜ |
| 56 | CookingPlanSlot | S4 | P12-13 | ⬜ |
| 57 | CostSnapshot | S5 | P1-2 | ⬜ |
| 58 | CostSnapshotItem | S5 | P1-2 | ⬜ |
| 59 | CostCalculation | S5 | P3-4 | ⬜ |
| 60 | CostCalculationItem | S5 | P3-4 | ⬜ |
| 61 | OverheadCost | S5 | P5-6 | ⬜ |
| 62 | MonthEndSnapshot | S5 | P7-8 | ⬜ |
| 63 | MonthEndAdjustment | S5 | P7-8 | ⬜ |
| 64 | MonthEndAdjustmentItem | S5 | P7-8 | ⬜ |
| 65 | NotificationTagDef | S5 | P9-10 | ⬜ |
| 66 | NotificationRule | S5 | P9-10 | ⬜ |
| 67 | NotificationTemplate | S5 | P9-10 | ⬜ |
| 68 | NotificationLog | S5 | P9-10 | ⬜ |
| 69 | AuditLog | S8 | P3-4 | ⬜ |

---

## 🏗️ Sprint 1: 안정화 + 품질 기반 확보 (5/4 ~ 5/12)

> ⚠️ 일정 변경: 기존 5/4~5/9 → 5/4~5/12 (Phase 2에서 이슈 7건 발견, +9h 추가 소요)
> 총 예상 공수: 28.5h → **37.5h**

### Phase 1 — Sonner toast 인프라 + 2파일 적용 ✅
- **날짜**: 2026-05-04
- **커밋**: `1a20d50`
- **변경 파일**: `package.json`, `src/components/ui/sonner.tsx` (신규), `src/app/layout.tsx`, `src/features/recipe/components/recipe-detail-dialog.tsx`, `src/app/(dashboard)/containers/page.tsx`
- **변경 내용**: sonner 설치, Toaster 마운트, recipe-detail-dialog와 containers에서 errorMessage→toast.error 전환, console.log→logger 교체
- **계획 대비 변경**: 없음 (계획대로 완료)
- **발견된 이슈**: push 시 브랜치명 불일치 → main으로 직접 push로 해결

### Phase 2 — E2E 검증 + BOM 편집 이슈 재현 ✅
- **날짜**: 2026-05-06
- **예상 시간**: 1.5h → **실제 시간: 2h**
- **검증 항목**:
  - [x] 레시피 상세 다이얼로그 열기 → 식자재·반제품·용기 그룹 옵션 로드 확인
  - [x] 재료 추가/삭제 → toast 성공/실패 메시지 확인
  - [x] BOM 생성 → 슬롯 복수 추가 → 각 슬롯에 구성재료 자동 할당 확인
  - [x] 슬롯 삭제 → 삭제 확인 다이얼로그 → toast 확인
  - [x] BOM 확정 (ACTIVE) 후 → 편집 UI 모두 사라지는 것 재현 확인
  - [x] 용기 관리 페이지 CRUD → toast 확인
- **발견된 이슈** (7건):
  1. 🔴 **단위 자유입력** — UnitCategory 기반 Select Box로 변경 필요
  2. 🔴 **용기 삭제 의존성 미검증** — FK 체크 없음 → 의존성 확인 + UI 경고 필요
  3. 🟡 **재료 추가 모달 즉시 닫힘** — 연속 추가 모드 + "완료" 버튼 필요
  4. 🟡 **Select Box 불편** — cmdk 기반 combobox 전환 필요
  5. 🔴 **BOM 등록 후 수정 불가** — 복제+편집 기능 구현 필요
  6. 🟡 **슬롯 이름 미표시** — ContainerSlot 실제 라벨 표시 필요
  7. 🟢 **레시피 기본정보에 용기/슬롯 요약 없음** — 배식 구성 섹션 추가 필요

### Phase 3 — 단위 관리 중앙화 (Unit Select Box → DB 기반 완전 전환) ✅
- **날짜**: 2026-05-06 ~ 2026-05-07
- **예상 시간**: 2.5h → **실제 시간: ~8h** (3단계에 걸쳐 진행)
- **커밋 이력**:
  - `2c14eb9` (05-06) — Phase 3 초기: `UNIT_OPTIONS` 상수 분리, material-form 2단계 Select Box
  - `b565f25` (05-07) — MaterialType 정리 (RAW/OTHER), 자재·부자재 UI를 Dialog 모달로 통일
  - `43b95ae` (05-07) — UnitMaster 모델+서비스+액션+UI, DB 기반 단위 Select, 시드 30개
  - `5d777aa` (05-07) — 단위 관리 독립 페이지(/units), 단위환산 DB Select 전환, unitCategory 수정 지원
- **변경 파일** (총 18개, 마지막 커밋 기준 8개):
  - `src/app/(dashboard)/units/page.tsx` — 신규: 단위 관리 독립 페이지
  - `src/app/(dashboard)/materials/page.tsx` — "단위 관리" 탭 제거, 2탭 구조
  - `src/app/(dashboard)/subsidiaries/page.tsx` — "단위 관리" 탭 제거, 2탭 구조
  - `src/components/layout/sidebar.tsx` — "단위 관리" 메뉴 추가 (Ruler 아이콘)
  - `src/features/unit-master/schemas/unit-master.schema.ts` — updateSchema에 unitCategory 추가
  - `src/features/unit-master/actions/unit-master.action.ts` — `getUnitOptionsForConversionAction` 추가
  - `src/features/unit-master/components/unit-master-list.tsx` — 약어→코드 자동 반영, 수정 시 unitCategory 변경, sortOrder 설명
  - `src/features/unit-conversion/components/unit-conversion-form.tsx` — fromUnit/toUnit 자유입력→DB Select 전환
- **완료 항목**:
  - [x] `/units` 단독 단위 관리 페이지 생성 (자재/부자재 탭)
  - [x] 사이드바에 "단위 관리" 메뉴 추가
  - [x] 자재/부자재 페이지에서 "단위 관리" 탭 제거 (중앙화)
  - [x] UnitMaster Prisma 모델 + migration + 시드 30개 (자재 20 + 부자재 10)
  - [x] UnitMaster 서비스 (CRUD, 사용중 삭제 방지, 시스템 단위 보호)
  - [x] UnitMaster 액션 (목록 조회, Select 옵션 조회, 생성, 수정, 삭제)
  - [x] UnitMaster UI (카테고리별 그룹 테이블, 등록/수정/삭제 다이얼로그)
  - [x] 단위 등록: 약어 입력 = 코드 자동 반영 (별도 코드 필드 제거)
  - [x] 단위 수정: unitCategory(중량/용량/수량/길이) 변경 가능
  - [x] sortOrder 용도 명시 (Select Box 표시 순서)
  - [x] 자재 등록/수정 Form: DB 기반 단위 Select (getUnitOptionsAction)
  - [x] 부자재 등록/수정 Form: DB 기반 단위 Select
  - [x] 단위환산 Form: fromUnit/toUnit 자유입력 → DB 등록 단위 기반 Select 전환
  - [x] 단위환산: unitCategory별 필터링으로 등록 단위 범위 제한
  - [x] 미등록 분류 선택 시 "단위 관리에서 등록하기" 안내 링크 표시
  - [x] MaterialType enum 정리 (SEASONING/PROCESSED 제거 → RAW/OTHER만)
  - [x] 자재·부자재 UI Dialog 모달 통일 (Sheet→Dialog)
  - [x] TypeScript 오류 0건 확인 (`npx tsc --noEmit`)
  - [x] 동작 테스트 완료 (UI 전 항목 정상)
- **해소된 이슈**:
  - Issue #1 (단위 자유입력) → DB 중앙 관리로 완전 해소
  - Issue #4 (Select Box 사용성) → 중앙 단위 관리 + 단위환산 Select 전환으로 부분 해소
- **아키텍처 결정**:
  - 단위 코드 = 약어 그대로 사용 (kg, EA, 개 등). 순번 자동채번(UNIT-001) 불필요
  - 약어 입력 시 공백 제거 후 코드로 자동 반영
  - 단위 관리는 `/units` 독립 페이지에서 중앙 관리, 타 페이지에서는 참조만
  - `sortOrder`는 Select Box 표시 순서 (숫자 작을수록 먼저)
  - `isSystem` 플래그로 시드 기본 단위 삭제 방지
  - 단위환산 fromUnit/toUnit은 해당 itemType의 UnitMaster에서만 선택 가능

### Phase 4 — Container 삭제 의존성 검증 + UI 경고 ✅
- **날짜**: 2026-05-07
- **커밋**: `f99e81e`
- **변경 파일**: 3개 (+193 / -13)
  - `src/features/container/services/container.service.ts` — `checkContainerGroupDependency` (MealTemplate + RecipeBOMSlot count), `checkContainerSlotDependency` (slotIndex 기반 RecipeBOMSlot count), `deleteContainerGroup`에 의존성 체크 삽입, `deleteContainerSlot`에 의존성 체크 삽입
  - `src/features/container/actions/container.action.ts` — `DEPENDENCY:` 에러 파싱 + `actionFail("DEPENDENCY", ...)`, `checkContainerGroupDependencyAction` 신규 액션, `deleteContainerSlotAction`에도 DEPENDENCY 처리
  - `src/app/(dashboard)/containers/page.tsx` — `checkContainerGroupDependencyAction` import, `dependencyMessage` 상태 추가, `handleRequestDeleteGroup` 사전 확인, 삭제 모달 "삭제 불가"/"삭제 확인" 분기, 의존성 있으면 사용처 표시 + 삭제 버튼 숨김
- **완료 항목**:
  - [x] ContainerGroup 삭제 전 MealTemplate 참조 확인
  - [x] ContainerGroup 삭제 전 RecipeBOMSlot 참조 확인
  - [x] ContainerSlot 삭제 전 RecipeBOMSlot(containerGroupId + slotIndex) 참조 확인
  - [x] DEPENDENCY 에러 코드로 구체적 사용처 메시지 전달
  - [x] UI: 삭제 전 의존성 사전 확인 → "삭제 불가" 모달로 전환
  - [x] UI: 의존성 있는 경우 삭제 버튼 숨김, 사용처 정보 표시
  - [x] TypeScript 오류 0건 확인
- **해소된 이슈**: Issue #2 (용기 삭제 의존성 미검증) → ✅ 완전 해소

### Phase 5 — duplicateRecipeBOM 서비스 + 액션 구현 ✅
- **날짜**: 2026-05-07
- **커밋**: `01e82a3`
- **변경 파일**: 2개 (+124 / -0)
  - `src/features/recipe/services/recipe-bom.service.ts` — `duplicateRecipeBOM` 함수 추가 (트랜잭션으로 BOM + 슬롯 + 슬롯 아이템 전체 복사, 자동 버전 채번, DRAFT 상태)
  - `src/features/recipe/actions/recipe.action.ts` — `duplicateRecipeBOMAction` 추가 (권한 확인, 감사 로그, 에러 처리)
- **완료 항목**:
  - [x] `duplicateRecipeBOM` 서비스: 원본 BOM 전체 조회 → 트랜잭션 내에서 RecipeBOM + RecipeBOMSlot + RecipeBOMSlotItem 복사
  - [x] 다음 버전 번호 자동 채번 (`getNextRecipeBOMVersion`)
  - [x] 복제된 BOM은 항상 DRAFT, activatedAt=null
  - [x] `duplicateRecipeBOMAction`: 권한(recipe:CREATE), 감사 로그 (duplicatedFrom 기록), 에러 처리
  - [x] TypeScript 오류 0건 확인
- **부분 해소된 이슈**: Issue #5 (BOM 등록 후 수정 불가) → 서비스/액션 계층 완료. UI 연동은 Phase 6에서 진행

### Phase 6 — BOM UI 완전 보강 ✅
- **날짜**: 2026-05-07
- **커밋**: `768aa71` (Phase 6), `aaa76cc` (Phase 6-b 보완)
- **변경 파일**: 2개 커밋 합산
  - `src/app/(dashboard)/recipes/page.tsx` → 내부 `recipe-detail-dialog.tsx` — BOM 복제/보관 버튼, baseWeightG·슬롯 인라인 편집, 슬롯별 재료 추가, ContainerSlot 라벨 표시, 배식 구성 섹션, 연속추가 모드 + Combobox 전환
  - `src/features/recipe/actions/recipe.action.ts` — `updateRecipeBOMBaseWeightAction`에 `buildRecipeBOMSnapshot` 호출 추가 (before 스냅샷 감사 로그)
- **완료 항목**:
  - [x] ACTIVE BOM "보관" 버튼 (`updateRecipeBOMStatusAction` 연동)
  - [x] 모든 상태 BOM에 "복제해서 새 버전" 버튼 (`duplicateRecipeBOMAction` 연동)
  - [x] DRAFT BOM baseWeightG 인라인 편집
  - [x] 슬롯 인라인 편집 (totalWeightG, note)
  - [x] 슬롯별 "재료 추가" 버튼
  - [x] 슬롯 이름에 ContainerSlot 실제 라벨 표시 (이슈 #6 해소)
  - [x] 레시피 기본정보 탭에 "배식 구성" 섹션 추가 (이슈 #7 해소)
  - [x] 재료 추가 연속 모드 + combobox 전환 (이슈 #3, #4 해소)
  - [x] ACTIVE BOM 중량/메모 편집 허용 + before 스냅샷 감사 로그 (Phase 6-b)
  - [x] TypeScript 오류 0건 확인
- **BOM 편집 정책 요약**:
  - ACTIVE BOM — 중량/메모 편집 가능, 스냅샷 감사 로그 기록
  - DRAFT BOM — 중량/메모 편집 + 슬롯 추가/삭제 가능
  - ARCHIVED BOM — 읽기 전용
  - 버전 관리: 복제 → DRAFT 편집 → ACTIVE 확정
- **해소된 이슈**:
  - Issue #3 (재료 추가 모달 즉시 닫힘) → ✅ 연속 추가 모드로 해소
  - Issue #4 (Select Box 불편) → ✅ Combobox 전환으로 해소
  - Issue #5 (BOM 등록 후 수정 불가) → ✅ 복제+편집 UI 완성으로 완전 해소
  - Issue #6 (슬롯 이름 미표시) → ✅ ContainerSlot 라벨 표시로 해소
  - Issue #7 (배식 구성 요약 없음) → ✅ 배식 구성 섹션 추가로 해소

### Phase 7 — container.service.test.ts 작성 ✅
- **날짜**: 2026-05-08
- **커밋**: `e14490a`
- **변경 파일**: 3개
  - `package.json` — `"test": "vitest run"`, `"test:watch": "vitest"` 스크립트 추가
  - `src/tests/mocks/prisma.ts` — `containerSlot`, `containerAccessory`, `mealTemplate` 모델 mock 추가
  - `src/tests/container.service.test.ts` — 신규 파일, 30개 테스트 케이스
- **완료 항목**:
  - [x] package.json에 test 스크립트 추가
  - [x] 공통 Prisma mock에 누락 모델 3개 추가
  - [x] ContainerGroup CRUD 테스트 (getContainerGroups pagination·search, getById, create auto-code, update, delete soft-delete + NOT_FOUND)
  - [x] ContainerGroup 삭제 의존성 차단 테스트 (MealTemplate, RecipeBOMSlot, 복합 의존)
  - [x] ContainerSlot CRUD 테스트 (add auto-index, null volumeMl, update, delete + dependency check)
  - [x] checkContainerGroupDependency / checkContainerSlotDependency 테스트
  - [x] ContainerAccessory add/update/delete 테스트
  - [x] 전체 9개 테스트 파일, 135개 테스트 PASS 확인
- **테스트 실행 결과**: 9 files | 135 tests | 0 failed

### Phase 8 — Toast 확대: material + subsidiary (6개 컴포넌트) ✅ (스킵)
- **날짜**: 2026-05-08
- **상태**: 검증 결과 6개 파일 모두 이미 toast import 및 toast.success/error 적용 완료 → 별도 작업 불필요
- **검증 내역**:
  - material-list.tsx: toast import ✅, 삭제 성공 toast.success ✅, 삭제 실패 toast.error ✅
  - material-form.tsx: toast import ✅, 등록/수정 성공 toast.success ✅
  - material-detail-panel.tsx: toast import ✅, 기본 공급업체 설정/해제 toast.success ✅
  - subsidiary-list.tsx: toast import ✅, 삭제 성공 toast.success ✅, 삭제 실패 toast.error ✅
  - subsidiary-form.tsx: toast import ✅, 등록/수정 성공 toast.success ✅
  - subsidiary-detail-panel.tsx: toast import ✅, 기본 공급업체 설정/해제 toast.success ✅

### Phase 9 — Toast 확대: supplier (4개 컴포넌트) ✅
- **날짜**: 2026-05-08
- **커밋**: `98e438e`
- **변경 파일**: 5개
  - `src/features/supplier/components/supplier-list.tsx` — toast import + 삭제 성공/실패 + fetch 실패 toast
  - `src/features/supplier/components/supplier-form.tsx` — toast import + 등록/수정 성공/실패 toast
  - `src/features/supplier/components/supplier-item-list.tsx` — toast import + 삭제 성공/실패 + fetch 실패 toast
  - `src/features/supplier/components/supplier-item-form.tsx` — toast import + 등록/수정 성공/실패 toast + 한글 깨짐 복원
  - `PROGRESS.md` — Phase 6~8 완료 반영
- **완료 항목**:
  - [x] supplier-list: 삭제 성공 toast.success, 삭제 실패 toast.error, fetch 실패 toast.error
  - [x] supplier-form: 등록/수정 성공 toast.success (분기 메시지), 실패 toast.error
  - [x] supplier-item-list: 삭제 성공 toast.success, 삭제 실패 toast.error, fetch 실패 toast.error
  - [x] supplier-item-form: 등록/수정 성공 toast.success (분기 메시지), 실패 toast.error, 한글 복원
  - [x] TypeScript 오류 0건, 기존 135 테스트 PASS 유지

### Phase 10 — Toast 확대: recipe + semi-product (5개 컴포넌트) ✅
- **날짜**: 2026-05-08
- **커밋**: `1109e4f` (코드), `b0c3f99` (docs)
- **대상 파일**: 5개 + PROGRESS.md
  - `src/features/recipe/components/recipe-list.tsx`
  - `src/features/recipe/components/recipe-form.tsx`
  - `src/features/recipe/components/semi-product-list.tsx`
  - `src/features/recipe/components/semi-product-form.tsx`
  - `src/features/recipe/components/semi-product-detail-dialog.tsx`
- **레포 검증 결과** (Phase 9 검증 시 확인):
  - recipe-detail-dialog.tsx: 이미 toast 적용 완료 ✅ → 제외
  - unit-conversion-list.tsx: 이미 toast 적용 완료 ✅ → 제외
  - unit-conversion-form.tsx: 이미 toast 적용 완료 ✅ → 제외
  - unit-master-list.tsx: 이미 toast 적용 완료 ✅ → 제외
  - containers/page.tsx: 이미 toast 적용 완료 ✅ → 제외
  - **미적용 5개 파일만 작업 대상으로 확정**
- **작업**:
  - [x] recipe-list.tsx: `import { toast } from "sonner"` + 삭제 성공 `toast.success("레시피가 삭제되었습니다")`, 삭제 실패 `toast.error(...)`, fetch 실패 `toast.error("목록을 불러오는데 실패했습니다")`
  - [x] recipe-form.tsx: toast import + 등록 성공 `toast.success("레시피가 등록되었습니다")`, 수정 성공 `toast.success("레시피가 수정되었습니다")`, 실패 `toast.error(...)`
  - [x] semi-product-list.tsx: toast import + 삭제 성공 `toast.success("반제품이 삭제되었습니다")`, 삭제 실패 `toast.error(...)`, fetch 실패 `toast.error("목록을 불러오는데 실패했습니다")`
  - [x] semi-product-form.tsx: toast import + 등록 성공 `toast.success("반제품이 등록되었습니다")`, 수정 성공 `toast.success("반제품이 수정되었습니다")`, 실패 `toast.error(...)`
  - [x] semi-product-detail-dialog.tsx: toast import + BOM 생성/상태변경/삭제 성공·실패 toast, 아이템 추가/수량수정/삭제 성공·실패 toast (기존 `setErrorMessage` 패턴은 인라인 에러로 유지하되 toast 병행)
  - [x] PROGRESS.md Phase 10 ✅ 마킹
- **패턴**: supplier 4개 파일과 동일 (success → toast.success, error → toast.error)
- **검증**: `npx tsc --noEmit` + `npx vitest run` (135+ tests PASS)
- **Toast 적용 합계**: success 10건, error 22건 (총 32건)
- **TypeScript errors**: 0
- **Tests**: 135건 PASS

### Phase 11 — CONVENTIONS.md 전수 점검 ✅
- **날짜**: 2026-05-08
- **커밋**: `90bfee6` (테스트 추가), `770ff4a` (any 제거 포함)
- **예상 시간**: 3h → **실제 시간: ~1.5h**
- **변경 파일**: 4개
  - `src/tests/mocks/prisma.ts` — `supplier`, `unitMaster` 모델 mock 추가 + `prismaMock` alias export
  - `src/tests/supplier.service.test.ts` — **신규**: 12 tests (getSuppliers pagination·search, getSupplierById, createSupplier 코드채번, updateSupplier, deleteSupplier soft-delete)
  - `src/tests/unit-master.service.test.ts` — **신규**: 11 tests (getUnitMasters pagination·filter, getUnitMasterById, createUnitMaster, updateUnitMaster, deleteUnitMaster NOT_FOUND/SYSTEM/IN_USE, getUnitOptionsByItemType)
  - `src/features/unit-conversion/services/unit-conversion.service.ts` — `const where: any` → `const where: Prisma.UnitConversionWhereInput` (any 타입 제거)
- **CONVENTIONS 12개 규칙 점검 결과**:
  - [x] ① `any` 타입 금지 — 1건 위반 → `Prisma.UnitConversionWhereInput`으로 수정 완료, **0건**
  - [x] ② 클라이언트 직접 DB 접근 금지 — PASS (전 컴포넌트 server action 경유)
  - [x] ③ 환경변수 하드코딩 금지 — PASS (`process.env.*` 사용, 하드코딩 0건)
  - [x] ④ `console.log` 금지 — PASS (`logger.ts` 중앙화, 직접 console 호출 0건)
  - [x] ⑤ `NextResponse.json()` 금지 — PASS (`ok()`/`fail()` 헬퍼 사용)
  - [x] ⑥ `deletedAt: null` 누락 금지 — PASS (soft-delete extension 10개 모델 자동 적용)
  - [x] ⑦ 다중 쓰기 시 트랜잭션 — PASS (`duplicateRecipeBOM` 등 `$transaction` 사용)
  - [x] ⑧ 권한 체크 필수 — PASS (모든 action에 `assertPermission`)
  - [x] ⑨ 감사 로그 필수 — PASS (CREATE/UPDATE/DELETE action에 `createAuditLog`)
  - [x] ⑩ 테스트 없이 머지 금지 — 2건 위반 → `supplier.service.test.ts`, `unit-master.service.test.ts` 신규 작성 완료, **11서비스:11테스트 1:1 매핑**
  - [x] ⑪ PROGRESS.md 갱신 필수 — 본 커밋으로 완료
  - [x] ⑫ 6단계 프로세스 준수 — PASS
- **서비스 ↔ 테스트 매핑** (규칙 ⑩ 완전 충족):
  - material.service → material.service.test ✅
  - subsidiary.service → subsidiary.service.test ✅
  - supplier.service → supplier.service.test ✅ **신규**
  - supplier-item.service → supplier-item.service.test ✅
  - unit-master.service → unit-master.service.test ✅ **신규**
  - unit-conversion.service → unit-conversion.service.test ✅
  - recipe.service → recipe.service.test ✅
  - recipe-bom.service → recipe-bom.service.test ✅
  - bom.service → bom.service.test ✅
  - semi-product.service → semi-product.service.test ✅
  - container.service → container.service.test ✅
- **TypeScript errors**: 0 (기존 3건 → 0건)
- **Tests**: 11 files | **158 tests** PASS (기존 135 → +23)

### Phase 12 — recipe.action.ts 4파일 분리 + handleActionError 공통 헬퍼 ✅
- **날짜**: 2026-05-12
- **커밋**: `f82ec4f6`
- **예상 시간**: 4h → **실제 시간: ~2h**
- **변경 파일**: 14개 (신규 5 + 수정 9)
  - `src/lib/action-helpers.ts` — **신규**: handleActionError 공통 헬퍼 (인증/권한/도메인/Prisma/DEPENDENCY 에러 일괄 매핑)
  - `src/features/recipe/actions/recipe.action.ts` — **축소**: 39KB→7.3KB, Recipe CRUD 5 + Ingredient CRUD 4 = 9개 함수
  - `src/features/recipe/actions/recipe-bom.action.ts` — **신규**: RecipeBOM 7 + Slot 3 + SlotItem 3 + 복제 1 = 14개 함수
  - `src/features/recipe/actions/semi-product.action.ts` — **신규**: SemiProduct CRUD 5개 함수
  - `src/features/recipe/actions/bom.action.ts` — **신규**: BOM 6 + BOMItem 3 + replaceBOMItems 1 = 10개 함수
  - `src/features/recipe/components/recipe-detail-dialog.tsx` — import 경로 3파일 분산
  - `src/features/recipe/components/semi-product-list.tsx` — import 경로 semi-product.action으로 변경
  - `src/features/recipe/components/semi-product-form.tsx` — import 경로 semi-product.action으로 변경
  - `src/features/recipe/components/semi-product-detail-dialog.tsx` — import 경로 semi-product.action + bom.action으로 변경
  - `src/features/material/actions/material.action.ts` — handleActionError 적용
  - `src/features/supplier/actions/supplier.action.ts` — handleActionError 적용
  - `src/features/container/actions/container.action.ts` — handleActionError 적용
  - `src/features/unit-master/actions/unit-master.action.ts` — handleActionError 적용
  - `src/features/unit-conversion/actions/unit-conversion.action.ts` — handleActionError 적용
- **완료 항목**:
  - [x] recipe.action.ts (39KB/35함수) → 4개 파일 (7.3+11.7+4.5+7.6KB / 38함수)로 도메인별 분리
  - [x] handleActionError 공통 헬퍼로 전 도메인 action (81개) catch 블록 통일 (평균 5줄→1줄)
  - [x] 6개 컴포넌트 import 경로 정확히 수정 (recipe-list, recipe-form은 변경 불필요)
  - [x] 기존 테스트 158건 영향 없음 (action 시그니처 변경 없음)
  - [x] TypeScript 오류 0건
- **아키텍처 결정**:
  - 도메인 에러는 handleActionError의 domainErrors 파라미터로 전달 (공통 에러와 분리)
  - supplier action의 try 블록 내 actionFail 직접 사용은 기능적으로 정상이므로 현 Phase에서 유지

### Phase 13 — Error Boundary + 타입 강화 + Phase 12 보완 ✅
- **날짜**: 2026-05-12
- **커밋**: `59f12070`
- **예상 시간**: 2h → **실제 시간: ~1.5h**
- **변경 파일**: 6개 (신규 3 + 수정 3)
  - `src/app/global-error.tsx` — **신규**: 루트 레이아웃 에러 바운더리 (html/body 포함, logger 기록, digest 표시)
  - `src/app/(dashboard)/error.tsx` — **신규**: 대시보드 에러 바운더리 (AlertTriangle 아이콘, 다시 시도/홈 이동 버튼)
  - `src/lib/action-helpers.ts` — **수정**: PaginatedActionResult, PaginatedFetcher 타입 + loadAllPages 공통 헬퍼 추가
  - `src/features/recipe/components/recipe-detail-dialog.tsx` — **수정**: 인라인 loadAllPages 삭제 → 공통 헬퍼 import, any 타입 제거
  - `src/features/supplier/actions/supplier.action.ts` — **수정** (Phase 12 보완): SupplierItem 4개 함수 actionFail 직접 호출 → handleActionError 패턴 통일, actionFail import 제거
  - `PROGRESS.md` — Phase 13 ✅ 마킹
- **완료 항목**:
  - [x] global-error.tsx: 루트 레이아웃 에러 → 한글 UI + digest 코드 + 다시 시도 버튼
  - [x] (dashboard)/error.tsx: 대시보드 에러 → AlertTriangle + 다시 시도/홈 이동
  - [x] loadAllPages any 타입 제거 → PaginatedFetcher<T> 제네릭으로 완전 타입 안전
  - [x] loadAllPages 인라인 → src/lib/action-helpers.ts 공통 헬퍼로 이동
  - [x] supplier.action.ts actionFail 직접 사용 4건 → handleActionError 패턴 통일
  - [x] 전 프로젝트 any 타입: 0건 (eslint-disable 라인 제거)
  - [x] TypeScript 오류 0건
  - [x] 기존 158 테스트 영향 없음
- **CONVENTIONS 검증**:
  - ① any 금지 → recipe-detail-dialog의 마지막 eslint-disable-next-line 제거로 **0건 달성**

### Phase 14 — Sprint 1 최종 QA ✅
- **날짜**: 2026-05-12
- **커밋**: `c07fa1e4`
- **예상 시간**: 2h → **실제 시간: ~1.5h**
- **변경 파일**: 3개 (수정 3)
  - `src/features/container/actions/container.action.ts` — actionFail 직접 호출 12건 → handleActionError 패턴 전면 통일, actionFail import 제거
  - `src/features/unit-conversion/actions/unit-conversion.action.ts` — try 블록 내 actionFail 3건 → handleActionError 패턴 통일, actionFail import 제거
  - `PROGRESS.md` — Phase 13 해시 기입 + Phase 14 ✅ 마킹
- **QA 검증 항목**:
  - [x] Issue #1~#7 전건 해소 확인 (7/7)
  - [x] 도메인 9개 action 파일 handleActionError 일관성 검증 — container·unit-conversion 미적용 발견 → 본 Phase에서 수정
  - [x] CONVENTIONS 12규칙 전수 점검 PASS
  - [x] Error Boundary 2파일 정상 (global-error.tsx, dashboard/error.tsx)
  - [x] loadAllPages 제네릭 타입 + any 0건 확인
  - [x] Toast 17개 컴포넌트 적용 확인
  - [x] 서비스:테스트 1:1 매핑 (11:11) + 158 tests
  - [x] TypeScript 오류 0건
- **handleActionError 최종 적용 현황** (전 도메인 완료):
  - material.action.ts: ✅ (12함수)
  - supplier.action.ts: ✅ (12함수)
  - container.action.ts: ✅ (10함수) ← **본 Phase에서 수정**
  - unit-master.action.ts: ✅ (7함수)
  - unit-conversion.action.ts: ✅ (4함수) ← **본 Phase에서 수정**
  - recipe.action.ts: ✅ (9함수)
  - recipe-bom.action.ts: ✅ (14함수)
  - semi-product.action.ts: ✅ (5함수)
  - bom.action.ts: ✅ (10함수)
  - **합계: 83개 action 함수 전체 handleActionError 통일**
- **Sprint 1 최종 현황**:
  - 총 14 Phase 완료 (Phase 1~14)
  - 총 커밋: 16건 (코드 11 + docs 5)
  - 테스트: 12파일 / 158 tests / 0 failures
  - TypeScript errors: 0
  - any 타입: 0건
  - actionFail 직접 사용: 0건 (전면 handleActionError 통일)

---

## 🏗️ Sprint 2: 식단 템플릿·식단 계획 (5/12 ~ 5/22)

> 총 예상 공수: ~48h
> ⚠️ 일정 조정: Sprint 1 Phase 3 확장(+5.5h)으로 Sprint 2 시작일 5/12→5/13
> ⚠️ v5 마이그레이션(Phase 2-b)으로 ContainerGroup 폐지, MealTemplateSlot→MealTemplateContainer 전환
> ⚠️ Sprint 2의 기존 Phase 2-e, 6, 7, 8, 9, 10, 11은 유지한다. 다만 Phase 5 완료 이후 MealPlan 구조 재정의 보강 작업(Phase 5-R)을 삽입한 뒤 Sprint 2 원래 미완료 작업을 재개한다.

### Phase 1 — MealTemplate Zod 스키마 + 서비스 + 테스트 ✅
- **날짜**: 2026-05-12
- **커밋**: `937ee2d6` (스키마+서비스), `6e693f83` (타입 보완+테스트+PROGRESS)
- **예상 시간**: 4h → **실제 시간: ~3h**
- **변경 파일**: 4개 (신규 2 + 수정 2)
  - `src/features/meal-template/schemas/meal-template.schema.ts` — **신규**: Zod 스키마 8개
  - `src/features/meal-template/services/meal-template.service.ts` — **신규**: Template CRUD 5 + Container 3 + Accessory 3 = 11함수
  - `src/tests/meal-template.service.test.ts` — **신규**: 테스트 케이스
  - `src/tests/mocks/prisma.ts` — mealTemplateContainer, mealTemplateAccessory mock 추가
- **완료 항목**:
  - [x] MealTemplate/Container/Accessory Zod 스키마 (v5 Prisma 모델 1:1 대응)
  - [x] MealTemplate 목록 조회 (pagination + search + sort)
  - [x] MealTemplate 상세 조회 (containers, accessories, subsidiaryMaster include)
  - [x] MealTemplate 생성/수정/삭제 (삭제 시 $transaction으로 Container/Accessory 일괄 삭제)
  - [x] MealTemplateContainer 추가/수정/삭제 (subsidiaryMasterId + sortOrder)
  - [x] MealTemplateAccessory 추가/수정/삭제 (subsidiaryMasterId + consumptionType + fixedQuantity + isRequired)
  - [x] TypeScript 오류 0건, any 0건
- **v5 반영**: Phase 2-b에서 MealTemplateSlot → MealTemplateContainer로 전면 전환 완료

### Phase 2 — MealTemplate 액션 + UI + 사이드바 ✅
- **날짜**: 2026-05-12
- **커밋**: `5f92eba6`
- **예상 시간**: 5h → **실제 시간: ~3h**
- **변경 파일**: 3개 (신규 2 + 수정 1)
  - `src/features/meal-template/actions/meal-template.action.ts` — **신규**: 11 action (Template 5 + Container 3 + Accessory 3), handleActionError 패턴
  - `src/app/(dashboard)/meal-templates/page.tsx` — **신규**: 식단 템플릿 CRUD 페이지 (목록/검색/아코디언/용기·악세서리 CRUD/toast)
  - `src/components/layout/sidebar.tsx` — "식단 템플릿" 메뉴 추가 (LayoutTemplate 아이콘)
- **완료 항목**:
  - [x] 11개 action 함수 (handleActionError, 권한 체크, 감사 로그)
  - [x] 식단 템플릿 CRUD UI (생성/수정/삭제 모달)
  - [x] 아코디언 확장: 용기/악세서리 상세 표시
  - [x] 용기 추가 모달 (SubsidiaryMaster CONTAINER 선택)
  - [x] 악세서리 추가 모달 (부자재 선택, 소비모드, 고정수량, 필수여부)
  - [x] 악세서리 인라인 수정 (consumptionType, isRequired)
  - [x] 삭제 확인 AlertDialog (template/container/accessory 분기)
  - [x] 사이드바 메뉴 추가, 전체 toast 적용
  - [x] TypeScript 오류 0건

### Phase 2-b — v5 Prisma 스키마 마이그레이션 ✅
- **날짜**: 2026-05-13
- **커밋**: `9f084f25`, `197dfe81`, `4b73dd39`, `2801c6de`
- **v5 핵심 의사결정**:
  - **용기가 부자재에 흡수**: ContainerGroup 폐지 → SubsidiaryMaster에 `subsidiaryType: CONTAINER | ACCESSORY | CONSUMABLE` enum 추가. 용기를 부자재 관리(/subsidiaries)에서 등록하고, /containers 페이지는 슬롯 전용 관리로 변경
  - **부자재 공급업체 유형 구분**: Supplier에 `supplierType: MATERIAL | SUBSIDIARY` 추가. 식재료·부자재 공급업체를 같은 테이블에서 유형 구분으로 관리. 부자재도 공급업체와 연결되어 발주→입고→사용 프로세스를 타도록 설계
  - **ContainerAccessory 폐지**: 부속품(악세서리)은 MealTemplateAccessory(subsidiaryMasterId FK)로 관리
  - **MealTemplateSlot → MealTemplateContainer**: subsidiaryMasterId + sortOrder 구조로 전면 재설계
  - **MealTemplateAccessory 변경**: name 문자열 → subsidiaryMasterId FK 참조
  - **RecipeBOMSlot**: containerGroupId → subsidiaryMasterId 전환
- **변경 파일**:
  - `prisma/schema.prisma` — v5 전면 재설계 + 마이그레이션 `20260513054059_restructure_v5_subsidiary_container_template`
  - `container.schema.ts` — ContainerGroup/AccessorySchema 삭제, subsidiaryMasterId 기반만 유지
  - `container.service.ts` — SubsidiaryMaster(CONTAINER) 쿼리, MealTemplateContainer 의존성 체크
  - `container.action.ts` — ContainerGroup/Accessory CRUD action 삭제, export-as alias → const assignment (Turbopack 호환)
  - `meal-template.schema.ts` — containerGroupId 제거, subsidiaryMasterId 기반
  - `meal-template.service.ts` — TEMPLATE_INCLUDE에 containers/accessories/subsidiaryMaster
  - `meal-templates/page.tsx` — v5 타입(ContainerRow, AccessoryRow, TemplateRow), API 호출 전환
  - `containers/page.tsx` — 슬롯 전용 관리로 변경, 안내문 "용기는 부자재 관리에서 등록합니다"
  - `recipe-detail-dialog.tsx` — getSlotsBySubsidiaryIdAction import 수정
  - `prisma mock` — containerGroup 제거, mealTemplateContainer 추가
- **해결된 이슈**: Turbopack에서 `export { X as Y }` 패턴이 원래 이름을 숨기는 문제 → `export const Y = X` 패턴으로 수정
- **테스트**: 12파일 / 160개 PASS

### Phase 2-c — v5 UI/로직 보완 + 버그 수정 ✅
- **날짜**: 2026-05-14
- **커밋**: `6ca88338` (기능), `268aaa24` (버그 수정)
- **예상 시간**: 5h → **실제 시간: ~4h**
- **변경 파일**: 17개 (2커밋 합산)
  - `src/features/material/schemas/material.schema.ts` — `subsidiaryType` 필드, `subsidiaryListQuerySchema` 신규, `SubsidiaryListQuery` 타입
  - `src/features/material/services/subsidiary.service.ts` — `SubsidiaryListQuery` 전환, `subsidiaryType` 필터, `getSubsidiariesByType` 신규, `generateSubsidiaryCode` → `$queryRaw`
  - `src/features/material/services/material.service.ts` — `generateMaterialCode` → `$queryRaw`
  - `src/features/material/actions/material.action.ts` — `subsidiaryListQuerySchema` 적용, `getSubsidiariesByTypeAction` 신규
  - `src/features/material/components/subsidiary-form.tsx` — `subsidiaryType` Select (CONTAINER/ACCESSORY/CONSUMABLE)
  - `src/features/material/components/subsidiary-list.tsx` — 유형 컬럼 + 필터 드롭다운 + 뱃지 스타일
  - `src/features/supplier/schemas/supplier.schema.ts` — `supplierType` 필드, `supplierListQuerySchema` 신규
  - `src/features/supplier/components/supplier-form.tsx` — `supplierType` Select (MATERIAL/SUBSIDIARY)
  - `src/features/supplier/components/supplier-list.tsx` — 유형 컬럼 + 필터 드롭다운 + 뱃지 스타일
  - `src/features/supplier/components/supplier-item-form.tsx` — `supplierType` 기반 `itemType` 자동 고정, Select→disabled Input
  - `src/app/(dashboard)/suppliers/page.tsx` — `SupplierWithType` 타입, `supplierType` prop 전달
  - `src/app/(dashboard)/meal-templates/page.tsx` — ACCESSORY+CONSUMABLE 분리 로딩, 인라인 sortOrder/fixedQuantity 편집
  - `src/tests/mocks/prisma.ts` — `$queryRaw` mock 추가
  - `src/tests/material.service.test.ts` — `$queryRaw` mock 전환
  - `src/tests/subsidiary.service.test.ts` — `$queryRaw` mock + `subsidiaryType` 추가
  - `src/tests/supplier.service.test.ts` — `supplierType` 추가
- **완료 항목**:
  - [x] 부자재: subsidiaryType 스키마/서비스/폼/리스트 추가 (CONTAINER/ACCESSORY/CONSUMABLE)
  - [x] 부자재: subsidiaryListQuerySchema + subsidiaryType 필터
  - [x] 부자재: getSubsidiariesByTypeAction 신규 (식단 템플릿 옵션 로딩용)
  - [x] 공급업체: supplierType 스키마/서비스/폼/리스트 추가 (MATERIAL/SUBSIDIARY)
  - [x] 공급업체: supplierListQuerySchema + supplierType 필터
  - [x] 공급 품목: supplierType 기반 itemType 자동 고정 (식재료↔식자재, 부자재↔부자재)
  - [x] 식단 템플릿: CONTAINER/ACCESSORY+CONSUMABLE 옵션 분리 로딩
  - [x] 식단 템플릿: 용기 sortOrder 인라인 편집 (blur-save)
  - [x] 식단 템플릿: 악세서리 고정수량 컬럼 + 인라인 편집
  - [x] 코드 채번: soft-delete extension 우회 ($queryRaw) — material, subsidiary
  - [x] 테스트: $queryRaw mock 추가, 관련 테스트 4건 수정
  - [x] TypeScript 오류 0건
  - [x] 테스트: 12 파일 / 160 PASS
- **발견된 이슈**:
  - supplier.service.ts의 generateSupplierCode 미전환 (findFirst 패턴 유지) → Phase 2-d에서 수정
  - 부자재 등록 시 공급업체 연결 UI 부재 → Phase 2-d에서 보완

### Phase 2-d — supplier 서비스 패턴 통일 + 타입 정리 ✅
- **날짜**: 2026-05-14
- **커밋**: `2dc5e89e`
- **예상 시간**: 3h → **실제 시간: ~4h** (테스트 실패 디버깅 포함)
- **변경 파일**: 3개 (+46 / -33)
  - `src/features/supplier/services/supplier.service.ts` — `generateSupplierCode` findFirst → `$queryRaw` 전환 (soft-delete extension 우회), `getSuppliers`/`getSupplierById`/`deleteSupplier`에 명시적 `deletedAt: null` 조건 추가, `deleteSupplier`를 `delete()` → `update({ deletedAt })` explicit soft-delete로 변경
  - `src/tests/supplier.service.test.ts` — createSupplier 테스트에서 `findFirst` mock → `$queryRaw` mock 전환, deleteSupplier 테스트에서 `delete` mock → `update` mock 검증 + `delete` 미호출 확인, getSupplierById 테스트에 `deletedAt: null` where 검증 추가
  - `src/app/(dashboard)/suppliers/page.tsx` — `SupplierWithType` 커스텀 타입 제거, Prisma `Supplier` 타입 직접 사용으로 간소화
- **완료 항목**:
  - [x] supplier.service.ts: generateSupplierCode → $queryRaw 전환 (material/subsidiary 패턴과 동일)
  - [x] supplier.service.ts: getSuppliers where 절에 deletedAt: null 명시
  - [x] supplier.service.ts: getSupplierById where 절에 deletedAt: null 명시
  - [x] supplier.service.ts: deleteSupplier → explicit soft-delete (update + deletedAt)
  - [x] supplier.service.test.ts: $queryRaw mock 기반 코드 채번 테스트 (SUP-001, SUP-006)
  - [x] supplier.service.test.ts: soft-delete 테스트 → update mock + delete 미호출 검증
  - [x] supplier.service.test.ts: getSupplierById null 반환 테스트 정상화
  - [x] suppliers/page.tsx: SupplierWithType 제거 → Prisma Supplier 직접 사용
  - [x] TypeScript 오류 0건
  - [x] 테스트: 12 파일 / 160 PASS (3건 실패 → 0건)
- **패턴 통일 검증 결과**:

  | 항목 | material.service | subsidiary.service | supplier.service |
  |------|-----------------|-------------------|-----------------|
  | 코드 채번 | $queryRaw ✅ | $queryRaw ✅ | $queryRaw ✅ |
  | deletedAt: null | 명시 ✅ | 명시 ✅ | 명시 ✅ |
  | soft-delete | update({ deletedAt }) ✅ | update({ deletedAt }) ✅ | update({ deletedAt }) ✅ |
  | 테스트 mock | $queryRaw ✅ | $queryRaw ✅ | $queryRaw ✅ |

- **미완료 → Phase 2-e 이관**:
  - 부자재 등록/수정 폼에 공급업체 연결 섹션 추가 (SubsidiaryMaster + SupplierItem 트랜잭션)

### Phase 2-e — 부자재-공급업체 연결 UX ⬜ (선택적, Phase 3 이후 진행 가능)
- **예상 시간**: 3h
- **작업 목록**:
  - [ ] 부자재 등록/수정 폼에 공급업체 연결 섹션 추가
    - 부자재 공급업체(supplierType=SUBSIDIARY) Select
    - 제품명, 규격, 공급단위, 단가 입력
    - 저장 시 SubsidiaryMaster + SupplierItem 트랜잭션 처리
    - defaultSupplierItemId 자동 설정 (첫 연결 시)
  - [ ] PROGRESS.md 갱신
- **비고**: MealPlanGroup/MealPlan 구현이 우선순위 높으므로, Phase 3 진행 후 필요 시 Sprint 2 후반에 병행 가능

### Phase 3 — MealPlanGroup/MealPlan Zod 스키마 + 서비스 ✅
- **날짜**: 2026-05-14
- **커밋**: `298ae851`
- **예상 시간**: 6h → **실제 시간: ~2h**
- **변경 파일**: 3개 (+426 / -0)
  - `src/features/meal-plan/schemas/meal-plan.schema.ts` — **신규**: Zod 스키마 8개 (MealPlanGroup list/create/update, MealPlan create/update, MealPlanSlot create/update)
  - `src/features/meal-plan/services/meal-plan.service.ts` — **신규**: 14개 서비스 함수
  - `src/tests/mocks/prisma.ts` — 6개 모델 mock 추가 (mealPlanGroup, mealPlan, mealPlanSlot, mealCount, mealPlanAccessory, lineup)
- **완료 항목**:
  - [x] MealPlanGroup: 목록(pagination + status/lineup/dateRange 필터), 상세, 생성, 수정(상태 변경), 삭제(cascade tx), 복사(deep clone)
  - [x] MealPlan: 그룹별 조회, 생성(slotType + mealTemplateId), 수정, 삭제(cascade tx)
  - [x] MealPlanSlot: 목록, 생성(slotIndex + recipe + BOM + quantity), 수정, 삭제
  - [x] Include 상수 분리 (GROUP_LIST_INCLUDE, GROUP_DETAIL_INCLUDE, MEAL_PLAN_INCLUDE)
  - [x] deleteMealPlanGroup: 4단계 cascade 삭제 (Slot → Accessory → Plan → Count → Group)
  - [x] copyMealPlanGroup: $transaction deep clone (Group → Plan → Slot + Accessory)
  - [x] Prisma mock 6개 모델 추가
  - [x] TypeScript 오류 0건
  - [x] 기존 테스트 160 PASS 유지
- **패턴 일치**: meal-template.service.ts와 동일 (Include 상수, $transaction cascade, NOT_FOUND throw, hard delete)

### Phase 4 — MealPlan 액션 ✅
- **날짜**: 2026-05-14
- **커밋**: `a831418f`
- **예상 시간**: 4h → **실제 시간: ~1h**
- **변경 파일**: 1개 (+304 / -0)
  - `src/features/meal-plan/actions/meal-plan.action.ts` — **신규**: 13개 server action
- **완료 항목**:
  - [x] MealPlanGroup: getMealPlanGroupsAction, getMealPlanGroupByIdAction, createMealPlanGroupAction, updateMealPlanGroupAction, deleteMealPlanGroupAction, copyMealPlanGroupAction
  - [x] MealPlan: getMealPlansByGroupAction, createMealPlanAction, updateMealPlanAction, deleteMealPlanAction
  - [x] MealPlanSlot: getMealPlanSlotsAction, createMealPlanSlotAction, updateMealPlanSlotAction, deleteMealPlanSlotAction
  - [x] 전체 handleActionError 패턴 적용 (13/13)
  - [x] assertPermission(session, "mealPlan", action) 통일
  - [x] createAuditLog: CREATE/UPDATE/DELETE 대상 전부 적용
  - [x] 도메인 에러 매핑: NOT_FOUND, P2002(unique constraint)
  - [x] TypeScript 오류 0건
  - [x] 기존 테스트 160 PASS 유지
- **패턴 일치**: meal-template.action.ts와 동일 (requireCompanySession + assertPermission + handleActionError + createAuditLog + actionOk)

### Phase 5 — 식단 그룹 UI ✅
- **날짜**: 2026-05-14
- **커밋**: `f859c993`
- **예상 시간**: 4h → **실제 시간: ~2h**
- **변경 파일**: 1개 (+약 800 lines / -0)
  - `src/app/(dashboard)/meal-plans/page.tsx` — **신규**: 식단 계획 CRUD 페이지 (목록 뷰 + 상세 뷰)
- **완료 항목**:
  - [x] 목록 뷰: MealPlanGroup 테이블 (날짜·라인업·상태·식단 수 컬럼)
  - [x] 목록 뷰: pagination (page/limit/totalPages), Enter 검색, 상태 필터 (5종)
  - [x] 목록 뷰: 상태 뱃지 색상 (DRAFT 회색, CONFIRMED 파랑, IN_PROGRESS 초록, COMPLETED 보라, CANCELLED 빨강)
  - [x] 상세 뷰: MealPlan 카드별 렌더링 (slotType 한글 변환: 조식/중식/석식/간식)
  - [x] 상세 뷰: 슬롯 테이블 (순서/레시피/인원), 악세서리 뱃지 (subsidiaryMaster.name × quantity)
  - [x] 그룹 생성 Dialog (planDate + lineupId 직접 입력, Sprint 6에서 Lineup Select 전환 예정)
  - [x] 그룹 복사 Dialog (source 날짜·라인업 표시, 대상 날짜 선택 → copyMealPlanGroupAction)
  - [x] 상태 변경 Dialog (현재 상태 제외 옵션 필터링 → updateMealPlanGroupAction)
  - [x] 식단 추가 Dialog (slotType Select + mealTemplate Select via loadAllPages → createMealPlanAction)
  - [x] 삭제 AlertDialog (group/meal/slot 3종 분기, cascade 경고 → deleteMealPlanGroupAction/deleteMealPlanAction/deleteMealPlanSlotAction)
  - [x] Toast 통합: success 6건 (생성/복사/상태변경/식단추가/삭제×3종), error 전 경로 적용
  - [x] logger.error 적용 (console.log 미사용)
  - [x] 사이드바 /meal-plans 메뉴 이미 등록 확인 (CalendarDays 아이콘)
  - [x] AlertDialog 태그 정합성 수정 완료 (</Dialog> → </AlertDialog>)
  - [x] TypeScript 오류 0건
  - [x] 기존 테스트 160 PASS 유지
- **패턴 일치**: meal-templates/page.tsx와 동일 (loadAllPages, AlertDialog, toast, logger.error, pagination, shadcn/ui)
- **제한사항**: Lineup 모델 미구현 (Sprint 6 Phase 5). 현재 lineupId 수동 입력
- **Action ↔ UI 매핑**:
  - getMealPlanGroupsAction → 목록 fetchData ✅
  - getMealPlanGroupByIdAction → 상세 openDetail ✅
  - createMealPlanGroupAction → 그룹 생성 handleCreateGroup ✅
  - updateMealPlanGroupAction → 상태 변경 handleStatusChange ✅
  - deleteMealPlanGroupAction → 삭제 handleConfirmDelete(group) ✅
  - copyMealPlanGroupAction → 복사 handleCopyGroup ✅
  - createMealPlanAction → 식단 추가 handleAddMeal ✅
  - deleteMealPlanAction → 삭제 handleConfirmDelete(meal) ✅
  - deleteMealPlanSlotAction → 삭제 handleConfirmDelete(slot) ✅
  - getMealTemplatesAction → 템플릿 옵션 loadTemplateOptions ✅

### Phase 5-R — MealPlan 구조 재정의 보강 작업 🔄 (진행 중)
- **상태**: Sprint 2 내부 신규 보강 작업
- **목적**: 기존 Sprint 2 계획과 완료 이력을 삭제하지 않고 유지한 상태에서, Phase 3~5에서 구현된 MealPlan 도메인 구조를 후속 Phase 6~11 및 Sprint 3~5와 안정적으로 연결할 수 있도록 재정렬
- **배경**:
  - Phase 3, 4, 5를 통해 MealPlanGroup / MealPlan / MealPlanSlot의 기본 CRUD 및 UI는 구현되었음
  - 그러나 현재 구조는 `MealPlanGroup.lineupId` 고정, `MealPlan`의 식사타입 × lineup 구조 미정착, `MealPlanSlot`의 실행 배정 정보 부족으로 인해 MealCount / MaterialRequirement / CookingPlan / 자동생성 흐름을 안정적으로 연결하기 어려움
  - 따라서 Sprint 2의 원래 미완료 작업(Phase 2-e, 6, 7, 8, 9, 10, 11)을 그대로 진행하지 않고, 그 전에 구조 재정의 보강 작업을 삽입해야 함
- **주의**:
  - 본 작업은 기존 Sprint 2 계획을 대체하지 않음
  - 기존 Phase 2-e, 6, 7, 8, 9, 10, 11은 그대로 유지함
  - 본 작업 완료 후 Sprint 2 원래 계획을 재개함
- **구조 재정의 공식 결정 사항**:
  - `MealPlanGroup`: 날짜 중심 그룹으로 단순화, `lineupId` 제거, `note`/`deletedAt` 추가, 유니크 `(companyId, planDate)`
  - `MealPlan`: 식사타입 × lineup 조합으로 재정의, `lineupId`(필수) + `mealTemplateId`(선택) 관계 추가, 유니크 `(mealPlanGroupId, slotType, lineupId)` — 라인업 N개 자유 확장 가능
  - `MealPlanSlot`: 실행 배정 단위로 확장, `slotIndex` → `sortOrder`, `kind: SlotKind` discriminator 추가, `subsidiaryMasterId`/`containerSlotIndex`/`supplierItemId`/`productionLineId`/`recipeBomId` 관계 추가, 유니크 제거 (공장 분할 허용)
  - `MealCount`: 라인업별 식수 독립 추적, `lineupId` 추가, 유니크 `(mealPlanGroupId, slotType, lineupId)`
  - 신규 enum: `SlotKind { CONTAINER, DIRECT }` (케이스 분류), `MealSlotType.EVENT` (제휴이벤트)
  - 안정성 정책: DB는 nullable 허용, 애플리케이션 레벨 (Zod + service)에서 `kind`에 따라 필수 필드 검증

#### Step 1 — schema.prisma 재설계 + 마이그레이션 ✅
- **날짜**: 2026-05-26
- **커밋**: `688633c`
- **변경 파일**:
  - `prisma/schema.prisma` — MealPlanGroup/MealPlan/MealPlanSlot/MealCount 재설계, `MealSlotType.EVENT` 추가, `SlotKind` enum 신규, 역참조 관계 정리 (Lineup, MealTemplate, SubsidiaryMaster, Recipe, RecipeBOM, SupplierItem, ProductionLine)
  - `prisma/migrations/<timestamp>_phase5r_step1_meal_plan_restructure/migration.sql` — DB 스키마 마이그레이션
- **변경 내용**:
  - 신규 enum: `SlotKind { CONTAINER, DIRECT }` 추가
  - `MealSlotType` enum에 `EVENT` 값 추가
  - `MealPlanGroup`: `lineupId` 제거, `note`/`deletedAt` 추가, 유니크 `(companyId, planDate)` 로 단순화
  - `MealPlan`: `lineupId`(필수) + `mealTemplateId`(선택) FK 관계 추가, `note`/`deletedAt` 추가, 유니크 `(mealPlanGroupId, slotType, lineupId)` 로 변경
  - `MealPlanSlot`: `slotIndex` → `sortOrder`, `kind: SlotKind` discriminator 추가, `subsidiaryMasterId`/`containerSlotIndex`/`supplierItemId`/`productionLineId`/`recipeBomId` 관계 추가, 기존 `@@unique([mealPlanId, slotIndex])` 제거 (공장 분할 허용), `deletedAt` 추가, 인덱스 7개로 확장
  - `MealCount`: `lineupId`(필수) 추가, 유니크 `(mealPlanGroupId, slotType, lineupId)` 로 변경
- **검증**: `prisma format`, `prisma validate`, `prisma migrate dev --name phase5r_step1_meal_plan_restructure`, `prisma generate` 성공
- **알려진 상태** (의도된 보류):
  - `npx tsc --noEmit` 17개 에러 (`src/features/meal-plan/services/meal-plan.service.ts`): `lineupId` 추가·`slotIndex`→`sortOrder` 등 schema 변경으로 인한 service 시그니처 불일치
  - 위 에러는 Step 3 (Zod) → Step 4 (Service) → Step 5 (Action) 에서 순차적으로 해소 예정
  - Step 1 단계 종료 시점의 tsc 에러는 정상이며, Step 5 완료 시점에 0 errors로 복귀
- **계획 대비 변경**: 없음 (이전 합의된 변경 ①~⑦ 그대로 적용)
- **다음 단계**: Step 2 — seed.ts 식단 샘플 추가

### Phase 5-R Step 1.2 — MealPlan partial unique index + deleteMealPlan MealCount 동반 처리 ✅
- **날짜**: 2026-05-27
- **커밋**: (마이그레이션 + schema + seed) / (service 패치) ← git push 후 해시 기입
- **배경**:
  - `MealPlan`에 `deletedAt`이 있고 `@@unique([mealPlanGroupId, slotType, lineupId])`가 함께 걸려 있어, soft delete된 행과 동일한 (그룹, 식사타입, 라인업) 조합의 새 행 생성이 차단되는 버그 발생
  - 사용자 시나리오: 식단 카드 삭제 → 동일 조합으로 재등록 시도 → `Unique constraint failed` 에러
  - 추가 발견: `deleteMealPlan`이 연관 `MealCount`를 soft delete하지 않아, 식단 카드를 지워도 식수 현황 표에는 행이 남는 비대칭 동작
- **변경 파일**: 4개 (신규 1 + 수정 3)
  - `prisma/migrations/20260526030000_phase5r_step1_2_meal_plan_partial_unique/migration.sql` — **신규**: 기존 unique index DROP + `deleted_at IS NULL` 조건 partial unique index 생성 (`meal_plans_meal_plan_group_id_slot_type_lineup_id_active`)
  - `prisma/schema.prisma` — `MealPlan` 모델의 `@@unique([mealPlanGroupId, slotType, lineupId])`를 주석 처리하고 의도 주석 추가 ("절대 해제하지 말 것")
  - `prisma/seed.ts` — MealPlan upsert 8곳을 `findFirst({ ..., deletedAt: null }) + 조건부 create` 패턴으로 전환 (복합 unique key 제거로 upsert 불가)
  - `src/features/meal-plan/services/meal-plan.service.ts` — `deleteMealPlan`에 `tx.mealCount.updateMany` 추가, 동일 (그룹, 식사타입, 라인업) MealCount 동반 soft delete
- **완료 항목**:
  - [x] DB 인덱스 이름을 컨벤션(`{table}_{cols}_active`)에 맞춰 rename — `meal_plans_active_unique` → `meal_plans_meal_plan_group_id_slot_type_lineup_id_active`
  - [x] partial unique index 마이그레이션 파일 생성 및 push
  - [x] schema.prisma `@@unique` 주석 처리 + 의도 주석 명시
  - [x] `prisma migrate status` → "Database schema is up to date" 확인
  - [x] seed.ts 8개 upsert → findFirst+create 패턴 전환 (다른 도메인의 기존 컨벤션과 동일)
  - [x] deleteMealPlan에 MealCount 동반 soft delete 추가 (deleteMealPlanGroup과 정책 통일)
  - [x] `npx tsc --noEmit` 0 errors
  - [x] e2e 시나리오 통과: 식단 삭제 → 동일 (식사타입, 라인업) 조합 재등록 성공
- **아키텍처 결정**:
  - **데이터 보존 정책**: soft-deleted MealPlan 행은 재활성화하지 않고 항상 새 행 생성 → 이력 보존 우선
  - **인덱스 명명**: 기존 `20260423074023_add_partial_unique_indexes`와 동일한 `{table}_{cols}_active` 패턴 통일
  - **마이그레이션 안전장치**: `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` 사용으로 재실행 시 충돌 없음
  - **삭제 정책 통일**: `deleteMealPlanGroup`(그룹 단위)과 `deleteMealPlan`(단일 단위) 모두 연관 MealCount를 함께 soft delete
- **남은 백로그 (Phase 5-R Step 1.3 이후로 분리)**:
  - `MealCount`도 동일한 partial unique index 패턴으로 통일 필요 (현재 `upsertMealCount`가 soft-deleted 행을 재활성화하는 방식으로 우회 중 — 이력이 덮어쓰이는 비대칭 상태)
  - `MealTemplate`, `MealTemplateContainer`, `MealTemplateAccessory`, `SupplierItem`에 `deletedAt` 추가 (CONVENTIONS 규칙 6 일관성 회복)
  - 두 항목 모두 현재 동작에는 영향 없으며, Lineup 모듈(Step A) 이후 별도 Step에서 처리
- **다음 단계**: Phase 5-R Step 2 — Lineup feature 모듈(read-only) 신설 → /meal-plans 다이얼로그의 라인업 ID 수동 입력을 LineupSelect 컴포넌트로 전환

## Phase 5-R Step 2: Lineup 모듈 (진행 중 — 백엔드 완료)

### 목표
- Lineup CRUD 완성
- LineupLocationMap (라인업 ↔ 배송 매장) 관리
- LineupMealTemplateMap (라인업 × 슬롯타입 → 기본 식단 템플릿) 매핑
  - 식단 그룹 생성 시 슬롯별 기본 템플릿 자동 적용 기반
  - 일회성/영구 오버라이드는 MealPlan/MealPlanSlot 레벨에서 처리 (Step 3 예정)

### Step 2.1 — Schema & Migration ✅
- `prisma/schema.prisma`
  - `Lineup` 모델: `templateMaps LineupMealTemplateMap[]` 관계 추가
  - `LineupMealTemplateMap` 모델 신규
    - 필드: id, lineupId, slotType(MealSlotType), mealTemplateId, createdAt, updatedAt, deletedAt
    - 인덱스: lineupId, slotType, mealTemplateId, deletedAt
    - 관계: Lineup, MealTemplate (양방향)
  - `MealTemplate` 모델: `lineupMaps LineupMealTemplateMap[]` 관계 추가
- `prisma/migrations/20260527000000_phase5r_step2_lineup_template_map/migration.sql`
  - 테이블 + 4개 일반 인덱스 + FK 2건(ON DELETE RESTRICT)
  - **Partial unique index**: `(lineup_id, slot_type) WHERE deleted_at IS NULL`
- 검증: `prisma migrate deploy` 성공, `tsc --noEmit` 0 errors

### Step 2.2 — Schemas & Services ✅
- `src/features/lineup/schemas/lineup.schema.ts` (전면 교체, 3.9KB)
  - Lineup CRUD, LocationMap sync(max 500), TemplateMap upsert·bulkUpsert(max 20)
- `src/features/lineup/services/lineup.service.ts` (9.2KB)
  - 자동 채번(LINE-xxx), CRUD, 의존성 체크(mealPlan/mealCount/shippingOrder)
  - 트랜잭션 soft-delete: lineup soft + locationMaps hard + templateMaps soft
  - `syncLineupLocations`: diff 기반 + 동일회사 location 검증
- `src/features/lineup/services/lineup-template-map.service.ts` (9.0KB, 신규)
  - upsert(active/restore/create 3분기) + bulkUpsert(트랜잭션, 슬롯 중복 제거)
  - `getDefaultTemplateForSlot`: 식단 자동 생성용 단건 조회
  - delete by id / delete by slot

### Step 2.3 — Actions ✅
- `src/features/lineup/actions/lineup.action.ts` (8.1KB)
  - 8개 액션: get list/byId, create, update, checkDependencies, delete, getLocations, syncLocations
- `src/features/lineup/actions/lineup-template-map.action.ts` (7.1KB, 신규)
  - 6개 액션: getMaps, getDefaultForSlot, upsert, bulkUpsert, delete, deleteBySlot
- 모든 액션: 세션 검증 + 권한 체크(lineup READ/CREATE/UPDATE/DELETE) + 감사 로그 + 에러 한글화

### Step 2.4 — Tests ✅
- `src/tests/mocks/prisma.ts`: location, lineupLocationMap, lineupMealTemplateMap, shippingOrder mock 추가
- `src/tests/lineup.service.test.ts` (18.2KB, 26 tests)
- `src/tests/lineup-template-map.service.test.ts` (14.6KB, 20 tests)
- **테스트 결과: 14 files / 206 tests / 0 failures** (이전 12/160 대비 +2 files, +46 tests)
- TypeScript: 0 errors

---

## Phase 5-R Step 2.5 prep — 비즈니스 모델 재정의 + Lineup 확장 ✅

### 배경: 비즈니스 모델 재정의
컴포넌트 작업 직전, Lineup 모듈의 비즈니스 의미를 사용자와 재확인한 결과
초기 설계 가정이 실제 운영 모델과 일치하지 않아 스코프를 재조정함.

**재정의된 정의**:
- **Lineup** = 회사가 판매하는 상품 분류 단위 (가정식도시락, 프레시밀, 특식 등)
  - 원가 산출의 그룹키
  - 라인업별로 식단(MealPlan)과 식수(MealCount)를 등록
  - 매핑되는 제조 공장은 사전 정의하지 않음
- **공장 할당 시점**: 식단 작성 단계 (MealPlan/MealPlanSlot)
- **공장 할당 단위**: 슬롯(Slot) 단위
  - 동일 라인업이라도 슬롯별로 다른 공장 할당 가능
  - 동일 슬롯도 수량이 많으면 여러 공장-제조라인으로 분할 제조 가능

### LineupLocationMap 배제 결정
**검토 결과**: 원가 산출은 `lineupId` 기반 group by로 충분하며,
LineupLocationMap을 통한 사전 매핑은 현재 비즈니스 모델에서 불필요함.

**처리 방침**:
- 모델/관계/스키마/서비스/액션/시드 코드 모두 **주석 처리**로 배제
- DB 테이블은 그대로 유지 (향후 명확한 쓰임 정의 시 복원 가능)
- 테스트는 `describe.skip`으로 보존 + 복원 가이드 주석

**향후 복원 시 가이드**:
1. schema.prisma에서 `LineupLocationMap` 모델, `Lineup.locationMaps`,
   `Location.lineupLocationMaps` 주석 해제
2. lineup.schema.ts에서 `createLineupLocationMapSchema`,
   `syncLineupLocationsSchema` 주석 해제
3. lineup.service.ts에서 `syncLineupLocations`, `getLineupLocations` 주석 해제
4. lineup.action.ts에서 `getLineupLocationsAction`,
   `syncLineupLocationsAction` 주석 해제
5. seed.ts의 LineupLocationMaps 블록 주석 해제
6. lineup.service.test.ts의 `describe.skip` 제거
7. `npx prisma generate` 만 실행하면 DB 재마이그레이션 불필요

### Lineup 모델 확장
**추가 필드**:
- `isActive Boolean @default(true)` — 판매 중단 라인업 필터링용
  (사용 안 하는 라인업이 식단 작성 시 노출되는 것 방지)
- `sortOrder Int @default(0)` — 라인업 노출 순서 제어
  (라인업이 많아지면 운영자가 노출 순서 직접 제어)
- `description String?` — 라인업 설명 (선택, 운영자 메모용)

**추가 인덱스**:
- `lineups_is_active_idx` — 활성 필터 빈도 높음
- `lineups_company_id_sort_order_idx` — 정렬 기본값 `sortOrder asc + name asc`

**Migration**:
`20260527010000_phase5r_step2_lineup_active_and_disable_location_map`
- ALTER TABLE로 3개 컬럼 + 2개 인덱스 추가
- LineupLocationMap 테이블은 DROP하지 않음

### 백엔드 코드 변경
| 파일 | 변경 내용 |
|------|----------|
| `schema.prisma` | Lineup 필드 추가, LocationMap 모델/관계 주석 |
| `lineup.schema.ts` | 새 필드 반영, isActive 필터 추가, LocationMap 스키마 주석 |
| `lineup.service.ts` | 새 필드 처리, sortOrder 정렬, LocationMap 함수 주석, _count.templateMaps |
| `lineup.action.ts` | LocationMap 액션 주석 |
| `prisma/seed.ts` | LineupLocationMaps 시드 블록 주석 |
| `lineup.service.test.ts` | 전면 교체 (~22 tests), 신규 7개 + LocationMap 7개 skip |

### 검증
- `npx tsc --noEmit`: 0 errors
- `npm run test`: 14 files / ~200 tests / 0 failures
- `npx prisma migrate status`: Database schema is up to date

### 학습/회고
1. **백엔드를 빠르게 만들기 전에 비즈니스 모델 확정이 우선** — 컴포넌트 작업 시작
   직전에 모델 재정의가 발생해 일부 백엔드 코드를 다시 손봐야 했음.
   향후 새 모듈 착수 시 "사용자 워크플로우 → 데이터 모델" 매핑부터 합의할 것.
2. **모델 배제는 DROP보다 주석 처리가 안전** — 향후 복원 시 마이그레이션 비용 없음.
3. **테스트의 `describe.skip` + 복원 가이드 주석**은 향후 작업자에게 친절한 안내.

### 다음 단계
- Step 2.6 — Components (lineup-list, lineup-form, lineup-detail, lineup-template-map)
- Step 2.7 — Page `src/app/(dashboard)/lineups/page.tsx`
- Step 2.8 — Sidebar "상품 라인업" 메뉴 추가 (Layers 아이콘)

## Phase 5-R Step 2.6~2.8 — Lineup UI 완성 ✅

### 날짜
- 2026-05-27 (UI 4종 작성)
- 2026-05-28 (검증·통합·푸시 완료)

### 변경 파일
**신규 (4)**
- `src/features/lineup/components/lineup-breadcrumb.tsx` — supplier 패턴 동일, 클릭 가능 breadcrumb
- `src/features/lineup/components/lineup-list.tsx` — 검색·isActive 필터·sortOrder·페이지네이션·삭제 의존성 다이얼로그
- `src/features/lineup/components/lineup-form.tsx` — 생성/수정 폼 (name, isActive, sortOrder, description)
- `src/app/(dashboard)/lineups/page.tsx` — list / new / edit 3-mode 뷰 + breadcrumb 통합

**수정 (1)**
- `src/components/layout/sidebar.tsx` — "상품 라인업" 메뉴 항목 추가 (Layers 아이콘)

### 패턴 일치 검증
| 항목 | supplier 모듈 | lineup 모듈 |
|------|--------------|------------|
| List 컴포넌트 구조 | 검색 + 필터 + 페이지네이션 ✅ | 동일 ✅ |
| Form 컴포넌트 구조 | Card 헤더 + ArrowLeft + handleSubmit | 동일 ✅ |
| 코드 폰트 | `font-mono text-sm` ✅ | 동일 ✅ |
| Toast 패턴 | sonner + 한글 메시지 ✅ | 동일 ✅ |
| 삭제 다이얼로그 | AlertDialog + 의존성 reasons | 동일 ✅ |
| Breadcrumb | 모드 전환 시 갱신 ✅ | 동일 ✅ |

### 의존성 추가
- shadcn/ui `Switch` 컴포넌트 추가 (isActive 토글용)

### 검증
- `npx tsc --noEmit`: 0 errors
- `npm run test`: 14 files / 206 tests / 0 failures (이 시점 기준)

---

## Phase 5-R Step 2 정정 — LineupMealTemplateMap 폐기 ✅

### 날짜
- 2026-05-28
- 커밋: `b6e515d` (코드 제거), DB DROP 마이그레이션 별도 적용

### 배경
Step 2.6 UI 작업 중 사용자와의 도메인 검토에서 다음 사실이 확인되어
LineupMealTemplateMap을 폐기하기로 결정.

**문제점**:
1. 동일 라인업·동일 슬롯이라도 날짜별로 다른 식단 템플릿을 운영할 수 있음
   - 예: 가정식도시락-중식 이번 주는 템플릿 A, 다음 주는 템플릿 B
   - 라인업 단계에서 "기본 템플릿"을 묶어두면 운영 유연성 저하
2. SNACK/EVENT 슬롯은 식단 템플릿 없이 SupplierItem 직결 운영
   - LineupMealTemplateMap이 모든 슬롯에 템플릿을 강제하는 형태가 됨
3. SNACK/EVENT 자체가 독립된 라인업으로 분리 운영될 가능성이 높음
   - 캠페인성 제휴 상품 등

### 폐기 결정에 따른 도메인 재정의
- **Lineup**: 판매 상품 분류 단위 (이름·코드·활성여부·정렬·설명만 보유, 슬롯·템플릿 관여 없음)
- **슬롯별 식단 템플릿 선택**: MealPlan 작성 단계에서 사용자가 직접 지정
- **MealPlan.mealTemplateId**: nullable 유지, 자동 채움 출처는 없음 (사용자 선택)

### 변경 파일

**삭제 (6)**
- `src/features/lineup/services/lineup-template-map.service.ts`
- `src/features/lineup/actions/lineup-template-map.action.ts`
- `src/features/lineup/actions/meal-template-options.action.ts`
- `src/features/lineup/components/lineup-template-map.tsx`
- `src/features/lineup/components/lineup-detail.tsx` (라인업 상세 페이지 자체 폐기 — 목록 → 수정 직행)
- `src/tests/lineup-template-map.service.test.ts`

**수정 (5)**
- `prisma/schema.prisma`
  - `LineupMealTemplateMap` 모델 블록 제거
  - `MealTemplate.lineupMaps` 관계 라인 주석 처리
  - `Lineup.templateMaps` 관계 라인 주석 처리
- `src/features/lineup/schemas/lineup.schema.ts` — TemplateMap 관련 스키마/타입 제거
- `src/features/lineup/services/lineup.service.ts`
  - `LINEUP_LIST_SELECT`에서 `_count.templateMaps` 제거
  - `getLineupById`에서 `include.templateMaps` 제거
  - `deleteLineup`을 transaction → 단순 `update({ deletedAt })`로 단순화
- `src/features/lineup/components/lineup-list.tsx` — "슬롯 매핑" 컬럼 + onViewDetail prop 제거
- `src/app/(dashboard)/lineups/page.tsx` — `detail` 모드 제거 (list / new / edit 3-mode로 축소)
- `src/tests/lineup.service.test.ts` — templateMap 관련 assertion 정리, deleteLineup 테스트를 단순 update로 변경

**신규 (1)**
- `prisma/migrations/20260527020000_phase5r_step2_drop_lineup_template_map/migration.sql`
  - `DROP TABLE IF EXISTS "lineup_meal_template_maps"`
  - FK는 모델 DROP 시 자동 정리

### 정리된 잔여 항목
- `src/features/lineup/constants/slot-types.ts` 빈 파일 삭제
  - 초기 설계에서 SNACK/EVENT 분리 가드용으로 만들어둔 placeholder
  - 라인업이 분류 단위로 단순화되면서 불필요해짐

### 검증
- `npx prisma migrate status`: Database schema is up to date
- `npx tsc --noEmit`: 0 errors
- `npm run test`: 13 files / 183 passed / 2 skipped
  - 이전 14 files / 206 tests 대비 -1 file, -23 tests (LineupMealTemplateMap 테스트 파일 + Lineup 테스트 중 매핑 관련 케이스 삭제 반영)

### 학습/회고
1. **도메인 검증은 UI 작업 직전이 마지막 기회** — Step 2.5 prep에서 한 번 재정의했음에도
   UI 작업 시작 시점에 다시 재정의가 발생함. "사용자가 실제로 어떻게 운영하는가"는
   schema/service 코드를 보는 것만으로는 드러나지 않음.
2. **폐기는 명시적으로** — 모델 블록 제거 + DROP 마이그레이션 + 코드 삭제까지 일관되게 처리해야
   다음 작업자에게 "이건 정말 안 쓴다"는 신호가 됨. 주석 처리만으로는 부족.
3. **단계별 점검(레포 검증)이 중요** — Phase 1 코드 제거 후 schema/마이그레이션 정리를
   별도 단계로 분리한 덕분에 drift를 사전 감지하고 정리할 수 있었음.

### 다음 단계
- Phase 5-R Step 2 종결
- Phase 5-R Step 3 — `CompanyMealSlot` 모듈 신설
  - `MealSlotType` enum 폐기 → 회사별 자유 슬롯 정의 모델로 전환
  - 사유: 향후 확장성 (프리미엄 중식, 캠페인 이벤트 등 자유 추가)
  - 자동 채번 `code` (SLOT-001), 생성 후 immutable
  - LUNCH/DINNER 기본 시드, isSystem 플래그 없음
  - 자세한 결정 사항은 Step 3 진입 시 별도 섹션 작성

---

---

## Phase 5-R Step 3 — CompanyMealSlot 모듈 (회사별 자유 슬롯 정의)

### 배경 / 결정 사항
- 기존 `MealSlotType` enum(`BREAKFAST/LUNCH/DINNER/SNACK/EVENT`)은 회사별 자유 슬롯 운영 요구사항을 충족하지 못함
  - 회사 A는 "중식/석식/제휴이벤트", 회사 B는 "프리미엄 중식/일반 중식/석식" 같이 다르게 운영
  - 향후 슬롯 추가가 빈번할 가능성 (캠페인 이벤트 등)
- 회사별로 자유롭게 슬롯을 정의할 수 있는 `CompanyMealSlot` 마스터 테이블 신설
- `MealSlotType` enum은 단계적으로 폐기 (Step 3.2b-2에서 제거)

### Step 진행 구조 (재구성)
실제 작업 순서를 PROGRESS.md에 정확히 반영하기 위해 아래 골격으로 재구성:

| Step | 작업 | 상태 |
|------|------|------|
| 3.1 | CompanyMealSlot 마스터 테이블 + 기본 시드 (LUNCH/DINNER) | ✅ |
| 3.2a | MealPlan/MealCount에 companyMealSlotId 컬럼 추가 + 백필 + EVENT 시드 | ✅ |
| 3.2b-1 | meal-plan zod/service에 companyMealSlotId 1급 입력 도입, slotType 호환 유지 | ✅ |
| 3.2b-2-α | UI 전환 (slotType Select → companyMealSlot 동적 Select) + 백엔드 slotType 입력 폐기 | ✅ |
| 3.2b-2-β | DB slot_type 컬럼/enum DROP + 호환 helper 제거 + 임시 잔재 정리 | ⬜ |
| 3.2c | CompanyMealSlot 마스터 관리 페이지 (CRUD UI) | ⬜ (보류 — 필요 시점에 진행) |
| 3.3 | meal-plan.service.test.ts 갱신 + 전체 테스트 통과 | ⬜ |
| 3.4 | /meal-plans UI 회귀 검증 + Phase 5-R Step 3 종합 검증 | ⬜ |

### Step 3.1 — CompanyMealSlot 마스터 테이블 ✅
- **날짜**: 2026-05-28
- **커밋**: `3b5eeaec`
- **변경 파일**:
  - `prisma/schema.prisma` — `CompanyMealSlot` 모델 신규 (id, companyId, code, displayName, description, isActive, sortOrder, timestamps, deletedAt), 유니크 `(companyId, code)`, 인덱스 4개
  - `prisma/migrations/20260528020000_phase5r_step3_1_add_company_meal_slot/migration.sql` — CREATE TABLE + FK + 인덱스
  - `prisma/migrations/20260528020001_phase5r_step3_1_fk_policy_fix/migration.sql` — FK 정책 보정 (마이그레이션 폴더 rename으로 ordering 정정)
  - `prisma/seed.ts` — 기본 슬롯 SLOT-001(중식), SLOT-002(석식) upsert
- **완료 항목**:
  - [x] CompanyMealSlot 모델 정의 (회사별 슬롯 자유 정의)
  - [x] 자동 채번 `code` (SLOT-001, SLOT-002 등), 생성 후 immutable 정책
  - [x] 기본 시드: SLOT-001(중식, sortOrder=10), SLOT-002(석식, sortOrder=20)
  - [x] 마이그레이션 폴더 timestamp 정정 (15125 → 020001로 rename, _prisma_migrations 테이블 동기화)
  - [x] `prisma migrate status`: Database schema is up to date
  - [x] `npx tsc --noEmit`: 0 errors
- **아키텍처 결정**:
  - 슬롯 `code`는 시스템 자동 채번 (사용자 입력 불가) — 일관된 정렬·표시 보장
  - `displayName`은 사용자가 자유롭게 변경 가능 (중식 → 점심특선 등)
  - `isSystem` 플래그 미도입 — 모든 슬롯을 동일하게 취급 (UnitMaster와 정책 차이, 단순성 우선)
  - FK 정책: ON DELETE NO ACTION + ON UPDATE CASCADE
- **다음 단계**: Step 3.2a — MealPlan/MealCount에 companyMealSlotId FK 컬럼 추가

### Step 3.2a — MealPlan/MealCount에 companyMealSlotId 컬럼 추가 + 백필 ✅
- **날짜**: 2026-05-28
- **커밋**: `944807bc`
- **배경**:
  - Step 3.1로 슬롯 마스터는 생성됐지만, 기존 MealPlan/MealCount는 여전히 `slotType` enum만 참조
  - 1단계로 신규 FK 컬럼을 추가하고 기존 데이터를 백필한 뒤, Step 3.2b-2에서 enum/컬럼을 제거하는 점진적 전환 방식 채택
  - 동시 변경은 롤백 비용이 크고 회귀 위험이 높아 분할 진행
- **변경 파일**: 5개 (신규 1 + 수정 4 + rename 1)
  - `prisma/migrations/20260528020100_phase5r_step3_2a_add_company_meal_slot_id_columns/migration.sql` — **신규**: nullable 컬럼 추가 → 백필 (LUNCH→SLOT-001, DINNER→SLOT-002, EVENT→SLOT-003) → DO $$ 검증 블록 → NOT NULL 전환 → FK + 인덱스
  - `prisma/schema.prisma` — `MealPlan`/`MealCount`에 `companyMealSlotId String @map("company_meal_slot_id")` + relation + `@@index([companyMealSlotId])`, `CompanyMealSlot`에 역참조 관계 `mealPlans MealPlan[]` / `mealCounts MealCount[]` 추가, `slotType`은 주석으로 "Step 3.2b-2에서 제거 예정" 명시
  - `prisma/seed.ts` — SLOT-003(제휴이벤트, sortOrder=30) upsert 추가, 8개 MealPlan + 8개 MealCount에 `companyMealSlotId` 매핑
  - `src/features/meal-plan/services/meal-plan.service.ts` — `SLOT_TYPE_TO_CODE` 상수 + `resolveCompanyMealSlotId` 호환 helper 추가, `createMealPlan`/`upsertMealCount`/`bulkUpsertMealCount`/`copyMealPlanGroup`에서 `companyMealSlotId` 채움 (bulk는 slotIdMap 캐시로 N+1 회피)
  - `prisma/migrations/20260528015125_…/` → `20260528020001_phase5r_step3_1_fk_policy_fix/` (폴더 rename, Step 3.1과 함께 정정)
- **완료 항목**:
  - [x] nullable 컬럼 추가 → 백필 → NOT NULL 전환 → FK + 인덱스 (단일 마이그레이션 트랜잭션)
  - [x] 백필 매핑: LUNCH → SLOT-001, DINNER → SLOT-002, EVENT → SLOT-003 (회사별)
  - [x] DO $$ 검증 블록: 매핑 실패 시 명확한 에러 메시지로 마이그레이션 중단
  - [x] SLOT-003(제휴이벤트) 시드 추가 (EVENT 백필 대응)
  - [x] service에 `resolveCompanyMealSlotId` 호환 helper 도입 (slotType → companyMealSlotId 변환, Step 3.2b-2에서 제거 예정)
  - [x] `slotType` 컬럼/enum은 그대로 유지 (Step 3.2b-2에서 일괄 제거)
  - [x] migrate reset 후 seed 8 MealPlan + 8 MealCount 모두 FK 매핑 (NULL 0건 SQL 확인)
  - [x] `npx tsc --noEmit`: 0 errors
  - [x] `npm run test`: 13 files / 183 passed / 2 skipped
- **트러블슈팅 이력** (참고):
  - 첫 마이그레이션 시도 시 P3018 (백필 단계에서 SLOT-003 누락으로 EVENT 행 매핑 실패) → `migrate resolve --rolled-back` 후 seed에 SLOT-003 추가하고 reset
  - seed 실행 시 PrismaClient에 `companyMealSlotId` 타입 부재 → `prisma generate` 재실행으로 해결
  - `prisma.mealPlan.findFirst` 시 P2021 (`MealPlan` 테이블 없음) → schema.prisma의 MealPlan/MealCount 모델에 `@@map("meal_plans")`/`@@map("meal_counts")` 누락 발견하여 추가
  - seed의 `mealPlan.create` 8곳에서 `companyMealSlotId` 누락 → 각각 명시적 매핑 추가
  - service에서 TS2322 5건 (`createMealPlan`/`upsertMealCount`/`bulkUpsertMealCount`/`copyMealPlanGroup` 2곳) → 위 helper 도입으로 해소
- **아키텍처 결정**:
  - **점진적 전환**: nullable 컬럼 → 백필 → NOT NULL의 3-step 패턴은 production migration에서도 안전. 단일 마이그레이션 안에서 트랜잭션으로 묶어 일관성 보장
  - **호환 helper 임시 유지**: `resolveCompanyMealSlotId`는 입력 API가 여전히 `slotType`을 받는 상태(UI 미전환)이므로 service 레이어에서 변환. Step 3.2b-2에서 helper 자체 제거 예정
  - **백필 검증의 명시화**: DO $$ 블록으로 NULL 0건을 보장 — silent failure 방지
- **다음 단계**: Step 3.2b-1 — meal-plan zod/service에 `companyMealSlotId`를 1급 입력으로 도입, `slotType` 호환은 유지 (UI는 변경 없음)

### Step 3.2b-1 — meal-plan zod/service에 companyMealSlotId 1급 입력 도입 ✅
- **날짜**: 2026-05-28
- **커밋**: `4629037e`
- **배경**:
  - Step 3.2a까지는 service 내부에서 `slotType`을 `companyMealSlotId`로 자동 변환하는 호환 모드로 운영
  - 본격적인 enum 폐기(Step 3.2b-2) 전에, API 입력에서 `companyMealSlotId`를 1급 시민으로 받을 수 있도록 zod 스키마와 service 시그니처를 먼저 확장
  - UI는 아직 `slotType`만 보내므로, 두 입력 모두 받되 `companyMealSlotId`가 있으면 우선 사용. 그 외 외부 client(API 직접 호출 등)는 신규 입력으로 옮길 수 있음
  - DB의 `slot_type` 컬럼은 그대로 유지 (UI/DB 동시 변경은 Step 3.2b-2에서)
- **변경 파일**: 3개 (수정)
  - `src/features/meal-plan/schemas/meal-plan.schema.ts` — `createMealPlanSchema`/`upsertMealCountSchema`에서 `slotType`을 optional로 변경, `companyMealSlotId` optional 추가, `.refine`으로 "둘 중 하나는 반드시 필요" 검증
  - `src/features/meal-plan/services/meal-plan.service.ts` — `resolveCompanyMealSlotIdFromInput` 헬퍼 신규 (companyMealSlotId가 있으면 회사 격리 검증 후 그대로 사용, 없으면 slotType→code 변환), `resolveSlotTypeFromCompanyMealSlot` 헬퍼 신규 (code→slotType 역매핑, 기본 3개 슬롯 외에는 EVENT로 fallback), `createMealPlan`/`upsertMealCount`/`bulkUpsertMealCount` 3곳에서 새 헬퍼 사용
  - `src/features/meal-plan/actions/meal-plan.action.ts` — `createMealPlanAction`/`upsertMealCountAction`/`bulkUpsertMealCountAction`의 에러 매핑에 `COMPANY_MEAL_SLOT_NOT_FOUND`, `SLOT_TYPE_REQUIRED` 추가
- **완료 항목**:
  - [x] zod schema: `slotType` 옵션화 + `companyMealSlotId` 옵션 추가 + `.refine`으로 XOR 검증 (둘 다 누락 시 거부)
  - [x] service: `companyMealSlotId` 우선 처리, 없으면 `slotType` → `companyMealSlotId` 변환 (기존 호환 helper 재사용)
  - [x] 회사 격리 검증: 외부로 받은 `companyMealSlotId`가 해당 회사 소속인지 `companyMealSlot.findUnique({ where: { id, ... } })`로 확인
  - [x] slotType 역매핑 helper: SLOT-001→LUNCH, SLOT-002→DINNER, SLOT-003→EVENT, 그 외→EVENT fallback (Step 3.2b-1 한정 임시 정책, Step 3.2b-2에서 slot_type 컬럼 제거 시 자연 소멸)
  - [x] action 에러 매핑 한글화: `COMPANY_MEAL_SLOT_NOT_FOUND` → "해당 슬롯을 찾을 수 없습니다", `SLOT_TYPE_REQUIRED` → "식사 타입 또는 슬롯을 선택하세요"
  - [x] UI 변경 없음 — 기존 `slotType` 입력 경로 정상 동작 (회귀 0건)
  - [x] `npx tsc --noEmit`: 0 errors
  - [x] `npm run test`: 13 files / 183 passed / 2 skipped
- **아키텍처 결정**:
  - **입력 우선순위**: `companyMealSlotId` > `slotType`. 두 필드가 모두 있으면 `companyMealSlotId`만 사용하고 `slotType`은 무시 (혼동 방지). 둘 다 없으면 `SLOT_TYPE_REQUIRED` 에러
  - **회사 격리는 service에서**: 다른 회사의 `companyMealSlotId`를 우회 입력하는 공격 차단. zod 단계에서는 형식만, 실제 검증은 DB 조회로
  - **fallback 정책**: Step 3.2b-1 단계에서는 기본 3개 슬롯(SLOT-001/002/003)만 운영 가정. 사용자가 SLOT-004 등 새 슬롯을 만들 수단(UI)이 없으므로 fallback이 실제로 발생하지 않음. Step 3.2b-2에서 컬럼 제거와 함께 정리
  - **helper 정의 위치 정리**: 기존 `resolveCompanyMealSlotId`가 `DbClient` 타입보다 먼저 선언돼 가독성 이슈 있었음 → 본 Step에서 타입 정의 이후로 재배치
- **다음 단계**: Step 3.2b-2 — UI를 companyMealSlot 동적 Select로 전환하고, DB의 `slot_type` 컬럼 및 `MealSlotType` enum 제거

### Step 3.2b-2-α — UI를 companyMealSlotId 1급 입력으로 전환 ✅
- **날짜**: 2026-05-29
- **커밋**: `4f8aace0`
- **배경**:
  - Step 3.2b-1까지는 UI가 여전히 `slotType` enum(조식/중식/석식/간식/이벤트)을 하드코딩한 Select로 보내고, service에서 자동 변환하는 호환 모드로 운영
  - 본격적인 enum 폐기를 위해 UI에서 회사별 동적 슬롯 Select로 전환하고, zod 입력에서 `slotType`을 제거하여 `companyMealSlotId`를 유일한 입력 채널로 승격
  - DB의 `slot_type` 컬럼/enum 자체는 본 단계에서 유지 (β에서 일괄 DROP). service가 `companyMealSlotId`로부터 `slotType`을 역매핑해서 컬럼을 채워주는 임시 로직 유지
- **변경 파일** (5개, +164 / −129):
  - `src/features/company-meal-slot/actions/company-meal-slot.action.ts` (신규) — `getActiveCompanyMealSlotsAction` + `CompanyMealSlotOption` 타입
  - `src/features/meal-plan/schemas/meal-plan.schema.ts` — `createMealPlanSchema` / `upsertMealCountSchema`에서 `slotType` 필드 제거, `companyMealSlotId` 필수 승격, refine XOR 제거
  - `src/features/meal-plan/services/meal-plan.service.ts` — `SLOT_TYPE_TO_CODE` / `resolveCompanyMealSlotIdBySlotType` 삭제, `resolveCompanyMealSlotIdFromInput`를 companyMealSlotId 단일 분기로 단순화, `MEAL_PLAN_INCLUDE` / `GROUP_DETAIL_INCLUDE`에 `companyMealSlot` include 추가
  - `src/features/meal-plan/actions/meal-plan.action.ts` — `createMealPlanAction` / `upsertMealCountAction` / `bulkUpsertMealCountAction`의 에러 매핑에서 `SLOT_TYPE_REQUIRED` 제거 (zod 필수 검증으로 도달 불가)
  - `src/app/(dashboard)/meal-plans/page.tsx` — 식단 추가 다이얼로그 Select를 회사별 동적 옵션으로 교체, `handleAddMeal` payload를 `companyMealSlotId` 기반으로 전환, 식단 카드 / 식수 행의 라벨링을 `companyMealSlot.displayName` 우선 + `slotType` fallback 정책으로 전환
- **완료 항목**:
  - [x] `getActiveCompanyMealSlotsAction` 신설 (회사 격리 + isActive 필터 + sortOrder 정렬)
  - [x] zod 스키마에서 `slotType` 입력 채널 폐기, `companyMealSlotId` 필수화
  - [x] service의 호환 helper 단순화 (β까지 임시 잔재만 남김)
  - [x] UI Select 동적 전환 + 라벨링 fallback 정책 적용
  - [x] PROGRESS.md 동시 갱신 (Step 3.2b-1 커밋 해시 정정 `abc1234` → `4629037e` 포함)
  - [x] `npx tsc --noEmit`: 0 errors
  - [x] `npm run test`: 통과
- **아키텍처 결정**:
  - **3.2b-2를 α(코드)/β(DB)로 분할**한 이유는 DB 마이그레이션 도중 UI 회귀가 동반될 경우 롤백 비용이 크기 때문. α에서 UI를 안정화하고 호환 helper로 DB와 격리한 뒤, β에서 호환 잔재를 일괄 제거.
  - **`company-meal-slot` 디렉토리를 별도로 신설**한 이유는 Step 3.2c에서 마스터 관리 CRUD action이 추가될 예정이라 자연스러운 응집도를 위함. 본 단계에서는 read action 하나만 들어가지만 명시적으로 `getActiveCompanyMealSlotsAction`으로 명명하여 향후 `getCompanyMealSlotsAction`(전체 목록, 비활성 포함)과 충돌하지 않도록 예약.
  - **라벨링 fallback 정책 (`displayName ?? SLOT_TYPE_LABEL ?? slotType`)**: β 이전까지 응답에 `slotType`이 함께 내려오는 호환 기간 동안 표시 안정성 확보. β에서 `slotType` 필드가 응답에서 사라지면 자연스럽게 첫 번째 분기만 살아남음.
- **β 단계 정리 대상 (메모)**:
  - `prisma/schema.prisma`: `MealPlan.slotType` / `MealCount.slotType` 컬럼 제거, `MealSlotType` enum DROP, unique `(mealPlanGroupId, slotType, lineupId)` → `(mealPlanGroupId, companyMealSlotId, lineupId)` 교체
  - `prisma/seed.ts`: 시드의 `slotType` 라인 제거
  - service의 `CODE_TO_SLOT_TYPE` 상수, `resolveSlotTypeFromCompanyMealSlot` 함수, `createMealPlan` / `upsertMealCount` / `bulkUpsertMealCount`의 `slotType` 역매핑 호출 라인, `assertMealPlanInCompany`의 `slotType: true` select, `deleteMealPlan`의 cascade MealCount 조건 (`slotType` → `companyMealSlotId`), `MEAL_PLAN_INCLUDE` / `GROUP_DETAIL_INCLUDE`의 `orderBy: [{ slotType: "asc" }, ...]` (companyMealSlot.sortOrder로 교체)
  - schema의 `mealSlotTypeEnum` / `MealSlotType` export 제거
  - page.tsx의 `MealPlanRow.slotType` / `MealCountRow.slotType` 필드 + `SLOT_TYPE_LABEL` 상수 + 옛 `addMealSlotType` state 주석 제거 + 라벨링 fallback 단순화
- **다음 단계**: Step 3.2b-2-β — DB 마이그레이션 + 호환 잔재 일괄 제거


### Step 3.2b-2-β — slot_type 완전 제거 ✅ (2026-06-01)

**목적**: MealSlotType enum과 slot_type 컬럼을 DB·코드에서 완전히 제거하고 companyMealSlotId 단일 키로 통합.

**변경 파일** (7개):
- `prisma/schema.prisma`
  - `enum MealSlotType` 블록 삭제
  - `MealPlan.slotType`, `MealCount.slotType` 필드 삭제
  - `@@unique` 키를 `(mealPlanGroupId, companyMealSlotId, lineupId)`로 교체 (양 모델)
- `prisma/migrations/20260601025811_drop_meal_slot_type/migration.sql`
  - FK Drop → Index Drop → Column Drop → Enum Drop → Index Create → FK Re-add
- `prisma/migrations/20260601030000_complete_drop_meal_slot_type_partial_unique/migration.sql` (보완)
  - meal_plans/meal_counts unique index를 partial(`WHERE deleted_at IS NULL`)로 재생성
  - company_meal_slot_id FK 재생성 (ON DELETE RESTRICT, ON UPDATE CASCADE)
- `prisma/seed.ts`
  - MealPlan/MealCount seed에서 slotType 라인 전량 제거 (16+8 곳)
  - upsert 복합 키를 companyMealSlotId 기반으로 교체
- `src/features/meal-plan/schemas/meal-plan.schema.ts`
  - `mealSlotTypeEnum`, `MealSlotType` export 삭제
  - createMealPlanSchema/upsertMealCountSchema 주석을 β로 갱신
- `src/features/meal-plan/services/meal-plan.service.ts`
  - `MealSlotType` import 삭제
  - `CODE_TO_SLOT_TYPE` 상수, `resolveSlotTypeFromCompanyMealSlot` 헬퍼 삭제
  - createMealPlan / upsertMealCount / bulkUpsertMealCount: slotType 필드 제거, 복합 키를 `mealPlanGroupId_companyMealSlotId_lineupId`로 교체
  - assertMealPlanInCompany select에서 slotType 제거
  - deleteMealPlan 캐스케이드 where절을 companyMealSlotId 기반으로 변경
  - copyMealPlanGroup 매핑에서 slotType 라인 제거
  - MEAL_PLAN_INCLUDE / GROUP_DETAIL_INCLUDE / getMealCounts orderBy를 `companyMealSlot.sortOrder`로 변경
- `src/app/(dashboard)/meal-plans/page.tsx`
  - MealPlanRow / MealCountRow 타입에서 slotType 제거
  - `SLOT_TYPE_LABEL` 상수 삭제
  - 라벨 fallback을 `companyMealSlot?.displayName ?? "-"`로 단순화

**마이그레이션 이력 특이사항**:
- 1차 마이그레이션(`...025811`)은 활성 partial unique 미적용으로 인해 soft-deleted 행과 충돌, 롤백됨
- 2차 보완 마이그레이션(`...030000`)으로 partial unique + FK 재생성하여 해결
- 최종 상태: `prisma migrate status` up-to-date, 29개 마이그레이션

**검증 완료**:
- ✅ `npx tsc --noEmit` 0 errors
- ✅ DB 인덱스/FK 검증 (pg_indexes, pg_constraint)
- ✅ 식단 추가/삭제/삭제 후 재추가(partial unique 동작 확인)
- ⏭️ 식수 입력은 UI 미구현으로 다음 스텝에서 검증 예정

**다음 스텝**: 식수 입력 UI 추가 (Step 3.2c 또는 별도 스텝)

### Phase 5-R Step 6-3c-A — MealCount 입력 UI 최소 구현 ✅
- **날짜**: 2026-06-01
- **커밋**: `9ba2d21`
- **변경 파일**: 2개 (+192 / -4)
  - `src/app/(dashboard)/meal-plans/page.tsx` — `upsertMealCountAction` / `deleteMealCountAction` import, 식수 추가 다이얼로그(슬롯 Select + LineupSelect + 예상/확정 input), 행 단위 삭제 버튼, deleteTarget union에 `"mealCount"` 추가
  - `PROGRESS.md` — Step 6-3c-A 섹션 추가
- **완료 항목**:
  - [x] `+ 식수 추가` 버튼 → 다이얼로그 (슬롯·라인업·예상·확정)
  - [x] 식수 테이블에 행 단위 🗑 버튼
  - [x] soft-delete 후 동일 (slot, lineup) 조합 재등록 시 reactivation
  - [x] `npx tsc --noEmit` 0 errors
- **백엔드**: Step 3.2b-2-β에서 이미 준비 완료 (`upsertMealCount` 합성키, `deleteMealCount` soft-delete)
- **후속 조정 사유**: 별도 추가 다이얼로그 방식이 "식단 없이도 식수가 생성될 수 있는 구조"라 데이터 무결성 약점이 있어, 곧바로 Step 6-3c-A2로 1:1 통합 뷰로 재설계.

### Phase 5-R Step 6-3c-A2 — MealCount × MealPlan 1:1 통합 뷰 ✅
- **날짜**: 2026-06-01
- **커밋**: `9078d01`
- **변경 파일**: 1개 (+210 / -150)
  - `src/app/(dashboard)/meal-plans/page.tsx` — 독립 "식수 추가" 다이얼로그 폐기, "식단/식수 현황" 통합 섹션으로 전환
- **완료 항목**:
  - [x] `detailGroup.mealPlans`를 기준으로 행을 그려, 같은 (`companyMealSlotId`, `lineupId`) `MealCount`를 옆에 매칭 표시
  - [x] 행별 상태 배지: `미입력` / `예상만` / `확정`
  - [x] 행별 `[입력]` 또는 `[수정]` 버튼 → 식수 편집 다이얼로그 (슬롯·라인업 readonly로 prefilled)
  - [x] 행별 🗑 버튼은 `MealCount`가 존재할 때만 노출
  - [x] 전역 `+ 식수 추가` 버튼 제거 → 식단 없이 식수만 등록되는 경로 차단
  - [x] `upsertMealCountAction` / `deleteMealCountAction`은 그대로 재사용 (백엔드 변경 0)
  - [x] `npx tsc --noEmit` 0 errors
  - [x] 모든 (slot × lineup) 조합 CRUD + soft-delete reactivation 정상 동작 검증
- **데이터 모델 정합성**:
  - `MealPlan`과 `MealCount`는 같은 `(mealPlanGroupId, companyMealSlotId, lineupId)` 합성키를 공유 → 사실상 1:0..1 관계
  - UI 차원에서 `MealPlan`이 선행 등록되어야 `MealCount` 입력 진입점이 노출되도록 강제 → 고아 `MealCount` 데이터 발생 가능성 0
- **잔여 정리 항목**: `openMealCountEditor` / `closeMealCountEditor` / `handleSaveMealCount`의 들여쓰기가 4스페이스 추가로 작성됨. 기능엔 영향 없음. Phase 7-A 패치 시 동일 파일을 열 때 함께 정리.
- **Phase 5-R 라운드 종료 판정**: ✅ 모든 Step 완료. `01_개발순서.md §3.8` 규정에 따라 Sprint 2 원래 미완료 작업 재개.

### Step 3.2c — CompanyMealSlot 마스터 관리 페이지 ⬜ (보류)
- **상태**: 별도 Step으로 분리, 필요 시점에 착수
- **사유**: 현재 기본 3개 슬롯(SLOT-001/002/003)으로 비즈니스 요구를 충족. 운영 중 슬롯 추가가 실제 필요해질 때 진행
- **예상 작업 범위**:
  - `/company-meal-slots/page.tsx` — CRUD 페이지 (목록/생성/수정/비활성화/sortOrder 변경)
  - `company-meal-slot.service.ts`/`action.ts` — CRUD + 의존성 체크 (MealPlan/MealCount 참조 시 비활성화로 제한)
  - 사이드바 메뉴 추가 (관리 그룹 하위)

### Step 3.3 — meal-plan.service.test.ts 갱신 + 전체 테스트 통과 ⬜
- **목표**:
  - Step 3.2b-2 적용 후 service 테스트가 `companyMealSlotId` 기반으로 동작하도록 갱신
  - 신규 테스트 케이스: 회사 격리 위반 시 `COMPANY_MEAL_SLOT_NOT_FOUND` 에러 발생 확인
  - 기존 `slotType` 기반 케이스를 `companyMealSlotId` 기반으로 마이그레이션
- **선결 조건**: Step 3.2b-2 완료

### Step 3.4 — /meal-plans UI 회귀 검증 + Phase 5-R Step 3 종합 검증 ⬜
- **목표**:
  - UI 전 시나리오 수동 검증 (식단 그룹 생성/삭제/복사, 식단 추가/삭제, 식수 입력)
  - `prisma migrate status`, `tsc --noEmit`, `npm test` 통과 확인
  - PROGRESS.md Phase 5-R Step 3 종결 처리
  - Sprint 2 원래 미완료 Phase(2-e, 6, 7, 8, 9, 10, 11) 재개 판정

---

### Phase 6 — 식단 캘린더 뷰 ⬜
- **예정일**: 2026-05-17 ~ 2026-05-18
- **예상 시간**: 6h
- **작업**: `meal-plan-calendar.tsx` (주간/월간 캘린더, 드래그/클릭 슬롯 배정)

### Phase 7 (재개) — 슬롯 상세 에디터 ⏳ (착수 대기)
- **목표**: `MealPlanSlot`의 추가/수정/삭제/재정렬 UI를 식단 카드 안에 제공.
- **사전 확인 완료** (재개 시 ready 상태):
  - 백엔드 액션: `createMealPlanSlotAction`, `updateMealPlanSlotAction`, `deleteMealPlanSlotAction`, `reorderMealPlanSlotsAction` ✅
  - SubsidiaryMaster(CONTAINER) 조회: `getContainerGroupsAction` (paginated, `loadAllPages` 호환) ✅
  - Recipe 조회: `getRecipesAction` ✅
  - SupplierItem 조회: `getSupplierItemsAction(supplierId)` (DIRECT 슬롯용, 7-B 단계에서 사용) ✅
  - LineupSelect 컴포넌트 ✅
  - ⛔ ProductionLine 조회 액션은 별도 feature가 없음 → Step 7-A에서 `meal-plan.action.ts`에 `getActiveProductionLinesAction` (회사 격리, 가벼운 인라인) 추가
- **분할 계획**:
  - **Step 7-A**: 컨테이너(CONTAINER) 슬롯 추가 다이얼로그. 각 식단 카드 위에 "슬롯 추가" 버튼 → 다이얼로그(부자재(CONTAINER), containerSlotIndex, recipe, productionLine, quantity, note). `slotKind=CONTAINER` 고정.
  - **Step 7-B**: DIRECT 슬롯 지원. 다이얼로그 상단에 CONTAINER/DIRECT 토글 추가, DIRECT 선택 시 SupplierItem Select 노출.
  - **Step 7-C**: 슬롯 수정 다이얼로그 + 드래그/드롭 재정렬 (`reorderMealPlanSlotsAction`).
- **권장 의사결정** (사용자 확인 완료):
  - ProductionLine UI = 본 Phase에서 `getActiveProductionLinesAction` 추가하여 Select 노출 (옵션 b).
  - Step 7-A는 CONTAINER만 우선 (옵션 a).
  - "슬롯 추가" 버튼은 각 MealPlan 카드 헤더 우측 (옵션 a).
- **착수 전 마지막 점검**:
  - [ ] `npx tsc --noEmit` 0 errors 베이스라인 확인
  - [ ] 잔여 정리 항목 (page.tsx 들여쓰기 3건) 함께 처리 여부 결정

## Phase 7-A2 / 7-A3 / 7-A4 — 식단 슬롯 등록 UI 전면 개편 (완료)

- **Date**: 2026-06-02
- **Commits**:
  - `8449ee6` — feat(meal-plan): add bulkCreateContainerSlots backend (Phase 7-A3)
  - `1f330f6` — feat(ui): add SearchableSelect combobox component (Phase 7-A4)
  - `f060cb5` — feat(meal-plan): replace single-slot dialog with bulk container assignment + template auto-apply + searchable selects

### Changes
- **Backend (Phase 7-A3)**
  - `meal-plan.schema.ts`: `bulkCreateContainerSlotsSchema` 추가 (recipeId nullable, productionLine 기본값/오버라이드)
  - `meal-plan.service.ts`: `bulkCreateContainerSlots(companyId, mealPlanId, input)` — 회사 격리/라인 ACTIVE/레시피 검증 후 `prisma.$transaction`으로 일괄 생성, `SLOT_INCLUDE` 포함 반환
  - `meal-plan.action.ts`: `bulkCreateContainerSlotsAction` — 권한·감사 로그·에러 매핑 (`SUBSIDIARY_NOT_FOUND`, `PRODUCTION_LINE_NOT_FOUND`, `RECIPE_NOT_FOUND`)
- **Frontend**
  - 기존 단일 슬롯 추가 다이얼로그 폐기, 식단 카드 헤더에 "용기 그룹 배정" 버튼 + 템플릿 적용된 경우 "템플릿 재적용" 버튼 노출
  - 용기 그룹 선택 시 해당 그룹의 모든 ContainerSlot을 펼쳐 한 화면에서 일괄 배정 (요약: 총/배정/미배정 카운터)
  - 7-A2(E1): 식단 추가 시 `mealTemplateId` 지정 시 `applyMealTemplateAction` 자동 호출
  - 7-A2(F1): 기존 슬롯이 있을 때 "템플릿 재적용" → AlertDialog로 덮어쓰기 명시 확인
  - 7-A4: `src/components/ui/searchable-select.tsx` 신규 — cmdk + Popover 기반 검색 가능 단일 선택 (라벨/서브라벨/우측정보, allowClear 옵션)
  - 식단 추가 다이얼로그의 템플릿 선택과 bulk 슬롯 다이얼로그의 용기/레시피/라인 선택 모두 검색 가능 셀렉트로 전환

### Decisions
- A2 (빈 슬롯 허용) / B2 (한 식단에 같은 용기 그룹 중복 가능) / C2 (서버 bulk 트랜잭션) / D2 (기본 라인 + 행별 오버라이드) / E1 (템플릿 자동 적용) / F1 (재적용 시 명시 확인) / G2 (부자재 UI는 다음 단계)

---

## Phase 7-B1 / 7-B2 — 슬롯 인라인 편집 + 부자재 CRUD (완료)

- **Date**: 2026-06-02
- **Commit**: `6d0e410` — feat(meal-plan): add slot inline editing + accessory CRUD UI (Phase 7-B1/B2)

### Changes
- 슬롯 테이블에 ✏️(수정) 버튼 추가, 클릭 시 행이 amber 배경의 편집 모드로 전환
- CONTAINER 슬롯 편집: 레시피(SearchableSelect, 미배정 허용), 생산라인, 수량, 비고
- DIRECT 슬롯 편집: supplierItem은 read-only, 수량/라인/비고만 편집
- 부자재 카드: "+ 추가" 버튼, 칩 옆 ✏️/✕ 마이크로 버튼
- 부자재 추가/수정 다이얼로그 (공용): 부자재 선택, 소비 방식(PER_MEAL_COUNT / FIXED_QUANTITY), 고정수량 조건부 노출, 필수 체크박스, 비고
- `handleConfirmDelete`에 `accessory` 분기 추가, `deleteTarget` union 확장

### Known Issues (→ Phase 7-C 대상)
- 부자재 다이얼로그 selector가 CONTAINER 타입 SubsidiaryMaster를 노출 (잘못된 옵션)
- 슬롯 테이블이 단일 평탄 리스트라 같은 용기 그룹의 슬롯이 시각적으로 묶이지 않음
- 부자재 수정 시 subsidiary selector가 잠겨 있어 부자재 본체 변경 불가

---

## Phase 7-C1 / 7-C2 / 7-C3 — 슬롯 그룹화 + 부자재 도메인 분리 + 수정 자유화 (완료)

- **Date**: 2026-06-02
- **Commits**:
  - `8ad8388` — feat(meal-plan): group slot table by container subsidiary (Phase 7-C1)
  - `2a1acc3` — feat(meal-plan): use non-container subsidiaries for accessory selector + allow changing subsidiary in edit (Phase 7-C2/C3)
  - `14e9794` — fix(meal-plan): respect subsidiaryListQuery limit max + load ACCESSORY/CONSUMABLE separately (Phase 7-C2 hotfix)

### Changes

#### Phase 7-C1 — 슬롯 그룹화
- `<TableBody>` 내부의 단일 `mp.slots.map((slot) => ...)` 평탄 루프를 `(() => { ... })()` IIFE로 감싼 그룹화 렌더링으로 교체
- 그룹화 키 규칙:
  - CONTAINER 슬롯: `subsidiaryMaster.id` 기준 (subsidiaryMaster null이면 "용기 미지정" 그룹)
  - DIRECT 슬롯: 단일 "직배송" 그룹
- 그룹 표시 순서: 첫 번째 슬롯의 `sortOrder`가 작은 순 (안정 정렬)
- 그룹 헤더 (`colSpan={6}` 행): 아이콘 + 그룹명 + `code` + 배정 카운터(`N/M 배정`)
  - CONTAINER: `Package` 아이콘 + 파란 배경(`bg-blue-50/60`), 미지정 시 회색
  - DIRECT: `Truck` 아이콘 + 황색 배경(`bg-amber-50/60`)
- 그룹 내부 슬롯 행은 기존 보기/편집 모드 동작 그대로 유지

#### Phase 7-C2 — 부자재 도메인 분리
- `getSubsidiariesAction as getMaterialSubsidiariesAction` 별칭 import (container.action의 동명 함수와 충돌 회피)
- 새 타입 `AccessoryOption` 추가 (id, name, code, unit, subsidiaryType)
- 새 state `accessoryOptions: AccessoryOption[]` 추가
- 새 callback `loadAccessoryOptions()` 추가: `ACCESSORY` + `CONSUMABLE` 두 타입을 `Promise.all`로 병렬 조회 후 name 가나다 정렬로 합침 (CONTAINER는 슬롯 배정 전용이므로 제외)
- `useEffect` 의존성에 추가
- 부자재 다이얼로그의 SubsidiaryMaster selector 데이터 소스를 `containerOptions` → `accessoryOptions`로 교체
- 옵션 우측에 `unit` 표시 (rightLabel)
- 부자재 0개일 때 안내 문구 노출

#### Phase 7-C3 — 부자재 수정 자유화
- 부자재 다이얼로그 SubsidiaryMaster selector의 `disabled={!!accessoryEditTarget}` 제거 → 수정 시에도 자유 변경 가능
- "수정 시 변경 불가" 안내 문구 제거 → 빈 옵션 안내 문구로 교체

#### Phase 7-C2 hotfix
- 1차 푸시 후 `[ERROR] "[MealPlansPage.loadAccessoryOptions]" "부자재 목록 조회에 실패했습니다"` 발생
- 원인: `subsidiaryListQuerySchema.limit` max=100인데 500을 보내 Zod validation 실패
- 수정: `limit: 100`으로 축소 + 클라이언트 필터 대신 서버 `subsidiaryType` 필터 명시 호출로 전환 (2회 병렬)
- 에러 로깅도 타입별 분리

### Decisions
- C1: 그룹 헤더는 읽기 전용 (그룹 일괄 변경/삭제는 별도 Phase로)
- C2: CONTAINER 제외 = ACCESSORY + CONSUMABLE (사용자 확정: 용기는 별도 도메인, 부자재는 사용량 처리 대상)
- C2: 클라이언트 필터링보다 서버 필터링 선호 (limit 효율, 정확성)
- C3: 부자재 수정 시 subsidiary 자유 변경 허용 (활용성 우선, 잘못 선택 시 재선택 비용 < 삭제 후 재추가 비용)

### Resolved Known Issues (7-B Carry-over)
- ✅ 부자재 다이얼로그 selector가 CONTAINER 타입을 노출 → `accessoryOptions`로 교체
- ✅ 슬롯 테이블 평탄 리스트 → 용기 그룹별 헤더로 시각적 구분
- ✅ 부자재 수정 시 subsidiary selector 잠김 → disabled 제거

---

## Phase 7-D — 후속 정비 (예정)

다음 라운드 후보:
- 슬롯 재정렬 UI (그룹 내 ↑↓ 또는 드래그-드롭)
- 그룹 단위 액션 (그룹 전체 라인 일괄 변경, 그룹 전체 삭제)
- 템플릿 페이지(`/meal-templates`)의 부자재 selector도 동일 패턴으로 점검
- MealPlanAccessory 백엔드 테스트 보강 (Phase 10 일부 선행 가능)

---

## 🚧 Sprint 2 보강 라운드 — 사용자 검수 발견 사항 (2026-06-04)

Phase 7-C 완료 후 사용자 직접 검수에서 4개 영역 우려사항 정리.

- **Phase 7-A/B/C** 완료 (별도 섹션 — 슬롯 상세 에디터 1차)
- **Phase 7-D** 완료: 레시피·반제품 상세 다이얼로그 자동 닫힘 회귀 제거 (commit `f36a630`)
- **Phase 7-D hotfix** 완료: 반제품 BOM 자재 셀렉트 비어있던 회귀 해소 — `materialListQuery` limit max 준수 + `loadAllPages` 적용 (commit `d782f7b`)
- **Phase 7-F1** 완료: `findMatchingActiveBom` + `getEligibleRecipesForContainerSlot` 도입, `createMealPlanSlot` / `updateMealPlanSlot` / `bulkCreateContainerSlots` 서버 가드 (R1 ACTIVE BOM, R2 슬롯 일치, R3 totalWeightG>0, R4 recipeBomId 자동 기록), 에러 코드 `BOM_NOT_MATCHED` / `BOM_SLOT_NOT_MATCHED` / `BOM_SLOT_WEIGHT_ZERO` / `CONTAINER_SLOT_INFO_MISSING` (commit `1f15999`)
- **Phase 7-F2/F3** 완료: 인라인 편집 + 일괄 배정 SearchableSelect를 `eligibleRecipesCache`(`subsidiaryId:slotIndex` 키) 기반으로 교체, 로딩/적격 없음 상태 placeholder + amber 경고, `openSlotEdit` / `handleBulkContainerChange`에서 사전 로드 (commit `ff12ed6`)
- **Phase 7-F2/F3 cleanup** 완료: 미사용 `recipeOptions` state 제거 (commit `<여기에 Commit A의 해시>`)

### Issue-7-E — BOM 슬롯 totalWeightG 수동 입력 (Mid)
- **증상**: 자재를 연결해도 슬롯 총중량은 별도 수동 입력 (items.weightG 합산과 동기화되지 않음)
- **요구**: items.weightG 합산값으로 자동 표시 (수동 입력 칸 → 읽기전용 자동 표시)
- **구현 방향**: 서비스 레이어에서 RecipeBOMSlotItem CRUD 시 부모 slot의 totalWeightG 자동 갱신 (Option A — DB 컬럼 유지, 동기화)

### Issue-7-G — 단위 환산 가드 부재 (Mid)
- **정책 확인 사항**: 
  - 자재 마스터 unit은 발주/재고 표시 단위 (kg/L 허용)
  - BOM 계산은 g/mL 단위로 통일 (RecipeBOMSlotItem.unit 기본값 "g")
  - SupplierItem.supplyUnit + supplyUnitQty → UnitConversion 경유 → 자재 unit → global UnitConversion → BOM 단위(g)
- **현재 환산 가능성**: 구조적으로는 **2단계 환산(공급단위 → 자재 unit → BOM g)으로 모든 패키지 표현 가능**. seed에 global `kg→g`, `L→mL` 사전 등록됨.
- **보완 필요 항목 (가드 부재)**:
  - 가드-① SupplierItem 등록 시 `supplyUnit`의 unitCategory가 자재 마스터의 unitCategory와 일치하는지 검증 (현재 검증 없음)
  - 가드-② UnitConversion 등록 시 fromUnit/toUnit이 자재 unitCategory와 일치하는지 검증 (현재 검증 없음)
  - 가드-③ SupplierItem 등록 시 supplyUnit → 자재 unit 환산 경로 존재 여부 사전 확인 + 미존재 시 경고 (현재 미확인 — Phase 9 진입 시 폭발 위험)
  - 가드-④ 자재 폼/SupplierItem 폼에 "이 단위는 ... 단계로 환산됩니다" 도움말 (UX)
- **참고**: 자재 unit이 정책상 g 통일이 의도인지 / kg/L 허용 후 BOM 계산 시 g 환산이 의도인지 사용자 확인 필요. 후자라면 현재 시드/구조와 일치하므로 가드만 보완하면 됨.

### 진행 순서 (권장)
1. Phase 7-D — 식자재 연속 추가 (작고 빠른 가치, 사용자 호소 즉시 해소)
2. Phase 7-F — BOM 매칭 제약 (데이터 무결성, Phase 9 사전 정비)
3. Phase 7-E — 총중량 자동 합산 (UX 일관성)
4. Phase 7-G — 단위 환산 가드 (Phase 9 진입 전 필수)

각 Phase 완료 시 본 섹션의 해당 Issue를 ✅로 갱신.

---

### Phase 8 — MealCount + MealPlanAccessory 서비스/UI ⬜
- **예정일**: 2026-05-19 ~ 2026-05-20
- **예상 시간**: 4h
- **대상 모델**: MealCount, MealPlanAccessory
- **작업**: 예상/확정 식수 입력, 부자재(악세서리) 매핑 UI

### Phase 9 — 소요량 자동 산출 서비스 ⬜
- **예정일**: 2026-05-20 ~ 2026-05-21
- **예상 시간**: 5h
- **대상 모델**: MaterialRequirement
- **작업**: `material-requirement.service.ts` (BOM→재료 전개, 인원수 반영, 자동 산출)

### Phase 10 — 테스트 작성 ⬜
- **예정일**: 2026-05-21 ~ 2026-05-22
- **예상 시간**: 4h
- **작업**: `meal-plan.service.test.ts`, `material-requirement.service.test.ts`

### Phase 11 — 페이지 통합 + Sprint 2 QA ⬜
- **예정일**: 2026-05-22 ~ 2026-05-23
- **예상 시간**: 4h (QA 1일 여유 포함)
- **작업**: `/meal-plans/page.tsx` 통합, toast 적용, E2E 검증, PROGRESS.md 갱신

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

### Phase 4 — ProductionLine 서비스 + 액션 ⬜ (3h)

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
- `PROGRESS.md` — 전체 진행 이력 + 현재 상태 + 남은 작업
- `01_개발순서.md` — 전체 실행 순서
- `02_개발문서.md` — 구조 설계와 계층 규칙
- `03_개발가이드문서.md` — 현재 라운드 실행 절차
- `04_전체 구현 체크리스트 및 코드기준안.md` — 검증 기준 / 파일별 TODO / DoD
- `05_불일치 정리 및 통합기준 제안.md` — 공식 변경 이력
- `06_Phase 3. 식단 관리 프로세스.md` — 현재 작업 현황과 실제 단계
- `07_HANDOFF.md` — 다음 작업자 인수인계 패키지

### 현재 개발 기준선
- Sprint 1 완료
- Sprint 2는 Phase 5까지 완료
- Sprint 2는 아직 종료되지 않았음
- Sprint 2 원래 계획은 유지
- 단, Sprint 2 후속 Phase 진행 전 구조 재정의 보강이 선행됨

### 다음 시작 파일
1. `prisma/schema.prisma`
2. `prisma/seed.ts`
3. `src/features/meal-plan/schemas/meal-plan.schema.ts`
4. `src/features/meal-plan/services/meal-plan.service.ts`
5. `src/features/meal-plan/actions/meal-plan.action.ts`
6. `src/app/(dashboard)/meal-plans/page.tsx`
7. 관련 테스트 파일


