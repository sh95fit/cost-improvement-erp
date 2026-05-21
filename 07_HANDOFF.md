# 07_HANDOFF.md

## 문서 목적

이 문서는 LunchLab ERP 프로젝트를 다른 개발자 또는 다른 AI 모델에게 넘길 때
가장 먼저 전달해야 하는 기준선, 읽기 순서, 금지 추론 항목, 현재 시작점, 수정 대상 파일을 정리한 인수인계 패키지 문서다.

이 문서는 요약판이지만,
기존 히스토리를 대체하지 않는다.
반드시 `PROGRESS.md`와 함께 읽는다.

---

## 1. 현재 기준선

현재 프로젝트의 기준선은 아래와 같다.

- Sprint 1은 완료
- Sprint 2는 진행 중
- Sprint 2는 Phase 5까지 완료
- Sprint 2의 원래 미완료 Phase는 그대로 유지
- 다만 MealPlan 구조 문제로 인해 Sprint 2 내부 보강 작업이 추가됨
- 구조 재정의 보강 완료 후 Sprint 2 미완료 작업을 다시 이어감

---

## 2. 가장 먼저 읽을 문서

다음 순서대로 읽는다.

1. `PROGRESS.md`
2. `01_개발순서.md`
3. `02_개발문서.md`
4. `03_개발가이드문서.md`
5. `04_전체 구현 체크리스트 및 코드기준안.md`
6. `05_불일치 정리 및 통합기준 제안.md`
7. `06_Phase 3. 식단 관리 프로세스.md`
8. `07_HANDOFF.md`

---

## 3. 현재 핵심 판단

현재 가장 중요한 판단은 아래와 같다.

1. 기존 Sprint 1~8 계획은 유지한다
2. 기존 Sprint 1 완료 이력을 줄이지 않는다
3. 기존 Sprint 2 완료 이력을 줄이지 않는다
4. Sprint 2 미완료 Phase를 삭제하지 않는다
5. MealPlan 구조 재정의는 “새 Sprint”가 아니라 “Sprint 2 내부 보강 작업”으로 처리한다

---

## 4. 공식 구조 기준

### MealPlanGroup
- 날짜 중심 상위 그룹

### MealPlan
- 식사타입 × lineup 조합

### MealPlanSlot
- 실제 실행 배정 단위

### MealCount
- 상태가 아닌 입력 데이터

### 자동생성 기준
- MealPlanSlot 중심

---

## 5. 금지 추론 항목

다음은 문서나 코드에 근거 없이 추론하면 안 된다.

- Group가 lineup을 계속 직접 소유해야 한다는 추론
- MealCount가 status처럼 동작해야 한다는 추론
- Slot 없이 MaterialRequirement를 계산해도 된다는 추론
- 구조 재정의 전에 CookingPlan을 구현해도 된다는 추론
- Sprint 2 미완료 Phase가 구조 재정의로 대체되었다는 추론
- 기존 Sprint 이력을 요약해서 지워도 된다는 추론
- 새 번호 문서가 기존 히스토리를 대체한다는 추론

---

## 6. 현재 시작 파일

다음 파일부터 시작한다.

1. `prisma/schema.prisma`
2. `prisma/seed.ts`
3. `src/features/meal-plan/schemas/meal-plan.schema.ts`
4. `src/features/meal-plan/services/meal-plan.service.ts`
5. `src/features/meal-plan/actions/meal-plan.action.ts`
6. `src/app/(dashboard)/meal-plans/page.tsx`
7. 관련 테스트 파일

---

## 7. 현재 라운드 종료 조건

아래를 만족하면 현재 구조 재정의 보강 라운드를 종료할 수 있다.

- 문서 기준선 일치
- schema / migration 반영
- seed 반영
- meal-plan schema/service/action 반영
- UI 재구성 완료
- 자동생성 기준 문서화
- 테스트 PASS
- `PROGRESS.md` 갱신
- Sprint 2 재개 가능 판정

---

## 8. 구조 재정의 완료 후 재개 순서

1. Phase 2-e
2. Phase 6
3. Phase 7
4. Phase 8
5. Phase 9
6. Phase 10
7. Phase 11

그 뒤에는 기존 Sprint 3~8 계획을 그대로 따른다.
