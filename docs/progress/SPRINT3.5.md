# Sprint 3.5 — 수동(독립) 발주 보완 [Sprint 3 사후 보완]

> 기간: 2026-07-08 ~ 2026-07-09
> 상태: ✅ 종결 (2026-07-09)
> 이전 스프린트: `docs/progress/SPRINT3.md`
> 다음 스프린트: Sprint 4 (재고·이동·조리계획·사용·실사·대시보드)

## 목적

식단 기반 발주 외의 독립(수동) 발주 경로를 신설하여 헌법 P1' 를 코드로 구현. 수동 발주에 라인업 귀속 축을 필수화하여 원가 산정 누락을 방지.

## 스코프 (스키마 실측)

- `PurchaseOrder(isManual, locationId, productionLineId?, lineupId?)` — `isManual=true` 인 경우 `lineupId` 필수화 (서비스 검증)
- `lineupId` 는 Phase S3.5-0 에서 신규 추가됨 (마이그레이션 `add_purchase_order_lineup`)

## Sprint 통계

| 항목 | 수치 |
|---|---|
| 총 Phase | 4 (S3.5-0, S3.5-1, S3.5-2, S3.5-3) |
| 주요 커밋 | `95112583` (S3.5-0, S3.5-1) · `8ac522b` (S3.5-1 픽스처 정리) · S3.5-2/S3.5-3 커밋 (아래 참조) |
| 신규 마이그레이션 | 1건 (`20260708090640_add_purchase_order_lineup`) |
| 변경 파일 (누적) | 서비스 1, 스키마 2, 액션 1, 컴포넌트 2, 라우트 1, 테스트 1, 도메인 문서 1 (신규) |
| 신규 테스트 | 9건 (수동 발주 배치 서비스) |
| 테스트 총계 | `purchase-order-batch.service.test.ts` PASS, `purchase-order.service.test.ts` 27/27 PASS |
| TS 오류 | 0 |
| 신규 도메인 문서 | `docs/progress/MANUAL_PURCHASE_ORDER.md` |

## Phase 이력

### Phase S3.5-0 — 스키마 보강: PurchaseOrder.lineupId ✅

**완료**: 2026-07-08, 커밋 `95112583`

- `PurchaseOrder.lineupId String? @map("lineup_id")` + `lineup Lineup?` relation + `@@index([lineupId])`
- `Lineup.purchaseOrders PurchaseOrder[]` 역방향 relation
- 마이그레이션: `20260708090640_add_purchase_order_lineup`
- 정책: nullable 유지, `isManual=true` 인 경우 서비스 레이어에서 NOT NULL 검증
- 기존 데이터 backfill 없음

### Phase S3.5-1 — 수동 발주 서비스·액션 ✅

**완료**: 2026-07-08, 커밋 `95112583` (서비스·스키마·액션 확장) · `8ac522b` (레거시 픽스처 정리)

