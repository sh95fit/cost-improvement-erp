/**
 * 공용 포맷 유틸 (D30 C-3-d).
 *
 * 기존 각 컴포넌트에 로컬 정의되어 있던 formatCurrency/formatDate/formatDateTime 를 통합.
 * 새로 추가되는 컴포넌트는 이 파일에서 import 할 것.
 */

/**
 * 원화 통화 포맷. null/undefined 는 "-" 로 표시.
 * 소수점 없음 (KRW 특성).
 */
export function formatCurrency(v: number | null | undefined): string {
    if (v == null) return "-";
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(v);
  }
  
  /**
   * 날짜 포맷 (YYYY. M. D.).
   */
  export function formatDate(d: Date | string | null | undefined): string {
    if (d == null) return "-";
    return new Date(d).toLocaleDateString("ko-KR");
  }
  
  /**
   * 날짜+시각 포맷.
   */
  export function formatDateTime(d: Date | string | null | undefined): string {
    if (d == null) return "-";
    return new Date(d).toLocaleString("ko-KR");
  }
  