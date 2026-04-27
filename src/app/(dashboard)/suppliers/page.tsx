"use client";

import { useState } from "react";
import { SupplierList } from "@/features/supplier/components/supplier-list";
import { SupplierForm } from "@/features/supplier/components/supplier-form";
import { SupplierItemList } from "@/features/supplier/components/supplier-item-list";
import { SupplierItemForm } from "@/features/supplier/components/supplier-item-form";
import { SupplierBreadcrumb } from "@/features/supplier/components/supplier-breadcrumb";
import type { Supplier } from "@prisma/client";

type SupplierItemRow = {
  id: string;
  itemType: string;
  supplierItemCode: string | null;
  productName: string;
  spec: string | null;
  supplyUnit: string;
  supplyUnitQty: number;
  currentPrice: number;
  leadTimeDays: number;
  moq: number | null;
  materialMaster: { id: string; name: string; code: string } | null;
  subsidiaryMaster: { id: string; name: string; code: string } | null;
};

type View =
  | { mode: "list" }
  | { mode: "new" }
  | { mode: "edit"; supplier: Supplier }
  | { mode: "items"; supplier: Supplier }
  | { mode: "newItem"; supplier: Supplier }
  | { mode: "editItem"; supplier: Supplier; item: SupplierItemRow };

export default function SuppliersPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  const getBreadcrumb = () => {
    const root = {
      label: "공급업체 관리",
      onClick: () => setView({ mode: "list" }),
    };

    if (view.mode === "new") {
      return [root, { label: "신규 등록" }];
    }
    if (view.mode === "edit") {
      return [
        root,
        {
          label: `${view.supplier.name} (${view.supplier.code})`,
          onClick: () => setView({ mode: "items", supplier: view.supplier }),
        },
        { label: "정보 수정" },
      ];
    }
    if (view.mode === "items") {
      return [
        root,
        { label: `${view.supplier.name} (${view.supplier.code})` },
      ];
    }
    if (view.mode === "newItem") {
      return [
        root,
        {
          label: `${view.supplier.name} (${view.supplier.code})`,
          onClick: () => setView({ mode: "items", supplier: view.supplier }),
        },
        { label: "품목 등록" },
      ];
    }
    if (view.mode === "editItem") {
      return [
        root,
        {
          label: `${view.supplier.name} (${view.supplier.code})`,
          onClick: () => setView({ mode: "items", supplier: view.supplier }),
        },
        {
          label:
            view.item.materialMaster?.name ??
            view.item.subsidiaryMaster?.name ??
            "품목 수정",
        },
      ];
    }
    return [];
  };

  const breadcrumbItems = getBreadcrumb();

  if (view.mode === "new") {
    return (
      <div className="space-y-4">
        <SupplierBreadcrumb items={breadcrumbItems} />
        <SupplierForm
          onBack={() => setView({ mode: "list" })}
          onSaved={() => setView({ mode: "list" })}
        />
      </div>
    );
  }

  if (view.mode === "edit") {
    return (
      <div className="space-y-4">
        <SupplierBreadcrumb items={breadcrumbItems} />
        <SupplierForm
          supplier={view.supplier}
          onBack={() => setView({ mode: "items", supplier: view.supplier })}
          onSaved={() => setView({ mode: "items", supplier: view.supplier })}
        />
      </div>
    );
  }

  if (view.mode === "items") {
    return (
      <div className="space-y-4">
        <SupplierBreadcrumb items={breadcrumbItems} />
        <SupplierItemList
          supplier={view.supplier}
          onBack={() => setView({ mode: "list" })}
          onNewItem={() =>
            setView({ mode: "newItem", supplier: view.supplier })
          }
          onEditItem={(item: SupplierItemRow) =>
            setView({ mode: "editItem", supplier: view.supplier, item })
          }
        />
      </div>
    );
  }

  if (view.mode === "newItem") {
    return (
      <div className="space-y-4">
        <SupplierBreadcrumb items={breadcrumbItems} />
        <SupplierItemForm
          supplierId={view.supplier.id}
          onBack={() => setView({ mode: "items", supplier: view.supplier })}
          onSaved={() => setView({ mode: "items", supplier: view.supplier })}
        />
      </div>
    );
  }

  if (view.mode === "editItem") {
    return (
      <div className="space-y-4">
        <SupplierBreadcrumb items={breadcrumbItems} />
        <SupplierItemForm
          supplierId={view.supplier.id}
          item={view.item}
          onBack={() => setView({ mode: "items", supplier: view.supplier })}
          onSaved={() => setView({ mode: "items", supplier: view.supplier })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">공급업체 관리</h1>
        <p className="text-sm text-gray-500">
          공급업체 등록 및 공급 품목·단가를 관리합니다
        </p>
      </div>
      <SupplierList
        onNew={() => setView({ mode: "new" })}
        onEdit={(supplier: Supplier) => setView({ mode: "edit", supplier })}
        onViewItems={(supplier: Supplier) =>
          setView({ mode: "items", supplier })
        }
      />
    </div>
  );
}
