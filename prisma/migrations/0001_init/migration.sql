-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "siteWeb" TEXT,
    "siret" TEXT,
    "linkedinUrl" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prenom" TEXT NOT NULL DEFAULT '',
    "nom" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "telephone" TEXT,
    "poste" TEXT,
    "linkedinUrl" TEXT,
    "description" TEXT,
    "adresse" TEXT,
    "pays" TEXT,
    "source" TEXT,
    "category" TEXT NOT NULL DEFAULT 'lead',
    "state" TEXT NOT NULL DEFAULT 'new_lead',
    "companyId" TEXT,
    "prochaineActionTitre" TEXT,
    "prochaineActionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactStateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT NOT NULL,
    "previousCategory" TEXT,
    "newCategory" TEXT,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactStateHistory_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContactStateHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "datePrevue" DATETIME,
    "dateRealisation" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Action_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Action_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Contact_category_idx" ON "Contact"("category");

-- CreateIndex
CREATE INDEX "Contact_state_idx" ON "Contact"("state");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_nom_idx" ON "Contact"("nom");

-- CreateIndex
CREATE INDEX "Contact_prenom_idx" ON "Contact"("prenom");

-- CreateIndex
CREATE INDEX "Contact_prochaineActionDate_idx" ON "Contact"("prochaineActionDate");

-- CreateIndex
CREATE INDEX "ContactStateHistory_contactId_createdAt_idx" ON "ContactStateHistory"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "Action_contactId_idx" ON "Action"("contactId");

-- CreateIndex
CREATE INDEX "Action_statut_idx" ON "Action"("statut");

-- CreateIndex
CREATE INDEX "Action_channel_idx" ON "Action"("channel");

-- CreateIndex
CREATE INDEX "Action_datePrevue_idx" ON "Action"("datePrevue");
