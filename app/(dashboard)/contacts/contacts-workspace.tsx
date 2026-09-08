"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActionChannel, ActionStatut, PersonCategory, PersonState } from "@prisma/client";
import { SidePeek } from "@/app/components/side-peek";
import {
  ACTION_CHANNELS,
  ACTION_CHANNEL_LABELS,
  ACTION_STATUT_LABELS,
  PERSON_CATEGORIES,
  PERSON_CATEGORY_COLORS,
  PERSON_CATEGORY_LABELS,
  PERSON_CATEGORY_STATE_KEYS,
  PERSON_STATE_COLORS,
  PERSON_STATE_LABELS,
  contactDisplayName,
  formatDate,
  formatDateTime,
} from "@/lib/labels";

type CompanyOption = { id: string; nom: string };

type ActionRow = {
  id: string;
  channel: ActionChannel;
  titre: string;
  contenu: string;
  statut: ActionStatut;
  datePrevue: string | Date | null;
  dateRealisation: string | Date | null;
};

type ContactRow = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  poste: string | null;
  linkedinUrl: string | null;
  description: string | null;
  adresse: string | null;
  pays: string | null;
  source: string | null;
  category: PersonCategory;
  state: PersonState;
  companyId: string | null;
  company: { id: string; nom: string } | null;
  prochaineActionTitre: string | null;
  prochaineActionDate: string | Date | null;
  updatedAt: string | Date;
  actions?: ActionRow[];
};

