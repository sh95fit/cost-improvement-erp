import { redirect } from "next/navigation";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { POWizard } from "@/features/purchase-order/components/wizard/po-wizard";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  // 세션 + 회사 보장 (미인증 / 회사 미배정 시 throw)
  let session;
  try {
    session = await requireCompanySession();
  } catch {
    redirect("/login");
  }

  // 권한 가드 (없으면 throw → 목록으로 리다이렉트)
  try {
    assertPermission(session, "purchase-order", "CREATE");
  } catch {
    redirect("/purchase-orders?error=no-permission");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">신규 발주 (위저드)</h1>
        <p className="text-sm text-gray-500">
          식단(MealPlan) 기반으로 자재 필요량을 산출하여 공장 × 공급업체 단위로
          발주서를 자동 분할 생성합니다.
        </p>
      </div>

      <POWizard />
    </div>
  );
}
