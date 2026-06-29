"use client";

import type { POItemCandidate } from "@/features/purchase-order/lib/build-po-items-from-mr";
import type { PreviewDeltaPlanResult } from "@/features/purchase-order/actions/purchase-order.action";
import { DeltaPreviewCard } from "./delta-preview-card";
import { NewModePreview } from "./new-mode-preview";

interface Props {
  mode: "NEW" | "DELTA" | "REPLACE";
  mapped: POItemCandidate[];
  mappedPartialStock: POItemCandidate[];
  /** DELTA 모드에서만 사용됨 */
  deltaPreview: PreviewDeltaPlanResult | null;
  deltaPreviewLoading: boolean;
  deltaPreviewError: string | null;
  /** REPLACE 모드에서만 사용됨 — 덮어쓸 기준 PO id 목록 */
  basedOnPOIds: string[];
  /** ★ Phase 4-C2 (UI): 다축 뷰 기본 축 결정 — NewModePreview 로 전파 */
  scopeLevel: "COMPANY" | "LOCATION" | "PRODUCTION_LINE";  
}

/**
 * ★ D25-2 (D-PREVIEW-PLACEMENT): 모드별 wizard preview 통합 컨테이너.
 *
 *    - NEW     → NewModePreview (공급업체×공장×라인 분할)
 *    - DELTA   → DeltaPreviewCard (차분 변경 카드)
 *    - REPLACE → 경고 배너 + NewModePreview (덮어쓸 새 그룹)
 *
 *    D25-3 에서 Step 4 가 이 컴포넌트로 교체되며, D25-4 에서 Step 5 의
 *    중복 preview 가 제거된다.
 */
export function WizardPreviewPanel({
  mode,
  mapped,
  mappedPartialStock,
  deltaPreview,
  deltaPreviewLoading,
  deltaPreviewError,
  basedOnPOIds,
  scopeLevel,
}: Props) {
  // ───────────────────────────────────────────────
  // NEW 모드 — 분할 미리보기만
  if (mode === "NEW") {
    return (
      <div className="space-y-6">
        <ModeHeader mode="NEW" />
        <NewModePreview
          mapped={mapped}
          mappedPartialStock={mappedPartialStock}
          hideHeader
          scopeLevel={scopeLevel}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // DELTA 모드 — 차분 카드만 (NewModePreview 와 중복되므로 표시 X)
  if (mode === "DELTA") {
    return (
      <div className="space-y-6">
        <ModeHeader mode="DELTA" />
        <DeltaPreviewCard
          preview={deltaPreview}
          isLoading={deltaPreviewLoading}
          error={deltaPreviewError}
          context="step5"
        />
        <p className="text-xs text-gray-500">
          ※ 차분 미리보기는 Step 3 편집 시 자동 갱신됩니다. 기준 PO 와의 변동 행만
          표시되며, 변경 없음 항목은 회색 처리됩니다.
        </p>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // REPLACE 모드 — 경고 + 새 그룹 분할 미리보기
  return (
    <div className="space-y-6">
      <ModeHeader mode="REPLACE" />
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
        <p className="font-semibold text-red-900">
          ⚠ 덮어쓰기 모드
        </p>
        <p className="mt-1 text-red-800">
          기준 PO <strong>{basedOnPOIds.length}건</strong>이{" "}
          <strong>일괄 취소</strong>되고, 아래 내용으로 새 발주서가 생성됩니다.
          기준 PO 중 발주확정(APPROVED) 이상 상태가 포함되면 실행이 차단됩니다.
        </p>
      </div>
      <NewModePreview
          mapped={mapped}
          mappedPartialStock={mappedPartialStock}
          hideHeader
          scopeLevel={scopeLevel}
        />
    </div>
  );
}

// ────────────────────────────────────────────────
function ModeHeader({ mode }: { mode: "NEW" | "DELTA" | "REPLACE" }) {
  const config = {
    NEW: {
      title: "Step 4 — 분할 미리보기 (신규 발주)",
      desc: "공급업체 × 공장 × 라인 단위로 자동 분할되어 DRAFT PO 로 생성됩니다.",
    },
    DELTA: {
      title: "Step 4 — 차분 발주 미리보기",
      desc: "기준 PO 와 비교한 변경 사항만 반영됩니다. 증가/감소/신규/단가변경 행이 표시됩니다.",
    },
    REPLACE: {
      title: "Step 4 — 덮어쓰기 미리보기",
      desc: "기준 PO 가 취소되고 아래 새 그룹으로 재생성됩니다.",
    },
  }[mode];

  return (
    <div>
      <h2 className="text-lg font-semibold">{config.title}</h2>
      <p className="mt-1 text-sm text-gray-600">{config.desc}</p>
    </div>
  );
}
