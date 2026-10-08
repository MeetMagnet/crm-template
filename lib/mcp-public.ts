import { NextResponse } from "next/server";

export const MCP_SCOPE = "crm";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function publicOrigin(request: Request) {
  const configured = process.env.APP_URL || process.env.PUBLIC_URL;
  if (configured?.trim()) return configured.trim().replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

export function mcpResourceUrl(request: Request) {
  return `${publicOrigin(request)}/mcp`;
}

export function protectedResourceMetadata(request: Request) {
  const origin = publicOrigin(request);
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [MCP_SCOPE],
    resource_documentation: `${origin}/settings`,
  };
}

export function authorizationServerMetadata(request: Request) {
  const origin = publicOrigin(request);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/connect/mcp`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    scopes_supported: [MCP_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
  };
}

export function wwwAuthenticate(request: Request) {
  const origin = publicOrigin(request);
  return [
    'Bearer realm="mcp"',
    `resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    `resource="${origin}/mcp"`,
  ].join(", ");
}

export function isSafeOAuthRedirectUri(uri: string) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  if (parsed.protocol === "http:") {
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }
  return false;
}
