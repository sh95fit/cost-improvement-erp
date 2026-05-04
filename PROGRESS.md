# LunchLab ERP — 프로젝트 진행 현황

> 이 문서는 매 작업 단계 완료 시 반드시 갱신한다.
> 마지막 갱신: 2026-05-04 (Phase 1 완료)

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

## 🏗️ Sprint 1: 안정화 + 품질 기반 확보 (5/4 ~ 5/9)

### Phase 1 — Sonner toast 인프라 + 2파일 적용 ✅
- **날짜**: 2026-05-04
- **커밋**: `1a20d50`
- **변경 파일**: `package.json`, `src/components/ui/sonner.tsx` (신규), `src/app/layout.tsx`, `src/features/recipe/components/recipe-detail-dialog.tsx`, `src/app/(dashboard)/containers/page.tsx`
- **변경 내용**: sonner 설치, Toaster 마운트, recipe-detail-dialog와 containers에서 errorMessage→toast.error 전환, console.log→logger 교체
- **계획 대비 변경**: 없음 (계획대로 완료)
- **발견된 이슈**: push 시 브랜치명 불일치 → main으로 직접 push로 해결

### Phase 2 — E2E 검증 + BOM 편집 이슈 재현 ⬜
- **예정일**: 2026-05-05
- **예상 시간**: 1.5h
- **검증 항목**:
  - [ ] 레시피 상세 다이얼로그 열기 → 식자재·반제품·용기 그룹 옵션 로드 확인
  - [ ] 재료 추가/삭제 → toast 성공/실패 메시지 확인
  - [ ] BOM 생성 → 슬롯 복수 추가 (용기 그룹 A, B, C) → 각 슬롯에 구성재료 자동 할당 확인
  - [ ] 슬롯 삭제 → 삭제 확인 다이얼로그 → toast 확인
  - [ ] BOM 확정 (ACTIVE) 후 → 편집 UI 모두 사라지는 것 재현 확인
  - [ ] 용기 관리 페이지 CRUD → toast 확인
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 3 — duplicateRecipeBOM 서비스 + 액션 구현 ⬜
- **예정일**: 2026-05-05
- **예상 시간**: 2h
- **작업 범위**:
  - [ ] `recipe-bom.service.ts`에 `duplicateRecipeBOM(companyId, sourceBomId)` 추가 — 트랜잭션으로 슬롯·아이템 전체 복사, 새 DRAFT 버전 생성
  - [ ] `recipe.action.ts`에 `duplicateRecipeBOMAction` 추가 — 권한 체크, 감사 로그
  - [ ] `recipe-bom.service.test.ts`에 복제 테스트 추가
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 4 — BOM UI 완전 보강 ⬜
- **예정일**: 2026-05-05 ~ 2026-05-06
- **예상 시간**: 5h
- **작업 범위**:
  - [ ] ACTIVE BOM "보관" 버튼 추가 (`handleBOMStatus(bomId, "ARCHIVED")`)
  - [ ] 모든 상태 BOM에 "복제해서 새 버전" 버튼 추가 (`duplicateRecipeBOMAction`)
  - [ ] DRAFT BOM 확장 영역에 baseWeightG 인라인 편집 추가 (`updateRecipeBOMBaseWeightAction`)
  - [ ] 슬롯 인라인 편집 (totalWeightG, note) 추가 (`updateRecipeBOMSlotAction`)
  - [ ] 슬롯별 "재료 추가" 버튼 추가 (`addRecipeBOMSlotItemAction`)
  - [ ] import 보강: `updateRecipeBOMBaseWeightAction`, `updateRecipeBOMSlotAction`, `addRecipeBOMSlotItemAction`, `duplicateRecipeBOMAction`
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 5 — container.service.test.ts 작성 ⬜
- **예정일**: 2026-05-06
- **예상 시간**: 1.5h
- **작업 범위**:
  - [ ] `src/tests/container.service.test.ts` 신규 작성
  - [ ] 테스트 케이스: 그룹 코드 자동 생성, 그룹 CRUD, 슬롯 CRUD, 페이지네이션, soft-delete
  - [ ] `npm run test` 전체 통과 확인
