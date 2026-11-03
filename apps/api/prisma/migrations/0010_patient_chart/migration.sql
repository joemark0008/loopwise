-- The patient chart (DESIGN.md §9): one Wise chat per clinician per patient, and the chat an encounter was drafted in.

-- AlterTable
ALTER TABLE "chat" ADD COLUMN     "patient_id" TEXT;

-- AlterTable
ALTER TABLE "encounter" ADD COLUMN     "source_chat_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_user_patient_unique" ON "chat"("user_id", "patient_id") WHERE ((patient_id IS NOT NULL) AND (deleted_at IS NULL));

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
