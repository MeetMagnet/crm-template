import type { PersonCategory, PersonState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPersonCategory, isPersonState, resolveLifecycleUpdate } from "@/lib/labels";
import { parseCustomFields, stringifyCustomFields } from "@/lib/custom-columns";

export type ContactFilters = {
  q?: string;
  category?: string;
  state?: string;
  source?: string;
  email?: string;
  telephone?: string;
  poste?: string;
};

export type ContactSort = {
  field: string;
  direction: "asc" | "desc";
};

const SORTABLE: Record<string, Prisma.ContactOrderByWithRelationInput> = {
  prenom: { prenom: "asc" },
  nom: { nom: "asc" },
  email: { email: "asc" },
  telephone: { telephone: "asc" },
  poste: { poste: "asc" },
  category: { category: "asc" },
  state: { state: "asc" },
  source: { source: "asc" },
  updatedAt: { updatedAt: "asc" },
  createdAt: { createdAt: "asc" },
  prochaineActionDate: { prochaineActionDate: "asc" },
  company: { company: { nom: "asc" } },
};

function buildWhere(filters: ContactFilters = {}): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = {};
  const and: Prisma.ContactWhereInput[] = [];

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { prenom: { contains: q } },
        { nom: { contains: q } },
        { email: { contains: q } },
        { telephone: { contains: q } },
        { poste: { contains: q } },
        { company: { nom: { contains: q } } },
      ],
    });
  }
  if (filters.category && isPersonCategory(filters.category)) where.category = filters.category;
  if (filters.state && isPersonState(filters.state)) where.state = filters.state;
  if (filters.source?.trim()) and.push({ source: { contains: filters.source.trim() } });
  if (filters.email?.trim()) and.push({ email: { contains: filters.email.trim() } });
  if (filters.telephone?.trim()) and.push({ telephone: { contains: filters.telephone.trim() } });
  if (filters.poste?.trim()) and.push({ poste: { contains: filters.poste.trim() } });

  if (and.length) where.AND = and;
  return where;
}

function buildOrderBy(sorts: ContactSort[] = []): Prisma.ContactOrderByWithRelationInput[] {
  if (!sorts.length) return [{ updatedAt: "desc" }];
  return sorts
    .map((s) => {
      const base = SORTABLE[s.field];
      if (!base) return null;
      if (s.field === "company") return { company: { nom: s.direction } };
      return { [s.field]: s.direction } as Prisma.ContactOrderByWithRelationInput;
    })
    .filter(Boolean) as Prisma.ContactOrderByWithRelationInput[];
}

export async function listContacts(
  filters: ContactFilters = {},
  options: { sorts?: ContactSort[]; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(1000, Math.max(1, options.pageSize ?? 25));
  const where = buildWhere(filters);
  const [total, data] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      include: { company: true },
      orderBy: buildOrderBy(options.sorts),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  await alignContactsNextAction(data);
  return { data, total, page, pageSize };
}

export async function getContact(id: string) {
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: contactDetailInclude,
  });
  if (!contact) return null;
  const next = nextActionFields(pickNextOpenAction(contact.actions));
  if (!sameNextAction(contact, next)) {
    await prisma.contact.update({ where: { id }, data: next });
    contact.prochaineActionTitre = next.prochaineActionTitre;
    contact.prochaineActionDate = next.prochaineActionDate;
  }
  return contact;
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
  customFields?: Record<string, unknown>;
};

function cleanOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type NextActionCandidate = {
  id?: string;
  statut: string;
  titre: string;
  datePrevue: Date | null;
  createdAt: Date;
};

