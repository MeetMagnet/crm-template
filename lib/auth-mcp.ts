import { NextResponse } from "next/server";

export function getMcpToken(): string | undefined {
  const token = process.env.MCP_TOKEN?.trim();
  if (!token) {
    return undefined;
  }
  return token;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

export function requireMcpAuth(request: Request): NextResponse | null {
  const expected = getMcpToken();
  if (!expected) {
    return NextResponse.json(
      { error: "MCP_TOKEN n'est pas configuré sur le serveur" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const provided = match?.[1]?.trim();

  if (!provided || provided !== expected) {
    return unauthorized();
  }

  return null;
}
