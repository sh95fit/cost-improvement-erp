# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> 마지막 갱신: 2026-05-14 (Sprint 2 Phase 4 완료 — MealPlanGroup/MealPlan 스키마+서비스+액션)

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

## 📋 Prisma 스키마 모델 커버리지 (68모델 + UnitMaster)

> 아래 표는 schema.prisma v4의 모델이 어느 Sprint의 어느 Phase에서 구현되는지를 추적한다.

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
| 30 | MealPlanGroup | S2 | P3-4 | ✅ |
| 31 | MealPlan | S2 | P3-4 | ✅ |
| 32 | MealPlanSlot | S2 | P3-4 | ✅ |
| 33 | MealCount | S2 | P8 | ⬜ |
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

### Phase 5 — 식단 그룹 UI ⬜
- **예정일**: 2026-05-17
- **예상 시간**: 4h
- **작업**: `meal-plan-group-list.tsx`, `meal-plan-group-form.tsx`

### Phase 6 — 식단 캘린더 뷰 ⬜
- **예정일**: 2026-05-17 ~ 2026-05-18
- **예상 시간**: 6h
- **작업**: `meal-plan-calendar.tsx` (주간/월간 캘린더, 드래그/클릭 슬롯 배정)

### Phase 7 — 슬롯 상세 에디터 ⬜
- **예정일**: 2026-05-18 ~ 2026-05-19
- **예상 시간**: 4h
- **작업**: `meal-plan-slot-editor.tsx` (레시피 선택, RecipeBOM 선택, 인원수 입력)

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
- **작업**: 발주 목록, 발주서 상세, 품목 편집, 승인 워크플로
### Phase 5 — 입고 Zod 스키마 ⬜ (2h)
- **대상 모델**: ReceivingNote, ReceivingNoteItem
### Phase 6 — receiving.service.ts ⬜ (4h)
- **작업**: 입고 등록, 발주 대비 수량 대조, InventoryLot 자동 생성, InventoryTransaction 기록
### Phase 7 — receiving.action.ts + 입고 UI ⬜ (4h)
### Phase 8 — /receiving/page.tsx 통합 ⬜ (2h)
### Phase 9 — 테스트 + E2E + Sprint 3 QA ⬜ (4h)

---

## 🏗️ Sprint 4: 재고 + 재고이동 + 재고실사 + 출고 + 소비 + 조리계획 (6/1 ~ 6/15, ~62h)

> ⚠️ 기존 Sprint 4(41h)에 InventoryTransfer, StockTake, CookingPlan 등 누락분 통합

### Phase 1 — 재고 조회 서비스 ⬜ (4h)
- **대상 모델**: InventoryLot, InventoryTransaction
- **작업**: 로트별/자재별 재고 현황 조회, 트랜잭션 이력
### Phase 2 — 재고 UI + /inventory/page.tsx ⬜ (4h)
### Phase 3 — InventoryReservation 서비스 ⬜ (3h)
- **작업**: 예약 생성/해제, 예약 현황 조회, 자동 만료
### Phase 4 — InventoryTransfer 서비스 + 액션 ⬜ (4h)
- **대상 모델**: InventoryTransfer, InventoryTransferItem
- **작업**: 이동 요청(PUSH/PULL), 확인, 수령, 재고 차감/증가 트랜잭션
### Phase 5 — InventoryTransfer UI + /transfers/page.tsx ⬜ (4h)
### Phase 6 — StockTake 서비스 + 액션 ⬜ (4h)
- **대상 모델**: StockTake, StockTakeItem
- **작업**: 실사 생성, 시스템 수량 자동 로드, 실수량 입력, 차이 계산, 재고 보정 트랜잭션
### Phase 7 — StockTake UI + /stock-takes/page.tsx ⬜ (3h)
### Phase 8 — ShippingOrder 서비스 + 액션 ⬜ (4h)
- **대상 모델**: ShippingOrder, ShippingOrderItem
- **작업**: 출고 지시서 생성, 상태 관리, 재고 차감
### Phase 9 — ShippingOrder UI + /shipping/page.tsx ⬜ (3h)
### Phase 10 — ConsumptionItem 서비스 + 액션 ⬜ (4h)
- **대상 모델**: ConsumptionItem, ConsumptionLotDetail
- **작업**: 소비 등록, 로트 차감(FIFO), 소비 확정
### Phase 11 — ConsumptionItem UI + /consumption/page.tsx ⬜ (3h)
### Phase 12 — CookingPlan 서비스 + 액션 ⬜ (5h)
- **대상 모델**: CookingPlan, CookingPlanItem, CookingPlanSlot
- **작업**: 조리 계획 생성(식단→조리 변환), 슬롯별 레시피/BOM 스냅샷, 소요 자재 산출
### Phase 13 — CookingPlan UI + /cooking-plans/page.tsx ⬜ (4h)
### Phase 14 — 테스트 (재고/이동/실사/출고/소비/조리) ⬜ (4h)
### Phase 15 — Sprint 4 E2E + QA ⬜ (3h)

