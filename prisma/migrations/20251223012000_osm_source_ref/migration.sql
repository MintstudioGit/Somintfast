-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "source" TEXT;
ALTER TABLE "Lead" ADD COLUMN "sourceRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_customerId_source_sourceRef_key" ON "Lead"("customerId", "source", "sourceRef");

