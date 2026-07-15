import Link from "next/link";

export default function ConsumptionListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">사용 처리</h1>
      <div className="rounded-md border bg-white p-4 text-sm text-gray-600">
        사용 처리 목록은 S4-3-e 에서 구현됩니다.
        <br />
        신규 작성:{" "}
        <Link
          href="/consumption/new"
          className="text-blue-600 underline"
        >
          /consumption/new?date=YYYY-MM-DD&amp;locationId=...
        </Link>
      </div>
    </div>
  );
}
