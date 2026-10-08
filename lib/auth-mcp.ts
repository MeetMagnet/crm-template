import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isValidOAuthAccessToken } from "@/lib/mcp-oauth";
import { corsHeaders, wwwAuthenticate } from "@/lib/mcp-public";

export function getMcpToken(): string | undefined {
  const token = process.env.MCP_TOKEN?.trim();
  return token || undefined;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function unauthorizedMcp(request: Request): NextResponse {
  return NextResponse.json(
    { error: "Non autorisé" },
    {
      status: 401,
      headers: {
        ...corsHeaders(),
        "WWW-Authenticate": wwwAuthenticate(request),
      },
    },
  );
}

export async function requireMcpAuth(request: Request): Promise<NextResponse | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();
  if (!provided) return unauthorizedMcp(request);

  const expected = getMcpToken();
  if (expected && safeEqual(provided, expected)) return null;
  if (await isValidOAuthAccessToken(provided)) return null;
  return unauthorizedMcp(request);
}
