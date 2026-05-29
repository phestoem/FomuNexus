-- AlterTable
ALTER TABLE "FormBlueprint" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FormBlueprint_archivedAt_updatedAt_idx" ON "FormBlueprint"("archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "FormBlueprint_label_idx" ON "FormBlueprint"("label");