- **CONVENTIONS.md 해소**: #10 (테스트 없이 서비스 함수 머지 금지)
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 6 — Toast 확대: material + subsidiary (6개 컴포넌트) ⬜
- **예정일**: 2026-05-06 ~ 2026-05-07
- **예상 시간**: 3h
- **대상 파일**:
  - [ ] `src/features/material/components/material-list.tsx`
  - [ ] `src/features/material/components/material-form.tsx`
  - [ ] `src/features/material/components/material-detail-panel.tsx`
  - [ ] `src/features/material/components/subsidiary-list.tsx`
  - [ ] `src/features/material/components/subsidiary-form.tsx`
  - [ ] `src/features/material/components/subsidiary-detail-panel.tsx`
- **작업**: `import { toast } from "sonner"` 추가, errorMessage 상태 → toast.error/toast.success, console.log → logger
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 7 — Toast 확대: supplier (4개 컴포넌트) ⬜
- **예정일**: 2026-05-07
- **예상 시간**: 2h
- **대상 파일**:
  - [ ] `src/features/supplier/components/supplier-list.tsx`
  - [ ] `src/features/supplier/components/supplier-form.tsx`
  - [ ] `src/features/supplier/components/supplier-item-list.tsx`
  - [ ] `src/features/supplier/components/supplier-item-form.tsx`
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 8 — Toast 확대: recipe + semi-product + unit-conversion (7개 컴포넌트) ⬜
- **예정일**: 2026-05-07
- **예상 시간**: 2.5h
- **대상 파일**:
  - [ ] `src/features/recipe/components/recipe-list.tsx`
  - [ ] `src/features/recipe/components/recipe-form.tsx`
  - [ ] `src/features/recipe/components/semi-product-list.tsx`
  - [ ] `src/features/recipe/components/semi-product-form.tsx`
  - [ ] `src/features/recipe/components/semi-product-detail-dialog.tsx`
  - [ ] `src/features/unit-conversion/components/unit-conversion-list.tsx`
  - [ ] `src/features/unit-conversion/components/unit-conversion-form.tsx`
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 9 — CONVENTIONS.md 전수 점검 ⬜
- **예정일**: 2026-05-08
- **예상 시간**: 3h
- **점검 대상 (서비스 7파일 + 액션 4파일)**:
  - [ ] #1 `any` 타입 사용 여부
  - [ ] #4 `console.log` 잔여 여부
  - [ ] #6 `deletedAt: null` 조건 누락 여부
  - [ ] #7 다중 쓰기 트랜잭션 사용 여부
  - [ ] #8 `assertPermission` 호출 여부
  - [ ] #9 `createAuditLog` 호출 여부
  - [ ] #10 서비스별 테스트 존재 여부
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 10 — recipe.action.ts 서비스 계층 분리 ⬜
- **예정일**: 2026-05-08 ~ 2026-05-09
- **예상 시간**: 4h
- **작업 범위**:
  - [ ] recipe.action.ts (39KB) → Action은 입력 검증·권한·감사 로그만 담당
  - [ ] 비즈니스 로직은 서비스 레이어로 이동
  - [ ] 기존 테스트 통과 확인
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 11 — Error Boundary + 타입 강화 ⬜
- **예정일**: 2026-05-09
- **예상 시간**: 2h
- **작업 범위**:
  - [ ] `src/app/(dashboard)/error.tsx` 신규 작성
  - [ ] `loadAllPages` 제네릭 타입 안전성 강화 (any 제거)
  - [ ] `npx tsc --noEmit` + `npm run test` 전체 통과
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 12 — Sprint 1 최종 QA ⬜
- **예정일**: 2026-05-09
- **예상 시간**: 2h
- **검증 시나리오**:
  - [ ] BOM 생성 → 슬롯 복수 추가/삭제 → 중량 편집 → 확정 (ACTIVE)
  - [ ] ACTIVE BOM → "보관" 전환 → "복원" 전환
  - [ ] ACTIVE BOM → "복제해서 새 버전" → DRAFT v2 생성 → 편집 → 확정 (v1 자동 보관)
  - [ ] 슬롯 인라인 편집 (totalWeightG, note)
  - [ ] 슬롯별 재료 개별 추가/제거
  - [ ] baseWeightG 편집
  - [ ] 전체 도메인 toast 동작 확인 (17개 컴포넌트)
  - [ ] `npm run test` 전체 PASS
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

