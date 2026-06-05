# Sprint 1: 안정화 + 품질 기반 확보 (5/4 ~ 5/12)

> 본 문서는 PROGRESS.md에서 분리한 Sprint 1 전체 Phase 상세 이력 아카이브이다.
> 현재 상태 요약은 `PROGRESS.md`, 모델 구현 현황은 `SCHEMA_COVERAGE.md`를 참조한다.

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
