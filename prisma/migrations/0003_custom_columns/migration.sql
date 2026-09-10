-- AlterTable
ALTER TABLE "Company" ADD COLUMN "customFields" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "customFields" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Action" ADD COLUMN "customFields" TEXT NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "CustomColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CustomColumn_entityType_idx" ON "CustomColumn"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomColumn_entityType_key_key" ON "CustomColumn"("entityType", "key");
