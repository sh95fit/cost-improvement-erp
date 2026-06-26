import { describe, expect, it } from 'vitest';
import {
  calculateExpectedReceiveDate,
  formatExpectedReceiveDate,
  formatLeadTimeBadge,
} from '@/features/purchase-order/lib/format-lead-time';

describe('formatLeadTimeBadge (D28)', () => {
  it("0이면 '당일' 반환", () => {
    expect(formatLeadTimeBadge(0)).toBe('당일');
  });

  it("1이면 'D-1' 반환", () => {
    expect(formatLeadTimeBadge(1)).toBe('D-1');
  });

  it("2이면 'D-2' 반환", () => {
    expect(formatLeadTimeBadge(2)).toBe('D-2');
  });

  it("큰 값(7)도 'D-7'로 반환", () => {
    expect(formatLeadTimeBadge(7)).toBe('D-7');
  });

  it("null이면 '미지정' 반환", () => {
    expect(formatLeadTimeBadge(null)).toBe('미지정');
  });

  it("undefined이면 '미지정' 반환", () => {
    expect(formatLeadTimeBadge(undefined)).toBe('미지정');
  });

  it("음수는 '미지정' 폴백", () => {
    expect(formatLeadTimeBadge(-1)).toBe('미지정');
  });

  it("NaN은 '미지정' 폴백", () => {
    expect(formatLeadTimeBadge(NaN)).toBe('미지정');
  });

  it("소수는 trunc 처리 (1.7 → 'D-1')", () => {
    expect(formatLeadTimeBadge(1.7)).toBe('D-1');
  });
});

describe('calculateExpectedReceiveDate (D28)', () => {
  it('outboundDate=null이면 null 반환', () => {
    expect(calculateExpectedReceiveDate(null, 1)).toBeNull();
  });

  it('outboundDate=undefined이면 null 반환', () => {
    expect(calculateExpectedReceiveDate(undefined, 1)).toBeNull();
  });

  it('leadTime=0이면 outboundDate와 동일 일자', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28)); // 2026-06-28
    const result = calculateExpectedReceiveDate(outbound, 0);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-28');
  });

  it('leadTime=1이면 출고일 하루 전 (2026-06-28 → 2026-06-27)', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28));
    const result = calculateExpectedReceiveDate(outbound, 1);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-27');
  });

  it('leadTime=2이면 출고일 이틀 전 (2026-06-28 → 2026-06-26)', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28));
    const result = calculateExpectedReceiveDate(outbound, 2);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-26');
  });

  it('월 경계를 넘는 경우 정상 계산 (2026-07-01, leadTime=3 → 2026-06-28)', () => {
    const outbound = new Date(Date.UTC(2026, 6, 1));
    const result = calculateExpectedReceiveDate(outbound, 3);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-28');
  });

  it('연 경계를 넘는 경우 정상 계산 (2026-01-02, leadTime=5 → 2025-12-28)', () => {
    const outbound = new Date(Date.UTC(2026, 0, 2));
    const result = calculateExpectedReceiveDate(outbound, 5);
    expect(formatExpectedReceiveDate(result)).toBe('2025-12-28');
  });

  it('leadTime=null이면 outboundDate를 그대로 반환 (보수적 폴백)', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28));
    const result = calculateExpectedReceiveDate(outbound, null);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-28');
  });

  it('leadTime=음수면 outboundDate를 그대로 반환', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28));
    const result = calculateExpectedReceiveDate(outbound, -1);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-28');
  });

  it('outboundDate의 시·분·초는 무시되고 일자 단위만 사용', () => {
    const outbound = new Date(Date.UTC(2026, 5, 28, 23, 59, 59));
    const result = calculateExpectedReceiveDate(outbound, 1);
    expect(formatExpectedReceiveDate(result)).toBe('2026-06-27');
  });
});

describe('formatExpectedReceiveDate (D28)', () => {
  it("null이면 '미지정' 반환", () => {
    expect(formatExpectedReceiveDate(null)).toBe('미지정');
  });

  it("undefined이면 '미지정' 반환", () => {
    expect(formatExpectedReceiveDate(undefined)).toBe('미지정');
  });

  it('일반 일자는 YYYY-MM-DD로 포맷 (한 자리 월·일은 zero-pad)', () => {
    const date = new Date(Date.UTC(2026, 0, 5));
    expect(formatExpectedReceiveDate(date)).toBe('2026-01-05');
  });

  it('두 자리 월·일도 정상 포맷', () => {
    const date = new Date(Date.UTC(2026, 10, 15));
    expect(formatExpectedReceiveDate(date)).toBe('2026-11-15');
  });
});