---

## 🏗️ Sprint 5: 원가 + 간접비 + 월말 마감 + 알림 (6/16 ~ 6/28, ~52h)

> ⚠️ OverheadCost, CostCalculation, NotificationTemplate/Rule/TagDef 관리 UI 추가 반영

### Phase 1 — 원가 스냅샷 서비스 ⬜ (4h)
- **대상 모델**: CostSnapshot, CostSnapshotItem
- **작업**: 기간별 스냅샷 생성, 자재별 평균단가/수량/금액 집계
### Phase 2 — 원가 스냅샷 UI ⬜ (3h)
### Phase 3 — CostCalculation 서비스 ⬜ (5h)
- **대상 모델**: CostCalculation, CostCalculationItem
- **작업**: 예상/발주/실적 원가 계산 엔진, 레시피·식단 단위 원가 산출
### Phase 4 — CostCalculation UI + /cost/page.tsx ⬜ (4h)
### Phase 5 — OverheadCost 서비스 + 액션 ⬜ (3h)
- **대상 모델**: OverheadCost
- **작업**: 간접비(인건비, 광열비 등) 월별 등록/수정/삭제, 원가 배부
### Phase 6 — OverheadCost UI + /overhead-costs/page.tsx ⬜ (3h)
### Phase 7 — MonthEndSnapshot 서비스 ⬜ (5h)
- **대상 모델**: MonthEndSnapshot, MonthEndAdjustment, MonthEndAdjustmentItem
- **작업**: 월말 마감(스냅샷 생성, 잠금), 조정 내역 관리
### Phase 8 — MonthEnd UI + /month-end/page.tsx ⬜ (4h)
### Phase 9 — NotificationTemplate/Rule 서비스 ⬜ (4h)
- **대상 모델**: NotificationTagDef, NotificationRule, NotificationTemplate, NotificationLog
- **작업**: 태그 정의 CRUD, 템플릿 CRUD, 규칙 CRUD, 발송 엔진(IN_APP/EMAIL)
### Phase 10 — Notification UI + /notifications/page.tsx ⬜ (4h)
- **작업**: 알림 규칙 관리, 템플릿 편집, 알림 로그 조회
### Phase 11 — 테스트 (원가/간접비/월말/알림) ⬜ (4h)
### Phase 12 — Sprint 5 E2E + QA ⬜ (3h)

---

## 🏗️ Sprint 6: 조직 관리 — 회사·거점·라인·라인업 (6/29 ~ 7/7, ~38h)

> ⚠️ 신규 Sprint — 기존 일정에서 완전히 누락되었던 조직 계층 구조 + 권한 관리 포함

### Phase 1 — Company 서비스 + 액션 ⬜ (3h)
- **대상 모델**: Company
- **작업**: 회사 CRUD, 회사 정보 수정 (SYSTEM_ADMIN/COMPANY_ADMIN 전용)
### Phase 2 — Company UI + /companies/page.tsx ⬜ (3h)
- **작업**: 회사 목록 (SYSTEM_ADMIN), 회사 설정 (COMPANY_ADMIN)
### Phase 3 — Location 서비스 + 액션 ⬜ (3h)
- **대상 모델**: Location
- **작업**: 거점(주방/창고) CRUD, 계층 구조(Company→Location)
### Phase 4 — ProductionLine 서비스 + 액션 ⬜ (3h)
- **대상 모델**: ProductionLine
- **작업**: 제조라인 CRUD, 상태 관리(ACTIVE/INACTIVE/MAINTENANCE), 계층(Company→Location→ProductionLine)
### Phase 5 — Lineup 서비스 + 액션 ⬜ (3h)
- **대상 모델**: Lineup, LineupLocationMap
- **작업**: 라인업 CRUD, 라인업↔거점 매핑 관리
### Phase 6 — Location/ProductionLine/Lineup UI ⬜ (5h)
- **작업**: `/locations/page.tsx`, `/production-lines/page.tsx`, `/lineups/page.tsx`
- **계층 네비게이션**: 회사 → 거점 → 라인 트리 구조 UI
### Phase 7 — 테스트 (조직 관리 전체) ⬜ (3h)
### Phase 8 — Sprint 6 E2E + QA ⬜ (2h)
### Phase 9 — 사이드바 재구성 (조직 메뉴 추가) ⬜ (2h)
- **작업**: sidebar.tsx에 "조직 관리" 그룹(회사, 거점, 제조라인, 라인업) 추가

