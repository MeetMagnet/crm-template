import { NextResponse } from "next/server";
import { bulkDeleteActions, bulkUpdateActionStatut } from "@/lib/actions";
import { isActionStatut } from "@/lib/labels";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (!ids.length) return NextResponse.json({ error: "Aucune action sélectionnée" }, { status: 400 });

  if (body.action === "delete") {
    const result = await bulkDeleteActions(ids);
    return NextResponse.json({ ok: true, count: result.count });
  }
  if (body.action === "updateStatut") {
    if (!isActionStatut(body.statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    const result = await bulkUpdateActionStatut(ids, body.statut);
    return NextResponse.json({ ok: true, count: result.count });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
