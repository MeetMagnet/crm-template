import { NextResponse } from "next/server";
import { bulkDeleteCompanies } from "@/lib/companies";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Aucune entreprise sélectionnée" }, { status: 400 });
  if (body.action !== "delete") return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  const result = await bulkDeleteCompanies(ids);
  return NextResponse.json({ ok: true, count: result.count });
}
