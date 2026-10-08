import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createMcpOAuthAuthorizationCode, findMcpOAuthClient } from "@/lib/mcp-oauth";
import { isSafeOAuthRedirectUri } from "@/lib/mcp-public";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = String(body.client_id ?? "").trim();
  const redirectUri = String(body.redirect_uri ?? "").trim();
  const client = await findMcpOAuthClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "client_id inconnu. Relancez la connexion depuis Claude." }, { status: 400 });
  }
  if (!isSafeOAuthRedirectUri(redirectUri) || !client.redirectUriList.includes(redirectUri)) {
    return NextResponse.json({ error: "redirect_uri non autorisé pour ce client." }, { status: 400 });
  }

  try {
    const { code } = await createMcpOAuthAuthorizationCode({
      clientId,
      userId: user.id,
      redirectUri,
      codeChallenge: String(body.code_challenge ?? ""),
      codeChallengeMethod: String(body.code_challenge_method ?? "S256"),
      scope: typeof body.scope === "string" ? body.scope : undefined,
      resource: typeof body.resource === "string" ? body.resource : undefined,
      request,
    });
    const redirect = new URL(redirectUri);
    redirect.searchParams.set("code", code);
    if (body.state) redirect.searchParams.set("state", String(body.state));
    return NextResponse.json({
      success: true,
      redirect_to: redirect.toString(),
      client_name: client.clientName,
      redirect_host: redirect.host,
    });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode || 400;
    const message = error instanceof Error ? error.message : "Impossible d’autoriser ce connecteur.";
    return NextResponse.json({ error: message }, { status });
  }
}
