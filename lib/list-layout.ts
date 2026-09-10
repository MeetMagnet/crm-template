export type FilterRow = {
  id: string;
  field: string;
  op: "eq" | "contains";
  value: string;
};

export type SortRow = {
  id: string;
  field: string;
  direction: "asc" | "desc";
};

export type ColumnDef = {
  key: string;
  label: string;
  isCustom?: boolean;
  customType?: string;
  customId?: string;
};

export type ListLayoutState = {
  visibleColumnKeys: string[];
  columnOrder: string[];
  viewMode: "list" | "kanban";
  filterRows: FilterRow[];
  sortRows: SortRow[];
  kanbanGroupBy: string;
  pageSize: number;
};

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadLayout(storageKey: string, fallback: ListLayoutState): ListLayoutState {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function saveLayout(storageKey: string, state: ListLayoutState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function orderedVisibleColumns(defs: ColumnDef[], order: string[], visible: string[]) {
  const byKey = Object.fromEntries(defs.map((d) => [d.key, d]));
  const ordered = order.filter((k) => visible.includes(k) && byKey[k]).map((k) => byKey[k]);
  const missing = visible.filter((k) => !order.includes(k) && byKey[k]).map((k) => byKey[k]);
  return [...ordered, ...missing];
}

export function moveColumn(order: string[], fromKey: string, toKey: string) {
  const next = order.filter((k) => k !== fromKey);
  const idx = next.indexOf(toKey);
  if (idx === -1) return order;
  next.splice(idx, 0, fromKey);
  return next;
}

export function pageLabel(total: number, page: number, pageSize: number) {
  if (total === 0) return "0 résultat";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} sur ${total}`;
}

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 1000];