---

## 🏗️ Sprint 2: 식단 계획 (5/10 ~ 5/18, ~39h)

### Phase 1 — 스키마 확인 + Zod 스키마 작성 ⬜
- **예정일**: 2026-05-10
- **예상 시간**: 3h
- **대상 모델**: MealTemplate, MealPlanGroup, MealPlan, MealPlanSlot, MaterialRequirement
- **작업 범위**:
  - [ ] Prisma 스키마 대조 확인
  - [ ] `src/features/meal-plan/schemas/meal-plan.schema.ts` 신규 작성
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 2 — meal-plan.service.ts 구현 ⬜
- **예정일**: 2026-05-10 ~ 2026-05-11
- **예상 시간**: 6h
- **작업 범위**:
  - [ ] 식단 템플릿 CRUD
  - [ ] 식단 그룹 CRUD
  - [ ] 식단 생성·복사
  - [ ] 슬롯 배정 (레시피 + RecipeBOM 연결)
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 3 — meal-plan.action.ts 구현 ⬜
- **예정일**: 2026-05-11 ~ 2026-05-12
- **예상 시간**: 4h
- **작업 범위**:
  - [ ] Server Action 래퍼 (입력 검증, 권한, 감사 로그)
  - [ ] CONVENTIONS.md 준수 확인
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 4 — 식단 그룹 UI 구현 ⬜
- **예정일**: 2026-05-12 ~ 2026-05-13
- **예상 시간**: 4h
- **작업 범위**:
  - [ ] `meal-plan-group-list.tsx`
  - [ ] `meal-plan-group-form.tsx`
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 5 — 식단 캘린더 뷰 구현 ⬜
- **예정일**: 2026-05-13 ~ 2026-05-14
- **예상 시간**: 6h
- **작업 범위**:
  - [ ] `meal-plan-calendar.tsx` — 주간/월간 캘린더 뷰
  - [ ] 슬롯 배정 UI (드래그 또는 클릭)
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 6 — 슬롯 상세 에디터 구현 ⬜
- **예정일**: 2026-05-14 ~ 2026-05-15
- **예상 시간**: 4h
- **작업 범위**:
  - [ ] `meal-plan-slot-editor.tsx` — 레시피 선택, RecipeBOM 선택, 인원수 입력
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 7 — 소요량 자동 산출 서비스 ⬜
- **예정일**: 2026-05-15 ~ 2026-05-16
- **예상 시간**: 5h
- **작업 범위**:
  - [ ] `material-requirement.service.ts` — BOM → 재료 전개, 인원수 반영
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 8 — 테스트 작성 ⬜
- **예정일**: 2026-05-16 ~ 2026-05-17
- **예상 시간**: 4h
- **작업 범위**:
  - [ ] `meal-plan.service.test.ts`
  - [ ] `material-requirement.service.test.ts`
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

### Phase 9 — 페이지 통합 + Sprint 2 QA ⬜
- **예정일**: 2026-05-17 ~ 2026-05-18
- **예상 시간**: 3h
- **작업 범위**:
  - [ ] `/meal-plans/page.tsx` 통합
  - [ ] toast 적용
  - [ ] E2E 검증: 템플릿 생성 → 그룹 생성 → 슬롯 배정 → 소요량 산출
  - [ ] PROGRESS.md 갱신
- **계획 대비 변경**: (완료 후 기록)
- **발견된 이슈**: (완료 후 기록)

---

## 🏗️ Sprint 3: 발주 + 입고 (5/19 ~ 5/27, ~32h)

