import type { PersonCategory, PersonState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPersonCategory, isPersonState, resolveLifecycleUpdate } from "@/lib/labels";

export type ContactFilters = {
  q?: string;
  category?: string;
  state?: string;
};

function buildWhere(filters: ContactFilters = {}): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {};
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { prenom: { contains: q } },
      { nom: { contains: q } },
      { email: { contains: q } },
      { telephone: { contains: q } },
      { poste: { contains: q } },
      { company: { nom: { contains: q } } },
    ];
  }
  if (filters.category && isPersonCategory(filters.category)) {
    where.category = filters.category;
  }
  if (filters.state && isPersonState(filters.state)) {
    where.state = filters.state;
  }
  return where;
}

export async function listContacts(filters: ContactFilters = {}) {
  return prisma.contact.findMany({
    where: buildWhere(filters),
    include: { company: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getContact(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      company: true,
      actions: { orderBy: [{ datePrevue: "asc" }, { createdAt: "desc" }] },
    },
  });
}

export type ContactInput = {
  prenom?: string;
  nom?: string;
  email?: string | null;
  telephone?: string | null;
  poste?: string | null;
  linkedinUrl?: string | null;
  description?: string | null;
  adresse?: string | null;
  pays?: string | null;
  source?: string | null;
  category?: PersonCategory;
  state?: PersonState;
  companyId?: string | null;
  prochaineActionTitre?: string | null;
  prochaineActionDate?: Date | null;
};

function cleanOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createContact(input: ContactInput, changedById?: string) {
  const lifecycle = resolveLifecycleUpdate({
    currentState: "new_lead",
    currentCategory: "lead",
    requestedState: input.state,
    requestedCategory: input.category,
  });

  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        prenom: input.prenom?.trim() ?? "",
        nom: input.nom?.trim() ?? "",
        email: cleanOptional(input.email) ?? null,
        telephone: cleanOptional(input.telephone) ?? null,
        poste: cleanOptional(input.poste) ?? null,
        linkedinUrl: cleanOptional(input.linkedinUrl) ?? null,
        description: cleanOptional(input.description) ?? null,
        adresse: cleanOptional(input.adresse) ?? null,
        pays: cleanOptional(input.pays) ?? null,
        source: cleanOptional(input.source) ?? null,
        category: lifecycle.category,
        state: lifecycle.state,
        companyId: input.companyId || null,
        prochaineActionTitre: cleanOptional(input.prochaineActionTitre) ?? null,
        prochaineActionDate: input.prochaineActionDate ?? null,
      },
      include: { company: true },
    });

    await tx.contactStateHistory.create({
      data: {
        contactId: contact.id,
        previousState: null,
        newState: contact.state,
        previousCategory: null,
        newCategory: contact.category,
        changedById: changedById || null,
      },
    });

    return contact;
  });
}

export async function updateContact(id: string, input: ContactInput, changedById?: string) {
  const current = await prisma.contact.findUnique({ where: { id } });
  if (!current) return null;

  const lifecycle = resolveLifecycleUpdate({
    currentState: current.state,
    currentCategory: current.category,
    requestedState: input.state,
    requestedCategory: input.category,
  });

  const stateChanged = lifecycle.state !== current.state || lifecycle.category !== current.category;

  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.update({
      where: { id },
      data: {
        ...(input.prenom !== undefined ? { prenom: input.prenom.trim() } : {}),
        ...(input.nom !== undefined ? { nom: input.nom.trim() } : {}),
        ...(input.email !== undefined ? { email: cleanOptional(input.email) } : {}),
        ...(input.telephone !== undefined ? { telephone: cleanOptional(input.telephone) } : {}),
        ...(input.poste !== undefined ? { poste: cleanOptional(input.poste) } : {}),
        ...(input.linkedinUrl !== undefined ? { linkedinUrl: cleanOptional(input.linkedinUrl) } : {}),
        ...(input.description !== undefined ? { description: cleanOptional(input.description) } : {}),
        ...(input.adresse !== undefined ? { adresse: cleanOptional(input.adresse) } : {}),
        ...(input.pays !== undefined ? { pays: cleanOptional(input.pays) } : {}),
        ...(input.source !== undefined ? { source: cleanOptional(input.source) } : {}),
        ...(input.companyId !== undefined ? { companyId: input.companyId || null } : {}),
        ...(input.prochaineActionTitre !== undefined
          ? { prochaineActionTitre: cleanOptional(input.prochaineActionTitre) }
          : {}),
        ...(input.prochaineActionDate !== undefined
          ? { prochaineActionDate: input.prochaineActionDate }
          : {}),
        category: lifecycle.category,
        state: lifecycle.state,
      },
      include: {
        company: true,
        actions: { orderBy: [{ datePrevue: "asc" }, { createdAt: "desc" }] },
      },
    });

    if (stateChanged) {
      await tx.contactStateHistory.create({
        data: {
          contactId: id,
          previousState: current.state,
          newState: lifecycle.state,
          previousCategory: current.category,
          newCategory: lifecycle.category,
          changedById: changedById || null,
        },
      });
    }

    return contact;
  });
}

export async function deleteContact(id: string) {
  return prisma.contact.delete({ where: { id } });
}

export async function refreshContactNextAction(contactId: string) {
  const next = await prisma.action.findFirst({
    where: { contactId, statut: { not: "termine" } },
    orderBy: [{ datePrevue: "asc" }, { createdAt: "asc" }],
  });
  return prisma.contact.update({
    where: { id: contactId },
    data: {
      prochaineActionTitre: next?.titre ?? null,
      prochaineActionDate: next?.datePrevue ?? null,
    },
  });
}
