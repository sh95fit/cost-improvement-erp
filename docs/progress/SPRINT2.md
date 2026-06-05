
# Sprint 2: 식단 템플릿·식단 계획 (5/12 ~ 진행 중)

> 본 문서는 PROGRESS.md에서 분리한 Sprint 2 전체 Phase 상세 이력 아카이브이다.
> 현재 상태 요약은 `PROGRESS.md`, 모델 구현 현황은 `SCHEMA_COVERAGE.md`를 참조한다.

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

## Phase 5-R Step 3: CompanyMealSlot 모듈 (2026-05-15)

### 목표
- `MealSlotType` enum (조식/중식/석식/EVENT) → 회사별 동적 슬롯 마스터로 전환
- 자동채번: `SLOT-001`, `SLOT-002`, ...
- 회사별 기본 슬롯 시드 (조식/중식/석식)

### 스키마 변경 (commit `a3f218c1`)
- **추가 모델**: `CompanyMealSlot`
  - 필드: `id, companyId, code, displayName, description, isActive, sortOrder, createdAt, updatedAt, deletedAt`
  - 인덱스: `@@unique([companyId, code])`, `@@index([companyId, isActive])`, `@@index([companyId, sortOrder])`
- **MealPlan 변경**: `slotType: MealSlotType` → `companyMealSlotId: String` (FK)
- **MealCount 변경**: 동일하게 `companyMealSlotId`로 전환
- **MealSlotType enum 제거**: 모든 참조 코드 정리
- 마이그레이션: `20260515093012_phase5r_step3_company_meal_slot`

### 서비스 (`src/features/company-meal-slot/services/company-meal-slot.service.ts`)
- CRUD 11개 함수: `createCompanyMealSlot, getCompanyMealSlot, listCompanyMealSlots, updateCompanyMealSlot, deleteCompanyMealSlot, restoreCompanyMealSlot, getNextSlotCode, seedDefaultSlots, validateSlotCode, getActiveSlotsByCompany, reorderSlots`
- 의존성 체크: MealPlan, MealCount에서 사용 중인 슬롯은 hard delete 금지 → soft delete만 허용
- 자동채번: 회사별 마지막 `SLOT-XXX` 조회 후 +1

### 액션 (`src/features/company-meal-slot/actions/company-meal-slot.action.ts`)
- 11개 액션 함수, 권한 키 `companyMealSlot`
- `handleActionError` 일관 적용

### UI (commit `e7a40d92`)
- 경로: `/company-meal-slots`
- 사이드바 메뉴 추가 (UtensilsCrossed 아이콘)
- 컴포넌트: `company-meal-slot-list.tsx`, `company-meal-slot-form.tsx`, `company-meal-slot-breadcrumb.tsx`

### 테스트
- `company-meal-slot.service.test.ts`: 18개 테스트
- 총 14파일 / 201 테스트 / 2 skip / 0 fail
- TypeScript errors: 0

### 시드 스크립트 업데이트
- `prisma/seed.ts`: 각 회사에 기본 슬롯 3개(BREAKFAST/LUNCH/DINNER) 자동 생성
- 기존 데이터 마이그레이션: 기존 `MealPlan.slotType` 값을 조회 → 회사별 `CompanyMealSlot` 생성 → FK 매핑

---

## Phase 5-R Step 4: Lineup ↔ CompanyMealSlot 연결 (2026-05-16)

### 목적
Lineup이 어떤 슬롯에서 사용 가능한지 명시 (예: "한정식 라인업"은 중식/석식 전용)

### 스키마 (commit `c12d9a47`)
- 신규 모델 `LineupSlotMap`:
  - `id, lineupId, companyMealSlotId, isDefault, createdAt`
  - `@@unique([lineupId, companyMealSlotId])`
- 마이그레이션: `20260516081245_phase5r_step4_lineup_slot_map`

