import type { ContactStatut, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isContactStatut } from "@/lib/labels";

const contactInclude = {
  company: true,
  _count: { select: { actions: true } },
} satisfies Prisma.ContactInclude;

export type ContactWithCompany = Prisma.ContactGetPayload<{
  include: typeof contactInclude;
}>;

export type ListContactsParams = {
  q?: string;
  statut?: string;
  companyId?: string;
};

export async function listContacts(params: ListContactsParams = {}) {
  const where: Prisma.ContactWhereInput = {};

  if (params.q && params.q.trim()) {
    const q = params.q.trim();
    where.OR = [
      { nom: { contains: q } },
      { email: { contains: q } },
      { telephone: { contains: q } },
      { company: { nom: { contains: q } } },
    ];
  }

  if (params.statut && isContactStatut(params.statut)) {
    where.statut = params.statut;
  }

  if (params.companyId) {
    where.companyId = params.companyId;
  }

  return prisma.contact.findMany({
    where,
    include: contactInclude,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getContact(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      company: true,
      actions: { orderBy: { createdAt: "desc" } },
    },
  });
}

export type ContactInput = {
  nom: string;
  email?: string | null;
  telephone?: string | null;
  statut?: ContactStatut;
  companyId?: string | null;
};

export async function createContact(data: ContactInput) {
  return prisma.contact.create({
    data: {
      nom: data.nom.trim(),
      email: emptyToNull(data.email),
      telephone: emptyToNull(data.telephone),
      statut: data.statut ?? "lead",
      companyId: emptyToNull(data.companyId),
    },
    include: contactInclude,
  });
}

export async function updateContact(id: string, data: Partial<ContactInput>) {
  return prisma.contact.update({
    where: { id },
    data: {
      ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
      ...(data.email !== undefined ? { email: emptyToNull(data.email) } : {}),
      ...(data.telephone !== undefined ? { telephone: emptyToNull(data.telephone) } : {}),
      ...(data.statut !== undefined ? { statut: data.statut } : {}),
      ...(data.companyId !== undefined ? { companyId: emptyToNull(data.companyId) } : {}),
    },
    include: contactInclude,
  });
}

export async function deleteContact(id: string) {
  return prisma.contact.delete({ where: { id } });
}

export async function updateContactStatut(id: string, statut: ContactStatut) {
  return prisma.contact.update({
    where: { id },
    data: { statut },
    include: contactInclude,
  });
}

export async function countContactsByStatut() {
  const groups = await prisma.contact.groupBy({
    by: ["statut"],
    _count: { _all: true },
  });
  return groups;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
