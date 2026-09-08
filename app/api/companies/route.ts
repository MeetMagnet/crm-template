import { NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/companies";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companies = await listCompanies(searchParams.get("q") ?? undefined);
  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    const company = await createCompany({
      nom: body.nom,
      email: body.email,
      telephone: body.telephone,
      adresse: body.adresse,
      siteWeb: body.siteWeb,
      siret: body.siret,
      linkedinUrl: body.linkedinUrl,
      description: body.description,
      notes: body.notes,
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Création impossible" },
      { status: 400 },
    );
  }
}
