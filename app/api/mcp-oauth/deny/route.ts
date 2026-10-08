import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { findMcpOAuthClient } from "@/lib/mcp-oauth";
import { isSafeOAuthRedirectUri } from "@/lib/mcp-public";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const client = await findMcpOAuthClient(String(body.client_id ?? ""));
  if (!client) return NextResponse.json({ error: "client_id inconnu." }, { status: 400 });

  const redirectUri = String(body.redirect_uri ?? "").trim();
  if (!isSafeOAuthRedirectUri(redirectUri) || !client.redirectUriList.includes(redirectUri)) {
    return NextResponse.json({ error: "redirect_uri non autorisé pour ce client." }, { status: 400 });
  }

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("error", "access_denied");
  if (body.state) redirect.searchParams.set("state", String(body.state));
  return NextResponse.json({ success: true, redirect_to: redirect.toString(), redirect_host: redirect.host });
}
