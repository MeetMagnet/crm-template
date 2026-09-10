import { NextResponse } from "next/server";
import { deleteCompany, getCompany, updateCompany } from "@/lib/companies";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  const company = await getCompany(id);
  if (!company) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const company = await updateCompany(id, {
      nom: body.nom,
      email: body.email,
      telephone: body.telephone,
      adresse: body.adresse,
      siteWeb: body.siteWeb,
      siret: body.siret,
      linkedinUrl: body.linkedinUrl,
      description: body.description,
      notes: body.notes,
      customFields:
        body.customFields && typeof body.customFields === "object" && !Array.isArray(body.customFields)
          ? (body.customFields as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    await deleteCompany(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
