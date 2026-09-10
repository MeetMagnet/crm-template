-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "viewType" TEXT NOT NULL DEFAULT 'list',
    "filters" TEXT NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "SavedView_entity_idx" ON "SavedView"("entity");

-- CreateIndex
CREATE INDEX "SavedView_userId_idx" ON "SavedView"("userId");
