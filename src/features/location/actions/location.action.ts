// src/features/location/actions/location.action.ts
"use server";

import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/utils/audit";
import { actionOk } from "@/lib/result";
import type { ActionResult } from "@/lib/result";
import { handleActionError } from "@/lib/action-helpers";
import {
  createLocationSchema,
  updateLocationSchema,
  locationListQuerySchema,
} from "../schemas/location.schema";
import * as locationService from "../services/location.service";
import type { Location } from "@prisma/client";

// ════════════════════════════════════════
// Location Read
// ════════════════════════════════════════

export async function getLocationsAction(
  rawQuery: Record<string, unknown>
): Promise<
  ActionResult<Awaited<ReturnType<typeof locationService.getLocations>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "READ");
    const query = locationListQuerySchema.parse(rawQuery);
    const result = await locationService.getLocations(session.companyId, query);
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "위치 목록 조회에 실패했습니다");
  }
}

export async function getLocationByIdAction(
  id: string
): Promise<
  ActionResult<Awaited<ReturnType<typeof locationService.getLocationById>>>
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "READ");
    const location = await locationService.getLocationById(
      session.companyId,
      id
    );
    if (!location) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "위치 조회에 실패했습니다",
        { NOT_FOUND: "위치를 찾을 수 없습니다" }
      );
    }
    return actionOk(location);
  } catch (error) {
    return handleActionError(error, "위치 조회에 실패했습니다");
  }
}

// ════════════════════════════════════════
// Location CRUD (Write)
// ════════════════════════════════════════

export async function createLocationAction(
  rawInput: Record<string, unknown>
): Promise<ActionResult<Location>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "CREATE");
    const input = createLocationSchema.parse(rawInput);
    const location = await locationService.createLocation(
      session.companyId,
      input
    );
    await createAuditLog({
      session,
      action: "CREATE",
      entityType: "Location",
      entityId: location.id,
      after: location as unknown as Record<string, unknown>,
    });
    return actionOk(location);
  } catch (error) {
    return handleActionError(error, "위치 생성에 실패했습니다");
  }
}

export async function updateLocationAction(
  id: string,
  rawInput: Record<string, unknown>
): Promise<ActionResult<Location>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "UPDATE");
    const input = updateLocationSchema.parse(rawInput);
    const existing = await locationService.getLocationById(
      session.companyId,
      id
    );
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "위치 수정에 실패했습니다",
        { NOT_FOUND: "위치를 찾을 수 없습니다" }
      );
    }
    const before = existing as unknown as Record<string, unknown>;
    const location = await locationService.updateLocation(
      session.companyId,
      id,
      input
    );
    await createAuditLog({
      session,
      action: "UPDATE",
      entityType: "Location",
      entityId: location.id,
      before,
      after: location as unknown as Record<string, unknown>,
    });
    return actionOk(location);
  } catch (error) {
    return handleActionError(error, "위치 수정에 실패했습니다", {
      NOT_FOUND: "위치를 찾을 수 없습니다",
    });
  }
}

export async function checkLocationDependenciesAction(
  id: string
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof locationService.checkLocationDependencies>>
  >
> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "READ");
    const result = await locationService.checkLocationDependencies(
      session.companyId,
      id
    );
    return actionOk(result);
  } catch (error) {
    return handleActionError(error, "위치 의존성 확인에 실패했습니다", {
      NOT_FOUND: "위치를 찾을 수 없습니다",
    });
  }
}

export async function deleteLocationAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCompanySession();
    assertPermission(session, "location", "DELETE");
    const existing = await locationService.getLocationById(
      session.companyId,
      id
    );
    if (!existing) {
      return handleActionError(
        new Error("NOT_FOUND"),
        "위치 삭제에 실패했습니다",
        { NOT_FOUND: "위치를 찾을 수 없습니다" }
      );
    }
    await locationService.deleteLocation(session.companyId, id);
    await createAuditLog({
      session,
      action: "DELETE",
      entityType: "Location",
      entityId: id,
      before: existing as unknown as Record<string, unknown>,
    });
    return actionOk({ id });
  } catch (error) {
    return handleActionError(error, "위치 삭제에 실패했습니다", {
      NOT_FOUND: "위치를 찾을 수 없습니다",
      DEPENDENCY_EXISTS:
        "이 위치를 사용 중인 생산라인/재고/이동/출고가 있어 삭제할 수 없습니다",
    });
  }
}
