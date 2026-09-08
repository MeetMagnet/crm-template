"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidePeek } from "@/app/components/side-peek";
import { contactDisplayName } from "@/lib/labels";

type CompanyRow = {
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
  _count?: { contacts: number };
  contacts?: Array<{
    id: string;
    prenom: string;
    nom: string;
    email: string | null;
    category: string;
    state: string;
  }>;
};

export function CompaniesWorkspace({ initialCompanies }: { initialCompanies: CompanyRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [companies, setCompanies] = useState(initialCompanies);
  const [selected, setSelected] = useState<CompanyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"info" | "notes" | "contacts">("info");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCompanies(initialCompanies), [initialCompanies]);

  useEffect(() => {
    const id = searchParams.get("company");
    if (id) void openCompany(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return companies;
    const needle = q.trim().toLowerCase();
    return companies.filter((c) =>
      `${c.nom} ${c.email ?? ""} ${c.siteWeb ?? ""} ${c.siret ?? ""}`.toLowerCase().includes(needle),
    );
  }, [companies, q]);

  async function openCompany(id: string) {
    const res = await fetch(`/api/companies/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data);
    setCreating(false);
    setTab("info");
    const params = new URLSearchParams(searchParams.toString());
    params.set("company", id);
    router.replace(`/companies?${params.toString()}`);
  }

  function closePeek() {
    setSelected(null);
    setCreating(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("company");
    const qs = params.toString();
    router.replace(qs ? `/companies?${qs}` : "/companies");
  }

  function openCreate() {
    setCreating(true);
    setSelected({
      id: "",
      nom: "",
      email: "",
      telephone: "",
      adresse: "",
      siteWeb: "",
      siret: "",
      linkedinUrl: "",
      description: "",
      notes: "",
      contacts: [],
    });
    setTab("info");
  }

  async function saveCompany(form: FormData) {
    if (!selected) return;
    setSaving(true);
    setError("");
    const payload = {
      nom: String(form.get("nom") ?? ""),
      email: String(form.get("email") ?? "") || null,
      telephone: String(form.get("telephone") ?? "") || null,
      adresse: String(form.get("adresse") ?? "") || null,
      siteWeb: String(form.get("siteWeb") ?? "") || null,
      siret: String(form.get("siret") ?? "") || null,
      linkedinUrl: String(form.get("linkedinUrl") ?? "") || null,
      description: String(form.get("description") ?? "") || null,
      notes: String(form.get("notes") ?? "") || null,
    };
    const url = creating || !selected.id ? "/api/companies" : `/api/companies/${selected.id}`;
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
    setCompanies((prev) => {
      const others = prev.filter((c) => c.id !== saved.id);
      return [...others, { ...saved, _count: { contacts: saved.contacts?.length ?? 0 } }].sort((a, b) =>
        a.nom.localeCompare(b.nom),
      );
    });
    router.refresh();
  }

  async function deleteCompany() {
    if (!selected?.id || creating) return;
    if (!confirm(`Supprimer ${selected.nom} ?`)) return;
    const res = await fetch(`/api/companies/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setCompanies((prev) => prev.filter((c) => c.id !== selected.id));
    closePeek();
    router.refresh();
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Entreprises</h1>
        <input
          className="input toolbar-input"
          placeholder="Rechercher (nom, site…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="button" onClick={openCreate}>
          Nouvelle entreprise
        </button>
      </div>
      <div className="page-body">
        {filtered.length === 0 ? (
          <p className="empty">Aucune entreprise.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Site</th>
                  <th>E-mail</th>
                  <th>Contacts</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => (
                  <tr className="row-link" key={company.id} onClick={() => void openCompany(company.id)}>
                    <td>{company.nom}</td>
                    <td>{company.siteWeb ?? "—"}</td>
                    <td>{company.email ?? "—"}</td>
                    <td>{company._count?.contacts ?? company.contacts?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SidePeek
        open={!!selected}
        title={creating || !selected?.id ? "Nouvelle entreprise" : selected.nom || "Sans nom"}
        onClose={closePeek}
        actions={
          selected?.id && !creating ? (
            <button className="btn danger small" type="button" onClick={() => void deleteCompany()}>
              Supprimer
            </button>
          ) : null
        }
      >
        {selected ? (
          <>
            <div className="tabs">
              <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>
                Informations
              </button>
              <button type="button" className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>
                Notes
              </button>
              <button
                type="button"
                className={tab === "contacts" ? "active" : ""}
                onClick={() => setTab("contacts")}
                disabled={creating || !selected.id}
              >
                Contacts
              </button>
            </div>
            {error ? <p className="error">{error}</p> : null}
            {tab === "contacts" ? (
              <div className="actions-list">
                {(selected.contacts ?? []).length === 0 ? (
                  <p className="muted">Aucun contact rattaché.</p>
                ) : (
                  (selected.contacts ?? []).map((c) => (
                    <a key={c.id} className="action-item" href={`/contacts?contact=${c.id}`}>
                      <strong>{contactDisplayName(c)}</strong>
                      <div className="muted">{c.email ?? "—"}</div>
                    </a>
                  ))
                )}
              </div>
            ) : (
              <form
                className="form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveCompany(new FormData(e.currentTarget));
                }}
              >
                {tab === "info" ? (
                  <>
                    <label>
                      Nom
                      <input className="input" name="nom" required defaultValue={selected.nom} />
                    </label>
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
                    <label>
                      Site web
                      <input className="input" name="siteWeb" defaultValue={selected.siteWeb ?? ""} />
                    </label>
                    <label>
                      SIRET
                      <input className="input" name="siret" defaultValue={selected.siret ?? ""} />
                    </label>
                    <label>
                      LinkedIn
                      <input className="input" name="linkedinUrl" defaultValue={selected.linkedinUrl ?? ""} />
                    </label>
                    <label>
                      Adresse
                      <input className="input" name="adresse" defaultValue={selected.adresse ?? ""} />
                    </label>
                    <label>
                      Description
                      <textarea className="textarea" name="description" defaultValue={selected.description ?? ""} />
                    </label>
                    <input type="hidden" name="notes" defaultValue={selected.notes ?? ""} />
                  </>
                ) : (
                  <>
                    <input type="hidden" name="nom" defaultValue={selected.nom} />
                    <input type="hidden" name="email" defaultValue={selected.email ?? ""} />
                    <input type="hidden" name="telephone" defaultValue={selected.telephone ?? ""} />
                    <input type="hidden" name="siteWeb" defaultValue={selected.siteWeb ?? ""} />
                    <input type="hidden" name="siret" defaultValue={selected.siret ?? ""} />
                    <input type="hidden" name="linkedinUrl" defaultValue={selected.linkedinUrl ?? ""} />
                    <input type="hidden" name="adresse" defaultValue={selected.adresse ?? ""} />
                    <input type="hidden" name="description" defaultValue={selected.description ?? ""} />
                    <label>
                      Notes
                      <textarea className="textarea" name="notes" defaultValue={selected.notes ?? ""} />
                    </label>
                  </>
                )}
                <button className="btn" disabled={saving} type="submit">
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </form>
            )}
          </>
        ) : null}
      </SidePeek>
    </div>
  );
}