---

## 🏗️ Sprint 7: 권한 관리 + 사용자 + 초대 (7/8 ~ 7/16, ~42h)

> ⚠️ 신규 Sprint — 권한셋 설정을 통한 계층별 권한 분리, 초대 프로세스 전체

### Phase 1 — User/UserScope 관리 서비스 ⬜ (4h)
- **대상 모델**: User, UserScope
- **작업**: 사용자 목록 (회사별), 사용자 상태 관리(ACTIVE/INACTIVE/SUSPENDED), UserScope 변경(역할 변경, 권한셋 할당)
- **계층별 권한 분리**: SYSTEM_ADMIN(전체), COMPANY_ADMIN(소속 회사), MEMBER(본인만)
### Phase 2 — User 관리 UI + /users/page.tsx ⬜ (4h)
### Phase 3 — PermissionSet 서비스 + 액션 ⬜ (5h)
- **대상 모델**: PermissionSet, PermissionSetItem
- **작업**: 권한셋 CRUD, 권한 아이템 관리 (리소스×액션 매트릭스)
### Phase 4 — PermissionSet UI + /permission-sets/page.tsx ⬜ (5h)
- **작업**: 권한셋 목록, 권한 매트릭스 편집기(리소스×액션 체크박스), 사용자 연결 현황
### Phase 5 — Invitation 서비스 + 액션 ⬜ (5h)
- **대상 모델**: Invitation
- **작업**: 초대 생성, 초대 메일 발송, 초대 수락 (토큰 검증 → User+UserScope 생성), 만료/취소/재발송
### Phase 6 — Invitation UI + /invitations/page.tsx ⬜ (4h)
- **작업**: 초대 목록, 수락 페이지 (`/invite/[token]/page.tsx`)
### Phase 7 — 사이드바 재구성 (사용자/권한 메뉴 추가) ⬜ (2h)
### Phase 8 — 테스트 (사용자/권한셋/초대) ⬜ (4h)
### Phase 9 — Sprint 7 E2E + QA ⬜ (3h)
- **검증**: 초대→수락→권한셋 할당→접근 제한 확인

---

## 🏗️ Sprint 8: 대시보드 + 감사로그 + UX 통일 + 최종 QA (7/17 ~ 7/25, ~38h)

> 기존 Sprint 6 내용을 확장 + AutoGenLog 추가

### Phase 1 — 메인 대시보드 서비스 ⬜ (4h)
- **작업**: 오늘의 식단 요약, 재고 경고, 미처리 발주/입고, 원가 추이 차트 데이터
### Phase 2 — 메인 대시보드 UI + /(dashboard)/page.tsx ⬜ (5h)
### Phase 3 — AuditLog 조회 서비스 ⬜ (2h)
- **대상 모델**: AuditLog
### Phase 4 — AuditLog UI + /audit-logs/page.tsx ⬜ (3h)
### Phase 5 — CONVENTIONS.md 최종 점검 ⬜ (3h)
### Phase 6 — UI/UX 통일 ⬜ (4h)
- **작업**: 전체 페이지 일관성, 반응형, 접근성, 로딩 상태
### Phase 7 — AutoGenLog 조회 UI ⬜ (2h)
- **대상 모델**: AutoGenLog
### Phase 8 — 사이드바 최종 정리 ⬜ (2h)
### Phase 9 — 전체 E2E 풀 플로우 검증 ⬜ (5h)
- **검증**: 초대→로그인→식단→발주→입고→재고→출고→소비→원가→마감 전체 흐름
### Phase 10 — 문서화 + 배포 설정 + 최종 QA ⬜ (4h)

