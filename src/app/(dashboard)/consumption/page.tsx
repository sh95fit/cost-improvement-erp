import { ConsumptionList } from "@/features/consumption/components/consumption-list";

export default function ConsumptionListPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">사용 관리</h1>
          <p className="text-sm text-gray-500">
            식단 자동 계산 및 수동으로 추가된 사용 처리 내역을 조회합니다.
          </p>
        </div>
      </div>
      <ConsumptionList />
    </div>
  );
}
