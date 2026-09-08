import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listCompanies(q?: string) {
  const where: Prisma.CompanyWhereInput = {};
  if (q?.trim()) {
    const query = q.trim();
    where.OR = [
      { nom: { contains: query } },
      { email: { contains: query } },
      { siteWeb: { contains: query } },
      { siret: { contains: query } },
    ];
  }
  return prisma.company.findMany({
    where,
    include: { _count: { select: { contacts: true } } },
    orderBy: { nom: "asc" },
  });
}

export async function getCompany(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ nom: "asc" }, { prenom: "asc" }] },
    },
  });
}

export type CompanyInput = {
  nom?: string;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  siteWeb?: string | null;
  siret?: string | null;
  linkedinUrl?: string | null;
  description?: string | null;
  notes?: string | null;
};

function cleanOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createCompany(input: CompanyInput) {
  const nom = input.nom?.trim();
  if (!nom) throw new Error("Le nom est requis");
  return prisma.company.create({
    data: {
      nom,
      email: cleanOptional(input.email) ?? null,
      telephone: cleanOptional(input.telephone) ?? null,
      adresse: cleanOptional(input.adresse) ?? null,
      siteWeb: cleanOptional(input.siteWeb) ?? null,
      siret: cleanOptional(input.siret) ?? null,
      linkedinUrl: cleanOptional(input.linkedinUrl) ?? null,
      description: cleanOptional(input.description) ?? null,
      notes: cleanOptional(input.notes) ?? null,
    },
  });
}

export async function updateCompany(id: string, input: CompanyInput) {
  return prisma.company.update({
    where: { id },
    data: {
      ...(input.nom !== undefined ? { nom: input.nom.trim() } : {}),
      ...(input.email !== undefined ? { email: cleanOptional(input.email) } : {}),
      ...(input.telephone !== undefined ? { telephone: cleanOptional(input.telephone) } : {}),
      ...(input.adresse !== undefined ? { adresse: cleanOptional(input.adresse) } : {}),
      ...(input.siteWeb !== undefined ? { siteWeb: cleanOptional(input.siteWeb) } : {}),
      ...(input.siret !== undefined ? { siret: cleanOptional(input.siret) } : {}),
      ...(input.linkedinUrl !== undefined ? { linkedinUrl: cleanOptional(input.linkedinUrl) } : {}),
      ...(input.description !== undefined ? { description: cleanOptional(input.description) } : {}),
      ...(input.notes !== undefined ? { notes: cleanOptional(input.notes) } : {}),
    },
    include: {
      contacts: { orderBy: [{ nom: "asc" }, { prenom: "asc" }] },
    },
  });
}

export async function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}
