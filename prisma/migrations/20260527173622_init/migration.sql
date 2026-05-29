-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "FormBlueprint" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetSchema" JSONB NOT NULL,
    "toneProfile" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSession" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "capturedData" JSONB NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormSession_blueprintId_idx" ON "FormSession"("blueprintId");

-- AddForeignKey
ALTER TABLE "FormSession" ADD CONSTRAINT "FormSession_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "FormBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
