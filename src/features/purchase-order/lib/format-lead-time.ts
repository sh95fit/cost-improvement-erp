/**
 * 발주서 품목별 예상 입고일 표시 유틸 (D28 정책)
 *
 * 두 가지 표기를 제공한다:
 *  - formatLeadTimeBadge: Step 5 위저드용 상대 표기 ("D-1", "당일", "미지정")
 *  - calculateExpectedReceiveDate: 발주서 상세 화면용 절대일자 (YYYY-MM-DD)
 *
 * D20 결정사항과의 정합:
 *  - PO 목록·위저드 헤더의 단일 입고일 칸은 폐기됨 (헤더 부활 X)
 *  - 본 유틸은 "품목 단위" 표기에만 사용
 */

/**
 * 리드타임을 D-N 배지 문자열로 변환한다.
 *
 * 정책:
 *  - leadTimeDays === 0  →  "당일"
 *  - leadTimeDays >= 1   →  "D-N" (예: 1 → "D-1", 2 → "D-2")
 *  - null / undefined / 음수 → "미지정"
 *
 * 음수 리드타임은 도메인상 무의미하므로 "미지정"으로 폴백한다.
 */
export function formatLeadTimeBadge(
    leadTimeDays: number | null | undefined,
  ): string {
    if (leadTimeDays === null || leadTimeDays === undefined) {
      return "미지정";
    }
    if (!Number.isFinite(leadTimeDays) || leadTimeDays < 0) {
      return "미지정";
    }
    if (leadTimeDays === 0) {
      return "당일";
    }
    // 소수 입력 방어 (스키마상 Int지만 런타임 안전성 차원)
    const days = Math.trunc(leadTimeDays);
    return `D-${days}`;
  }
  
  /**
   * 출고일과 리드타임으로 예상 입고일(절대일자)을 계산한다.
   *
   * expectedReceiveDate = outboundDate − leadTimeDays
   *
   *  - outboundDate가 null/undefined이면 null 반환
   *  - leadTimeDays가 null/undefined/음수이면 outboundDate를 그대로 반환 (보수적 폴백)
   *
   * 시간대 안전성: Date 산술은 ms 단위로 처리하되, 일자 단위 의미를 유지하기 위해
   * UTC 자정 기준으로 정규화한 뒤 일수를 차감한다. 입력 Date의 시·분·초는 무시.
   */
  export function calculateExpectedReceiveDate(
    outboundDate: Date | null | undefined,
    leadTimeDays: number | null | undefined,
  ): Date | null {
    if (!outboundDate) {
      return null;
    }
    if (
      leadTimeDays === null ||
      leadTimeDays === undefined ||
      !Number.isFinite(leadTimeDays) ||
      leadTimeDays < 0
    ) {
      return new Date(outboundDate.getTime());
    }
    const days = Math.trunc(leadTimeDays);
    const utcMs = Date.UTC(
      outboundDate.getUTCFullYear(),
      outboundDate.getUTCMonth(),
      outboundDate.getUTCDate(),
    );
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return new Date(utcMs - days * MS_PER_DAY);
  }
  
  /**
   * 예상 입고일을 "YYYY-MM-DD" 문자열로 포맷한다. 입력이 null이면 "미지정" 반환.
   *
   * 발주서 상세 화면의 "품목 예상 입고일" 컬럼에서 사용.
   */
  export function formatExpectedReceiveDate(
    expectedReceiveDate: Date | null | undefined,
  ): string {
    if (!expectedReceiveDate) {
      return "미지정";
    }
    const y = expectedReceiveDate.getUTCFullYear();
    const m = String(expectedReceiveDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(expectedReceiveDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  