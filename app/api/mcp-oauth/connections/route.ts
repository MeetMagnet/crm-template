import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listMcpConnections } from "@/lib/mcp-oauth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const connections = await listMcpConnections();
  return NextResponse.json({
    data: connections.map((connection) => ({
      ...connection,
      createdAt: connection.createdAt.toISOString(),
      lastUsedAt: connection.lastUsedAt?.toISOString() ?? null,
    })),
  });
}
