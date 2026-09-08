import { NextResponse } from "next/server";
import { deleteAction, getAction, updateAction } from "@/lib/actions";
import { isActionChannel, isActionStatut, parseOptionalDate } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const action = await getAction(id);
  if (!action) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(action);
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (body.channel !== undefined && !isActionChannel(body.channel)) {
    return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
  }
  if (body.statut !== undefined && !isActionStatut(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  const action = await updateAction(id, {
    channel: isActionChannel(body.channel) ? body.channel : undefined,
    titre: body.titre,
    contenu: body.contenu,
    statut: isActionStatut(body.statut) ? body.statut : undefined,
    datePrevue: body.datePrevue !== undefined ? parseOptionalDate(body.datePrevue) ?? null : undefined,
    dateRealisation:
      body.dateRealisation !== undefined ? parseOptionalDate(body.dateRealisation) ?? null : undefined,
  });
  if (!action) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(action);
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    await deleteAction(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
