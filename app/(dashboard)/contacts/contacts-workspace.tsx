"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActionStatut, PersonCategory, PersonState } from "@prisma/client";
import { ContactSheet, type ContactSheetData } from "@/app/components/contact-sheet";
import { SidePeek } from "@/app/components/side-peek";
import {
  PERSON_CATEGORIES,
  PERSON_CATEGORY_COLORS,
  PERSON_CATEGORY_LABELS,
  PERSON_CATEGORY_STATE_KEYS,
  PERSON_STATE_COLORS,
  PERSON_STATE_LABELS,
  PROVENANCE_OPTIONS,
  contactDisplayName,
  formatDate,
} from "@/lib/labels";
import {
  PAGE_SIZE_OPTIONS,
  loadLayout,
  moveColumn,
  orderedVisibleColumns,
  pageLabel,
  saveLayout,
  uid,
  type ColumnDef,
  type FilterRow,
  type ListLayoutState,
  type SortRow,
} from "@/lib/list-layout";
import {
  formatCustomFieldValue,
  parseCustomFields,
  type CustomColumnRecord,
} from "@/lib/custom-columns";
import { CustomColumnModal } from "@/app/components/custom-column-modal";

type CompanyOption = { id: string; nom: string };

type ContactRow = ContactSheetData & {
  company: { id: string; nom: string } | null;
  customFields?: string | Record<string, unknown>;
};

type SavedView = {
  id: string;
  name: string;
  viewType: string;
  filters: Record<string, unknown>;
};

