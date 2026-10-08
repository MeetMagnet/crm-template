"use client";

import { useEffect, useState } from "react";
import type { ActionChannel, ActionStatut, PersonCategory, PersonState } from "@prisma/client";
import { CustomFieldInputs } from "@/app/components/custom-column-modal";
import { PropertyRow } from "@/app/components/property-sheet";
import {
  ACTION_CHANNELS,
  ACTION_CHANNEL_LABELS,
  ACTION_STATUT_LABELS,
  PERSON_CATEGORIES,
  PERSON_CATEGORY_LABELS,
  PERSON_CATEGORY_STATE_KEYS,
  PERSON_STATE_LABELS,
  formatDateTime,
} from "@/lib/labels";

type HistoryRow = {
  id: string;
  previousState: PersonState | null;
  newState: PersonState;
  createdAt: string | Date;
};

type ActionRow = {
  id: string;
  channel: ActionChannel;
  titre: string;
  contenu: string;
  statut: ActionStatut;
  datePrevue: string | Date | null;
};

export type ContactSheetData = {
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
  prochaineActionTitre: string | null;
  prochaineActionDate: string | Date | null;
  updatedAt: string | Date;
  actions?: ActionRow[];
  stateHistory?: HistoryRow[];
};

type Draft = {
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
};

function toDraft(contact: ContactSheetData): Draft {
  return {
    prenom: contact.prenom ?? "",
    nom: contact.nom ?? "",
    email: contact.email ?? "",
    telephone: contact.telephone ?? "",
    poste: contact.poste ?? "",
    linkedinUrl: contact.linkedinUrl ?? "",
    description: contact.description ?? "",
    adresse: contact.adresse ?? "",
    pays: contact.pays ?? "",
    source: contact.source ?? "",
    category: contact.category,
    state: contact.state,
    companyId: contact.companyId ?? "",
  };
}

