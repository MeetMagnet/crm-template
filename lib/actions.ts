import type { ActionChannel, ActionStatut, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshContactNextAction } from "@/lib/contacts";
import { isActionChannel, isActionStatut, isPersonCategory } from "@/lib/labels";

export type ActionFilters = {
  q?: string;
  channel?: string;
  statut?: string;
  contactCategory?: string;
  contactId?: string;
};

function buildWhere(filters: ActionFilters = {}): Prisma.ActionWhereInput {
  const where: Prisma.ActionWhereInput = {};
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.channel && isActionChannel(filters.channel)) where.channel = filters.channel;
  if (filters.statut && isActionStatut(filters.statut)) where.statut = filters.statut;
  if (filters.contactCategory && isPersonCategory(filters.contactCategory)) {
    where.contact = { category: filters.contactCategory };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { titre: { contains: q } },
      { contenu: { contains: q } },
      { contact: { prenom: { contains: q } } },
      { contact: { nom: { contains: q } } },
      { contact: { email: { contains: q } } },
    ];
  }
  return where;
}

export async function listActions(filters: ActionFilters = {}) {
  return prisma.action.findMany({
    where: buildWhere(filters),
    include: {
      contact: { include: { company: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: [{ datePrevue: "asc" }, { createdAt: "desc" }],
  });
}

export async function getAction(id: string) {
  return prisma.action.findUnique({
    where: { id },
    include: {
      contact: { include: { company: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
}

export type ActionInput = {
  contactId?: string;
  channel?: ActionChannel;
  titre?: string;
  contenu?: string;
  statut?: ActionStatut;
  datePrevue?: Date | null;
  dateRealisation?: Date | null;
  userId?: string | null;
};

export async function createAction(input: ActionInput) {
  if (!input.contactId) throw new Error("contactId requis");
  if (!input.channel) throw new Error("channel requis");
  if (!input.titre?.trim()) throw new Error("titre requis");

  const action = await prisma.action.create({
    data: {
      contactId: input.contactId,
      channel: input.channel,
      titre: input.titre.trim(),
      contenu: input.contenu?.trim() ?? "",
      statut: input.statut ?? "a_faire",
      datePrevue: input.datePrevue ?? null,
      dateRealisation: input.dateRealisation ?? null,
      userId: input.userId ?? null,
    },
    include: {
      contact: { include: { company: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
  await refreshContactNextAction(action.contactId);
  return action;
}

export async function updateAction(id: string, input: ActionInput) {
  const current = await prisma.action.findUnique({ where: { id } });
  if (!current) return null;

  let statut = input.statut;
  let dateRealisation = input.dateRealisation;
  if (statut === "termine" && dateRealisation === undefined) {
    dateRealisation = new Date();
  }
  if (statut && statut !== "termine" && dateRealisation === undefined) {
    dateRealisation = null;
  }

  const action = await prisma.action.update({
    where: { id },
    data: {
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.titre !== undefined ? { titre: input.titre.trim() } : {}),
      ...(input.contenu !== undefined ? { contenu: input.contenu } : {}),
      ...(statut ? { statut } : {}),
      ...(input.datePrevue !== undefined ? { datePrevue: input.datePrevue } : {}),
      ...(dateRealisation !== undefined ? { dateRealisation } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
    },
    include: {
      contact: { include: { company: true } },
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
  await refreshContactNextAction(action.contactId);
  return action;
}

export async function deleteAction(id: string) {
  const action = await prisma.action.delete({ where: { id } });
  await refreshContactNextAction(action.contactId);
  return action;
}

/** Compat MCP / anciens appels « note ». */
export async function addNote(contactId: string, titre: string, contenu = "") {
  return createAction({
    contactId,
    channel: "note",
    titre,
    contenu,
    statut: "termine",
    dateRealisation: new Date(),
  });
}
