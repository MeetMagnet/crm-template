import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const companyInclude = {
  _count: { select: { contacts: true } },
} satisfies Prisma.CompanyInclude;

export type CompanyWithCount = Prisma.CompanyGetPayload<{
  include: typeof companyInclude;
}>;

export async function listCompanies(q?: string) {
  const where: Prisma.CompanyWhereInput = {};
  if (q && q.trim()) {
    const query = q.trim();
    where.OR = [
      { nom: { contains: query } },
      { email: { contains: query } },
      { telephone: { contains: query } },
    ];
  }

  return prisma.company.findMany({
    where,
    include: companyInclude,
    orderBy: { nom: "asc" },
  });
}

export async function getCompany(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { nom: "asc" } },
    },
  });
}

export type CompanyInput = {
  nom: string;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  siteWeb?: string | null;
  notes?: string | null;
};

export async function createCompany(data: CompanyInput) {
  return prisma.company.create({
    data: {
      nom: data.nom.trim(),
      email: emptyToNull(data.email),
      telephone: emptyToNull(data.telephone),
      adresse: emptyToNull(data.adresse),
      siteWeb: emptyToNull(data.siteWeb),
      notes: emptyToNull(data.notes),
    },
    include: companyInclude,
  });
}

export async function updateCompany(id: string, data: Partial<CompanyInput>) {
  return prisma.company.update({
    where: { id },
    data: {
      ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
      ...(data.email !== undefined ? { email: emptyToNull(data.email) } : {}),
      ...(data.telephone !== undefined ? { telephone: emptyToNull(data.telephone) } : {}),
      ...(data.adresse !== undefined ? { adresse: emptyToNull(data.adresse) } : {}),
      ...(data.siteWeb !== undefined ? { siteWeb: emptyToNull(data.siteWeb) } : {}),
      ...(data.notes !== undefined ? { notes: emptyToNull(data.notes) } : {}),
    },
    include: companyInclude,
  });
}

export async function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
