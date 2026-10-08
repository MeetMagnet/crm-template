"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionChannel, ActionStatut, PersonCategory } from "@prisma/client";
import {
  ACTION_CHANNELS,
  ACTION_CHANNEL_LABELS,
  ACTION_STATUTS,
  ACTION_STATUT_LABELS,
  actionStatutBadgeClass,
  PERSON_CATEGORIES,
  PERSON_CATEGORY_LABELS,
  contactDisplayName,
  formatDateTime,
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
import { ActionCheck } from "@/app/components/action-check";
import { CustomColumnModal } from "@/app/components/custom-column-modal";
import { PropertyRow } from "@/app/components/property-sheet";
import { SidePeek } from "@/app/components/side-peek";

type ActionRow = {
  id: string;
  channel: ActionChannel;
  titre: string;
  contenu: string;
  statut: ActionStatut;
  datePrevue: string | Date | null;
  customFields?: string | Record<string, unknown>;
  contact: {
    id: string;
    prenom: string;
    nom: string;
    category: PersonCategory;
    company: { nom: string } | null;
  };
};

type SavedView = { id: string; name: string; viewType: string; filters: Record<string, unknown> };

const STORAGE_KEY = "crm-actions-default-layout";

const WORKFLOW_BUCKETS: Array<{ value: "" | ActionStatut; label: string }> = [
  { value: "a_faire", label: "to do" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "", label: "Toutes" },
];

const DATE_COLUMNS = [
  { key: "overdue", label: "En retard" },
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "7 prochains jours" },
  { key: "later", label: "Plus tard" },
  { key: "none", label: "Sans date" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function actionDateBucket(value: string | Date | null | undefined) {
  if (!value) return "none";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "none";
  const diff = (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000;
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "later";
}

function dateForBucket(bucket: string) {
  const today = startOfDay(new Date());
  if (bucket === "none") return null;
  if (bucket === "overdue") today.setDate(today.getDate() - 1);
  if (bucket === "week") today.setDate(today.getDate() + 3);
  if (bucket === "later") today.setDate(today.getDate() + 14);
  return today.toISOString();
}
const BASE_COLUMN_DEFS: ColumnDef[] = [
  { key: "titre", label: "Titre" },
  { key: "contact", label: "Contact" },
  { key: "channel", label: "Canal" },
  { key: "statut", label: "Statut" },
  { key: "datePrevue", label: "Date prévue" },
];

const DEFAULT_LAYOUT: ListLayoutState = {
  visibleColumnKeys: ["titre", "contact", "channel", "statut", "datePrevue"],
  columnOrder: BASE_COLUMN_DEFS.map((c) => c.key),
  viewMode: "list",
  filterRows: [],
  sortRows: [{ id: "s1", field: "datePrevue", direction: "asc" }],
  kanbanGroupBy: "statut",
  pageSize: 25,
};

export function ActionsWorkspace() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<string | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumnRecord[]>([]);
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<CustomColumnRecord | null>(null);
  const [workflowBucket, setWorkflowBucket] = useState<"" | ActionStatut>("a_faire");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [peek, setPeek] = useState<ActionRow | null>(null);
  const [creatingAction, setCreatingAction] = useState(false);
  const [actionDraft, setActionDraft] = useState({
    contactId: "",
    channel: "note" as ActionChannel,
    titre: "",
    contenu: "",
    statut: "a_faire" as ActionStatut,
    datePrevue: "",
  });
  const [contactOptions, setContactOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  useEffect(() => {
    setLayout(loadLayout(STORAGE_KEY, DEFAULT_LAYOUT));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || selectedViewId) return;
    saveLayout(STORAGE_KEY, layout);
  }, [layout, hydrated, selectedViewId]);

  const loadViews = useCallback(async () => {
    const res = await fetch("/api/saved-views?entity=actions");
    if (!res.ok) return;
    const data = await res.json();
    setSavedViews(data.data ?? []);
  }, []);

  const loadCustomColumns = useCallback(async () => {
    const res = await fetch("/api/custom-columns?entityType=action");
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

  const fetchActions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(layout.viewMode === "kanban" ? 1 : page),
      pageSize: String(layout.viewMode === "kanban" ? 1000 : layout.pageSize),
    });
    if (q.trim()) params.set("q", q.trim());
    if (workflowBucket) params.set("statut", workflowBucket);
    if (categoryFilter) params.set("contactCategory", categoryFilter);
    for (const row of layout.filterRows) {
      if (row.value) params.set(row.field, row.value);
    }
    if (layout.sortRows.length) {
      params.set(
        "sorts",
        JSON.stringify(layout.sortRows.map((s) => ({ field: s.field, direction: s.direction }))),
      );
    }
    const res = await fetch(`/api/actions?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setActions(data.data ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [categoryFilter, layout.filterRows, layout.pageSize, layout.sortRows, layout.viewMode, page, q, workflowBucket]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchActions();
  }, [hydrated, fetchActions]);

  const visibleCols = useMemo(
    () => orderedVisibleColumns(allColumnDefs, layout.columnOrder, layout.visibleColumnKeys),
    [allColumnDefs, layout.columnOrder, layout.visibleColumnKeys],
  );

  const pageIds = actions.map((a) => a.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const totalPages = Math.max(1, Math.ceil(total / layout.pageSize));

  function toDateTimeLocal(value: string | Date | null | undefined) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function openAction(action: ActionRow) {
    setCreatingAction(false);
    setActionError("");
    setPeek(action);
    setActionDraft({
      contactId: action.contact.id,
      channel: action.channel,
      titre: action.titre,
      contenu: action.contenu,
      statut: action.statut,
      datePrevue: toDateTimeLocal(action.datePrevue),
    });
  }

  async function openCreateAction() {
    setCreatingAction(true);
    setActionError("");
    setPeek({
      id: "",
      channel: "note",
      titre: "",
      contenu: "",
      statut: workflowBucket || "a_faire",
      datePrevue: null,
      contact: { id: "", prenom: "", nom: "", category: "lead", company: null },
    });
    setActionDraft({
      contactId: "",
      channel: "note",
      titre: "",
      contenu: "",
      statut: workflowBucket || "a_faire",
      datePrevue: "",
    });
    const res = await fetch("/api/contacts?pageSize=200");
    if (res.ok) {
      const data = await res.json();
      setContactOptions(
        (data.data ?? []).map((contact: { id: string; prenom: string; nom: string }) => ({
          id: contact.id,
          label: contactDisplayName(contact),
        })),
      );
    }
  }

  async function saveAction() {
    if (!actionDraft.titre.trim()) {
      setActionError("Titre requis");
      return;
    }
    if (creatingAction && !actionDraft.contactId) {
      setActionError("Choisissez un contact");
      return;
    }
    setActionSaving(true);
    setActionError("");
    const payload = {
      contactId: actionDraft.contactId,
      channel: actionDraft.channel,
      titre: actionDraft.titre.trim(),
      contenu: actionDraft.contenu,
      statut: actionDraft.statut,
      datePrevue: actionDraft.datePrevue || null,
    };
    const res = await fetch(creatingAction ? "/api/actions" : `/api/actions/${peek?.id}`, {
      method: creatingAction ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setActionSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Enregistrement impossible");
      return;
    }
    setPeek(null);
    setCreatingAction(false);
    await fetchActions();
  }

  async function setActionStatut(id: string, statut: ActionStatut) {
    const previous = actions.find((action) => action.id === id);
    setActions((prev) => prev.map((action) => (action.id === id ? { ...action, statut } : action)));
    setPeek((current) => (current?.id === id ? { ...current, statut } : current));
    setActionDraft((draft) => (peek?.id === id ? { ...draft, statut } : draft));
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (!res.ok && previous) {
      setPeek((current) => (current?.id === id ? previous : current));
      setActionDraft((draft) => (peek?.id === id ? { ...draft, statut: previous.statut } : draft));
    }
    await fetchActions();
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Supprimer ${selectedIds.length} action(s) ?`)) return;
    await fetch("/api/actions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: selectedIds }),
    });
    setSelectedIds([]);
    await fetchActions();
  }

  async function bulkComplete() {
    await fetch("/api/actions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateStatut", ids: selectedIds, statut: "termine" }),
    });
    setSelectedIds([]);
    await fetchActions();
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
        body: JSON.stringify({ name, entity: "actions", viewType: layout.viewMode, filters }),
      });
      if (res.ok) setSelectedViewId((await res.json()).id);
    }
    setSaveViewOpen(false);
    setSaveViewName("");
    await loadViews();
  }

  function cellValue(action: ActionRow, key: string) {
    const custom = customColumns.find((c) => c.key === key);
    if (custom) {
      const fields =
        typeof action.customFields === "string"
          ? parseCustomFields(action.customFields)
          : (action.customFields ?? {});
      return formatCustomFieldValue(fields[key], custom.type);
    }
    switch (key) {
      case "titre":
        return action.titre;
      case "contact":
        return (
          <>
            {contactDisplayName(action.contact)}
            <div className="muted">{action.contact.company?.nom ?? ""}</div>
          </>
        );
      case "channel":
        return ACTION_CHANNEL_LABELS[action.channel];
      case "statut":
        return <span className={actionStatutBadgeClass(action.statut)}>{ACTION_STATUT_LABELS[action.statut]}</span>;
      case "datePrevue":
        return <span className="muted">{formatDateTime(action.datePrevue)}</span>;
      default:
        return "—";
    }
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Actions</h1>
        <div className="seg">
          {WORKFLOW_BUCKETS.map((bucket) => (
            <button
              key={bucket.label}
              type="button"
              className={workflowBucket === bucket.value ? "active" : ""}
              onClick={() => {
                setWorkflowBucket(bucket.value);
                setPage(1);
              }}
            >
              {bucket.label}
            </button>
          ))}
        </div>
        <select
          className="select"
          style={{ width: 170 }}
          value={categoryFilter}
          title="Filtrer par catégorie de contact"
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les contacts</option>
          {PERSON_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {PERSON_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        <input
          className="input toolbar-input"
          placeholder="Rechercher (titre, contact…)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select className="select" style={{ width: 180 }} value={selectedViewId} onChange={(e) => applySavedView(e.target.value)}>
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
        <button className={`icon-btn ${showFilters ? "active" : ""}`} type="button" title="Filtres" onClick={() => setShowFilters((v) => !v)}>
          ⚙
        </button>
        <button className={`icon-btn ${showSorts ? "active" : ""}`} type="button" title="Tris" onClick={() => setShowSorts((v) => !v)}>
          ↕
        </button>
        <div className="dropdown">
          <button className={`icon-btn ${showColumns ? "active" : ""}`} type="button" title="Colonnes" onClick={() => setShowColumns((v) => !v)}>
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
                    onChange={(e) =>
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
                      }))
                    }
                  />
                  <span style={{ flex: 1 }}>{col.label}</span>
                  {col.isCustom ? (
                    <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.preventDefault()}>
                      <button
                        className="btn ghost small"
                        type="button"
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
        <button
          className="btn secondary small"
          type="button"
          onClick={() => setLayout((p) => ({ ...p, viewMode: p.viewMode === "list" ? "kanban" : "list" }))}
        >
          {layout.viewMode === "list" ? "Vue Kanban (dates)" : "Vue Liste"}
        </button>
        {selectedIds.length > 0 ? (
          <>
            <button className="btn small" type="button" onClick={() => void bulkComplete()}>
              Terminer ({selectedIds.length})
            </button>
            <button className="btn danger small" type="button" onClick={() => void bulkDelete()}>
              Supprimer ({selectedIds.length})
            </button>
          </>
        ) : null}
        <button className="btn" type="button" onClick={() => void openCreateAction()}>
          + Nouvelle action
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
            {layout.viewMode === "kanban" ? `${actions.length} / ${total} actions` : pageLabel(total, page, layout.pageSize)}
          </span>
          {layout.viewMode === "list" ? (
            <>
              <button className="btn secondary small" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Préc.
              </button>
              <button className="btn secondary small" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
                    filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, field: e.target.value, value: "" } : r)),
                  }))
                }
              >
                <option value="channel">Canal</option>
                <option value="statut">Statut</option>
                <option value="contactCategory">Catégorie contact</option>
                <option value="titre">Titre</option>
              </select>
              {row.field === "channel" ? (
                <select className="select" style={{ width: 160 }} value={row.value} onChange={(e) => { setLayout((prev) => ({ ...prev, filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)) })); setPage(1); }}>
                  <option value="">—</option>
                  {ACTION_CHANNELS.map((c) => (
                    <option key={c} value={c}>{ACTION_CHANNEL_LABELS[c]}</option>
                  ))}
                </select>
              ) : row.field === "statut" ? (
                <select className="select" style={{ width: 160 }} value={row.value} onChange={(e) => { setLayout((prev) => ({ ...prev, filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)) })); setPage(1); }}>
                  <option value="">—</option>
                  {ACTION_STATUTS.map((s) => (
                    <option key={s} value={s}>{ACTION_STATUT_LABELS[s]}</option>
                  ))}
                </select>
              ) : row.field === "contactCategory" ? (
                <select className="select" style={{ width: 160 }} value={row.value} onChange={(e) => { setLayout((prev) => ({ ...prev, filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)) })); setPage(1); }}>
                  <option value="">—</option>
                  {PERSON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{PERSON_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              ) : (
                <input className="input" style={{ width: 200 }} value={row.value} onChange={(e) => { setLayout((prev) => ({ ...prev, filterRows: prev.filterRows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)) })); setPage(1); }} />
              )}
              <button className="btn ghost small" type="button" onClick={() => setLayout((prev) => ({ ...prev, filterRows: prev.filterRows.filter((r) => r.id !== row.id) }))}>×</button>
            </div>
          ))}
          <button className="btn dashed small" type="button" onClick={() => setLayout((prev) => ({ ...prev, filterRows: [...prev.filterRows, { id: uid("f"), field: "statut", op: "eq", value: "" }] }))}>
            + Filtre
          </button>
        </div>
      ) : null}

      {showSorts ? (
        <div className="panel-soft">
          {layout.sortRows.map((row) => (
            <div className="panel-soft-row" key={row.id}>
              <select className="select" style={{ width: 180 }} value={row.field} onChange={(e) => setLayout((prev) => ({ ...prev, sortRows: prev.sortRows.map((r) => (r.id === row.id ? { ...r, field: e.target.value } : r)) }))}>
                <option value="datePrevue">Date prévue</option>
                <option value="titre">Titre</option>
                <option value="statut">Statut</option>
                <option value="channel">Canal</option>
                <option value="createdAt">Création</option>
                <option value="contact">Contact</option>
              </select>
              <select className="select" style={{ width: 140 }} value={row.direction} onChange={(e) => setLayout((prev) => ({ ...prev, sortRows: prev.sortRows.map((r) => (r.id === row.id ? { ...r, direction: e.target.value as "asc" | "desc" } : r)) }))}>
                <option value="asc">Croissant</option>
                <option value="desc">Décroissant</option>
              </select>
              <button className="btn ghost small" type="button" onClick={() => setLayout((prev) => ({ ...prev, sortRows: prev.sortRows.filter((r) => r.id !== row.id) }))}>×</button>
            </div>
          ))}
          <button className="btn dashed small" type="button" onClick={() => setLayout((prev) => ({ ...prev, sortRows: [...prev.sortRows, { id: uid("s"), field: "datePrevue", direction: "asc" }] }))}>
            + Tri
          </button>
        </div>
      ) : null}

      <div className="page-body">
        {loading ? (
          <p className="empty">Chargement…</p>
        ) : layout.viewMode === "list" ? (
          actions.length === 0 ? (
            <p className="empty">Aucune action.</p>
          ) : (
            <div className="table-wrap">
              <table className="list-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
                          )
                        }
                      />
                    </th>
                    <th className="col-check" aria-label="Terminé" />
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
                            setLayout((prev) => ({ ...prev, columnOrder: moveColumn(prev.columnOrder, dragCol, dropCol) }));
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
                  {actions.map((action) => (
                    <tr
                      className={`row-link ${selectedIds.includes(action.id) ? "selected" : ""}`}
                      key={action.id}
                      onClick={() => openAction(action)}
                    >
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(action.id)}
                          onChange={() =>
                            setSelectedIds((prev) =>
                              prev.includes(action.id) ? prev.filter((x) => x !== action.id) : [...prev, action.id],
                            )
                          }
                        />
                      </td>
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <ActionCheck
                          done={action.statut === "termine"}
                          onToggle={() => void setActionStatut(action.id, action.statut === "termine" ? "a_faire" : "termine")}
                        />
                      </td>
                      {visibleCols.map((col) => (
                        <td key={col.key}>{cellValue(action, col.key)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="pipeline">
            {DATE_COLUMNS.map((col) => {
              const items = actions.filter((action) => actionDateBucket(action.datePrevue) === col.key);
              return (
                <section
                  className="column"
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (!id) return;
                    void fetch(`/api/actions/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ datePrevue: dateForBucket(col.key) }),
                    }).then(() => fetchActions());
                  }}
                >
                  <h2>
                    <span>{col.label}</span>
                    <span className="muted">{items.length}</span>
                  </h2>
                  {items.map((action) => (
                    <article
                      className={`kanban-card ${action.statut === "termine" ? "done" : "open"}`}
                      draggable
                      key={action.id}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", action.id)}
                      onClick={() => openAction(action)}
                    >
                      <div className="title-with-check">
                        <ActionCheck
                          done={action.statut === "termine"}
                          onToggle={() => void setActionStatut(action.id, action.statut === "termine" ? "a_faire" : "termine")}
                        />
                        <h3>{action.titre}</h3>
                      </div>
                      <p className="muted" style={{ margin: 0 }}>
                        {contactDisplayName(action.contact)} · {ACTION_CHANNEL_LABELS[action.channel]}
                      </p>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {saveViewOpen ? (
        <div className="modal-backdrop" onClick={() => setSaveViewOpen(false)}>
          <div className="modal-card form-grid" onClick={(e) => e.stopPropagation()}>
            <h3>Sauvegarder la vue</h3>
            <label>
              Nom
              <input className="input" value={saveViewName} onChange={(e) => setSaveViewName(e.target.value)} />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
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

      <SidePeek
        open={!!peek}
        title={creatingAction ? "Nouvelle action" : peek?.titre || "Action"}
        onClose={() => {
          setPeek(null);
          setCreatingAction(false);
        }}
        actions={
          <button className="btn small" type="button" disabled={actionSaving} onClick={() => void saveAction()}>
            {actionSaving ? "…" : "Enregistrer"}
          </button>
        }
      >
        <div className="prop-sheet">
          {actionError ? <p className="error">{actionError}</p> : null}
          {!creatingAction && peek ? (
            <div className="title-with-check">
              <ActionCheck
                done={actionDraft.statut === "termine"}
                onToggle={() => void setActionStatut(peek.id, actionDraft.statut === "termine" ? "a_faire" : "termine")}
              />
              <span className={actionStatutBadgeClass(actionDraft.statut)}>{ACTION_STATUT_LABELS[actionDraft.statut]}</span>
            </div>
          ) : null}
          {creatingAction ? (
            <PropertyRow label="Contact">
              <select
                className="select"
                value={actionDraft.contactId}
                onChange={(e) => setActionDraft((draft) => ({ ...draft, contactId: e.target.value }))}
              >
                <option value="">Choisir…</option>
                {contactOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.label}
                  </option>
                ))}
              </select>
            </PropertyRow>
          ) : peek?.contact.id ? (
            <PropertyRow label="Contact">
              <a className="text-link" href={`/contacts?contact=${peek.contact.id}`}>
                {contactDisplayName(peek.contact)}
              </a>
            </PropertyRow>
          ) : null}
          <PropertyRow label="Titre">
            <input className="input" value={actionDraft.titre} onChange={(e) => setActionDraft((draft) => ({ ...draft, titre: e.target.value }))} />
          </PropertyRow>
          <PropertyRow label="Canal">
            <select className="select" value={actionDraft.channel} onChange={(e) => setActionDraft((draft) => ({ ...draft, channel: e.target.value as ActionChannel }))}>
              {ACTION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {ACTION_CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="État">
            <select className="select" value={actionDraft.statut} onChange={(e) => setActionDraft((draft) => ({ ...draft, statut: e.target.value as ActionStatut }))}>
              {ACTION_STATUTS.map((statut) => (
                <option key={statut} value={statut}>
                  {ACTION_STATUT_LABELS[statut]}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="Date">
            <input className="input" type="datetime-local" value={actionDraft.datePrevue} onChange={(e) => setActionDraft((draft) => ({ ...draft, datePrevue: e.target.value }))} />
          </PropertyRow>
          <PropertyRow label="Note">
            <textarea className="textarea" value={actionDraft.contenu} onChange={(e) => setActionDraft((draft) => ({ ...draft, contenu: e.target.value }))} />
          </PropertyRow>
        </div>
      </SidePeek>

      <CustomColumnModal
        open={columnModalOpen}
        entityType="action"
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
        onSaved={() => void loadCustomColumns()}
      />
    </div>
  );
}