### 서비스 / 액션 / UI
- `lineup-slot-map.service.ts`: 5개 함수 (assign, unassign, list, setDefault, validateAssignment)
- Lineup 상세/편집 다이얼로그에서 슬롯 다중선택 UI 추가
- 테스트: 12개 추가 → 총 213 PASS

---

## Phase 5-R Step 5: MealPlan 자동 생성 로직 재구성 (2026-05-17)

### 변경 사항 (commit `4e5d8a31`)
- 기존 `MealPlanGroup` 생성 시 자동으로 슬롯별 `MealPlan`을 모두 만들던 로직 제거
- 새 흐름: `MealPlanGroup` 생성 후, 사용자가 (슬롯 × 라인업) 조합으로 `MealPlan`을 명시적으로 추가
- 서비스 `meal-plan.service.ts`:
  - `createMealPlan(groupId, slotId, lineupId, templateId?)` 단일 진입점
  - 중복 검증: 동일 `(group, slot, lineup)` 활성 행 1개 강제
  - Soft delete 후 재생성 허용

### UI 변경
- `src/app/(dashboard)/meal-plans/page.tsx`: 그룹별 슬롯 탭 + 라인업 다중 선택
- `meal-plan-grid.tsx`: 행=라인업, 열=슬롯 매트릭스 뷰

### 테스트
- `meal-plan.service.test.ts` 전면 재작성 (28개)
- 총 16파일 / 219 PASS / 2 skip / 0 fail

---

## Phase 6 (예정): 식단 캘린더 뷰 ⬜
- `/meal-plans/calendar` 페이지
- 월간 캘린더에 `MealPlanGroup` 표시, 클릭 시 그룹 상세 모달
- 의존: Phase 7-E (캘린더 UI 컴포넌트) 완료 필요

---

## Phase 7-A: MealTemplate 슬롯 확장 (2026-05-18, commit `5a8c1f23`)

### 변경
- `MealTemplateContainer`에 `accessoryGroup` 필드 추가 (옵션)
- `MealTemplateAccessory.consumptionMode`: FIXED / PER_PERSON / PER_CONTAINER
- 서비스 / 액션 / UI 동기화

---

## Phase 7-B: MealPlanSlot 직접 입력 모드 (2026-05-19, commit `7b9d2e44`)

### 변경
- `SlotKind.DIRECT` 케이스: 컨테이너 없이 `RecipeBOM`을 직접 지정
- UI: 슬롯 추가 다이얼로그에 "직접 입력" 토글
- 검증: `kind=DIRECT`일 때 `containerSlotId` 금지, `recipeBomId` 필수

---

## Phase 7-C: MealPlanAccessory 모듈 (2026-05-20, commit `9c1a3f55`)

### 신규 기능
- 식단별 부재료 추가 (`MealPlanAccessory`)
- 소비모드: FIXED / PER_PERSON / PER_CONTAINER
- 자동 수량 계산 헬퍼 `calculateAccessoryQty(mealCount, mode, baseQty)`

### 테스트
- `meal-plan-accessory.service.test.ts`: 11개

---

## Phase 7-D: MealCount 모듈 (2026-05-21, commit `f3e4b277`)

### 목표
- 식수 관리 (예상/실제) 별도 모듈로 분리
- 키: `(mealPlanGroupId, companyMealSlotId, lineupId)`

### 구현
- 서비스: `meal-count.service.ts` (8개 함수)
- 액션: `meal-count.action.ts` (8개)
- UI: 식단 그룹 상세 페이지 내 인라인 편집
- 자동 동기화: `MealPlan` 생성 시 `MealCount` 초기 레코드 자동 생성 (estimatedCount=0)

### 테스트
- 14개 추가 → 누적 233 PASS

---

## Phase 7-E (예정): 캘린더 UI 컴포넌트 ⬜
- 공용 `<Calendar>` 컴포넌트
- `react-day-picker` 기반, 월간/주간 토글
- Phase 6의 식단 캘린더에서 사용

---

## Phase 7-F: MealPlan 복제 기능 (2026-05-22, commit `2d8b6c99`)

