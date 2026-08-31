import { NextRequest, NextResponse } from "next/server";
import { deleteCompany, getCompany, updateCompany } from "@/lib/companies";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const company = await getCompany(id);
  if (!company) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }
  return NextResponse.json(company);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getCompany(id);
  if (!existing) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  if (body.nom !== undefined && (typeof body.nom !== "string" || body.nom.trim() === "")) {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }

  const company = await updateCompany(id, {
    nom: body.nom,
    email: body.email,
    telephone: body.telephone,
    adresse: body.adresse,
    siteWeb: body.siteWeb,
    notes: body.notes,
  });

  return NextResponse.json(company);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const existing = await getCompany(id);
  if (!existing) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }
  await deleteCompany(id);
  return NextResponse.json({ ok: true });
}
