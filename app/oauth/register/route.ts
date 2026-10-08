import { NextResponse } from "next/server";
import { registerMcpOAuthClient } from "@/lib/mcp-oauth";
import { corsHeaders, corsPreflight } from "@/lib/mcp-public";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();

function limited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 20) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  if (limited(request)) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429, headers: corsHeaders() });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const registered = await registerMcpOAuthClient(body);
    return NextResponse.json(registered, { status: 201, headers: corsHeaders() });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode || 400;
    const message = error instanceof Error ? error.message : "invalid_client_metadata";
    return NextResponse.json({ error: "invalid_client_metadata", error_description: message }, { status, headers: corsHeaders() });
  }
}