const STORAGE_KEY = "crm-contacts-default-layout";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function nextActionBucket(value: string | Date | null | undefined) {
  if (!value) return "none";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "none";
  const diff = (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function dateForActionBucket(bucket: string) {
  const today = startOfDay(new Date());
  if (bucket === "none") return null;
  if (bucket === "overdue") today.setDate(today.getDate() - 1);
  if (bucket === "week") today.setDate(today.getDate() + 3);
  if (bucket === "later") today.setDate(today.getDate() + 14);
  return today.toISOString().slice(0, 10);
}

const BASE_COLUMN_DEFS: ColumnDef[] = [
  { key: "name", label: "Nom" },
  { key: "company", label: "Entreprise" },
  { key: "email", label: "E-mail" },
  { key: "telephone", label: "Téléphone" },
  { key: "poste", label: "Poste" },
  { key: "category", label: "Catégorie" },
  { key: "state", label: "État" },
  { key: "source", label: "Source" },
  { key: "next_action", label: "Prochaine action" },
  { key: "updatedAt", label: "MAJ" },
];

const FILTER_FIELDS = [
  { key: "category", label: "Catégorie", type: "enum" as const },
  { key: "state", label: "État", type: "enum" as const },
  { key: "source", label: "Provenance", type: "enum" as const },
  { key: "email", label: "E-mail", type: "text" as const },
  { key: "telephone", label: "Téléphone", type: "text" as const },
  { key: "poste", label: "Poste", type: "text" as const },
];

const SORT_FIELDS = [
  { key: "updatedAt", label: "Dernière modification" },
  { key: "prenom", label: "Prénom" },
  { key: "nom", label: "Nom" },
  { key: "email", label: "E-mail" },
  { key: "category", label: "Catégorie" },
  { key: "state", label: "État" },
  { key: "prochaineActionDate", label: "Date prochaine action" },
  { key: "company", label: "Entreprise" },
];

const DEFAULT_LAYOUT: ListLayoutState = {
  visibleColumnKeys: ["name", "company", "email", "category", "state", "next_action", "updatedAt"],
  columnOrder: BASE_COLUMN_DEFS.map((c) => c.key),
  viewMode: "list",
  filterRows: [],
  sortRows: [{ id: "s1", field: "updatedAt", direction: "desc" }],
  kanbanGroupBy: "state",
  pageSize: 25,
};

function getCustomFields(contact: ContactRow) {
  return typeof contact.customFields === "string"
    ? parseCustomFields(contact.customFields)
    : (contact.customFields ?? {});
}

function cellValue(contact: ContactRow, key: string, customCols: CustomColumnRecord[]) {
  const custom = customCols.find((c) => c.key === key);
  if (custom) {
    return formatCustomFieldValue(getCustomFields(contact)[key], custom.type);
  }
  switch (key) {
    case "name":
      return contactDisplayName(contact);
    case "company":
      return contact.company?.nom ?? "—";
    case "email":
      return contact.email ?? "—";
    case "telephone":
      return contact.telephone ?? "—";
    case "poste":
      return contact.poste ?? "—";
    case "source":
      return contact.source ?? "—";
    case "next_action":
      return contact.prochaineActionTitre
        ? `${contact.prochaineActionTitre} (${formatDate(contact.prochaineActionDate)})`
        : "—";
    case "updatedAt":
      return formatDate(contact.updatedAt);
    default:
      return "—";
  }
}

export function ContactsWorkspace({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [layout, setLayout] = useState<ListLayoutState>(DEFAULT_LAYOUT);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkState, setBulkState] = useState("");
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumnRecord[]>([]);
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumnRecord | null>(null);
  const [customFieldDraft, setCustomFieldDraft] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLayout(loadLayout(STORAGE_KEY, DEFAULT_LAYOUT));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || selectedViewId) return;
    saveLayout(STORAGE_KEY, layout);
  }, [layout, hydrated, selectedViewId]);

  const loadViews = useCallback(async () => {
    const res = await fetch("/api/saved-views?entity=contacts");
    if (!res.ok) return;
    const data = await res.json();
    setSavedViews(data.data ?? []);
  }, []);

  const loadCustomColumns = useCallback(async () => {
    const res = await fetch("/api/custom-columns?entityType=contact");
    if (!res.ok) return;
    const data = await res.json();
    setCustomColumns(data.data ?? []);
  }, []);

  useEffect(() => {
    void loadViews();
    void loadCustomColumns();
  }, [loadViews, loadCustomColumns]);

  const allColumnDefs = useMemo<ColumnDef[]>(
    () => [
      ...BASE_COLUMN_DEFS,
      ...customColumns.map((c) => ({
        key: c.key,
        label: c.label,
        isCustom: true,
        customType: c.type,
        customId: c.id,
      })),
    ],
    [customColumns],
  );

  const apiFilters = useMemo(() => {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
    for (const row of layout.filterRows) {
      if (!row.value) continue;
      params[row.field] = row.value;
    }
    return params;
  }, [q, layout.filterRows]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(layout.viewMode === "kanban" ? 1 : page),
      pageSize: String(layout.viewMode === "kanban" ? 1000 : layout.pageSize),
      ...apiFilters,
    });
    if (layout.sortRows.length) {
      params.set(
        "sorts",
        JSON.stringify(layout.sortRows.map((s) => ({ field: s.field, direction: s.direction }))),
      );
    }
    const res = await fetch(`/api/contacts?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setContacts(data.data ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [apiFilters, layout.pageSize, layout.sortRows, layout.viewMode, page]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchContacts();
  }, [hydrated, fetchContacts]);

  useEffect(() => {
    const id = searchParams.get("contact");
    if (!id) return;
    void openContact(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleCols = useMemo(
    () => orderedVisibleColumns(allColumnDefs, layout.columnOrder, layout.visibleColumnKeys),
    [allColumnDefs, layout.columnOrder, layout.visibleColumnKeys],
  );

  const pageIds = contacts.map((c) => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function openContact(id: string) {
    const res = await fetch(`/api/contacts/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data);
    setCustomFieldDraft(getCustomFields(data));
    setCreating(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("contact", id);
    router.replace(`/contacts?${params.toString()}`);
  }

  function closePeek() {
    setSelected(null);
    setCreating(false);
    setError("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("contact");
    const qs = params.toString();
    router.replace(qs ? `/contacts?${qs}` : "/contacts");
  }

  function openCreate() {
    setCreating(true);
    setSelected({
      id: "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      poste: "",
      linkedinUrl: "",
      description: "",
      adresse: "",
      pays: "",
      source: "",
      category: "lead",
      state: "new_lead",
      companyId: null,
      company: null,
      prochaineActionTitre: null,
      prochaineActionDate: null,
      updatedAt: new Date().toISOString(),
      customFields: {},
      actions: [],
    });
    setCustomFieldDraft({});
  }

  async function saveContact(
    draft: {
      prenom: string;
      nom: string;
      email: string;
      telephone: string;
      poste: string;
      linkedinUrl: string;
      description: string;
      adresse: string;
      pays: string;
      source: string;
      category: PersonCategory;
      state: PersonState;
      companyId: string;
      prochaineActionTitre: string;
      prochaineActionDate: string;
    },
    fields: Record<string, unknown>,
  ) {
    if (!selected) return;
    setSaving(true);
    setError("");
    const payload = {
      prenom: draft.prenom,
      nom: draft.nom,
      email: draft.email || null,
      telephone: draft.telephone || null,
      poste: draft.poste || null,
      linkedinUrl: draft.linkedinUrl || null,
      description: draft.description || null,
      adresse: draft.adresse || null,
      pays: draft.pays || null,
      source: draft.source || null,
      category: draft.category,
      state: draft.state,
      companyId: draft.companyId || null,
      prochaineActionTitre: draft.prochaineActionTitre,
      prochaineActionDate: draft.prochaineActionDate || null,
      customFields: fields,
    };
    const url = creating || !selected.id ? "/api/contacts" : `/api/contacts/${selected.id}`;
    const res = await fetch(url, {
      method: creating || !selected.id ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Enregistrement impossible");
      return;
    }
    const saved = await res.json();
    setSelected(saved);
    setCustomFieldDraft(getCustomFields(saved));
    setCreating(false);
    await fetchContacts();
    const params = new URLSearchParams(searchParams.toString());
    params.set("contact", saved.id);
    router.replace(`/contacts?${params.toString()}`);
  }

  async function deleteContact() {
    if (!selected?.id || creating) return;
    if (!confirm(`Supprimer ${contactDisplayName(selected)} ?`)) return;
    const res = await fetch(`/api/contacts/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return;
    closePeek();
    await fetchContacts();
  }

  async function moveContact(
    contactId: string,
    next: { state?: PersonState; category?: PersonCategory; prochaineActionDate?: string | null },
  ) {
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, ...next } : c)));
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    await fetchContacts();
  }

  async function createAction(input: { channel: string; titre: string; contenu: string; datePrevue: string }) {
    if (!selected?.id) return;
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: selected.id,
        channel: input.channel,
        titre: input.titre,
        contenu: input.contenu,
        datePrevue: input.datePrevue || null,
      }),
    });
    await openContact(selected.id);
    await fetchContacts();
  }

  async function setActionStatut(actionId: string, statut: ActionStatut) {
    await fetch(`/api/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (selected?.id) await openContact(selected.id);
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Supprimer ${selectedIds.length} contact(s) ?`)) return;
    await fetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: selectedIds }),
    });
    setSelectedIds([]);
    await fetchContacts();
  }

  async function bulkMerge() {
    if (selectedIds.length < 2 || !mergeTargetId) return;
    const res = await fetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "merge", ids: selectedIds, targetId: mergeTargetId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Migration impossible");
      return;
    }
    setMergeOpen(false);
    setSelectedIds([]);
    await fetchContacts();
  }

  async function bulkUpdate() {
    await fetch("/api/contacts/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        ids: selectedIds,
        category: bulkCategory || undefined,
        state: bulkState || undefined,
      }),
    });
    setBulkOpen(false);
    setBulkCategory("");
    setBulkState("");
    setSelectedIds([]);
    await fetchContacts();
  }

  function applySavedView(viewId: string) {
    setSelectedViewId(viewId);
    if (!viewId) return;
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    const f = view.filters || {};
    setLayout((prev) => ({
      ...prev,
      viewMode: (view.viewType as "list" | "kanban") || prev.viewMode,
      filterRows: (f.filterRows as FilterRow[]) || [],
      sortRows: (f.sortRows as SortRow[]) || prev.sortRows,
      visibleColumnKeys: (f.visibleColumnKeys as string[]) || prev.visibleColumnKeys,
      columnOrder: (f.columnOrder as string[]) || prev.columnOrder,
      kanbanGroupBy: (f.kanbanGroupBy as string) || prev.kanbanGroupBy,
      pageSize: (f.pageSize as number) || prev.pageSize,
    }));
    setPage(1);
  }

  async function saveCurrentView() {
    const name = saveViewName.trim();
    if (!name) return;
    const filters = {
      filterRows: layout.filterRows,
      sortRows: layout.sortRows,
      visibleColumnKeys: layout.visibleColumnKeys,
      columnOrder: layout.columnOrder,
      kanbanGroupBy: layout.kanbanGroupBy,
      pageSize: layout.pageSize,
    };
    if (selectedViewId) {
      await fetch(`/api/saved-views/${selectedViewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, viewType: layout.viewMode, filters }),
      });
    } else {
      const res = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, entity: "contacts", viewType: layout.viewMode, filters }),
      });
      if (res.ok) {
        const created = await res.json();
        setSelectedViewId(created.id);
      }
    }
    setSaveViewOpen(false);
    setSaveViewName("");
    await loadViews();
  }

  async function deleteSelectedView() {
    if (!selectedViewId) return;
    if (!confirm("Supprimer cette vue ?")) return;
    await fetch(`/api/saved-views/${selectedViewId}`, { method: "DELETE" });
    setSelectedViewId("");
    await loadViews();
  }

  const kanbanColumns = useMemo(() => {
    if (layout.kanbanGroupBy === "category") {
      return PERSON_CATEGORIES.map((key) => ({
        key,
        label: PERSON_CATEGORY_LABELS[key],
        items: contacts.filter((c) => c.category === key),
      }));
    }
    if (layout.kanbanGroupBy === "next_action_date") {
      const buckets = [
        { key: "overdue", label: "En retard" },
        { key: "today", label: "Aujourd'hui" },
        { key: "week", label: "7 prochains jours" },
        { key: "later", label: "Plus tard" },
        { key: "none", label: "Sans date" },
      ];
      return buckets.map((bucket) => ({
        ...bucket,
        items: contacts.filter((contact) => nextActionBucket(contact.prochaineActionDate) === bucket.key),
      }));
    }
    const keys = PERSON_CATEGORY_STATE_KEYS.lead.concat(
      PERSON_CATEGORY_STATE_KEYS.prospect,
      PERSON_CATEGORY_STATE_KEYS.client,
      PERSON_CATEGORY_STATE_KEYS.ex_clients,
    );
    return keys.map((key) => ({
      key,
      label: PERSON_STATE_LABELS[key],
      items: contacts.filter((c) => c.state === key),
    }));
  }, [contacts, layout.kanbanGroupBy]);

  const totalPages = Math.max(1, Math.ceil(total / layout.pageSize));

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Contacts</h1>
        <input
          className="input toolbar-input"
          placeholder="Rechercher (nom, poste, email…)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />

        <select
          className="select"
          style={{ width: 180 }}
          value={selectedViewId}
          onChange={(e) => applySavedView(e.target.value)}
        >
          <option value="">— Aucune vue sauvegardée —</option>
          {savedViews.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          className="btn soft small"
          type="button"
          onClick={() => {
            setSaveViewName(savedViews.find((v) => v.id === selectedViewId)?.name ?? "");
            setSaveViewOpen(true);
          }}
        >
          {selectedViewId ? "Gérer la vue" : "Sauvegarder la vue"}
        </button>

        <button
          className={`icon-btn ${showFilters ? "active" : ""}`}
          type="button"
          title="Filtres"
          onClick={() => setShowFilters((v) => !v)}
        >
          ⚙
        </button>
        <button
          className={`icon-btn ${showSorts ? "active" : ""}`}
          type="button"
          title="Tris"
          onClick={() => setShowSorts((v) => !v)}
        >
          ↕
        </button>
        <div className="dropdown">
          <button
            className={`icon-btn ${showColumns ? "active" : ""}`}
            type="button"
            title="Colonnes visibles"
            onClick={() => setShowColumns((v) => !v)}
          >
            👁
          </button>
          {showColumns ? (
            <div className="dropdown-menu">
              <div className="dropdown-title">Colonnes visibles</div>
              {allColumnDefs.map((col) => (
                <label key={col.key}>
                  <input
                    type="checkbox"
                    checked={layout.visibleColumnKeys.includes(col.key)}
                    onChange={(e) => {
                      setLayout((prev) => ({
                        ...prev,
                        visibleColumnKeys: e.target.checked
                          ? [...prev.visibleColumnKeys, col.key]
                          : prev.visibleColumnKeys.filter((k) => k !== col.key),
                        columnOrder: e.target.checked
                          ? prev.columnOrder.includes(col.key)
                            ? prev.columnOrder
                            : [...prev.columnOrder, col.key]
                          : prev.columnOrder,
                      }));
                    }}
                  />
                  <span style={{ flex: 1 }}>{col.label}</span>
                  {col.isCustom ? (
                    <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.preventDefault()}>
                      <button
                        className="btn ghost small"
                        type="button"
                        title="Modifier"
                        onClick={() => {
                          const full = customColumns.find((c) => c.id === col.customId);
                          if (!full) return;
                          setEditingColumn(full);
                          setColumnModalOpen(true);
                          setShowColumns(false);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="btn ghost small"
                        type="button"
                        title="Supprimer"
                        onClick={() => {
                          if (!col.customId || !confirm(`Supprimer la colonne « ${col.label} » ?`)) return;
                          void fetch(`/api/custom-columns/${col.customId}`, { method: "DELETE" }).then(() => {
                            setLayout((prev) => ({
                              ...prev,
                              visibleColumnKeys: prev.visibleColumnKeys.filter((k) => k !== col.key),
                              columnOrder: prev.columnOrder.filter((k) => k !== col.key),
                            }));
                            void loadCustomColumns();
                          });
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ) : null}
                </label>
              ))}
              <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, padding: "8px 12px" }}>
                <button
                  className="btn soft small"
                  type="button"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setEditingColumn(null);
                    setColumnModalOpen(true);
                    setShowColumns(false);
                  }}
                >
                  + Ajouter une colonne
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="segmented">
          <button
            type="button"
            className={layout.viewMode === "list" ? "active" : ""}
            onClick={() => setLayout((p) => ({ ...p, viewMode: "list" }))}
          >
            Liste
          </button>
          <button
            type="button"
            className={layout.viewMode === "kanban" ? "active" : ""}
            onClick={() => setLayout((p) => ({ ...p, viewMode: "kanban" }))}
          >
            Kanban
          </button>
        </div>
        <select
          className="select"
          style={{ width: 190 }}
          value={layout.kanbanGroupBy}
          onChange={(e) => setLayout((p) => ({ ...p, kanbanGroupBy: e.target.value }))}
        >
          <option value="state">Par état</option>
          <option value="category">Par catégorie</option>
          <option value="next_action_date">Par date de l&apos;action</option>
        </select>

        {selectedIds.length > 1 ? (
          <button
            className="btn small"
            type="button"
            onClick={() => {
              setMergeTargetId(selectedIds[0] ?? "");
              setMergeOpen(true);
            }}
          >
            Migrer ({selectedIds.length})
          </button>
        ) : null}
        {selectedIds.length > 0 ? (
          <>
            <button className="btn small" type="button" onClick={() => setBulkOpen(true)}>
              Modifier ({selectedIds.length})
            </button>
            <button className="btn danger small" type="button" onClick={() => void bulkDelete()}>
              Supprimer ({selectedIds.length})
            </button>
          </>
        ) : null}

        <button className="btn" type="button" onClick={openCreate}>
          + Ajouter contact
        </button>

        <div className="pagination-bar">
          <select
            className="select"
            style={{ width: 90 }}
            value={layout.pageSize}
            onChange={(e) => {
              setLayout((p) => ({ ...p, pageSize: Number(e.target.value) }));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <span>
            {layout.viewMode === "kanban"
              ? `${contacts.length} / ${total} contacts`
              : pageLabel(total, page, layout.pageSize)}
          </span>
          {layout.viewMode === "list" ? (
            <>
              <button className="btn secondary small" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Préc.
              </button>
              <button
                className="btn secondary small"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suiv.
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="panel-soft">
          {layout.filterRows.map((row) => (
            <div className="panel-soft-row" key={row.id}>
              <select
                className="select"
                style={{ width: 160 }}
                value={row.field}
                onChange={(e) =>
                  setLayout((prev) => ({
                    ...prev,
                    filterRows: prev.filterRows.map((r) =>
                      r.id === row.id ? { ...r, field: e.target.value, value: "" } : r,
                    ),
                  }))
                }
              >
                {FILTER_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              {row.field === "category" ? (
                <select
                  className="select"
                  style={{ width: 180 }}
                  value={row.value}
                  onChange={(e) => {
                    setLayout((prev) => ({
                      ...prev,
                      filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">—</option>
                  {PERSON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {PERSON_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              ) : row.field === "state" ? (
                <select
                  className="select"
                  style={{ width: 220 }}
                  value={row.value}
                  onChange={(e) => {
                    setLayout((prev) => ({
                      ...prev,
                      filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">—</option>
                  {(Object.keys(PERSON_STATE_LABELS) as PersonState[]).map((s) => (
                    <option key={s} value={s}>
                      {PERSON_STATE_LABELS[s]}
                    </option>
                  ))}
                </select>
              ) : row.field === "source" ? (
                <select
                  className="select"
                  style={{ width: 220 }}
                  value={row.value}
                  onChange={(e) => {
                    setLayout((prev) => ({
                      ...prev,
                      filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                    }));
                    setPage(1);
                  }}
                >
                  <option value="">—</option>
                  {PROVENANCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  style={{ width: 200 }}
                  value={row.value}
                  onChange={(e) => {
                    setLayout((prev) => ({
                      ...prev,
                      filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                    }));
                    setPage(1);
                  }}
                />
              )}
              <button
                className="btn ghost small"
                type="button"
                onClick={() =>
                  setLayout((prev) => ({
                    ...prev,
                    filterRows: prev.filterRows.filter((r) => r.id !== row.id),
                  }))
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn dashed small"
            type="button"
            onClick={() =>
              setLayout((prev) => ({
                ...prev,
                filterRows: [...prev.filterRows, { id: uid("f"), field: "category", op: "eq", value: "" }],
              }))
            }
          >
            + Filtre
          </button>
        </div>
      ) : null}

      {showSorts ? (
        <div className="panel-soft">
          {layout.sortRows.map((row) => (
            <div className="panel-soft-row" key={row.id}>
              <select
                className="select"
                style={{ width: 200 }}
                value={row.field}
                onChange={(e) =>
                  setLayout((prev) => ({
                    ...prev,
                    sortRows: prev.sortRows.map((r) => (r.id === row.id ? { ...r, field: e.target.value } : r)),
                  }))
                }
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="select"
                style={{ width: 140 }}
                value={row.direction}
                onChange={(e) =>
                  setLayout((prev) => ({
                    ...prev,
                    sortRows: prev.sortRows.map((r) =>
                      r.id === row.id ? { ...r, direction: e.target.value as "asc" | "desc" } : r,
                    ),
                  }))
                }
              >
                <option value="asc">Croissant</option>
                <option value="desc">Décroissant</option>
              </select>
              <button
                className="btn ghost small"
                type="button"
                onClick={() =>
                  setLayout((prev) => ({
                    ...prev,
                    sortRows: prev.sortRows.filter((r) => r.id !== row.id),
                  }))
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn dashed small"
            type="button"
            onClick={() =>
              setLayout((prev) => ({
                ...prev,
                sortRows: [...prev.sortRows, { id: uid("s"), field: "updatedAt", direction: "desc" }],
              }))
            }
          >
            + Tri
          </button>
        </div>
      ) : null}

      <div className="page-body">
        {loading ? (
          <p className="empty">Chargement…</p>
        ) : layout.viewMode === "list" ? (
          contacts.length === 0 ? (
            <p className="empty">Aucun contact.</p>
          ) : (
            <div className="table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} />
                    </th>
                    {visibleCols.map((col) => (
                      <th
                        key={col.key}
                        draggable
                        className={`${dragCol === col.key ? "dragging" : ""} ${dropCol === col.key ? "drop-before" : ""}`}
                        onDragStart={() => setDragCol(col.key)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDropCol(col.key);
                        }}
                        onDrop={() => {
                          if (dragCol && dropCol && dragCol !== dropCol) {
                            setLayout((prev) => ({
                              ...prev,
                              columnOrder: moveColumn(prev.columnOrder, dragCol, dropCol),
                            }));
                          }
                          setDragCol(null);
                          setDropCol(null);
                        }}
                        onDragEnd={() => {
                          setDragCol(null);
                          setDropCol(null);
                        }}
                      >
                        <span className="col-handle">⠿</span>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr
                      className={`row-link ${selectedIds.includes(contact.id) ? "selected" : ""}`}
                      key={contact.id}
                      onClick={() => void openContact(contact.id)}
                    >
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(contact.id)}
                          onChange={() => toggleSelect(contact.id)}
                        />
                      </td>
                      {visibleCols.map((col) => (
                        <td key={col.key}>
                          {col.key === "category" ? (
                            <span className={`badge ${PERSON_CATEGORY_COLORS[contact.category]}`}>
                              {PERSON_CATEGORY_LABELS[contact.category]}
                            </span>
                          ) : col.key === "state" ? (
                            <span className={`badge ${PERSON_STATE_COLORS[contact.state]}`}>
                              {PERSON_STATE_LABELS[contact.state]}
                            </span>
                          ) : (
                            cellValue(contact, col.key, customColumns)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="pipeline">
            {kanbanColumns.map((col) => (
              <section
                className="column"
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const contactId = e.dataTransfer.getData("text/plain");
                  if (!contactId) return;
                  if (layout.kanbanGroupBy === "category") {
                    void moveContact(contactId, { category: col.key as PersonCategory });
                  } else if (layout.kanbanGroupBy === "next_action_date") {
                    void moveContact(contactId, { prochaineActionDate: dateForActionBucket(col.key) });
                  } else {
                    void moveContact(contactId, { state: col.key as PersonState });
                  }
                }}
              >
                <h2>
                  <span>{col.label}</span>
                  <span className="muted">{col.items.length}</span>
                </h2>
                {col.items.map((contact) => (
                  <article
                    className="kanban-card"
                    draggable
                    key={contact.id}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", contact.id)}
                    onClick={() => void openContact(contact.id)}
                  >
                    <h3>{contactDisplayName(contact)}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {contact.company?.nom ?? contact.email ?? "Sans entreprise"}
                    </p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>

      {saveViewOpen ? (
        <div className="modal-backdrop" onClick={() => setSaveViewOpen(false)}>
          <div className="modal-card form-grid" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedViewId ? "Gérer la vue" : "Sauvegarder la vue"}</h3>
            <label>
              Nom
              <input className="input" value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {selectedViewId ? (
                <button className="btn danger small" type="button" onClick={() => void deleteSelectedView()}>
                  Supprimer
                </button>
              ) : null}
              <button className="btn secondary small" type="button" onClick={() => setSaveViewOpen(false)}>
                Annuler
              </button>
              <button className="btn small" type="button" onClick={() => void saveCurrentView()}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mergeOpen ? (
        <div className="modal-backdrop" onClick={() => setMergeOpen(false)}>
          <div className="modal-card form-grid" onClick={(e) => e.stopPropagation()}>
            <h3>Migrer {selectedIds.length} contacts</h3>
            <p className="muted">Le contact conservé récupère les actions et les champs vides. Les autres fiches sont supprimées.</p>
            <label>
              Conserver
              <select className="select" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                {contacts
                  .filter((contact) => selectedIds.includes(contact.id))
                  .map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contactDisplayName(contact)}
                    </option>
                  ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn secondary small" type="button" onClick={() => setMergeOpen(false)}>
                Annuler
              </button>
              <button className="btn small" type="button" onClick={() => void bulkMerge()}>
                Migrer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkOpen ? (
        <div className="modal-backdrop" onClick={() => setBulkOpen(false)}>
          <div className="modal-card form-grid" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier {selectedIds.length} contact(s)</h3>
            <label>
              Catégorie
              <select className="select" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                <option value="">Ne pas changer</option>
                {PERSON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PERSON_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              État
              <select className="select" value={bulkState} onChange={(e) => setBulkState(e.target.value)}>
                <option value="">Ne pas changer</option>
                {(Object.keys(PERSON_STATE_LABELS) as PersonState[]).map((s) => (
                  <option key={s} value={s}>
                    {PERSON_STATE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn secondary small" type="button" onClick={() => setBulkOpen(false)}>
                Annuler
              </button>
              <button className="btn small" type="button" onClick={() => void bulkUpdate()}>
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CustomColumnModal
        open={columnModalOpen}
        entityType="contact"
        column={
          editingColumn
            ? {
                id: editingColumn.id,
                label: editingColumn.label,
                type: editingColumn.type as "text" | "number" | "date" | "boolean",
                key: editingColumn.key,
              }
            : null
        }
        onClose={() => {
          setColumnModalOpen(false);
          setEditingColumn(null);
        }}
        onSaved={() => {
          void loadCustomColumns();
        }}
      />

      <SidePeek
        open={!!selected}
        title={creating || !selected?.id ? "Nouveau contact" : contactDisplayName(selected)}
        onClose={closePeek}
        actions={
          selected?.id && !creating ? (
            <button className="btn danger small" type="button" onClick={() => void deleteContact()}>
              Supprimer
            </button>
          ) : null
        }
      >
        {selected ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span className={`badge ${PERSON_CATEGORY_COLORS[selected.category]}`}>
                {PERSON_CATEGORY_LABELS[selected.category]}
              </span>
              <span className={`badge ${PERSON_STATE_COLORS[selected.state]}`}>
                {PERSON_STATE_LABELS[selected.state]}
              </span>
            </div>
            <ContactSheet
              contact={selected}
              creating={creating || !selected.id}
              companies={companies}
              customColumns={customColumns}
              customFields={customFieldDraft}
              onCustomFields={setCustomFieldDraft}
              saving={saving}
              error={error}
              onSave={(draft, fields) => void saveContact(draft, fields)}
              onCreateAction={(input) => void createAction(input)}
              onSetStatut={(actionId, statut) => void setActionStatut(actionId, statut)}
              onOpenCompany={(companyId) => router.push(`/companies?company=${companyId}`)}
            />
          </>
        ) : null}
      </SidePeek>
    </div>
  );
}
