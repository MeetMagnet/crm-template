import { authorizationServerMetadata, corsHeaders, corsPreflight } from "@/lib/mcp-public";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export function GET(request: Request) {
  return Response.json(authorizationServerMetadata(request), { headers: corsHeaders() });
}
