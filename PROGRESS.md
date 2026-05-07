# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> 마지막 갱신: 2026-05-07 (Phase 3 완료 — 단위 관리 중앙화)

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
| 14 | ContainerGroup | 구현완료 | — | ✅ |
| 15 | ContainerSlot | 구현완료 | — | ✅ |
| 16 | ContainerAccessory | 구현완료 | — | ✅ |
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
| 27 | MealTemplate | S2 | P1-2 | ⬜ |
| 28 | MealTemplateSlot | S2 | P1-2 | ⬜ |
| 29 | MealTemplateAccessory | S2 | P1-2 | ⬜ |
| 30 | MealPlanGroup | S2 | P3-5 | ⬜ |
| 31 | MealPlan | S2 | P3-5 | ⬜ |
| 32 | MealPlanSlot | S2 | P6-7 | ⬜ |
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

## 🏗️ Sprint 1: 안정화 + 품질 기반 확보 (5/4 ~ 5/11)

> ⚠️ 일정 변경: 기존 5/4~5/9 → 5/4~5/11 (Phase 2에서 이슈 7건 발견, +9h 추가 소요)
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
  1. 🔴 **단위 자유입력** — UnitCategory 기반 Select Box로 변경 필요 → ✅ Phase 3에서 해소
  2. 🔴 **용기 삭제 의존성 미검증** — FK 체크 없음 → 의존성 확인 + UI 경고 필요
  3. 🟡 **재료 추가 모달 즉시 닫힘** — 연속 추가 모드 + "완료" 버튼 필요
  4. 🟡 **Select Box 불편** — cmdk 기반 combobox 전환 필요 → ✅ Phase 3에서 부분 해소 (DB 기반 Select 전환)
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

### Phase 4 — Container 삭제 의존성 검증 + UI 경고 ⬜
- **예정일**: 2026-05-08
- **예상 시간**: 2h
- **작업 범위**:
  - [ ] `container.service.ts`에 삭제 전 RecipeBOMSlot 의존성 확인 로직 추가
  - [ ] `DEPENDENCY_EXISTS` 에러 throw + 연결된 레시피 목록 반환
  - [ ] `containers/page.tsx`에서 의존성 경고 Alert 표시

### Phase 5 — duplicateRecipeBOM 서비스 + 액션 구현 ⬜
- **예정일**: 2026-05-08
- **예상 시간**: 2h
- **작업 범위**:
  - [ ] `recipe-bom.service.ts`에 `duplicateRecipeBOM` 추가 (트랜잭션으로 슬롯·아이템 전체 복사)
  - [ ] `recipe.action.ts`에 `duplicateRecipeBOMAction` 추가
  - [ ] `recipe-bom.service.test.ts`에 복제 테스트 추가

