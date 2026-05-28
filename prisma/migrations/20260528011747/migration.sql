/*
  Warnings:

  - You are about to drop the `lineup_location_maps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "lineup_location_maps" DROP CONSTRAINT "lineup_location_maps_lineup_id_fkey";

-- DropForeignKey
ALTER TABLE "lineup_location_maps" DROP CONSTRAINT "lineup_location_maps_location_id_fkey";

-- DropTable
DROP TABLE "lineup_location_maps";

-- CreateIndex
CREATE INDEX "lineups_deleted_at_idx" ON "lineups"("deleted_at");
