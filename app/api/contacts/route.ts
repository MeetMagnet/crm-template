import { NextRequest, NextResponse } from "next/server";
import { createContact, listContacts } from "@/lib/contacts";
import { isContactStatut } from "@/lib/labels";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const contacts = await listContacts({
    q: searchParams.get("q") ?? undefined,
    statut: searchParams.get("statut") ?? undefined,
    companyId: searchParams.get("companyId") ?? undefined,
  });
  return NextResponse.json(contacts);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || body.nom.trim() === "") {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }

  if (body.statut !== undefined && !isContactStatut(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const contact = await createContact({
    nom: body.nom,
    email: body.email ?? null,
    telephone: body.telephone ?? null,
    statut: body.statut,
    companyId: body.companyId ?? null,
  });

  return NextResponse.json(contact, { status: 201 });
}
