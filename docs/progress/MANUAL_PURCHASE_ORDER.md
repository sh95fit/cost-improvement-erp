# 수동 발주(Manual Purchase Order) 도메인

> 작성일: 2026-07-09
> 관련 코드:
> - src/features/purchase-order/schemas/purchase-order.schema.ts
> - src/features/purchase-order/services/purchase-order-batch.service.ts
> - src/features/purchase-order/components/manual-purchase-order-form.tsx
> 관련 헌법: PROGRESS.md P1' / P9'
> 관련 문서:
> - docs/progress/PO_LIFECYCLE.md (상태 라이프사이클)
> - docs/progress/COST_LINEUP_ALIGNMENT.md (라인업·비용 정합)

## 1. 도메인 정의

발주는 다음 **두 경로**로 생성된다.

| 경로 | 진입점 | 산정 근거 | 그룹키 축 | 마스터 영향 |
|---|---|---|---|---|
| 식단 기반 (Wizard) | 발주 위저드 | MaterialRequirement (MR) | supplier × location × productionLine | setAsDefault 시 defaultSupplierItemId 갱신 (P9) |
| **수동 (Manual)** | `/purchase-orders/manual/new` | **사용자가 자재·수량·단가·공급업체를 직접 선택** | supplier × location × productionLine × **lineup** | **defaultSupplierItemId 미변경** (P9') |

수동 발주는 식단 기반 산정을 거치지 않는 즉시 발주 경로이며, 특정 라인업에 반드시 귀속되어 비용 정합을 보장한다. (헌법 P1')

## 2. 헌법 조항 매핑

- **P1'** — 수동 발주는 라인업(`lineupId`)을 반드시 지정해야 한다. `mealPlanGroupId`는 항상 `null`.
- **P9** — 위저드 발주 SUBMITTED 시 SupplierItem.currentPrice / SupplierItemPriceHistory 갱신, setAsDefault=true 시 MaterialMaster.defaultSupplierItemId 갱신.
- **P9'** — **수동 발주는 마스터에 영향을 주지 않는다.**
  - `setAsDefault:true`가 들어와도 `defaultSupplierItemId` **미변경**.
  - `applyDefaultSupplierUpdates`는 `input.isManual === false`일 때만 실행.
  - 결과의 `defaultSupplierUpdates`는 항상 `[]`.
  - (단가 이력 적층은 SUBMITTED 전이 시점 로직을 그대로 따르며, 수동/자동 구분 없이 동작. 본 문서 §5 참조.)

## 3. 스키마 필드

`createPurchaseOrdersBatchSchema` (batch service 진입점):

| 필드 | 타입 | 수동 발주 요구 |
|---|---|---|
| `isManual` | `boolean` (default false) | **`true`** |
| `mode` | `POBatchMode` | **`"NEW"` 만 허용** (DELTA/REPLACE 금지) |
| `mealPlanGroupId` | `string?` | 서비스가 강제로 `null` 처리 |
| `basedOnPOIds` | `string[]` | 빈 배열 |
| `items[].lineupId` | `string?` | **NOT NULL 강제** |
| `items[].materialRequirementId` | `string?` | 서비스가 강제로 `null` 처리 |
| `items[].setAsDefault` | `boolean` (default false) | 무시됨 (P9') |

`PurchaseOrder` 헤더에 반영되는 값:
- `isManual: true`
- `lineupId: items[0].lineupId` (그룹 대표)
- `mealPlanGroupId: null`
- 아이템 `sourceType: "MANUAL"` (자동 경로는 `"WIZARD_AUTO"`)

## 4. 그룹키 규칙

`makeGroupKey(item, isManual)`:

```
자동: `${supplierId}|${locationId}|${productionLineId ?? "_"}`
수동: `${supplierId}|${locationId}|${productionLineId ?? "_"}|${lineupId ?? "_"}`
```

**축 확장 근거**: 같은 공급업체·공장·생산라인이라도 라인업이 다르면 서로 다른 비용 귀속이 필요하다. (P1' + 비용 정합) → 별도 PO 로 분리.

## 5. 상태 라이프사이클

`PO_LIFECYCLE.md` 정의를 그대로 따른다. 수동 발주는 항상 `DRAFT` 로 생성되며 이후 전이 매트릭스는 자동 발주와 동일:

- `DRAFT → SUBMITTED`: SubmitPurchaseOrder 액션에서 SupplierItem.currentPrice / PriceHistory 갱신 (수동 발주도 동일 로직 적용 — 마스터 영향 금지는 `defaultSupplierItemId` 에만 국한된다).
- `SUBMITTED → RECEIVED`: 입고서 확정 시 자동 전이. 수동 발주도 동일하게 동작 (P5).

## 6. 배치 서비스 오류 코드

수동 발주 관련 신규 코드 (`PO_BATCH_ERRORS`):

| 코드 | 발생 조건 |
|---|---|
| `MANUAL_PO_ONLY_NEW_MODE` | `isManual:true` 이면서 `mode !== "NEW"` |
| `LINEUP_REQUIRED_FOR_MANUAL` | `isManual:true` 이면서 임의 item 에 `lineupId` 미지정 |
| `LINEUP_NOT_FOUND` | `lineupId` 가 존재하지 않거나 soft-deleted |
| `LINEUP_COMPANY_MISMATCH` | `lineupId` 가 타 회사 소속 |
| `LINEUP_INACTIVE` | `lineupId.isActive === false` |

기존 공통 코드 (`EMPTY_ITEMS`, `LOCATION_NOT_FOUND`, `SUPPLIER_NOT_FOUND` 등)는 수동 발주에도 동일하게 적용.

## 7. UI 정책 (S3.5-2)

- 진입: 발주 목록 → "수동 발주 등록" 버튼 → `/purchase-orders/manual/new`
- 헤더 필드: 공장·라인업·생산라인·발주일·출고 예정일·비고
- 자재/공급 품목 선택은 `SearchableSelect` 로 검색 지원 (자재·품목 수 증가 대응).
- 컬럼 순서: 자재 → 공급업체·공급 품목 → **단가 → 단위 → 수량** → 합계 → 삭제 (품목 선택 → 단가 자동 채움 → 수량 입력의 자연 흐름).
- 생성 완료 후 `/purchase-orders` 리다이렉트. 중복 제출 방지 위해 성공 응답 후에도 버튼은 비활성 상태 유지 (idempotencyKey 병행).

## 8. 변경 이력

- 2026-07-09: 초안 작성 (Sprint 3.5 Phase S3.5-3). Phase S3.5-0 ~ S3.5-2 결과 반영 — Option A(다중 공급업체 그룹핑) 채택, P1'·P9' 헌법 조항 확정, `MANUAL_PO_ONLY_NEW_MODE`/`LINEUP_*` 5종 에러코드 정의, 그룹키 축에 lineupId 추가.
