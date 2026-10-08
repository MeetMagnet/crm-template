import { NextResponse } from "next/server";
import { exchangeMcpOAuthAuthorizationCode, refreshMcpOAuthToken } from "@/lib/mcp-oauth";
import { corsHeaders, corsPreflight } from "@/lib/mcp-public";

export const dynamic = "force-dynamic";

function oauthError(status: number, error: string, description?: string) {
  return NextResponse.json(
    description ? { error, error_description: description } : { error },
    { status, headers: corsHeaders() },
  );
}

function basicAuth(header: string | null) {
  const raw = header?.trim() || "";
  if (!raw.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(raw.slice(6), "base64").toString("utf8");
    const index = decoded.indexOf(":");
    if (index < 0) return null;
    return { client_id: decoded.slice(0, index), client_secret: decoded.slice(index + 1) };
  } catch {
    return null;
  }
}

async function readBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, value == null ? "" : String(value)]));
  }
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text).entries());
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const basic = basicAuth(request.headers.get("authorization"));
  const clientId = (body.client_id || basic?.client_id || "").trim();
  const clientSecret = (body.client_secret || basic?.client_secret || "").trim() || null;
  const grantType = (body.grant_type || "").trim();

  try {
    if (grantType === "authorization_code") {
      const tokens = await exchangeMcpOAuthAuthorizationCode({
        code: body.code || "",
        clientId,
        redirectUri: body.redirect_uri || "",
        codeVerifier: body.code_verifier || "",
        clientSecret,
      });
      return NextResponse.json(tokens, { headers: corsHeaders() });
    }
    if (grantType === "refresh_token") {
      const tokens = await refreshMcpOAuthToken({
        refreshToken: body.refresh_token || "",
        clientId,
        clientSecret,
      });
      return NextResponse.json(tokens, { headers: corsHeaders() });
    }
    return oauthError(400, "unsupported_grant_type");
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode || 400;
    const message = error instanceof Error ? error.message : "invalid_grant";
    return oauthError(status, status === 401 ? "invalid_client" : message, message);
  }
}
