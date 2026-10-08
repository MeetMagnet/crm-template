-- CreateTable
CREATE TABLE "McpOAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "clientName" TEXT NOT NULL,
    "redirectUris" TEXT NOT NULL,
    "grantTypes" TEXT NOT NULL,
    "responseTypes" TEXT NOT NULL,
    "tokenEndpointAuthMethod" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "McpOAuthCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "McpOAuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "accessExpiresAt" DATETIME NOT NULL,
    "refreshExpiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthClient_clientId_key" ON "McpOAuthClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthCode_codeHash_key" ON "McpOAuthCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthToken_accessTokenHash_key" ON "McpOAuthToken"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "McpOAuthToken_refreshTokenHash_key" ON "McpOAuthToken"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "McpOAuthToken_clientId_idx" ON "McpOAuthToken"("clientId");
