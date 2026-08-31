import { NextRequest, NextResponse } from "next/server";
import { deleteContact, getContact, updateContact } from "@/lib/contacts";
import { isContactStatut } from "@/lib/labels";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const contact = await getContact(id);
  if (!contact) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }
  return NextResponse.json(contact);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getContact(id);
  if (!existing) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (body.statut !== undefined && !isContactStatut(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  if (body.nom !== undefined && (typeof body.nom !== "string" || body.nom.trim() === "")) {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }

  const contact = await updateContact(id, {
    nom: body.nom,
    email: body.email,
    telephone: body.telephone,
    statut: body.statut,
    companyId: body.companyId,
  });

  return NextResponse.json(contact);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getContact(id);
  if (!existing) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }
  await deleteContact(id);
  return NextResponse.json({ ok: true });
}
