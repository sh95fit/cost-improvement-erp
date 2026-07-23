/**
 * 파일: src/features/meal-plan/services/revert-guard.service.ts
 * 목적: MealPlan 역방향 상태 전이(COMPLETED→IN_PROGRESS, IN_PROGRESS→CONFIRMED) 시
 *       연쇄 정리 및 가드 수행.
 * 근거: 헌법 P20 (2026-07-23 신설), 감사서 §9-4 (재편집 정책 α3), R5-R1-B 페이즈.
 * 실구현: R12 (Sprint 5 재편집 UI 도입 시). 본 커밋은 스켈레톤만.
 *
 * 책임:
 *   1. assertMealPlanRevertable — 대상 MealPlanGroup 에 연결된 ConsumptionHeader 중
 *      CONFIRMED 가 1건이라도 존재하면 ConfirmedConsumptionExistsError throw.
 *   2. revertMealPlanCascade — PENDING ConsumptionHeader (및 하위 Item·LotDetail) 삭제
 *      + 대상 MR (FINAL 또는 ESTIMATED) soft-delete
 *      + 관련 InventoryReservation release (reason = "MANUAL_CANCEL")
 *      단일 트랜잭션 내에서 수행 (부분 정리 방지).
 *
 * 순환 흐름 (P20):
 *   순방향(CONFIRMED→IN_PROGRESS)
 *     → 역방향 필요 시 revert-guard 로 정리 (본 서비스)
 *     → 순방향 재진입 시 auto-reserve 는 clean slate 가정
 */

import type { Prisma } from "@prisma/client";

export const REVERT_GUARD_ERRORS = {
  CONFIRMED_CONSUMPTION_EXISTS: "CONFIRMED_CONSUMPTION_EXISTS",
} as const;

export class ConfirmedConsumptionExistsError extends Error {
  constructor(mealPlanGroupId: string, confirmedHeaderIds: string[]) {
    super(
      `${REVERT_GUARD_ERRORS.CONFIRMED_CONSUMPTION_EXISTS}: group=${mealPlanGroupId}, headers=[${confirmedHeaderIds.join(",")}]`,
    );
    this.name = "ConfirmedConsumptionExistsError";
  }
}

export interface AssertMealPlanRevertableInput {
  companyId: string;
  mealPlanGroupId: string;
}

export interface RevertMealPlanCascadeInput {
  companyId: string;
  mealPlanGroupId: string;
  actorUserId: string;
  /** 되돌아갈 대상 MR countSource (COMPLETED→IN_PROGRESS=FINAL, IN_PROGRESS→CONFIRMED=ESTIMATED) */
  targetMrCountSource: "FINAL" | "ESTIMATED";
}

export interface RevertMealPlanCascadeResult {
  deletedHeaders: number;
  softDeletedMrs: number;
  releasedReservations: number;
}

/**
 * CONFIRMED ConsumptionHeader 가 하나라도 존재하면 ConfirmedConsumptionExistsError throw.
 * TODO(R12): 실구현.
 */
export async function assertMealPlanRevertable(
  _tx: Prisma.TransactionClient,
  _input: AssertMealPlanRevertableInput,
): Promise<void> {
  throw new Error("NOT_IMPLEMENTED — R12 (Sprint 5 재편집 UI)");
}

/**
 * PENDING Consumption 삭제 + 대상 MR soft-delete + 관련 Reservation release.
 * TODO(R12): 실구현.
 */
export async function revertMealPlanCascade(
  _tx: Prisma.TransactionClient,
  _input: RevertMealPlanCascadeInput,
): Promise<RevertMealPlanCascadeResult> {
  throw new Error("NOT_IMPLEMENTED — R12 (Sprint 5 재편집 UI)");
}
