-- M-Fix-R1 (D14-7): MaterialMaster / SubsidiaryMaster 활성/비활성 플래그

ALTER TABLE "material_masters"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "material_masters_is_active_idx"
  ON "material_masters"("is_active");

ALTER TABLE "subsidiary_masters"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "subsidiary_masters_is_active_idx"
  ON "subsidiary_masters"("is_active");