### Phase 1 — PO 스키마 + Zod ⬜
### Phase 2 — purchase-order.service.ts ⬜
### Phase 3 — purchase-order.action.ts ⬜
### Phase 4 — 발주 UI ⬜
### Phase 5 — /purchasing/page.tsx 통합 ⬜
### Phase 6 — 입고 스키마 + Zod ⬜
### Phase 7 — receiving.service.ts ⬜
### Phase 8 — receiving.action.ts + 입고 UI ⬜
### Phase 9 — 테스트 + E2E + Sprint 3 QA ⬜

---

## 🏗️ Sprint 4: 재고 + 출고 + 소비 (5/28 ~ 6/7, ~41h)

### Phase 1 — 재고 조회 서비스 ⬜
### Phase 2 — 재고 UI ⬜
### Phase 3 — 출고 서비스 + 액션 ⬜
### Phase 4 — 출고 UI ⬜
### Phase 5 — /shipping/page.tsx 통합 ⬜
### Phase 6 — 조리 계획 서비스 ⬜
### Phase 7 — 소비 서비스 ⬜
### Phase 8 — 소비 UI ⬜
### Phase 9 — /consumption/page.tsx 통합 ⬜
### Phase 10 — 테스트 + E2E + Sprint 4 QA ⬜

---

## 🏗️ Sprint 5: 원가 + 월말 마감 + 알림 (6/8 ~ 6/16, ~35h)

### Phase 1 — 원가 계산 엔진 ⬜
### Phase 2 — 원가 스냅샷 서비스 ⬜
### Phase 3 — 원가 UI ⬜
### Phase 4 — /cost/page.tsx 통합 ⬜
### Phase 5 — 월말 마감 서비스 ⬜
### Phase 6 — 월말 마감 UI ⬜
### Phase 7 — /month-end/page.tsx 통합 ⬜
### Phase 8 — 알림 서비스 + UI ⬜
### Phase 9 — 테스트 + E2E + Sprint 5 QA ⬜

---

## 🏗️ Sprint 6: 대시보드 + 관리 + 마무리 (6/17 ~ 6/24, ~30h)

### Phase 1 — 메인 대시보드 ⬜
### Phase 2 — 감사 로그 UI ⬜
### Phase 3 — 사용자/권한 관리 UI ⬜
### Phase 4 — CONVENTIONS.md 최종 점검 ⬜
### Phase 5 — UI/UX 통일 ⬜
### Phase 6 — 전체 E2E 풀 플로우 검증 ⬜
### Phase 7 — 문서화 + 최종 QA ⬜

---

## 📊 전체 요약

| Sprint | 기간 | Phase 수 | 예상 공수 | 상태 |
|--------|------|----------|-----------|------|
| Sprint 1 | 5/4 ~ 5/9 | 12 | ~28.5h | 🟡 진행 중 (1/12) |
| Sprint 2 | 5/10 ~ 5/18 | 9 | ~39h | ⬜ 대기 |
| Sprint 3 | 5/19 ~ 5/27 | 9 | ~32h | ⬜ 대기 |
| Sprint 4 | 5/28 ~ 6/7 | 10 | ~41h | ⬜ 대기 |
| Sprint 5 | 6/8 ~ 6/16 | 9 | ~35h | ⬜ 대기 |
| Sprint 6 | 6/17 ~ 6/24 | 7 | ~30h | ⬜ 대기 |
| **총계** | **5/4 ~ 6/24** | **56** | **≈205.5h** | |

---

## 🔄 변경 이력

| 날짜 | 변경 내용 | 사유 |
|------|-----------|------|
| 2026-05-04 | 최초 작성 | Sprint 1 Phase 1 완료 시점 |
| 2026-05-04 | Sprint 1에 Phase 3~4 추가 (BOM 편집 보강) | BOM 등록 후 수정 불가 이슈 발견 |
| 2026-05-04 | 작업 프로세스 6단계 규칙 추가 | 깃 배포→레포 검증→프로세스 검증→테스트→보완→다음 단계 |
