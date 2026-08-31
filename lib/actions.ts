import type { ActionStatut, ActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const actionInclude = {
  contact: { include: { company: true } },
} satisfies Prisma.ActionInclude;

export type ActionWithContact = Prisma.ActionGetPayload<{
  include: typeof actionInclude;
}>;

export type ListActionsParams = {
  contactId?: string;
  statut?: ActionStatut;
};

export async function listActions(params: ListActionsParams = {}) {
  const where: Prisma.ActionWhereInput = {};
  if (params.contactId) where.contactId = params.contactId;
  if (params.statut) where.statut = params.statut;

  return prisma.action.findMany({
    where,
    include: actionInclude,
    orderBy: [{ statut: "asc" }, { datePrevue: "asc" }, { createdAt: "desc" }],
  });
}

export async function getAction(id: string) {
  return prisma.action.findUnique({
    where: { id },
    include: actionInclude,
  });
}

export type ActionInput = {
  contactId: string;
  type: ActionType;
  titre: string;
  contenu?: string;
  statut?: ActionStatut;
  datePrevue?: Date | null;
  dateRealisation?: Date | null;
};

export async function createAction(data: ActionInput) {
  return prisma.action.create({
    data: {
      contactId: data.contactId,
      type: data.type,
      titre: data.titre.trim(),
      contenu: data.contenu?.trim() ?? "",
      statut: data.statut ?? "a_faire",
      datePrevue: data.datePrevue ?? null,
      dateRealisation: data.dateRealisation ?? null,
    },
    include: actionInclude,
  });
}

export async function updateAction(id: string, data: Partial<Omit<ActionInput, "contactId">>) {
  return prisma.action.update({
    where: { id },
    data: {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.titre !== undefined ? { titre: data.titre.trim() } : {}),
      ...(data.contenu !== undefined ? { contenu: data.contenu.trim() } : {}),
      ...(data.statut !== undefined ? { statut: data.statut } : {}),
      ...(data.datePrevue !== undefined ? { datePrevue: data.datePrevue } : {}),
      ...(data.dateRealisation !== undefined ? { dateRealisation: data.dateRealisation } : {}),
    },
    include: actionInclude,
  });
}

export async function closeAction(id: string) {
  return prisma.action.update({
    where: { id },
    data: {
      statut: "termine",
      dateRealisation: new Date(),
    },
    include: actionInclude,
  });
}

export async function deleteAction(id: string) {
  return prisma.action.delete({ where: { id } });
}

export async function addNote(contactId: string, titre: string, contenu: string) {
  return createAction({
    contactId,
    type: "note",
    titre,
    contenu,
    statut: "termine",
    dateRealisation: new Date(),
  });
}
