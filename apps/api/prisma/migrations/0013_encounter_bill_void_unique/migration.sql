-- One bill per encounter that is not voided (DESIGN.md §5): a voided bill stays in the record and a new one can be
-- made. 0011_encounter_record made the index unique on every bill.

-- DropIndex
DROP INDEX "encounter_bill_encounter_unique";

-- CreateIndex
CREATE UNIQUE INDEX "encounter_bill_encounter_unique" ON "encounter_bill"("encounter_id") WHERE (status <> 'voided'::bill_status);
