-- CreateEnum
CREATE TYPE "stock_grade" AS ENUM ('A', 'B', 'C');

-- AlterTable
ALTER TABLE "material_masters" ADD COLUMN     "stock_grade" "stock_grade" NOT NULL DEFAULT 'C',
ADD COLUMN     "stock_grade_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subsidiary_masters" ADD COLUMN     "stock_grade" "stock_grade" NOT NULL DEFAULT 'C',
ADD COLUMN     "stock_grade_updated_at" TIMESTAMP(3);
