import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { findMcpOAuthClient } from "@/lib/mcp-oauth";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, context: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { clientId } = await context.params;
  const client = await findMcpOAuthClient(decodeURIComponent(clientId));
  if (!client) return NextResponse.json({ error: "Client OAuth introuvable." }, { status: 404 });

  let redirectHost = "";
  try {
    redirectHost = client.redirectUriList[0] ? new URL(client.redirectUriList[0]).host : "";
  } catch {
    redirectHost = "";
  }

  return NextResponse.json({
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: client.redirectUriList,
    redirect_host: redirectHost,
    scope: client.scope,
  });
}
