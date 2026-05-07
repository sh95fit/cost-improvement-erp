-- 기존 SEASONING, PROCESSED 데이터를 RAW로 변환
UPDATE material_masters SET material_type = 'RAW' WHERE material_type IN ('SEASONING', 'PROCESSED');

-- enum 값 제거
ALTER TYPE material_type RENAME TO material_type_old;
CREATE TYPE material_type AS ENUM ('RAW', 'OTHER');
ALTER TABLE material_masters ALTER COLUMN material_type TYPE material_type USING material_type::text::material_type;
DROP TYPE material_type_old;
