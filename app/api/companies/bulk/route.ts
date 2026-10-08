import { NextResponse } from "next/server";
import { bulkDeleteCompanies, migrateCompanies } from "@/lib/companies";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Aucune entreprise sélectionnée" }, { status: 400 });
  if (body.action === "delete") {
    const result = await bulkDeleteCompanies(ids);
    return NextResponse.json({ ok: true, count: result.count });
  }

  if (body.action === "migrate") {
    const targetId = typeof body.targetId === "string" ? body.targetId : "";
    if (!targetId) {
      return NextResponse.json({ error: "Choisissez une entreprise cible" }, { status: 400 });
    }
    try {
      const result = await migrateCompanies(targetId, ids);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
