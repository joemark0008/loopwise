-- Wise confirmations for the encounter's documents (DESIGN.md §7.1): prescriptions, medical certificates and bills
-- carry a version a Wise card saves against, so a draft changed since the card showed it is never overwritten.
-- The `*_version` triggers fire after the `*_lock` triggers (name order), so an issued document's lock still sees the
-- version unchanged and only the allowed columns moving.

-- AlterTable
ALTER TABLE "prescription" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "medical_certificate" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "encounter_bill" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

CREATE TRIGGER "prescription_version"
    BEFORE UPDATE ON "prescription"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
CREATE TRIGGER "medical_certificate_version"
    BEFORE UPDATE ON "medical_certificate"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
CREATE TRIGGER "encounter_bill_version"
    BEFORE UPDATE ON "encounter_bill"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