---

## 📊 전체 요약

| Sprint | 기간 | 주요 내용 | Phase 수 | 예상 공수 | 상태 |
|--------|------|-----------|----------|-----------|------|
| Sprint 1 | 5/4 ~ 5/12 | 안정화 + 품질 기반 | 14 | ~37.5h | 🟡 진행 중 (5/14) |
| Sprint 2 | 5/13 ~ 5/22 | 식단 템플릿 + 식단 계획 | 11 | ~48h | ⬜ 대기 |
| Sprint 3 | 5/23 ~ 5/31 | 발주 + 입고 | 9 | ~32h | ⬜ 대기 |
| Sprint 4 | 6/1 ~ 6/15 | 재고 + 이동 + 실사 + 출고 + 소비 + 조리 | 15 | ~62h | ⬜ 대기 |
| Sprint 5 | 6/16 ~ 6/28 | 원가 + 간접비 + 월말 + 알림 | 12 | ~52h | ⬜ 대기 |
| Sprint 6 | 6/29 ~ 7/7 | 조직 관리 (회사·거점·라인·라인업) | 9 | ~38h | ⬜ 대기 |
| Sprint 7 | 7/8 ~ 7/16 | 권한 관리 + 사용자 + 초대 | 9 | ~42h | ⬜ 대기 |
| Sprint 8 | 7/17 ~ 7/25 | 대시보드 + 감사로그 + UX + 최종 QA | 10 | ~38h | ⬜ 대기 |
| **총계** | **5/4 ~ 7/25** | | **89** | **≈349.5h** | |

---

## 📋 Sprint 1 이슈 추적

| # | 이슈 | 심각도 | 상태 | 해소 Phase |
|---|------|--------|------|-----------|
| 1 | 단위 자유입력 → DB Select 전환 필요 | 🔴 | ✅ 해소 | Phase 3 |
| 2 | 용기 삭제 의존성 미검증 | 🔴 | ✅ 해소 | Phase 4 |
| 3 | 재료 추가 모달 즉시 닫힘 | 🟡 | ⬜ 미해소 | Phase 6 예정 |
| 4 | Select Box 사용성 | 🟡 | 🟡 부분 해소 | Phase 3 (DB Select), Phase 6 (combobox) |
| 5 | BOM 등록 후 수정 불가 | 🔴 | 🟡 부분 해소 | Phase 5 (서비스/액션), Phase 6 (UI 연동) |
| 6 | 슬롯 이름 미표시 | 🟡 | ⬜ 미해소 | Phase 6 예정 |
| 7 | 레시피 기본정보 용기/슬롯 요약 없음 | 🟢 | ⬜ 미해소 | Phase 6 예정 |

---

## 🔄 변경 이력

| 날짜 | 변경 내용 | 사유 |
|------|-----------|------|
| 2026-05-04 | 최초 작성 | Sprint 1 Phase 1 완료 시점 |
| 2026-05-04 | Sprint 1에 Phase 3~4 추가 (BOM 편집 보강) | BOM 등록 후 수정 불가 이슈 발견 |
| 2026-05-04 | 작업 프로세스 6단계 규칙 추가 | 검증 누락 방지 |
| 2026-05-06 | Phase 2 완료, 이슈 7건 등록, Sprint 1 일정 +2일 확장 | E2E 검증 결과 반영 |
| 2026-05-06 | 전체 일정 재산정 — 68모델 전수 대조, Sprint 6-8 신규 | 누락 모델 발견 |
| 2026-05-07 | Phase 3 완료 — 단위 관리 중앙화 | 4커밋 대규모 작업. `/units` 독립 페이지, UnitMaster 모델, DB Select 전환. 이슈 #1 해소, #4 부분 해소 |
| 2026-05-07 | Phase 4 완료 — 컨테이너 의존성 체크 | 3파일 수정. 삭제 전 MealTemplate/RecipeBOMSlot 참조 확인, UI "삭제 불가" 모달. 이슈 #2 해소 |
| 2026-05-07 | Phase 5 완료 — RecipeBOM 복제 서비스 | 2파일 수정. `duplicateRecipeBOM` (트랜잭션 복사), `duplicateRecipeBOMAction`. 이슈 #5 부분 해소 (서비스 완료, UI는 Phase 6) |
