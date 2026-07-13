# LunchLab ERP — 코딩 규칙 및 금지사항

## 금지사항 10개

1. **`any` 타입 사용 금지** — 반드시 구체적인 타입 또는 `unknown`을 사용한다.
2. **클라이언트 컴포넌트에서 직접 DB 접근 금지** — DB 접근은 반드시 Server Action 또는 API Route를 통한다.
3. **환경변수 하드코딩 금지** — 모든 환경변수는 `.env`에서 관리하고, 코드에 직접 값을 넣지 않는다.
4. **`console.log` 직접 사용 금지** — `src/lib/utils/logger.ts`의 `logger`를 사용한다.
5. **API Route에서 `NextResponse.json()` 직접 사용 금지** — `src/lib/result.ts`의 `ok()`, `fail()`을 사용한다.
6. **Prisma 쿼리에서 `deletedAt` 조건 누락 금지** — soft-delete extension 적용 전까지 모든 find 쿼리에 `deletedAt: null` 조건을 명시한다.
7. **트랜잭션 없이 다중 쓰기 작업 금지** — 2개 이상의 create/update/delete가 연속될 경우 `withTransaction`을 사용한다.
8. **권한 체크 없이 데이터 접근 금지** — 모든 서비스 함수 진입 시 `assertPermission`, `assertCompanyMatch` 등을 호출한다.
9. **감사 로그 없이 데이터 변경 금지** — CREATE, UPDATE, DELETE 작업 시 `createAuditLog`를 호출한다.
10. **테스트 없이 서비스 함수 머지 금지** — 모든 서비스 함수는 최소 1개의 단위 테스트를 포함한다.

## API 응답 형식


## Server Action 반환 형식

// 성공 { success: true, data: { ... } }
// 실패 { success: false, error: { code: "...", message: "..." } }


## 파일 구조 규칙

- **Zod 스키마**: `src/features/{domain}/schemas/{name}.schema.ts`
- **서비스**: `src/features/{domain}/services/{name}.service.ts`
- **Server Action**: `src/features/{domain}/actions/{name}.action.ts`
- **API Route**: `src/app/api/{resource}/route.ts`
- **페이지**: `src/app/(dashboard)/{resource}/page.tsx`

## 네이밍 규칙

- 파일명: kebab-case (`material-master.service.ts`)
- 컴포넌트: PascalCase (`MaterialForm`)
- 함수/변수: camelCase (`getMaterialById`)
- DB 컬럼: snake_case (`material_type`) — Prisma `@map`으로 매핑
- API 경로: kebab-case (`/api/material-masters`)

## 작업 프로세스 규칙
11. **PROGRESS.md 갱신 없이 다음 Phase 진행 금지** — 매 Phase 완료 시 PROGRESS.md의 해당 Phase를 ✅로 변경하고, 변경 내용·계획 대비 변경·발견된 이슈를 기록한 후 커밋한다.
12. **6단계 프로세스 미준수 금지** — 모든 Phase는 깃 배포 → 레포 검증 → 프로세스 검증 → 테스트 → 보완 → PROGRESS.md 갱신 순서를 따른다.


## 감사 로그 (AuditLog) 사용 원칙

Sprint 4 Phase S4-0-d 에서 표준화. 감사 로그는 항상 상태 변경 대상과 동일한 원자성 경계 안에서 기록되어야 한다.

### 서비스 레이어 (트랜잭션 내부)

`writeAuditLog(tx, params)` — `src/lib/utils/audit.ts`

- 서비스 함수는 `actorUserId: string` 파라미터를 명시적으로 받는다.
- 트랜잭션 콜백 내부에서 상태 변경 직후 `writeAuditLog(tx, {...})` 호출.
- 실패 시 throw → 전체 트랜잭션 롤백. 상태 변경과 감사 로그는 원자적으로 커밋된다.

### Actions 레이어 (트랜잭션 외부)

`createAuditLog({session, ...})` — `src/lib/utils/audit.ts`

- Server Action 안에서 서비스 호출 성공 후 세션 기반으로 기록.
- 내부적으로 `writeAuditLog(prisma, ...)` 를 호출.
- 실패해도 `logger.error` 만 남기고 통과 (Actions 레이어는 후처리 관점).
- 서비스에서 이미 `writeAuditLog(tx)` 로 기록했다면 Actions 레이어 중복 호출 금지.

### AuditAction enum 매핑 가이드

- `CREATE` — 신규 엔티티 생성
- `UPDATE` — 필드 갱신 (예약 해제, 상태 필드 변경 포함)
- `DELETE` — 삭제 (soft delete 포함)
- `APPROVE` / `REJECT` — 승인 워크플로우
- `STATUS_CHANGE` — 명시적 상태 전이 (PO 상태 등 도메인 상태 머신)
- `LOGIN` — 인증 이벤트
- `OVERRIDE` — 정책 우회 (관리자 강제 조치)
