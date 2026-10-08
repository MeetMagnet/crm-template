"use client";

import { useEffect, useState } from "react";
import { CustomFieldInputs } from "@/app/components/custom-column-modal";
import { PropertyRow } from "@/app/components/property-sheet";
import { contactDisplayName } from "@/lib/labels";

export type CompanySheetData = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  siteWeb: string | null;
  siret: string | null;
  linkedinUrl: string | null;
  description: string | null;
  notes: string | null;
  contacts?: Array<{ id: string; prenom: string; nom: string; email: string | null }>;
};

type Draft = {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  siteWeb: string;
  siret: string;
  linkedinUrl: string;
  description: string;
  notes: string;
};

function toDraft(company: CompanySheetData): Draft {
  return {
    nom: company.nom ?? "",
    email: company.email ?? "",
    telephone: company.telephone ?? "",
    adresse: company.adresse ?? "",
    siteWeb: company.siteWeb ?? "",
    siret: company.siret ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    description: company.description ?? "",
    notes: company.notes ?? "",
  };
}

export function CompanySheet({
  company,
  creating,
  customColumns,
  customFields,
  onCustomFields,
  saving,
  error,
  onSave,
}: {
  company: CompanySheetData;
  creating: boolean;
  customColumns: Array<{ key: string; label: string; type: string }>;
  customFields: Record<string, unknown>;
  onCustomFields: (next: Record<string, unknown>) => void;
  saving: boolean;
  error: string;
  onSave: (draft: Draft, fields: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(company));

  useEffect(() => {
    setDraft(toDraft(company));
  }, [company.id]);

  function commit(patch: Partial<Draft> = {}, fields = customFields) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!creating && next.nom.trim()) onSave(next, fields);
  }

  const contacts = company.contacts ?? [];

  return (
    <div className="prop-sheet">
      {error ? <p className="error">{error}</p> : null}
      <PropertyRow label="Nom">
        <input className="input" value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="Site web">
        <input className="input" value={draft.siteWeb} onChange={(e) => setDraft({ ...draft, siteWeb: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="E-mail">
        <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="Téléphone">
        <input className="input" value={draft.telephone} onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="LinkedIn">
        <input className="input" value={draft.linkedinUrl} onChange={(e) => setDraft({ ...draft, linkedinUrl: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="SIRET">
        <input className="input" value={draft.siret} onChange={(e) => setDraft({ ...draft, siret: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="Adresse">
        <input className="input" value={draft.adresse} onChange={(e) => setDraft({ ...draft, adresse: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="Description">
        <textarea className="textarea" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <PropertyRow label="Notes">
        <textarea className="textarea" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={() => commit()} />
      </PropertyRow>
      <div
        onBlur={() => {
          if (!creating && draft.nom.trim()) commit({}, customFields);
        }}
      >
        <CustomFieldInputs
          layout="rows"
          columns={customColumns}
          values={customFields}
          onChange={(key, value) => onCustomFields({ ...customFields, [key]: value })}
        />
      </div>
      <div className="prop-actions">
        <span className="sheet-status">{saving ? "Enregistrement…" : creating ? "Le nom est obligatoire." : "Les changements sont enregistrés au fil de la saisie."}</span>
        {creating ? (
          <button className="btn" type="button" disabled={saving || !draft.nom.trim()} onClick={() => onSave(draft, customFields)}>
            Créer l’entreprise
          </button>
        ) : null}
      </div>
      {!creating && company.id ? (
        <div className="prop-history">
          <p className="prop-label">Contacts</p>
          {contacts.length === 0 ? (
            <p className="muted">Aucun contact rattaché.</p>
          ) : (
            <ul>
              {contacts.map((item) => (
                <li key={item.id}>
                  <a href={`/contacts?contact=${item.id}`}>{contactDisplayName(item)}</a>
                  {item.email ? <span className="muted"> · {item.email}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
