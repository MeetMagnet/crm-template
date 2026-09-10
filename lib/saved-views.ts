import { prisma } from "@/lib/prisma";

export type SavedViewPayload = {
  name: string;
  entity: string;
  viewType?: string;
  filters?: Record<string, unknown>;
  isShared?: boolean;
  userId?: string | null;
};

export async function listSavedViews(entity: string) {
  const rows = await prisma.savedView.findMany({
    where: { entity },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    ...row,
    filters: safeParse(row.filters),
  }));
}

export async function createSavedView(input: SavedViewPayload) {
  return prisma.savedView.create({
    data: {
      name: input.name.trim(),
      entity: input.entity,
      viewType: input.viewType ?? "list",
      filters: JSON.stringify(input.filters ?? {}),
      isShared: input.isShared ?? true,
      userId: input.userId ?? null,
    },
  });
}

export async function updateSavedView(id: string, input: Partial<SavedViewPayload>) {
  return prisma.savedView.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.viewType !== undefined ? { viewType: input.viewType } : {}),
      ...(input.filters !== undefined ? { filters: JSON.stringify(input.filters) } : {}),
      ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
    },
  });
}

export async function deleteSavedView(id: string) {
  return prisma.savedView.delete({ where: { id } });
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