export function ContactsWorkspace({
  initialContacts,
  companies,
}: {
  initialContacts: ContactRow[];
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [groupBy, setGroupBy] = useState<"state" | "category">("state");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [state, setState] = useState(searchParams.get("state") ?? "");
  const [contacts, setContacts] = useState(initialContacts);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"info" | "actions">("info");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    const id = searchParams.get("contact");
    if (!id) return;
    void openContact(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (category && c.category !== category) return false;
      if (state && c.state !== state) return false;
      if (!q.trim()) return true;
      const hay = `${c.prenom} ${c.nom} ${c.email ?? ""} ${c.telephone ?? ""} ${c.poste ?? ""} ${c.company?.nom ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [contacts, category, state, q]);

  const kanbanColumns = useMemo(() => {
    if (groupBy === "category") {
      return PERSON_CATEGORIES.map((key) => ({
        key,
        label: PERSON_CATEGORY_LABELS[key],
        items: filtered.filter((c) => c.category === key),
      }));
    }
    const keys = category && category in PERSON_CATEGORY_STATE_KEYS
      ? PERSON_CATEGORY_STATE_KEYS[category as PersonCategory]
      : PERSON_CATEGORY_STATE_KEYS.lead.concat(
          PERSON_CATEGORY_STATE_KEYS.prospect,
          PERSON_CATEGORY_STATE_KEYS.client,
          PERSON_CATEGORY_STATE_KEYS.ex_clients,
        );
    return keys.map((key) => ({
      key,
      label: PERSON_STATE_LABELS[key],
      items: filtered.filter((c) => c.state === key),
    }));
  }, [filtered, groupBy, category]);

  async function openContact(id: string) {
    const res = await fetch(`/api/contacts/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data);
    setCreating(false);
    setTab("info");
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
      actions: [],
    });
    setTab("info");
  }

  async function saveContact(patch: Partial<ContactRow>) {
    if (!selected) return;
    setSaving(true);
    setError("");
    const payload = { ...selected, ...patch };
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
    setCreating(false);
    setContacts((prev) => {
      const others = prev.filter((c) => c.id !== saved.id);
      return [saved, ...others];
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set("contact", saved.id);
    router.replace(`/contacts?${params.toString()}`);
    router.refresh();
  }

  async function deleteContact() {
    if (!selected?.id || creating) return;
    if (!confirm(`Supprimer ${contactDisplayName(selected)} ?`)) return;
    const res = await fetch(`/api/contacts/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setContacts((prev) => prev.filter((c) => c.id !== selected.id));
    closePeek();
    router.refresh();
  }

  async function moveContact(contactId: string, next: { state?: PersonState; category?: PersonCategory }) {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...next } : c)),
    );
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      router.refresh();
      return;
    }
    const saved = await res.json();
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, ...saved } : c)));
    if (selected?.id === contactId) setSelected(saved);
    router.refresh();
  }

  async function createAction(form: FormData) {
    if (!selected?.id) return;
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: selected.id,
        channel: form.get("channel"),
        titre: form.get("titre"),
        contenu: form.get("contenu"),
        datePrevue: form.get("datePrevue") || null,
      }),
    });
    if (!res.ok) return;
    await openContact(selected.id);
    router.refresh();
  }

  async function setActionStatut(actionId: string, statut: ActionStatut) {
    await fetch(`/api/actions/${actionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (selected?.id) await openContact(selected.id);
    router.refresh();
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Contacts</h1>
        <input
          className="input toolbar-input"
          placeholder="Rechercher (nom, poste, email…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" style={{ width: 150 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          {PERSON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PERSON_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 180 }} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Tous les états</option>
          {(category && category in PERSON_CATEGORY_STATE_KEYS
            ? PERSON_CATEGORY_STATE_KEYS[category as PersonCategory]
            : Object.keys(PERSON_STATE_LABELS) as PersonState[]
          ).map((s) => (
            <option key={s} value={s}>
              {PERSON_STATE_LABELS[s]}
            </option>
          ))}
        </select>
        <div className="segmented">
          <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
            Liste
          </button>
          <button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => setViewMode("kanban")}>
            Kanban
          </button>
        </div>
        {viewMode === "kanban" ? (
          <select className="select" style={{ width: 150 }} value={groupBy} onChange={(e) => setGroupBy(e.target.value as "state" | "category")}>
            <option value="state">Par état</option>
            <option value="category">Par catégorie</option>
          </select>
        ) : null}
        <button className="btn" type="button" onClick={openCreate}>
          Nouveau contact
        </button>
      </div>

      <div className="page-body">
        {viewMode === "list" ? (
          filtered.length === 0 ? (
            <p className="empty">Aucun contact.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Entreprise</th>
                    <th>E-mail</th>
                    <th>Catégorie</th>
                    <th>État</th>
                    <th>Prochaine action</th>
                    <th>MAJ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contact) => (
                    <tr className="row-link" key={contact.id} onClick={() => void openContact(contact.id)}>
                      <td>{contactDisplayName(contact)}</td>
                      <td>{contact.company?.nom ?? "—"}</td>
                      <td>{contact.email ?? "—"}</td>
                      <td>
                        <span className={`badge ${PERSON_CATEGORY_COLORS[contact.category]}`}>
                          {PERSON_CATEGORY_LABELS[contact.category]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${PERSON_STATE_COLORS[contact.state]}`}>
                          {PERSON_STATE_LABELS[contact.state]}
                        </span>
                      </td>
                      <td>
                        {contact.prochaineActionTitre ? (
                          <>
                            {contact.prochaineActionTitre}
                            <div className="muted">{formatDate(contact.prochaineActionDate)}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="muted">{formatDate(contact.updatedAt)}</td>
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
                  if (groupBy === "category") {
                    void moveContact(contactId, { category: col.key as PersonCategory });
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
            <div className="tabs">
              <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>
                Infos
              </button>
              <button
                type="button"
                className={tab === "actions" ? "active" : ""}
                onClick={() => setTab("actions")}
                disabled={creating || !selected.id}
              >
                Actions
              </button>
            </div>
            {error ? <p className="error">{error}</p> : null}
            {tab === "info" ? (
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void saveContact({
                    prenom: String(form.get("prenom") ?? ""),
                    nom: String(form.get("nom") ?? ""),
                    email: String(form.get("email") ?? "") || null,
                    telephone: String(form.get("telephone") ?? "") || null,
                    poste: String(form.get("poste") ?? "") || null,
                    linkedinUrl: String(form.get("linkedinUrl") ?? "") || null,
                    description: String(form.get("description") ?? "") || null,
                    adresse: String(form.get("adresse") ?? "") || null,
                    pays: String(form.get("pays") ?? "") || null,
                    source: String(form.get("source") ?? "") || null,
                    category: String(form.get("category") ?? "lead") as PersonCategory,
                    state: String(form.get("state") ?? "new_lead") as PersonState,
                    companyId: String(form.get("companyId") ?? "") || null,
                  });
                }}
              >
                <div className="form-row">
                  <label>
                    Prénom
                    <input className="input" name="prenom" defaultValue={selected.prenom} />
                  </label>
                  <label>
                    Nom
                    <input className="input" name="nom" defaultValue={selected.nom} />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    E-mail
                    <input className="input" name="email" type="email" defaultValue={selected.email ?? ""} />
                  </label>
                  <label>
                    Téléphone
                    <input className="input" name="telephone" defaultValue={selected.telephone ?? ""} />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Catégorie
                    <select className="select" name="category" defaultValue={selected.category}>
                      {PERSON_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {PERSON_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    État
                    <select className="select" name="state" defaultValue={selected.state}>
                      {(Object.keys(PERSON_STATE_LABELS) as PersonState[]).map((s) => (
                        <option key={s} value={s}>
                          {PERSON_STATE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Entreprise
                  <select className="select" name="companyId" defaultValue={selected.companyId ?? ""}>
                    <option value="">Aucune</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Poste
                  <input className="input" name="poste" defaultValue={selected.poste ?? ""} />
                </label>
                <label>
                  LinkedIn
                  <input className="input" name="linkedinUrl" defaultValue={selected.linkedinUrl ?? ""} />
                </label>
                <div className="form-row">
                  <label>
                    Source
                    <input className="input" name="source" defaultValue={selected.source ?? ""} />
                  </label>
                  <label>
                    Pays
                    <input className="input" name="pays" defaultValue={selected.pays ?? ""} />
                  </label>
                </div>
                <label>
                  Adresse
                  <input className="input" name="adresse" defaultValue={selected.adresse ?? ""} />
                </label>
                <label>
                  Description
                  <textarea className="textarea" name="description" defaultValue={selected.description ?? ""} />
                </label>
                <button className="btn" disabled={saving} type="submit">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </form>
            ) : (
              <div className="form-grid">
                <form
                  className="form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createAction(new FormData(e.currentTarget));
                    e.currentTarget.reset();
                  }}
                >
                  <div className="form-row">
                    <label>
                      Canal
                      <select className="select" name="channel" defaultValue="note">
                        {ACTION_CHANNELS.map((c) => (
                          <option key={c} value={c}>
                            {ACTION_CHANNEL_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date prévue
                      <input className="input" name="datePrevue" type="datetime-local" />
                    </label>
                  </div>
                  <label>
                    Titre
                    <input className="input" name="titre" required />
                  </label>
                  <label>
                    Contenu
                    <textarea className="textarea" name="contenu" />
                  </label>
                  <button className="btn" type="submit">
                    Ajouter l’action
                  </button>
                </form>
                <div className="actions-list">
                  {(selected.actions ?? []).length === 0 ? (
                    <p className="muted">Aucune action.</p>
                  ) : (
                    (selected.actions ?? []).map((action) => (
                      <article className="action-item" key={action.id}>
                        <header>
                          <div>
                            <strong>{action.titre}</strong>
                            <p className="muted" style={{ margin: "4px 0 0" }}>
                              {ACTION_CHANNEL_LABELS[action.channel]} · {formatDateTime(action.datePrevue)}
                            </p>
                          </div>
                          <span className="badge badge-gray">{ACTION_STATUT_LABELS[action.statut]}</span>
                        </header>
                        {action.contenu ? <p style={{ marginTop: 0 }}>{action.contenu}</p> : null}
                        <div style={{ display: "flex", gap: 8 }}>
                          {action.statut !== "termine" ? (
                            <button className="btn secondary small" type="button" onClick={() => void setActionStatut(action.id, "termine")}>
                              Terminer
                            </button>
                          ) : (
                            <button className="btn secondary small" type="button" onClick={() => void setActionStatut(action.id, "a_faire")}>
                              Réouvrir
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </SidePeek>
    </div>
  );
}
