import { NextRequest, NextResponse } from "next/server";
import { createAction, listActions } from "@/lib/actions";
import { getContact } from "@/lib/contacts";
import { isActionStatut, isActionType, parseOptionalDate } from "@/lib/labels";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statutParam = searchParams.get("statut");
  const statut = statutParam && isActionStatut(statutParam) ? statutParam : undefined;

  const actions = await listActions({
    contactId: searchParams.get("contactId") ?? undefined,
    statut,
  });
  return NextResponse.json(actions);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.contactId !== "string") {
    return NextResponse.json({ error: "contactId est obligatoire" }, { status: 400 });
  }
  if (typeof body.titre !== "string" || body.titre.trim() === "") {
    return NextResponse.json({ error: "Le titre est obligatoire" }, { status: 400 });
  }
  if (!isActionType(body.type)) {
    return NextResponse.json({ error: "Type d'action invalide" }, { status: 400 });
  }
  if (body.statut !== undefined && !isActionStatut(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const contact = await getContact(body.contactId);
  if (!contact) {
    return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
  }

  const datePrevue = parseOptionalDate(body.datePrevue);
  const dateRealisation = parseOptionalDate(body.dateRealisation);

  const action = await createAction({
    contactId: body.contactId,
    type: body.type,
    titre: body.titre,
    contenu: typeof body.contenu === "string" ? body.contenu : "",
    statut: body.statut,
    datePrevue: datePrevue === undefined ? null : datePrevue,
    dateRealisation: dateRealisation === undefined ? null : dateRealisation,
  });

  return NextResponse.json(action, { status: 201 });
}
