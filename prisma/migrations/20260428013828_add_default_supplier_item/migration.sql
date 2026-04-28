/*
  Warnings:

  - A unique constraint covering the columns `[default_supplier_item_id]` on the table `material_masters` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[default_supplier_item_id]` on the table `subsidiary_masters` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "material_masters" ADD COLUMN     "default_supplier_item_id" TEXT;

-- AlterTable
ALTER TABLE "subsidiary_masters" ADD COLUMN     "default_supplier_item_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "material_masters_default_supplier_item_id_key" ON "material_masters"("default_supplier_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "subsidiary_masters_default_supplier_item_id_key" ON "subsidiary_masters"("default_supplier_item_id");

-- AddForeignKey
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_default_supplier_item_id_fkey" FOREIGN KEY ("default_supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subsidiary_masters" ADD CONSTRAINT "subsidiary_masters_default_supplier_item_id_fkey" FOREIGN KEY ("default_supplier_item_id") REFERENCES "supplier_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