### 신규 기능
- 식단 그룹 단위 복제: 다른 날짜로 동일 구조 복사
- 서비스: `duplicateMealPlanGroup(sourceGroupId, targetDate)`
- 트랜잭션: Group → Plans → Slots → Accessories → Counts 순서로 복제
- UI: 그룹 목록에서 "복제" 버튼, 날짜 선택 모달

### 테스트
- `meal-plan-group.service.test.ts`에 5개 추가

---

## Phase 7-G (예정): MealPlan 검증 강화 ⬜
- Phase 9 진입 전 선결 항목
- 슬롯별 필수 라인업 검증, 누락 시 경고 표시
- `validateMealPlanGroup(groupId)` 헬퍼 추가 예정

---

## Phase 8-A: 테스트 인프라 보강 (2026-05-23, commit `8e2f4a18`)

### 변경
- Vitest 워크스페이스 설정 정비
- `vitest.config.ts`: coverage 임계 추가 (branches 70%, functions 75%)
- CI용 npm scripts: `test:ci`, `test:coverage`, `test:watch`

### 결과
- 총 219 PASS / 2 skip / 0 fail
- Coverage: 78% branches, 82% functions

---

## Phase 8.5-A: Location/ProductionLine 스키마 확장 (2026-06-04, commit `dfdb7f1c`)

### 스키마 변경 (`prisma/schema.prisma`)
- **enum 추가**: `LocationType { FACTORY, WAREHOUSE, HYBRID }`
- **enum 추가**: `ProductionLineStatus { ACTIVE, MAINTENANCE, INACTIVE }`
- **Location 모델 확장**:
  - 추가 필드: `code (String)`, `type (LocationType @default(FACTORY))`, `note (String?)`, `isActive (Boolean @default(true))`, `sortOrder (Int @default(0))`, `updatedAt`, `deletedAt`
  - 인덱스: `@@unique([companyId, code])`, `@@index([companyId, type])`, `@@index([companyId, isActive])`, `@@index([companyId, sortOrder])`
- **ProductionLine 모델 확장**:
  - 추가 필드: `code`, `status`, `sortOrder`, `note`, `updatedAt`, `deletedAt`
  - 인덱스: `@@unique([companyId, code])`, `@@index([companyId, locationId])`, `@@index([companyId, status])`
- 마이그레이션: `20260604091418_init_baseline_v6_phase_8_5`

### 시드 데이터
- 회사별 기본 Location 2개 (`LOC-001 본사공장`, `LOC-002 제2창고`)
- 기본 ProductionLine 4개 (`PL-001 ~ PL-004`)

---

## Phase 8.5-B: Location 마스터 기능 (2026-06-05, commits `9d8b10b2`, `4977fdc2`)

### 신규 파일 구조
- `src/features/location/schemas/location.schema.ts`
- `src/features/location/services/location.service.ts`
- `src/features/location/actions/location.action.ts`
- `src/features/location/components/location-list.tsx`
- `src/features/location/components/location-form.tsx`
- `src/features/location/components/location-breadcrumb.tsx`
- `src/app/(dashboard)/locations/page.tsx`

### 서비스 (8개 함수)
- `createLocation, getLocation, listLocations, updateLocation, deleteLocation, restoreLocation, getNextLocationCode, getFactoryLocationOptions`
- 자동채번: `LOC-001, LOC-002, ...`
- 의존성 가드 6개: ProductionLine, InventoryLot, InventoryTransfer(from/to), ReceivingNote, StockTake

### 권한
- 권한 키 `location` 추가 (`PermissionAction.READ/WRITE/DELETE`)

### UI
- 사이드바 메뉴 추가 (MapPin 아이콘)
- 필드: 코드(자동), 이름, 유형(FACTORY/WAREHOUSE/HYBRID), 주소, 비고, 활성, 정렬순서

---

## Phase 8.5-C: ProductionLine 마스터 기능 (2026-06-05, commits `10f4584c`, `3686206b`)

