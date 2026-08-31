import { NextRequest, NextResponse } from "next/server";
import { createCompany, listCompanies } from "@/lib/companies";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const companies = await listCompanies(q);
  return NextResponse.json(companies);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || body.nom.trim() === "") {
    return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
  }

  const company = await createCompany({
    nom: body.nom,
    email: body.email ?? null,
    telephone: body.telephone ?? null,
    adresse: body.adresse ?? null,
    siteWeb: body.siteWeb ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json(company, { status: 201 });
}
