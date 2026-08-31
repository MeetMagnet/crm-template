import { NextRequest, NextResponse } from "next/server";
import { closeAction, deleteAction, getAction, updateAction } from "@/lib/actions";
import { isActionStatut, isActionType, parseOptionalDate } from "@/lib/labels";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const action = await getAction(id);
  if (!action) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }
  return NextResponse.json(action);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getAction(id);
  if (!existing) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (body.cloturer === true) {
    const closed = await closeAction(id);
    return NextResponse.json(closed);
  }

  if (body.type !== undefined && !isActionType(body.type)) {
    return NextResponse.json({ error: "Type d'action invalide" }, { status: 400 });
  }
  if (body.statut !== undefined && !isActionStatut(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  if (body.titre !== undefined && (typeof body.titre !== "string" || body.titre.trim() === "")) {
    return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });
  }

  const action = await updateAction(id, {
    type: body.type,
    titre: body.titre,
    contenu: body.contenu,
    statut: body.statut,
    datePrevue: parseOptionalDate(body.datePrevue),
    dateRealisation: parseOptionalDate(body.dateRealisation),
  });

  return NextResponse.json(action);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getAction(id);
  if (!existing) {
    return NextResponse.json({ error: "Action introuvable" }, { status: 404 });
  }
  await deleteAction(id);
  return NextResponse.json({ ok: true });
}
