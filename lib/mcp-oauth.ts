import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { MCP_SCOPE, isSafeOAuthRedirectUri, mcpResourceUrl } from "@/lib/mcp-public";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return asList(parsed);
  } catch {
    return [];
  }
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string) {
  const verifier = codeVerifier.trim();
  const challenge = codeChallenge.trim();
  if (!verifier || !challenge) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(computed, challenge);
}

export async function registerMcpOAuthClient(body: Record<string, unknown>) {
  const redirectUris = asList(body.redirect_uris);
  if (!redirectUris.length) {
    const error = new Error("redirect_uris est requis.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  for (const uri of redirectUris) {
    if (!isSafeOAuthRedirectUri(uri)) {
      const error = new Error(`redirect_uri non autorisé : ${uri}. Seuls https et http://localhost sont acceptés.`);
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
  }

  const authMethod = String(body.token_endpoint_auth_method ?? "none").trim() || "none";
  const wantsSecret = authMethod === "client_secret_post" || authMethod === "client_secret_basic";
  const clientSecret = wantsSecret ? randomToken("mcpsec_") : null;
  const grantTypes = asList(body.grant_types);
  const responseTypes = asList(body.response_types);
  const clientId = randomToken("mcpcli_");
  const clientName = String(body.client_name ?? "").trim() || "Connecteur MCP";
  const scope = String(body.scope ?? "").trim() || MCP_SCOPE;

  await prisma.mcpOAuthClient.create({
    data: {
      clientId,
      clientSecretHash: clientSecret ? sha256(clientSecret) : null,
      clientName,
      redirectUris: JSON.stringify(redirectUris),
      grantTypes: JSON.stringify(grantTypes.length ? grantTypes : ["authorization_code", "refresh_token"]),
      responseTypes: JSON.stringify(responseTypes.length ? responseTypes : ["code"]),
      tokenEndpointAuthMethod: authMethod,
      scope,
    },
  });

  return {
    client_id: clientId,
    client_secret: clientSecret || undefined,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes.length ? grantTypes : ["authorization_code", "refresh_token"],
    response_types: responseTypes.length ? responseTypes : ["code"],
    token_endpoint_auth_method: authMethod,
    scope,
  };
}

export async function findMcpOAuthClient(clientId: string) {
  const client = await prisma.mcpOAuthClient.findUnique({ where: { clientId: clientId.trim() } });
  if (!client) return null;
  return {
    ...client,
    redirectUriList: parseJsonList(client.redirectUris),
  };
}

function assertRedirect(client: { redirectUriList: string[] }, redirectUri: string) {
  const wanted = redirectUri.trim();
  if (!wanted || !isSafeOAuthRedirectUri(wanted) || !client.redirectUriList.includes(wanted)) {
    const error = new Error("redirect_uri non autorisé pour ce client.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  return wanted;
}

export async function createMcpOAuthAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
  scope?: string;
  resource?: string;
  request: Request;
}) {
  const client = await findMcpOAuthClient(input.clientId);
  if (!client) {
    const error = new Error("client_id inconnu.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  const redirectUri = assertRedirect(client, input.redirectUri);
  if ((input.codeChallengeMethod || "S256").toUpperCase() !== "S256") {
    const error = new Error("Seul code_challenge_method=S256 est supporté.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
  if (!input.codeChallenge.trim()) {
    const error = new Error("code_challenge (PKCE) est requis.");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const code = randomToken("mcpauth_");
  await prisma.mcpOAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: client.clientId,
      userId: input.userId,
      redirectUri,
      codeChallenge: input.codeChallenge.trim(),
      codeChallengeMethod: "S256",
      scope: input.scope?.trim() || client.scope || MCP_SCOPE,
      resource: input.resource?.trim() || mcpResourceUrl(input.request),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });
  return { code, client };
}

function checkClientSecret(client: { clientSecretHash: string | null }, clientSecret: string | null) {
  if (!client.clientSecretHash) return;
  if (!clientSecret || !safeEqual(sha256(clientSecret), client.clientSecretHash)) {
    const error = new Error("invalid_client");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

export async function exchangeMcpOAuthAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  clientSecret?: string | null;
}) {
  const client = await findMcpOAuthClient(input.clientId);
  if (!client) {
    const error = new Error("invalid_client");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  checkClientSecret(client, input.clientSecret ?? null);
  assertRedirect(client, input.redirectUri);

  return prisma.$transaction(async (tx) => {
    const row = await tx.mcpOAuthCode.findUnique({ where: { codeHash: sha256(input.code) } });
    if (!row || row.usedAt || row.clientId !== client.clientId || row.expiresAt.getTime() < Date.now()) {
      const error = new Error("invalid_grant");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
    if (row.redirectUri !== input.redirectUri.trim() || !verifyPkceS256(input.codeVerifier, row.codeChallenge)) {
      const error = new Error("invalid_grant");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
    await tx.mcpOAuthCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    const accessToken = randomToken("mcpat_");
    const refreshToken = randomToken("mcprt_");
    await tx.mcpOAuthToken.create({
      data: {
        accessTokenHash: sha256(accessToken),
        refreshTokenHash: sha256(refreshToken),
        clientId: row.clientId,
        userId: row.userId,
        scope: row.scope,
        resource: row.resource,
        accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return {
      access_token: accessToken,
      token_type: "Bearer" as const,
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: row.scope,
    };
  });
}

export async function refreshMcpOAuthToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string | null;
}) {
  const client = await findMcpOAuthClient(input.clientId);
  if (!client) {
    const error = new Error("invalid_client");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  checkClientSecret(client, input.clientSecret ?? null);

  return prisma.$transaction(async (tx) => {
    const row = await tx.mcpOAuthToken.findUnique({ where: { refreshTokenHash: sha256(input.refreshToken) } });
    if (!row || row.revokedAt || row.clientId !== client.clientId || row.refreshExpiresAt.getTime() < Date.now()) {
      const error = new Error("invalid_grant");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }
    await tx.mcpOAuthToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    const accessToken = randomToken("mcpat_");
    const refreshToken = randomToken("mcprt_");
    await tx.mcpOAuthToken.create({
      data: {
        accessTokenHash: sha256(accessToken),
        refreshTokenHash: sha256(refreshToken),
        clientId: row.clientId,
        userId: row.userId,
        scope: row.scope,
        resource: row.resource,
        accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
        refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return {
      access_token: accessToken,
      token_type: "Bearer" as const,
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: row.scope,
    };
  });
}

export async function isValidOAuthAccessToken(token: string) {
  const row = await prisma.mcpOAuthToken.findUnique({ where: { accessTokenHash: sha256(token.trim()) } });
  if (!row || row.revokedAt || row.accessExpiresAt.getTime() < Date.now()) return false;
  await prisma.mcpOAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return true;
}

export async function listMcpConnections() {
  const tokens = await prisma.mcpOAuthToken.findMany({ orderBy: { createdAt: "desc" } });
  const clients = await prisma.mcpOAuthClient.findMany();
  const names = new Map(clients.map((client) => [client.clientId, client.clientName]));
  const byClient = new Map<string, { clientId: string; clientName: string; createdAt: Date; lastUsedAt: Date | null; active: boolean }>();
  for (const token of tokens) {
    const current = byClient.get(token.clientId);
    const active = !token.revokedAt && token.accessExpiresAt.getTime() > Date.now();
    if (!current) {
      byClient.set(token.clientId, {
        clientId: token.clientId,
        clientName: names.get(token.clientId) || "Connecteur MCP",
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        active,
      });
      continue;
    }
    if (token.lastUsedAt && (!current.lastUsedAt || token.lastUsedAt > current.lastUsedAt)) {
      current.lastUsedAt = token.lastUsedAt;
    }
    current.active = current.active || active;
  }
  return [...byClient.values()];
}
