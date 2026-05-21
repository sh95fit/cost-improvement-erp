# 06_Phase 3. 식단 관리 프로세스.md

## 문서 목적

이 문서는 현재 프로젝트에서 가장 중요한 작업 영역인
MealTemplate / MealPlan / MealCount / MaterialRequirement / CookingPlan으로 이어지는
Phase 3 식단 관리 프로세스의 현재 상태와 실제 작업 단계를 기록하는 문서다.

이 문서는 Sprint 2의 MealPlan 영역에 대한 “실제 작업판” 역할을 한다.
전체 이력은 `PROGRESS.md`,
구조 기준은 `02_개발문서.md`,
실행 순서는 `01_개발순서.md`,
실행 절차는 `03_개발가이드문서.md`를 따른다.

---

## 1. 현재 Phase 3의 위치

현재 Phase 3는 “완료”가 아니라 아래처럼 나누어 봐야 한다.

### 이미 끝난 범위
- MealTemplate schema/service/test
- MealTemplate action/UI/sidebar
- v5 구조 전환
- MealPlanGroup / MealPlan / MealPlanSlot 기본 schema/service/action
- 식단 그룹 CRUD UI

### 아직 안 끝난 범위
- 부자재-공급업체 연결 UX
- 식단 캘린더
- 슬롯 상세 에디터
- MealCount
- MealPlanAccessory
- MaterialRequirement
- 테스트 보강
- Sprint 2 QA

### 지금 새로 필요한 범위
- MealPlan 구조 재정의 보강
- schema / seed / service / action / UI / 자동생성 기준 / 테스트 / 문서 보강

즉,
**기본 CRUD는 만들어졌지만 Phase 3 전체 프로세스는 아직 끝나지 않았다.**

---

## 2. 현재까지 실제 완료 내용

### 2.1 MealTemplate
- schema 구축
- service 구축
- action 구축
- UI 구축
- container/accessory 관리 가능
- v5 구조 반영 완료

### 2.2 MealPlan 기본 구현
- MealPlanGroup schema/service 구축
- MealPlan schema/service 구축
- MealPlanSlot schema/service 구축
- 관련 action 구축
- `/meal-plans/page.tsx` 기본 CRUD UI 구축
- 그룹 생성/복사/상태 변경/식단 추가/삭제 가능

### 2.3 현재 UI의 한계
- lineup 입력이 구조적으로 미완성
- Group가 지나치게 많은 책임을 갖는다
- Slot이 실행 배정 단위로 부족하다
- 후속 count / requirement / cooking 연결이 불안정하다

---

## 3. 현재 구조 재정의가 필요한 이유

현재 구조가 안고 있는 핵심 문제는 다음과 같다.

1. 날짜 그룹과 lineup 책임이 분리되지 않았다
2. 식사타입 × lineup 구조가 모델에 명확히 자리 잡지 못했다
3. 실제 운영에서 필요한 supplier item / production line 배정 단위가 부족하다
4. 이후 MealCount, MaterialRequirement, CookingPlan, 발주 초안까지 연결할 기준 입력이 모호하다

이 문제를 해결하지 않고 Sprint 2 후반부를 진행하면,
후속 구현을 한 뒤 다시 구조를 뜯어야 할 가능성이 높다.

---

## 4. 현재 공식 구조 기준

### MealPlanGroup
- 날짜 중심 그룹
- 상태 전이 단위
- 상위 관리 단위

### MealPlan
- 식사타입 × lineup 조합
- Group 하위의 카드 단위

### MealPlanSlot
- 실제 실행 배정 단위
- recipe / BOM / supplier item / production line / quantity / note 등 수용

### MealCount
- 상태가 아닌 입력 데이터
- estimated/final count 관리

---

## 5. 현재 실제 작업 단계

### 단계 A — 구조 기준 문서 고정
- `PROGRESS.md` 보강
- 개발문서/가이드/체크리스트/불일치 문서 갱신
- handoff 문서 작성

### 단계 B — schema / migration 수정
- MealPlanGroup 책임 축소
- MealPlan 책임 강화
- MealPlanSlot 확장
- relation / unique / index 조정

### 단계 C — seed / schema / service / action 정비
- 시드 보강
- 입력 스키마 보강
- CRUD / copy / delete / 상태 전이 유지
- count와 상태 분리

### 단계 D — UI 재구성
- 날짜 그룹 중심 유지
- MealPlan 카드 구조 재정렬
- Slot 편집 강화
- supplier item / production line 배정 UI 추가

### 단계 E — 자동생성 기준 정리
- MealCount 연결 시점
- MealPlanAccessory 적용 방식
- MaterialRequirement 산출 기준
- CookingPlan 연결 기준
- 멱등성 정책

### 단계 F — 테스트 보강
- schema
- service
- action
- integration
- 필요 시 E2E

### 단계 G — Sprint 2 재개
- Phase 2-e
- Phase 6
- Phase 7
- Phase 8
- Phase 9
- Phase 10
- Phase 11

---

## 6. 현재 수정 대상 핵심 파일

### 우선순위 1
- `prisma/schema.prisma`
- `prisma/seed.ts`

### 우선순위 2
- `src/features/meal-plan/schemas/meal-plan.schema.ts`
- `src/features/meal-plan/services/meal-plan.service.ts`
- `src/features/meal-plan/actions/meal-plan.action.ts`

### 우선순위 3
- `src/app/(dashboard)/meal-plans/page.tsx`
- 관련 테스트 파일

---

## 7. 현재 단계의 완료 기준

현재 Phase 3 보강 라운드는 아래 조건을 만족해야 완료다.

- MealPlan 구조 재정의 기준이 문서와 코드에 일치한다
- schema / migration 반영 완료
- seed 보강 완료
- meal-plan schema/service/action 반영 완료
- MealPlan UI 재구성 완료
- 자동생성 연결 기준 정리 완료
- 테스트 PASS
- `PROGRESS.md` 반영 완료
- Sprint 2 원래 미완료 작업을 재개할 수 있다
