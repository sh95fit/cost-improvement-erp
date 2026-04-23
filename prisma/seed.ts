import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

// ============================================================
// 원가 정확도 개선 프로젝트 - seed.ts v2
// Prisma 7 호환
// ============================================================

// ⛔ 프로덕션 환경에서는 실행 금지
if (process.env.NODE_ENV === "production") {
  console.error("⛔ seed.ts는 프로덕션 환경에서 실행할 수 없습니다.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 시드 데이터 투입을 시작합니다...\n");

  // ---- 1. Company ----
  const company = await prisma.company.upsert({
    where: { code: "LUNCHLAB" },
    update: {},
    create: {
      name: "런치랩",
      code: "LUNCHLAB",
      bizNo: "123-45-67890",
      address: "서울특별시 강남구 테헤란로 123",
      phone: "02-1234-5678",
    },
  });
  console.log("✅ Company:", company.name);

  // ---- 2. PermissionSets ----
  const permSysAdmin = await prisma.permissionSet.upsert({
    where: { id: "perm-sys-admin" },
    update: {},
    create: {
      id: "perm-sys-admin",
      name: "SYSTEM_ADMIN_FULL",
      description: "시스템 관리자 전체 권한",
    },
  });

  const permCompanyAdmin = await prisma.permissionSet.upsert({
    where: { id: "perm-company-admin" },
    update: {},
    create: {
      id: "perm-company-admin",
      name: "COMPANY_ADMIN_FULL",
      description: "회사 관리자 전체 권한",
    },
  });

  const permMember = await prisma.permissionSet.upsert({
    where: { id: "perm-member-default" },
    update: {},
    create: {
      id: "perm-member-default",
      name: "MEMBER_DEFAULT",
      description: "일반 멤버 기본 권한",
    },
  });
  console.log("✅ PermissionSets: 3개 생성");

  // ---- 2-1. PermissionSetItems (시스템 관리자) ----
  const sysAdminResources = [
    "company", "user", "material", "subsidiary", "supplier",
    "recipe", "bom", "meal-plan", "inventory", "purchasing",
    "shipping", "cost", "month-end", "notification", "audit-log",
  ];
  const sysAdminActions = ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "EXPORT"] as const;

  for (const resource of sysAdminResources) {
    for (const action of sysAdminActions) {
      await prisma.permissionSetItem.upsert({
        where: {
          permissionSetId_resource_action: {
            permissionSetId: permSysAdmin.id,
            resource,
            action,
          },
        },
        update: {},
        create: {
          permissionSetId: permSysAdmin.id,
          resource,
          action,
        },
      });
    }
  }
  console.log(`✅ PermissionSetItems: ${sysAdminResources.length * sysAdminActions.length}개 (시스템 관리자)`);

  // ---- 3. System Admin User ----
  const adminEmail = process.env.SEED_SYSTEM_ADMIN_EMAIL || "admin@lunchlab.com";
  const adminName = process.env.SEED_SYSTEM_ADMIN_NAME || "시스템관리자";

  const adminUser = await prisma.user.upsert({
    where: { providerUserId: "google-oauth2|system-admin" },
    update: {},
    create: {
      providerUserId: "google-oauth2|system-admin",
      email: adminEmail,
      name: adminName,
      status: "ACTIVE",
    },
  });
  console.log("✅ Admin User:", adminUser.email);

  // ---- 3-1. UserScope ----
  await prisma.userScope.upsert({
    where: {
      userId_companyId: {
        userId: adminUser.id,
        companyId: company.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      companyId: company.id,
      role: "SYSTEM_ADMIN",
      permissionSetId: permSysAdmin.id,
    },
  });
  console.log("✅ UserScope: 시스템 관리자 매핑 완료");

  // ---- 4. Locations ----
  const locationSeoul = await prisma.location.upsert({
    where: { companyId_code: { companyId: company.id, code: "SEOUL-01" } },
    update: {},
    create: {
      companyId: company.id,
      name: "서울 본사 주방",
      code: "SEOUL-01",
      address: "서울특별시 강남구 테헤란로 123",
    },
  });

  const locationGyeonggi = await prisma.location.upsert({
    where: { companyId_code: { companyId: company.id, code: "GG-01" } },
    update: {},
    create: {
      companyId: company.id,
      name: "경기 물류센터",
      code: "GG-01",
      address: "경기도 성남시 분당구 판교로 456",
    },
  });
  console.log("✅ Locations: 2개 생성");

  // ---- 5. ProductionLines ----
  const prodLines = [
    { name: "A라인 (한식)", locationId: locationSeoul.id },
    { name: "B라인 (양식)", locationId: locationSeoul.id },
    { name: "C라인 (특식)", locationId: locationSeoul.id },
    { name: "D라인 (경기)", locationId: locationGyeonggi.id },
  ];
  for (const pl of prodLines) {
    await prisma.productionLine.create({
      data: {
        companyId: company.id,
        locationId: pl.locationId,
        name: pl.name,
        status: "ACTIVE",
      },
    });
  }
  console.log("✅ ProductionLines: 4개 생성");

  // ---- 6. Lineups ----
  const lineupHome = await prisma.lineup.upsert({
    where: { companyId_code: { companyId: company.id, code: "HOME-A" } },
    update: {},
    create: {
      companyId: company.id,
      name: "가정간편식 A",
      code: "HOME-A",
    },
  });

  const lineupFresh = await prisma.lineup.upsert({
    where: { companyId_code: { companyId: company.id, code: "FRESH-B" } },
    update: {},
    create: {
      companyId: company.id,
      name: "신선식품 B",
      code: "FRESH-B",
    },
  });
  console.log("✅ Lineups: 2개 생성");

  // ---- 7. LineupLocationMaps ----
  const lineupMaps = [
    { lineupId: lineupHome.id, locationId: locationSeoul.id },
    { lineupId: lineupHome.id, locationId: locationGyeonggi.id },
    { lineupId: lineupFresh.id, locationId: locationSeoul.id },
  ];
  for (const map of lineupMaps) {
    await prisma.lineupLocationMap.upsert({
      where: {
        lineupId_locationId: {
          lineupId: map.lineupId,
          locationId: map.locationId,
        },
      },
      update: {},
      create: map,
    });
  }
  console.log("✅ LineupLocationMaps: 3개 생성");

  // ---- 8. MaterialMasters ----
  const materials = [
    { name: "쌀", code: "MAT-001", materialType: "RAW" as const, unit: "kg", unitCategory: "WEIGHT" as const },
    { name: "닭가슴살", code: "MAT-002", materialType: "RAW" as const, unit: "kg", unitCategory: "WEIGHT" as const },
    { name: "양파", code: "MAT-003", materialType: "RAW" as const, unit: "kg", unitCategory: "WEIGHT" as const },
    { name: "간장", code: "MAT-004", materialType: "SEASONING" as const, unit: "L", unitCategory: "VOLUME" as const },
    { name: "참기름", code: "MAT-005", materialType: "SEASONING" as const, unit: "L", unitCategory: "VOLUME" as const },
    { name: "냉동만두", code: "MAT-006", materialType: "PROCESSED" as const, unit: "kg", unitCategory: "WEIGHT" as const },
  ];

  const materialRecords: Record<string, string> = {};
  for (const mat of materials) {
    const record = await prisma.materialMaster.upsert({
      where: { companyId_code: { companyId: company.id, code: mat.code } },
      update: {},
      create: {
        companyId: company.id,
        ...mat,
        shelfLifeDays: mat.materialType === "RAW" ? 7 : 180,
      },
    });
    materialRecords[mat.code] = record.id;
  }
  console.log("✅ MaterialMasters: 6개 생성");

  // ---- 9. SubsidiaryMasters ----
  const subsidiaries = [
    { name: "도시락 용기 (대)", code: "SUB-001", unit: "개" },
    { name: "도시락 용기 (소)", code: "SUB-002", unit: "개" },
    { name: "수저 세트", code: "SUB-003", unit: "세트" },
    { name: "포장 비닐", code: "SUB-004", unit: "장" },
  ];

  const subsidiaryRecords: Record<string, string> = {};
  for (const sub of subsidiaries) {
    const record = await prisma.subsidiaryMaster.upsert({
      where: { companyId_code: { companyId: company.id, code: sub.code } },
      update: {},
      create: { companyId: company.id, ...sub },
    });
    subsidiaryRecords[sub.code] = record.id;
  }
  console.log("✅ SubsidiaryMasters: 4개 생성");

  // ---- 10. Suppliers ----
  const supplierA = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: "SUP-001" } },
    update: {},
    create: {
      companyId: company.id,
      name: "신선농산",
      code: "SUP-001",
      contactName: "김신선",
      contactPhone: "010-1111-2222",
      contactEmail: "fresh@supplier.com",
    },
  });

  const supplierB = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: "SUP-002" } },
    update: {},
    create: {
      companyId: company.id,
      name: "대한식자재",
      code: "SUP-002",
      contactName: "이대한",
      contactPhone: "010-3333-4444",
      contactEmail: "daehan@supplier.com",
    },
  });
  console.log("✅ Suppliers: 2개 생성");

  // ---- 11. SupplierItems ----
  const supplierItems = [
    { supplierId: supplierA.id, materialCode: "MAT-001", supplyUnit: "포(20kg)", supplyUnitQty: 20, currentPrice: 52000 },
    { supplierId: supplierA.id, materialCode: "MAT-002", supplyUnit: "kg", supplyUnitQty: 1, currentPrice: 8500 },
    { supplierId: supplierA.id, materialCode: "MAT-003", supplyUnit: "망(10kg)", supplyUnitQty: 10, currentPrice: 15000 },
    { supplierId: supplierB.id, materialCode: "MAT-004", supplyUnit: "병(1.8L)", supplyUnitQty: 1.8, currentPrice: 4500 },
    { supplierId: supplierB.id, materialCode: "MAT-005", supplyUnit: "병(500ml)", supplyUnitQty: 0.5, currentPrice: 8000 },
    { supplierId: supplierB.id, materialCode: "MAT-006", supplyUnit: "봉(1kg)", supplyUnitQty: 1, currentPrice: 6500 },
  ];

  const supplierItemRecords: string[] = [];
  for (const si of supplierItems) {
    const record = await prisma.supplierItem.create({
      data: {
        supplierId: si.supplierId,
        itemType: "MATERIAL",
        materialMasterId: materialRecords[si.materialCode],
        supplyUnit: si.supplyUnit,
        supplyUnitQty: si.supplyUnitQty,
        currentPrice: si.currentPrice,
        leadTimeDays: 2,
      },
    });
    supplierItemRecords.push(record.id);
  }
  console.log("✅ SupplierItems: 6개 생성");

  // ---- 11-1. SupplierItemPriceHistory ----
  for (const siId of supplierItemRecords) {
    await prisma.supplierItemPriceHistory.create({
      data: {
        supplierItemId: siId,
        price: 0,
        effectiveFrom: new Date("2025-01-01"),
      },
    });
  }
  console.log("✅ SupplierItemPriceHistory: 6개 생성");

  // ---- 12. ContainerGroup ----
  const containerGroup = await prisma.containerGroup.upsert({
    where: { companyId_code: { companyId: company.id, code: "CTG-001" } },
    update: {},
    create: {
      companyId: company.id,
      name: "기본 도시락 4칸",
      code: "CTG-001",
    },
  });

  const containerSlots = [
    { slotIndex: 0, label: "밥", volumeMl: 300 },
    { slotIndex: 1, label: "메인반찬", volumeMl: 250 },
    { slotIndex: 2, label: "부반찬1", volumeMl: 150 },
    { slotIndex: 3, label: "부반찬2", volumeMl: 150 },
  ];
  for (const cs of containerSlots) {
    await prisma.containerSlot.upsert({
      where: {
        containerGroupId_slotIndex: {
          containerGroupId: containerGroup.id,
          slotIndex: cs.slotIndex,
        },
      },
      update: {},
      create: { containerGroupId: containerGroup.id, ...cs },
    });
  }

  await prisma.containerAccessory.create({
    data: {
      containerGroupId: containerGroup.id,
      name: "수저 세트",
      description: "일회용 수저+젓가락",
    },
  });
  console.log("✅ ContainerGroup: 1개 (4슬롯 + 1악세서리)");

  // ---- 13. Recipes & RecipeVariants ----
  const recipeA = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: "RCP-001" } },
    update: {},
    create: {
      companyId: company.id,
      name: "닭가슴살 덮밥",
      code: "RCP-001",
      description: "닭가슴살과 야채를 활용한 덮밥",
    },
  });

  const recipeB = await prisma.recipe.upsert({
    where: { companyId_code: { companyId: company.id, code: "RCP-002" } },
    update: {},
    create: {
      companyId: company.id,
      name: "만두국",
      code: "RCP-002",
      description: "냉동만두를 활용한 만두국",
    },
  });

  const variantA1 = await prisma.recipeVariant.create({
    data: { recipeId: recipeA.id, variantName: "기본 (1인분)", servings: 1 },
  });
  const variantA10 = await prisma.recipeVariant.create({
    data: { recipeId: recipeA.id, variantName: "대량 (10인분)", servings: 10 },
  });
  const variantB1 = await prisma.recipeVariant.create({
    data: { recipeId: recipeB.id, variantName: "기본 (1인분)", servings: 1 },
  });
  console.log("✅ Recipes: 2개, RecipeVariants: 3개");

  // ---- 14. SemiProduct ----
  const semiProduct = await prisma.semiProduct.upsert({
    where: { companyId_code: { companyId: company.id, code: "SEMI-001" } },
    update: {},
    create: {
      companyId: company.id,
      name: "닭가슴살 양념육",
      code: "SEMI-001",
      unit: "kg",
    },
  });
  console.log("✅ SemiProduct: 1개");

  // ---- 15. BOMs ----
  const bomA1 = await prisma.bOM.create({
    data: {
      companyId: company.id,
      ownerType: "RECIPE_VARIANT",
      recipeVariantId: variantA1.id,
      version: 1,
      status: "ACTIVE",
    },
  });

  const bomA10 = await prisma.bOM.create({
    data: {
      companyId: company.id,
      ownerType: "RECIPE_VARIANT",
      recipeVariantId: variantA10.id,
      version: 1,
      status: "ACTIVE",
    },
  });

  const bomSemi = await prisma.bOM.create({
    data: {
      companyId: company.id,
      ownerType: "SEMI_PRODUCT",
      semiProductId: semiProduct.id,
      version: 1,
      status: "ACTIVE",
    },
  });
  console.log("✅ BOMs: 3개");

  // ---- 15-1. BOMItems ----
  // BOM A1 (닭가슴살 덮밥 1인분)
  await prisma.bOMItem.createMany({
    data: [
      { bomId: bomA1.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-001"], quantity: 0.2, unit: "kg", sortOrder: 1 },
      { bomId: bomA1.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-002"], quantity: 0.15, unit: "kg", sortOrder: 2 },
      { bomId: bomA1.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-003"], quantity: 0.05, unit: "kg", sortOrder: 3 },
    ],
  });

  // BOM A10 (닭가슴살 덮밥 10인분)
  await prisma.bOMItem.createMany({
    data: [
      { bomId: bomA10.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-001"], quantity: 2.0, unit: "kg", sortOrder: 1 },
      { bomId: bomA10.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-002"], quantity: 1.5, unit: "kg", sortOrder: 2 },
    ],
  });

  // BOM Semi (닭가슴살 양념육)
  await prisma.bOMItem.createMany({
    data: [
      { bomId: bomSemi.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-002"], quantity: 1.0, unit: "kg", sortOrder: 1 },
      { bomId: bomSemi.id, itemType: "MATERIAL", materialMasterId: materialRecords["MAT-004"], quantity: 0.05, unit: "L", sortOrder: 2 },
    ],
  });
  console.log("✅ BOMItems: 7개");

  // ---- 16. UnitConversions ----
  const unitConversions = [
    { fromCode: "MAT-001", toCode: "MAT-001", fromUnit: "포(20kg)", toUnit: "kg", factor: 20, unitCategory: "WEIGHT" as const },
    { fromCode: "MAT-004", toCode: "MAT-004", fromUnit: "병(1.8L)", toUnit: "L", factor: 1.8, unitCategory: "VOLUME" as const },
    { fromCode: "MAT-005", toCode: "MAT-005", fromUnit: "병(500ml)", toUnit: "L", factor: 0.5, unitCategory: "VOLUME" as const },
  ];
  for (const uc of unitConversions) {
    await prisma.unitConversion.create({
      data: {
        fromMaterialId: materialRecords[uc.fromCode],
        toMaterialId: materialRecords[uc.toCode],
        fromUnit: uc.fromUnit,
        toUnit: uc.toUnit,
        factor: uc.factor,
        unitCategory: uc.unitCategory,
      },
    });
  }
  console.log("✅ UnitConversions: 3개");

  // ---- 17. MealTemplate ----
  const mealTemplate = await prisma.mealTemplate.create({
    data: {
      companyId: company.id,
      name: "기본 도시락 템플릿",
      containerGroupId: containerGroup.id,
    },
  });

  const templateSlots = [
    { slotIndex: 0, label: "밥", isRequired: true },
    { slotIndex: 1, label: "메인반찬", isRequired: true },
    { slotIndex: 2, label: "부반찬1", isRequired: false },
    { slotIndex: 3, label: "부반찬2", isRequired: false },
  ];
  for (const ts of templateSlots) {
    await prisma.mealTemplateSlot.upsert({
      where: {
        mealTemplateId_slotIndex: {
          mealTemplateId: mealTemplate.id,
          slotIndex: ts.slotIndex,
        },
      },
      update: {},
      create: { mealTemplateId: mealTemplate.id, ...ts },
    });
  }

  await prisma.mealTemplateAccessory.create({
    data: {
      mealTemplateId: mealTemplate.id,
      name: "수저 세트",
      isRequired: true,
    },
  });
  console.log("✅ MealTemplate: 1개 (4슬롯 + 1악세서리)");

  // ---- 18. NotificationTagDefs ----
  const tagDefs = [
    { tagKey: "company_name", label: "회사명" },
    { tagKey: "user_name", label: "사용자 이름" },
    { tagKey: "plan_date", label: "식단 날짜" },
    { tagKey: "lineup_name", label: "라인업명" },
    { tagKey: "order_number", label: "발주번호" },
    { tagKey: "supplier_name", label: "공급업체명" },
    { tagKey: "material_name", label: "식자재명" },
    { tagKey: "current_stock", label: "현재 재고량" },
    { tagKey: "min_stock", label: "최소 재고량" },
    { tagKey: "location_name", label: "위치명" },
    { tagKey: "target_month", label: "대상 월" },
    { tagKey: "status", label: "상태" },
    { tagKey: "total_amount", label: "총 금액" },
    { tagKey: "due_date", label: "마감일" },
  ];
  for (const td of tagDefs) {
    await prisma.notificationTagDef.upsert({
      where: { tagKey: td.tagKey },
      update: {},
      create: td,
    });
  }
  console.log("✅ NotificationTagDefs: 14개");

  // ---- 19. NotificationTemplates ----
  const templateMealPlan = await prisma.notificationTemplate.create({
    data: {
      name: "식단 확정 알림",
      subject: "[{{company_name}}] {{plan_date}} 식단이 확정되었습니다",
      bodyTemplate: "{{user_name}}님, {{plan_date}} {{lineup_name}} 식단이 확정되었습니다.",
      channel: "IN_APP",
    },
  });

  const templatePO = await prisma.notificationTemplate.create({
    data: {
      name: "발주 승인 알림",
      subject: "[{{company_name}}] 발주 {{order_number}} 승인됨",
      bodyTemplate: "{{supplier_name}}에 대한 발주 {{order_number}}이(가) 승인되었습니다. 총 금액: {{total_amount}}",
      channel: "IN_APP",
    },
  });

  const templateLowStock = await prisma.notificationTemplate.create({
    data: {
      name: "재고 부족 알림",
      subject: "[{{company_name}}] {{material_name}} 재고 부족",
      bodyTemplate: "{{location_name}}의 {{material_name}} 재고가 {{current_stock}}으로 최소 재고({{min_stock}}) 이하입니다.",
      channel: "EMAIL",
    },
  });
  console.log("✅ NotificationTemplates: 3개");

  // ---- 20. NotificationRules ----
  await prisma.notificationRule.createMany({
    data: [
      { companyId: company.id, eventType: "MEAL_PLAN_CONFIRMED", channel: "IN_APP", templateId: templateMealPlan.id },
      { companyId: company.id, eventType: "PO_APPROVED", channel: "IN_APP", templateId: templatePO.id },
      { companyId: company.id, eventType: "INVENTORY_LOW_STOCK", channel: "EMAIL", templateId: templateLowStock.id },
    ],
  });
  console.log("✅ NotificationRules: 3개");

  // ---- 요약 ----
  console.log("\n🎉 시드 데이터 투입 완료!");
  console.log("────────────────────────────");
  console.log("Company:              1");
  console.log("PermissionSets:       3");
  console.log("PermissionSetItems:   90");
  console.log("User (Admin):         1");
  console.log("UserScope:            1");
  console.log("Locations:            2");
  console.log("ProductionLines:      4");
  console.log("Lineups:              2");
  console.log("LineupLocationMaps:   3");
  console.log("MaterialMasters:      6");
  console.log("SubsidiaryMasters:    4");
  console.log("Suppliers:            2");
  console.log("SupplierItems:        6");
  console.log("PriceHistories:       6");
  console.log("ContainerGroup:       1 (4슬롯 + 1악세서리)");
  console.log("Recipes:              2");
  console.log("RecipeVariants:       3");
  console.log("SemiProduct:          1");
  console.log("BOMs:                 3");
  console.log("BOMItems:             7");
  console.log("UnitConversions:      3");
  console.log("MealTemplate:         1 (4슬롯 + 1악세서리)");
  console.log("NotificationTagDefs:  14");
  console.log("NotificationTemplates:3");
  console.log("NotificationRules:    3");
  console.log("────────────────────────────");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error("❌ 시드 실행 중 오류:", e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
