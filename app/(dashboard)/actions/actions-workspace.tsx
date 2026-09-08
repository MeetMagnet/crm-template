"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionChannel, ActionStatut, PersonCategory } from "@prisma/client";
import {
  ACTION_CHANNELS,
  ACTION_CHANNEL_LABELS,
  ACTION_STATUTS,
  ACTION_STATUT_LABELS,
  PERSON_CATEGORIES,
  PERSON_CATEGORY_LABELS,
  contactDisplayName,
  formatDateTime,
} from "@/lib/labels";

type ActionRow = {
  id: string;
  channel: ActionChannel;
  titre: string;
  contenu: string;
  statut: ActionStatut;
  datePrevue: string | Date | null;
  contact: {
    id: string;
    prenom: string;
    nom: string;
    category: PersonCategory;
    company: { nom: string } | null;
  };
};

export function ActionsWorkspace({ initialActions }: { initialActions: ActionRow[] }) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("");
  const [statut, setStatut] = useState("");
  const [contactCategory, setContactCategory] = useState("");

  useEffect(() => setActions(initialActions), [initialActions]);

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (channel && a.channel !== channel) return false;
      if (statut && a.statut !== statut) return false;
      if (contactCategory && a.contact.category !== contactCategory) return false;
      if (!q.trim()) return true;
      const hay = `${a.titre} ${a.contenu} ${a.contact.prenom} ${a.contact.nom}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [actions, channel, statut, contactCategory, q]);

  async function setActionStatut(id: string, next: ActionStatut) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, statut: next } : a)));
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: next }),
    });
    if (!res.ok) router.refresh();
    else router.refresh();
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Actions</h1>
        <input
          className="input toolbar-input"
          placeholder="Rechercher (titre, contact…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" style={{ width: 140 }} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Tous canaux</option>
          {ACTION_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {ACTION_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 140 }} value={statut} onChange={(e) => setStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          {ACTION_STATUTS.map((s) => (
            <option key={s} value={s}>
              {ACTION_STATUT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 150 }}
          value={contactCategory}
          onChange={(e) => setContactCategory(e.target.value)}
        >
          <option value="">Tous contacts</option>
          {PERSON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PERSON_CATEGORY_LABELS[c]}
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
      </div>

      <div className="page-body">
        {viewMode === "list" ? (
          filtered.length === 0 ? (
            <p className="empty">Aucune action.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Titre</th>
                    <th>Contact</th>
                    <th>Canal</th>
                    <th>Statut</th>
                    <th>Date prévue</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((action) => (
                    <tr
                      className="row-link"
                      key={action.id}
                      onClick={() => {
                        window.location.href = `/contacts?contact=${action.contact.id}`;
                      }}
                    >
                      <td>{action.titre}</td>
                      <td>
                        {contactDisplayName(action.contact)}
                        <div className="muted">{action.contact.company?.nom ?? ""}</div>
                      </td>
                      <td>{ACTION_CHANNEL_LABELS[action.channel]}</td>
                      <td>
                        <span className="badge badge-gray">{ACTION_STATUT_LABELS[action.statut]}</span>
                      </td>
                      <td className="muted">{formatDateTime(action.datePrevue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="pipeline">
            {ACTION_STATUTS.map((col) => {
              const items = filtered.filter((a) => a.statut === col);
              return (
                <section
                  className="column"
                  key={col}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) void setActionStatut(id, col);
                  }}
                >
                  <h2>
                    <span>{ACTION_STATUT_LABELS[col]}</span>
                    <span className="muted">{items.length}</span>
                  </h2>
                  {items.map((action) => (
                    <article
                      className="kanban-card"
                      draggable
                      key={action.id}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", action.id)}
                      onClick={() => {
                        window.location.href = `/contacts?contact=${action.contact.id}`;
                      }}
                    >
                      <h3>{action.titre}</h3>
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
    </div>
  );
}