- 서비스(`purchase-order.service.ts`): `assertLineupForPO(tx, companyId, isManual, lineupId)` 헬퍼 신설, `PO_LINEUP_ERRORS` 상수(4종) 정의. `createPurchaseOrder`·`updatePurchaseOrder` 진입 시 `assertLocationAndLine` 다음에 호출.
- 정책(P1'): `isManual=true` → `lineupId` NOT NULL 강제 (`LINEUP_REQUIRED_FOR_MANUAL`). `lineupId` 지정 시 존재·회사 일치·활성 검증 (`LINEUP_NOT_FOUND`·`LINEUP_COMPANY_MISMATCH`·`LINEUP_INACTIVE`).
- 스키마(`purchase-order.schema.ts`, Zod): `createPurchaseOrderSchema`·`updatePurchaseOrderSchema` 에 `lineupId: z.string().min(1).nullable().optional()` 추가.
- 액션(`purchase-order.action.ts`): 에러 매핑에 4종 라인업 오류 한글 문구 추가.
- 테스트: 레거시 픽스처 6건 중 자동 번호·총액 계산 관련 3건에서 `isManual: true` 제거. 나머지 3건은 S3.5-3 에서 라인업 신규 테스트와 함께 정리.
- 회귀: `npx vitest run src/tests/purchase-order.service.test.ts` → 27/27 PASS.

### Phase S3.5-2 — 수동 발주 UI ✅

**완료**: 2026-07-09

**결정 사항 (헌법 P1'/P9' 준수)**
- **Option A 채택**: 헤더에 공급업체 지정 없이 자재별 공급업체를 각 행에서 선택. 저장 시 배치 서비스가 `(supplierId, locationId, productionLineId, lineupId)` 그룹핑하여 자동으로 다수 PO 생성.
- **라인업 필수화**: P1' 원칙에 따라 수동 발주는 `lineupId` NOT NULL. 배치 서비스 `assertLineupsForManualBatch` 헬퍼로 회사·활성 여부 검증.
- **마스터 미변경 (P9')**: 수동 발주 아이템은 `setAsDefault: false` 로 SupplierItem 마스터의 `currentPrice`·`defaultSupplierItemId` 를 갱신하지 않음.
- **`sourceType = "MANUAL"`**: 배치 서비스에서 `isManual === true` 인 경우 PO 아이템의 `sourceType` 을 `MANUAL` 로 설정 (기본 위저드 발주는 `WIZARD_AUTO`).
- **다중 공급업체 자동 그룹핑**: 사용자는 자재만 신경 쓰고, 서로 다른 공급업체 품목이 섞여도 저장 시 자동으로 공급업체 단위로 PO 가 분리됨.
- **성공 후 목록으로 리다이렉트**: 다건 생성 시 어느 상세로 이동할지 모호 → `/purchase-orders` 로 통일. 성공 시 `submitting` 상태를 풀지 않아 리다이렉트 전 재클릭 원천 차단.
- **검색 가능한 셀렉트**: 자재/공급 품목뿐 아니라 공장·라인업·생산라인 헤더 셀렉트도 `SearchableSelect` 로 통일 → 마스터 개수가 늘어나도 UX 유지.
- **`limit` 상한 준수**: `getMaterialsAction` limit ≤ 100, `getProductionLinesAction` limit ≤ 200, `getLineupsAction` limit ≤ 200.

**변경 파일**
- `src/features/purchase-order/schemas/purchase-order.schema.ts` — `purchaseOrderListQuerySchema.isManual` 필드
- `src/features/purchase-order/services/purchase-order.service.ts` — `getPurchaseOrders` isManual 필터
- `src/features/purchase-order/services/purchase-order-batch.service.ts` — `batchPOItemSchema.lineupId`, `createPurchaseOrdersBatchSchema.isManual`, `makeGroupKey(item, isManual)`, `assertLineupsForManualBatch`, PO 생성 시 isManual/lineupId/sourceType 반영, 기본 공급업체 업데이트 스킵
- `src/features/purchase-order/components/purchase-order-list.tsx` — `onManualNew` Props, `manualFilter` state, "수동 발주" 버튼
- `src/features/purchase-order/components/manual-purchase-order-form.tsx` — 신규 (헤더+행 편집 UI, SearchableSelect 통합, 성공 시 목록 리다이렉트, 중복 제출 방지)
- `src/app/(dashboard)/purchase-orders/manual/new/page.tsx` — 신규 (라우트 페이지)
- `src/app/(dashboard)/purchase-orders/page.tsx` — `onManualNew` 라우팅 연결
- `src/features/purchase-order/actions/purchase-order.action.ts` — 수동 발주 에러 매핑 5종 추가

### Phase S3.5-3 — 테스트·문서 ✅

**완료**: 2026-07-09

**작업 항목**
1. 배치 서비스 수동 발주 테스트 9건 신설 (`src/tests/purchase-order-batch.service.test.ts` `describe("Manual mode (S3.5-2b)")`):
   - `LINEUP_REQUIRED_FOR_MANUAL` (lineupId 누락)
   - `LINEUP_NOT_FOUND` (존재하지 않는 lineupId)
   - `LINEUP_COMPANY_MISMATCH` (타 회사 소속)
   - `LINEUP_INACTIVE` (비활성)
   - `MANUAL_PO_ONLY_NEW_MODE` × 2 (mode=DELTA, mode=REPLACE)
   - 다중 공급업체 자동 그룹핑 + `sourceType='MANUAL'` + `mealPlanGroupId=null` + `materialRequirementId=null` 검증
   - `setAsDefault=true` 여도 `defaultSupplierItemId` 미변경 (P9')
   - 같은 supplier·location·line 이라도 lineupId 다르면 별도 PO 분리
2. Mock 확장: `mockTx.lineup.findMany`, `beforeEach` 기본값(활성·같은 회사 2개)
3. 신규 도메인 문서: `docs/progress/MANUAL_PURCHASE_ORDER.md` — 두 발주 경로 비교, P1'/P9' 헌법 매핑, 스키마 필드, 그룹키 규칙, 오류 코드 5종, UI 정책
4. Sprint 3.5 종결 처리 (본 문서 작성, PROGRESS.md 요약본 축약, SCHEMA_COVERAGE.md 이력 추가)

**변경 파일**
- `src/tests/purchase-order-batch.service.test.ts` (수동 발주 케이스 9건 추가)
- `docs/progress/MANUAL_PURCHASE_ORDER.md` (신규)
- `docs/progress/SPRINT3.5.md` (신규, 본 문서)
- `docs/progress/SCHEMA_COVERAGE.md` (이력 라인 추가)
- `PROGRESS.md` (Sprint 3.5 아카이브 처리)

## 결정 사항 요약 (헌법 반영)

- **P1'** 코드 실현: 수동 발주는 `lineupId` NOT NULL 강제. 배치 서비스에서 회사·활성 여부까지 검증.
- **P9'** 코드 실현: 수동 발주는 SupplierItem/MaterialMaster 마스터에 영향을 주지 않음. `applyDefaultSupplierUpdates` 는 `isManual=false` 일 때만 실행.
- **Option A (다중 공급업체 자동 그룹핑)** 채택: 사용자는 자재만 선택하고, 배치 서비스가 공급업체 축을 자동으로 분리.
- **수동 발주는 NEW 모드 전용**: DELTA/REPLACE 는 위저드 전용 경로. `MANUAL_PO_ONLY_NEW_MODE` 로 원천 차단.
- **그룹키 축 확장**: 수동 발주는 `supplier × location × productionLine × lineup`. 자동 발주는 `supplier × location × productionLine`.

## 미완/후속

- 수동 발주 폼 컴포넌트 테스트(React Testing Library) — Sprint 8 UX 통일 페이즈에서 다른 도메인 폼 테스트와 함께 일괄 도입 검토.
- 액션 레이어 통합 스모크 테스트 — 필요 시 Sprint 4 착수 전에 별도 hotfix Phase 로 추가.
