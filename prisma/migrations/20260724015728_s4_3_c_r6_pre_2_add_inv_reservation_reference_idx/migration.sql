-- CreateIndex
CREATE INDEX "inventory_reservations_reference_type_reference_id_idx" ON "inventory_reservations"("reference_type", "reference_id");