/** Prochaine action ouverte : la plus proche datée, puis les actions sans date. */
export function pickNextOpenAction<T extends NextActionCandidate>(actions: T[]): T | null {
  const open = actions.filter((action) => action.statut !== "termine");
  open.sort((a, b) => {
    if (a.datePrevue && b.datePrevue) {
      const diff = a.datePrevue.getTime() - b.datePrevue.getTime();
      if (diff !== 0) return diff;
    } else if (a.datePrevue || b.datePrevue) {
      return a.datePrevue ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return open[0] ?? null;
}

function nextActionFields(action: { titre: string; datePrevue: Date | null } | null) {
  return {
    prochaineActionTitre: action?.titre ?? null,
    prochaineActionDate: action?.datePrevue ?? null,
  };
}

function sameNextAction(
  contact: { prochaineActionTitre: string | null; prochaineActionDate: Date | null },
  next: { prochaineActionTitre: string | null; prochaineActionDate: Date | null },
) {
  const left = contact.prochaineActionDate?.getTime() ?? null;
  const right = next.prochaineActionDate?.getTime() ?? null;
  return contact.prochaineActionTitre === next.prochaineActionTitre && left === right;
}

function sameCalendarDay(left: Date | null | undefined, right: Date | null | undefined) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

const contactDetailInclude = {
  company: true,
  actions: { orderBy: [{ datePrevue: { sort: "asc" as const, nulls: "last" as const } }, { createdAt: "asc" as const }] },
  stateHistory: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.ContactInclude;

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
        customFields: stringifyCustomFields(input.customFields ?? {}),
      },
      include: {
        company: true,
        actions: { orderBy: [{ datePrevue: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] },
        stateHistory: { orderBy: { createdAt: "desc" } },
      },
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

    const titre = cleanOptional(input.prochaineActionTitre);
    if (titre || input.prochaineActionDate) {
      await tx.action.create({
        data: {
          contactId: contact.id,
          channel: "note",
          titre: titre || "Action",
          contenu: "",
          statut: "a_faire",
          datePrevue: input.prochaineActionDate ?? null,
        },
      });
    }

    return tx.contact.findUniqueOrThrow({
      where: { id: contact.id },
      include: contactDetailInclude,
    });
  }).then(async (contact) => {
    await refreshContactNextAction(contact.id);
    return prisma.contact.findUniqueOrThrow({
      where: { id: contact.id },
      include: contactDetailInclude,
    });
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
        ...(input.customFields !== undefined
          ? {
              customFields: stringifyCustomFields({
                ...parseCustomFields(current.customFields),
                ...input.customFields,
              }),
            }
          : {}),
        category: lifecycle.category,
        state: lifecycle.state,
      },
      include: {
        company: true,
        actions: { orderBy: [{ datePrevue: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] },
        stateHistory: { orderBy: { createdAt: "desc" } },
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

    return contact.id;
  }).then(async (contactId) => {
    await syncEditedNextAction(contactId, current, input);
    await refreshContactNextAction(contactId);
    return prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: contactDetailInclude,
    });
  });
}

export async function deleteContact(id: string) {
  return prisma.contact.delete({ where: { id } });
}

export async function bulkUpdateContacts(
  ids: string[],
  patch: { category?: PersonCategory; state?: PersonState },
  changedById?: string,
) {
  const results = [];
  for (const id of ids) {
    results.push(await updateContact(id, patch, changedById));
  }
  return results.filter(Boolean);
}

export async function bulkDeleteContacts(ids: string[]) {
  return prisma.contact.deleteMany({ where: { id: { in: ids } } });
}

function firstFilled(current: string | null, incoming: string | null) {
  if (current && current.trim()) return current;
  return incoming && incoming.trim() ? incoming : current;
}

function isEmptyCustomValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function mergeCustomFields(targetRaw: string, sourceRaws: string[]) {
  const merged = parseCustomFields(targetRaw);
  for (const raw of sourceRaws) {
    for (const [key, value] of Object.entries(parseCustomFields(raw))) {
      if (isEmptyCustomValue(merged[key]) && !isEmptyCustomValue(value)) merged[key] = value;
    }
  }
  return stringifyCustomFields(merged);
}

/** Fusionne les contacts sources dans la cible, puis les supprime. */
export async function mergeContacts(targetId: string, sourceIds: string[]) {
  const ids = [...new Set(sourceIds.filter((id) => id && id !== targetId))];
  if (!ids.length) throw new Error("Sélectionnez au moins deux contacts");

  return prisma.$transaction(async (tx) => {
    const target = await tx.contact.findUnique({ where: { id: targetId } });
    if (!target) throw new Error("Contact cible introuvable");
    const sources = await tx.contact.findMany({ where: { id: { in: ids } } });
    if (!sources.length) throw new Error("Aucun contact à migrer");

    const provenance = formatProvenanceImport([
      ...parseProvenanceImport(target.source),
      ...sources.flatMap((source) => parseProvenanceImport(source.source)),
    ]);

    await tx.action.updateMany({
      where: { contactId: { in: ids } },
      data: { contactId: targetId },
    });
    await tx.contactStateHistory.updateMany({
      where: { contactId: { in: ids } },
      data: { contactId: targetId },
    });

    await tx.contact.update({
      where: { id: targetId },
      data: {
        prenom: firstFilled(target.prenom, sources.find((s) => s.prenom)?.prenom ?? null) ?? "",
        nom: firstFilled(target.nom, sources.find((s) => s.nom)?.nom ?? null) ?? "",
        email: firstFilled(target.email, sources.find((s) => s.email)?.email ?? null),
        telephone: firstFilled(target.telephone, sources.find((s) => s.telephone)?.telephone ?? null),
        poste: firstFilled(target.poste, sources.find((s) => s.poste)?.poste ?? null),
        linkedinUrl: firstFilled(target.linkedinUrl, sources.find((s) => s.linkedinUrl)?.linkedinUrl ?? null),
        description: firstFilled(target.description, sources.find((s) => s.description)?.description ?? null),
        adresse: firstFilled(target.adresse, sources.find((s) => s.adresse)?.adresse ?? null),
        pays: firstFilled(target.pays, sources.find((s) => s.pays)?.pays ?? null),
        source: provenance || null,
        companyId: target.companyId ?? sources.find((s) => s.companyId)?.companyId ?? null,
        customFields: mergeCustomFields(target.customFields, sources.map((source) => source.customFields)),
      },
    });

    await tx.contact.deleteMany({ where: { id: { in: ids } } });
    return targetId;
  }).then(async (id) => {
    await refreshContactNextAction(id);
    return prisma.contact.findUniqueOrThrow({
      where: { id },
      include: { company: true },
    });
  });
}