### Phase 6 — BOM UI 완전 보강 ⬜
- **예정일**: 2026-05-08 ~ 2026-05-09
- **예상 시간**: 6h
- **작업 범위**:
  - [ ] ACTIVE BOM "보관" 버튼, 모든 상태 BOM에 "복제해서 새 버전" 버튼
  - [ ] DRAFT BOM baseWeightG 인라인 편집
  - [ ] 슬롯 인라인 편집 (totalWeightG, note)
  - [ ] 슬롯별 "재료 추가" 버튼
  - [ ] 슬롯 이름에 ContainerSlot 실제 라벨 표시 (이슈 #6)
  - [ ] 레시피 기본정보 탭에 "배식 구성" 섹션 추가 (이슈 #7)
  - [ ] 재료 추가 연속 모드 + combobox 전환 (이슈 #3, #4)

### Phase 7 — container.service.test.ts 작성 ⬜
- **예정일**: 2026-05-09
- **예상 시간**: 1.5h
- **작업 범위**: 그룹 CRUD, 슬롯 CRUD, 페이지네이션, soft-delete, 의존성 삭제 차단 테스트

### Phase 8 — Toast 확대: material + subsidiary (6개 컴포넌트) ⬜
- **예정일**: 2026-05-09 ~ 2026-05-10
- **예상 시간**: 3h
- **대상**: material-list, material-form, material-detail-panel, subsidiary-list, subsidiary-form, subsidiary-detail-panel

### Phase 9 — Toast 확대: supplier (4개 컴포넌트) ⬜
- **예정일**: 2026-05-10
- **예상 시간**: 2h
- **대상**: supplier-list, supplier-form, supplier-item-list, supplier-item-form

### Phase 10 — Toast 확대: recipe + semi-product + unit-conversion (7개 컴포넌트) ⬜
- **예정일**: 2026-05-10 ~ 2026-05-11
- **예상 시간**: 2.5h

### Phase 11 — CONVENTIONS.md 전수 점검 ⬜
- **예정일**: 2026-05-11
- **예상 시간**: 3h
- **점검**: any 타입, console.log 잔여, deletedAt 조건, 트랜잭션, assertPermission, createAuditLog, 테스트 존재

### Phase 12 — recipe.action.ts 서비스 계층 분리 ⬜
- **예정일**: 2026-05-11 ~ 2026-05-12
- **예상 시간**: 4h
- **작업**: recipe.action.ts (39KB) → 비즈니스 로직을 service 레이어로 분리

### Phase 13 — Error Boundary + 타입 강화 ⬜
- **예정일**: 2026-05-12
- **예상 시간**: 2h
- **작업**: `error.tsx` 신규, loadAllPages 제네릭 타입 강화

### Phase 14 — Sprint 1 최종 QA ⬜
- **예정일**: 2026-05-12
- **예상 시간**: 2h
- **검증**: 이슈 #1~#7 전체 해소 확인, 17개 컴포넌트 toast, 전체 테스트 PASS

---

## 🏗️ Sprint 2: 식단 템플릿 + 식단 계획 (5/13 ~ 5/22, ~48h)

> ⚠️ MealTemplate, MealCount, MealPlanAccessory 누락 반영으로 Phase 11개, 공수 39h→48h
> ⚠️ 일정 조정: Sprint 1 Phase 3 확장(+5.5h)으로 Sprint 2 시작일 5/12→5/13

### Phase 1 — MealTemplate Zod 스키마 + 서비스 ⬜
- **예정일**: 2026-05-13
- **예상 시간**: 4h
- **대상 모델**: MealTemplate, MealTemplateSlot, MealTemplateAccessory
- **작업**: `src/features/meal-template/schemas/meal-template.schema.ts`, `meal-template.service.ts` 작성

### Phase 2 — MealTemplate 액션 + UI ⬜
- **예정일**: 2026-05-13 ~ 2026-05-14
- **예상 시간**: 5h
- **작업**: `meal-template.action.ts`, `meal-template-list.tsx`, `meal-template-form.tsx`, `/meal-templates/page.tsx`

### Phase 3 — MealPlanGroup/MealPlan Zod 스키마 + 서비스 ⬜
- **예정일**: 2026-05-14 ~ 2026-05-15
- **예상 시간**: 6h
- **대상 모델**: MealPlanGroup, MealPlan, MealPlanSlot
- **작업**: `meal-plan.schema.ts`, `meal-plan.service.ts` (그룹 CRUD, 식단 생성·복사, 슬롯 배정)

### Phase 4 — MealPlan 액션 ⬜
- **예정일**: 2026-05-15 ~ 2026-05-16
- **예상 시간**: 4h
- **작업**: `meal-plan.action.ts` (입력 검증, 권한, 감사 로그)

### Phase 5 — 식단 그룹 UI ⬜
- **예정일**: 2026-05-16
- **예상 시간**: 4h
- **작업**: `meal-plan-group-list.tsx`, `meal-plan-group-form.tsx`

### Phase 6 — 식단 캘린더 뷰 ⬜
- **예정일**: 2026-05-16 ~ 2026-05-17
- **예상 시간**: 6h
- **작업**: `meal-plan-calendar.tsx` (주간/월간 캘린더, 드래그/클릭 슬롯 배정)

### Phase 7 — 슬롯 상세 에디터 ⬜
- **예정일**: 2026-05-17 ~ 2026-05-18
- **예상 시간**: 4h
- **작업**: `meal-plan-slot-editor.tsx` (레시피 선택, RecipeBOM 선택, 인원수 입력)

### Phase 8 — MealCount + MealPlanAccessory 서비스/UI ⬜
- **예정일**: 2026-05-18 ~ 2026-05-19
- **예상 시간**: 4h
- **대상 모델**: MealCount, MealPlanAccessory
- **작업**: 예상/확정 식수 입력, 부자재(악세서리) 매핑 UI

### Phase 9 — 소요량 자동 산출 서비스 ⬜
- **예정일**: 2026-05-19 ~ 2026-05-20
- **예상 시간**: 5h
- **대상 모델**: MaterialRequirement
- **작업**: `material-requirement.service.ts` (BOM→재료 전개, 인원수 반영, 자동 산출)

### Phase 10 — 테스트 작성 ⬜
- **예정일**: 2026-05-20 ~ 2026-05-21
- **예상 시간**: 4h
- **작업**: `meal-template.service.test.ts`, `meal-plan.service.test.ts`, `material-requirement.service.test.ts`

### Phase 11 — 페이지 통합 + Sprint 2 QA ⬜
- **예정일**: 2026-05-21 ~ 2026-05-22
- **예상 시간**: 4h (QA 1일 여유 포함)
- **작업**: `/meal-plans/page.tsx` 통합, toast 적용, E2E 검증, PROGRESS.md 갱신

---

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
- **계층별 권한 분리**:
  - SYSTEM_ADMIN: 전체 회사 사용자 관리
  - COMPANY_ADMIN: 소속 회사 사용자 관리
  - MEMBER: 본인 정보만 조회/수정

### Phase 2 — User 관리 UI + /users/page.tsx ⬜ (4h)
- **작업**: 사용자 목록, 역할 변경, 상태 변경, 회사 할당

### Phase 3 — PermissionSet 서비스 + 액션 ⬜ (5h)
- **대상 모델**: PermissionSet, PermissionSetItem
- **작업**:
  - 권한셋 CRUD (이름, 설명)
  - 권한 아이템 관리 (리소스×액션 매트릭스)
  - 리소스 목록: material, subsidiary, supplier, container, recipe, meal-plan, purchase-order, receiving, inventory, shipping, consumption, cooking-plan, cost, month-end, notification, company, location, production-line, lineup, user, audit-log
  - 액션 목록: CREATE, READ, UPDATE, DELETE, APPROVE, EXPORT

### Phase 4 — PermissionSet UI + /permission-sets/page.tsx ⬜ (5h)
- **작업**: 권한셋 목록, 권한 매트릭스 편집기(리소스×액션 체크박스), 사용자 연결 현황

### Phase 5 — Invitation 서비스 + 액션 ⬜ (5h)
- **대상 모델**: Invitation
- **작업**:
  - 초대 생성 (이메일, 역할, 토큰 생성, 만료일 설정)
  - 초대 메일 발송 (NotificationLog 연동)
  - 초대 수락 (토큰 검증 → User 생성/연결 → UserScope 생성 → 권한셋 자동 할당)
  - 초대 만료 처리
  - 초대 취소/재발송

### Phase 6 — Invitation UI + /invitations/page.tsx ⬜ (4h)
- **작업**: 초대 목록, 초대 발송 폼, 수락/만료 상태 표시, 재발송 버튼
- **수락 페이지**: `/invite/[token]/page.tsx` (비로그인 사용자용)

### Phase 7 — 사이드바 재구성 (사용자/권한 메뉴 추가) ⬜ (2h)
- **작업**: "관리" 그룹(사용자, 권한셋, 초대) 추가

### Phase 8 — 테스트 (사용자/권한셋/초대) ⬜ (4h)
### Phase 9 — Sprint 7 E2E + QA ⬜ (3h)
- **검증 시나리오**:
  - [ ] COMPANY_ADMIN이 MEMBER 초대 → 이메일 발송 확인
  - [ ] 초대 토큰으로 수락 → User 생성 + UserScope(MEMBER) 할당 확인
  - [ ] 권한셋 생성 → 사용자에 할당 → 해당 권한만 접근 가능 확인
  - [ ] MEMBER가 관리자 전용 페이지 접근 시 403 확인
  - [ ] 권한셋 변경 시 즉시 반영 확인

---

## 🏗️ Sprint 8: 대시보드 + 감사로그 + UX 통일 + 최종 QA (7/17 ~ 7/25, ~38h)

> 기존 Sprint 6 내용을 확장 + AutoGenLog 추가

### Phase 1 — 메인 대시보드 서비스 ⬜ (4h)
- **작업**: 오늘의 식단 요약, 재고 경고(min/max 기준), 미처리 발주/입고 현황, 금일 출고 현황, 원가 추이 차트 데이터

### Phase 2 — 메인 대시보드 UI + /(dashboard)/page.tsx ⬜ (5h)
- **작업**: KPI 카드, 식단 위젯, 재고 경고, 발주 현황, 원가 추이 차트

### Phase 3 — AuditLog 조회 서비스 ⬜ (2h)
- **대상 모델**: AuditLog
- **작업**: 회사별 감사 로그 조회, 필터(기간/사용자/엔티티/액션), 페이지네이션

### Phase 4 — AuditLog UI + /audit-logs/page.tsx ⬜ (3h)
- **작업**: 감사 로그 목록, before/after diff 뷰, 필터

### Phase 5 — CONVENTIONS.md 최종 점검 ⬜ (3h)
- **작업**: 전체 서비스/액션 파일 대상 12개 규칙 준수 확인

### Phase 6 — UI/UX 통일 ⬜ (4h)
- **작업**: 전체 페이지 일관성(간격, 색상, 폰트), 반응형, 접근성, 로딩 상태

### Phase 7 — AutoGenLog 조회 UI ⬜ (2h)
- **대상 모델**: AutoGenLog
- **작업**: 자동 생성 로그 조회, 상태별 필터

### Phase 8 — 사이드바 최종 정리 ⬜ (2h)
- **작업**: 전체 메뉴 그룹 정리, 아이콘 통일, 접근 권한별 메뉴 표시/숨김

### Phase 9 — 전체 E2E 풀 플로우 검증 ⬜ (5h)
- **검증 시나리오**:
  - [ ] 사용자 초대 → 로그인 → 식단 생성 → 소요량 산출 → 발주 → 입고 → 재고 확인 → 출고 → 소비 → 원가 계산 → 월말 마감
  - [ ] 권한별 접근 제한 확인 (SYSTEM_ADMIN, COMPANY_ADMIN, MEMBER)
  - [ ] 조직 계층 롤업 (Company → Location → ProductionLine → CookingPlan)
  - [ ] 감사 로그 전체 추적

### Phase 10 — 문서화 + 배포 설정 + 최종 QA ⬜ (4h)
- **작업**: API 문서 갱신, README 갱신, 배포 설정(Vercel/Docker), PROGRESS.md 최종 갱신

---

## 📊 전체 요약

| Sprint | 기간 | 주요 내용 | Phase 수 | 예상 공수 | 상태 |
|--------|------|-----------|----------|-----------|------|
| Sprint 1 | 5/4 ~ 5/12 | 안정화 + 품질 기반 | 14 | ~37.5h | 🟡 진행 중 (3/14) |
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
| 2 | 용기 삭제 의존성 미검증 | 🔴 | ⬜ 미해소 | Phase 4 예정 |
| 3 | 재료 추가 모달 즉시 닫힘 | 🟡 | ⬜ 미해소 | Phase 6 예정 |
| 4 | Select Box 사용성 | 🟡 | 🟡 부분 해소 | Phase 3 (DB Select), Phase 6 (combobox) |
| 5 | BOM 등록 후 수정 불가 | 🔴 | ⬜ 미해소 | Phase 5-6 예정 |
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
| 2026-05-07 | Phase 3 완료 — 단위 관리 중앙화 | 4커밋에 걸친 대규모 작업 (상수 Select → DB 기반 UnitMaster 중앙 관리). `/units` 독립 페이지 신설, 사이드바 메뉴 추가, 자재/부자재 페이지 탭 축소, 단위환산 Form DB Select 전환, unitCategory 수정 지원, 약어=코드 자동 반영. 이슈 #1 완전 해소, #4 부분 해소. 모델 커버리지에 UnitMaster 추가. Sprint 1 일정 +1일 (5/11→5/12), Sprint 2 시작일 5/12→5/13 조정 |