### 신규 파일 구조
- `src/features/production-line/schemas/production-line.schema.ts`
- `src/features/production-line/services/production-line.service.ts`
- `src/features/production-line/actions/production-line.action.ts`
- `src/features/production-line/components/production-line-list.tsx`
- `src/features/production-line/components/production-line-form.tsx`
- `src/features/production-line/components/production-line-breadcrumb.tsx`
- `src/app/(dashboard)/production-lines/page.tsx`

### 서비스 (8개 함수)
- `createProductionLine, getProductionLine, listProductionLines, updateProductionLine, deleteProductionLine, restoreProductionLine, getNextProductionLineCode, getProductionLineOptions`
- 자동채번: `PL-001, PL-002, ...`
- **위치 유형 가드**: `Location.type === WAREHOUSE`인 경우 ProductionLine 생성 차단 (FACTORY/HYBRID만 허용)
- 의존성 가드 2개: CookingPlan, MealPlanSlot

### 권한
- 권한 키 `productionLine` 추가

### UI
- 사이드바 메뉴 추가 (Factory 아이콘)
- 필드: 코드(자동), 이름, 위치(드롭다운, FACTORY/HYBRID만 표시 — `getFactoryLocationOptions` 사용), 상태, 비고, 정렬순서

---

## Phase 8.5-D: 테스트 추가 및 문서 재편 (2026-06-05)

### 테스트
- `location.service.test.ts`: 16개 테스트
- `production-line.service.test.ts`: 14개 테스트
- 누적: 18 파일 / 249 PASS / 2 skip / 0 fail
- TypeScript errors: 0

### 문서 재편
- 기존 단일 `PROGRESS.md` (~122 KB) → 4파일 구조로 분리:
  - `PROGRESS.md` (슬림, ~13 KB)
  - `docs/progress/SPRINT1.md` (~28 KB)
  - `docs/progress/SPRINT2.md` (~60 KB, 본 파일)
  - `docs/progress/SCHEMA_COVERAGE.md` (~8 KB)
- Sprint 3~8 로드맵은 원본대로 `PROGRESS.md`에 유지

---

## Sprint 2 누적 통계 (Phase 8.5-D 시점)

| 항목 | 값 |
|---|---|
| 진행 기간 | 2026-05-13 ~ 2026-06-05 (24일) |
| Phase 수 | 5-R Step 1~5, Phase 7-A/B/C/D/F, Phase 8-A, Phase 8.5-A/B/C/D |
| 주요 커밋 수 | 약 28개 |
| 신규 모델 | CompanyMealSlot, Lineup, LineupSlotMap, MealPlanAccessory, MealCount(재정의) |
| 확장 모델 | Location, ProductionLine, MealPlan, MealPlanSlot, MealPlanGroup, MealTemplate* |
| 테스트 파일 | 18개 |
| 테스트 케이스 | 249 PASS / 2 skip / 0 fail |
| TypeScript errors | 0 |
| any-type usages | 0 |

---

## Sprint 2 잔여 작업 (Phase 9 진입 전 정리)

- ⬜ Phase 2-e: material-supplier UX 보강
- ⬜ Phase 6: 식단 캘린더 뷰
- ⬜ Phase 7-E: 캘린더 UI 공용 컴포넌트
- ⬜ Phase 7-G: MealPlan 검증 강화 (Phase 9 선결 항목)
- ⬜ Phase 9: MaterialRequirement 서비스 (Phase 9-A 스키마 확장 → 9-B 생성 로직 → 9-C 발주 연결)
- ⬜ Phase 10: 테스트 추가 작성
- ⬜ Phase 11: 페이지 통합 및 Sprint 2 QA

> Phase 9-A 진입 시 별도 가이드 문서 (`docs/guides/phase-9-a-guide.md`)로 작성 예정.
> 본 문서에는 미래 작업 가이드를 포함하지 않음 — 진행 완료된 내용만 기록.