export function ContactSheet({
  contact,
  creating,
  companies,
  customColumns,
  customFields,
  onCustomFields,
  saving,
  error,
  onSave,
  onCreateAction,
  onSetStatut,
}: {
  contact: ContactSheetData;
  creating: boolean;
  companies: Array<{ id: string; nom: string }>;
  customColumns: Array<{ key: string; label: string; type: string }>;
  customFields: Record<string, unknown>;
  onCustomFields: (next: Record<string, unknown>) => void;
  saving: boolean;
  error: string;
  onSave: (draft: Draft, fields: Record<string, unknown>) => void;
  onCreateAction: (input: { channel: ActionChannel; titre: string; contenu: string; datePrevue: string }) => void;
  onSetStatut: (actionId: string, statut: ActionStatut) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(contact));
  const [tab, setTab] = useState<"info" | "actions">("info");
  const [actionChannel, setActionChannel] = useState<ActionChannel>("note");
  const [actionTitle, setActionTitle] = useState("");
  const [actionBody, setActionBody] = useState("");
  const [actionDate, setActionDate] = useState("");

  useEffect(() => {
    setDraft(toDraft(contact));
    setTab("info");
  }, [contact.id]);

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      category: contact.category,
      state: contact.state,
      companyId: contact.companyId ?? current.companyId,
    }));
  }, [contact.updatedAt, contact.category, contact.state, contact.companyId]);

  function commit(patch: Partial<Draft>, fields = customFields) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!creating) onSave(next, fields);
    return next;
  }

  const showDetails = Boolean(draft.adresse || draft.pays || draft.description);
  const history = contact.stateHistory ?? [];

  return (
    <>
      <div className="tabs">
        <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>
          Informations
        </button>
        <button type="button" className={tab === "actions" ? "active" : ""} onClick={() => setTab("actions")} disabled={creating}>
          Actions
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {tab === "info" ? (
        <div className="prop-sheet">
          <PropertyRow label="Prénom">
            <input className="input" value={draft.prenom} onChange={(e) => setDraft({ ...draft, prenom: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="Nom">
            <input className="input" value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="E-mail">
            <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="Téléphone">
            <input className="input" value={draft.telephone} onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="Poste">
            <input className="input" value={draft.poste} onChange={(e) => setDraft({ ...draft, poste: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="Entreprise">
            <select className="select" value={draft.companyId} onChange={(e) => commit({ companyId: e.target.value })}>
              <option value="">Aucune</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.nom}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="Catégorie">
            <select className="select" value={draft.category} onChange={(e) => commit({ category: e.target.value as PersonCategory })}>
              {PERSON_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {PERSON_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="État">
            <select className="select" value={draft.state} onChange={(e) => commit({ state: e.target.value as PersonState })}>
              {PERSON_CATEGORIES.every((category) => !PERSON_CATEGORY_STATE_KEYS[category].includes(draft.state)) ? (
                <option value={draft.state}>{PERSON_STATE_LABELS[draft.state]}</option>
              ) : null}
              {PERSON_CATEGORIES.map((category) => (
                <optgroup key={category} label={PERSON_CATEGORY_LABELS[category]}>
                  {PERSON_CATEGORY_STATE_KEYS[category].map((state) => (
                    <option key={state} value={state}>
                      {PERSON_STATE_LABELS[state]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="LinkedIn">
            <input className="input" value={draft.linkedinUrl} onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <PropertyRow label="Provenance">
            <input className="input" value={draft.source} placeholder="Site, LinkedIn, salon…" onChange={(e) => setDraft({ ...draft, source: e.target.value })} onBlur={() => commit({})} />
          </PropertyRow>
          <div
            onBlur={() => {
              if (!creating) commit({}, customFields);
            }}
          >
            <CustomFieldInputs
              layout="rows"
              columns={customColumns}
              values={customFields}
              onChange={(key, value) => onCustomFields({ ...customFields, [key]: value })}
            />
          </div>
          <details className="prop-details" open={showDetails}>
            <summary>Adresse et description</summary>
            <PropertyRow label="Adresse">
              <input className="input" value={draft.adresse} onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} onBlur={() => commit({})} />
            </PropertyRow>
            <PropertyRow label="Pays">
              <input className="input" value={draft.pays} onChange={(e) => setDraft({ ...draft, pays: e.target.value })} onBlur={() => commit({})} />
            </PropertyRow>
            <PropertyRow label="Description">
              <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => commit({})} />
            </PropertyRow>
          </details>
          {contact.prochaineActionTitre ? (
            <p className="prop-note">
              Prochaine action : {contact.prochaineActionTitre}
              {contact.prochaineActionDate ? ` · ${formatDateTime(contact.prochaineActionDate)}` : ""}
            </p>
          ) : null}
          {history.length > 0 ? (
            <div className="prop-history">
              <p className="prop-label">Parcours</p>
              <ul>
                {history.slice(0, 6).map((row) => (
                  <li key={row.id}>
                    <span>{formatDateTime(row.createdAt)}</span>
                    {row.previousState ? PERSON_STATE_LABELS[row.previousState] : "Création"} → {PERSON_STATE_LABELS[row.newState]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="prop-actions">
            <span className="sheet-status">{saving ? "Enregistrement…" : creating ? "" : "Les changements sont enregistrés au fil de la saisie."}</span>
            {creating ? (
              <button className="btn" type="button" disabled={saving} onClick={() => onSave(draft, customFields)}>
                Créer le contact
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="prop-sheet">
          <PropertyRow label="Canal">
            <select className="select" value={actionChannel} onChange={(e) => setActionChannel(e.target.value as ActionChannel)}>
              {ACTION_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {ACTION_CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
          </PropertyRow>
          <PropertyRow label="Titre">
            <input className="input" value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} />
          </PropertyRow>
          <PropertyRow label="Quand">
            <input className="input" type="datetime-local" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
          </PropertyRow>
          <PropertyRow label="Note">
            <textarea className="textarea" value={actionBody} onChange={(e) => setActionBody(e.target.value)} />
          </PropertyRow>
          <div className="prop-actions">
            <button
              className="btn"
              type="button"
              disabled={!actionTitle.trim()}
              onClick={() => {
                onCreateAction({
                  channel: actionChannel,
                  titre: actionTitle.trim(),
                  contenu: actionBody,
                  datePrevue: actionDate,
                });
                setActionTitle("");
                setActionBody("");
                setActionDate("");
              }}
            >
              Ajouter l’action
            </button>
          </div>
          <div className="actions-list">
            {(contact.actions ?? []).length === 0 ? (
              <p className="muted">Aucune action.</p>
            ) : (
              (contact.actions ?? []).map((action) => (
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
                  {action.statut !== "termine" ? (
                    <button className="btn secondary small" type="button" onClick={() => onSetStatut(action.id, "termine")}>
                      Terminer
                    </button>
                  ) : (
                    <button className="btn secondary small" type="button" onClick={() => onSetStatut(action.id, "a_faire")}>
                      Réouvrir
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