function parseProvenanceImport(source: string | null) {
  if (!source) return [];
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatProvenanceImport(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(", ");
}

async function alignContactsNextAction(
  contacts: Array<{ id: string; prochaineActionTitre: string | null; prochaineActionDate: Date | null }>,
) {
  if (!contacts.length) return;
  const actions = await prisma.action.findMany({
    where: { contactId: { in: contacts.map((contact) => contact.id) }, statut: { not: "termine" } },
    select: { contactId: true, titre: true, datePrevue: true, createdAt: true, statut: true },
  });
  const grouped = new Map<string, typeof actions>();
  for (const action of actions) {
    const list = grouped.get(action.contactId) ?? [];
    list.push(action);
    grouped.set(action.contactId, list);
  }
  for (const contact of contacts) {
    const next = nextActionFields(pickNextOpenAction(grouped.get(contact.id) ?? []));
    if (sameNextAction(contact, next)) continue;
    contact.prochaineActionTitre = next.prochaineActionTitre;
    contact.prochaineActionDate = next.prochaineActionDate;
    await prisma.contact.update({ where: { id: contact.id }, data: next });
  }
}

async function syncEditedNextAction(
  contactId: string,
  current: { prochaineActionTitre: string | null; prochaineActionDate: Date | null },
  input: ContactInput,
) {
  const titleProvided = input.prochaineActionTitre !== undefined;
  const dateProvided = input.prochaineActionDate !== undefined;
  if (!titleProvided && !dateProvided) return;

  const nextTitle = titleProvided ? (cleanOptional(input.prochaineActionTitre) ?? null) : current.prochaineActionTitre;
  const titleChanged = titleProvided && nextTitle !== current.prochaineActionTitre;
  const dateChanged = dateProvided && !sameCalendarDay(input.prochaineActionDate ?? null, current.prochaineActionDate);
  if (!titleChanged && !dateChanged) return;

  const open = await prisma.action.findMany({
    where: { contactId, statut: { not: "termine" } },
  });
  const displayed =
    open.find((action) => action.titre === current.prochaineActionTitre) ?? pickNextOpenAction(open);

  if (displayed) {
    if (titleChanged && !nextTitle) {
      await prisma.action.update({
        where: { id: displayed.id },
        data: { statut: "termine", dateRealisation: new Date() },
      });
      return;
    }
    await prisma.action.update({
      where: { id: displayed.id },
      data: {
        ...(titleChanged && nextTitle ? { titre: nextTitle } : {}),
        ...(dateChanged ? { datePrevue: input.prochaineActionDate ?? null } : {}),
      },
    });
    return;
  }

  const createdTitle = nextTitle || (dateProvided && input.prochaineActionDate ? "Action" : null);
  if (!createdTitle) return;
  await prisma.action.create({
    data: {
      contactId,
      channel: "note",
      titre: createdTitle,
      contenu: "",
      statut: "a_faire",
      datePrevue: dateProvided ? (input.prochaineActionDate ?? null) : null,
    },
  });
}

export async function refreshContactNextAction(contactId: string) {
  const actions = await prisma.action.findMany({
    where: { contactId, statut: { not: "termine" } },
  });
  return prisma.contact.update({
    where: { id: contactId },
    data: nextActionFields(pickNextOpenAction(actions)),
  });
}
