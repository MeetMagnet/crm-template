"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type CompanyFormProps = {
  company?: {
    id: string;
    nom: string;
    email: string | null;
    telephone: string | null;
    adresse: string | null;
    siteWeb: string | null;
    notes: string | null;
  };
};

export function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      nom: String(form.get("nom") ?? ""),
      email: String(form.get("email") ?? ""),
      telephone: String(form.get("telephone") ?? ""),
      adresse: String(form.get("adresse") ?? ""),
      siteWeb: String(form.get("siteWeb") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    const url = company ? `/api/companies/${company.id}` : "/api/companies";
    const res = await fetch(url, {
      method: company ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Enregistrement impossible");
      setPending(false);
      return;
    }

    const saved = await res.json();
    router.push(`/companies/${saved.id}`);
    router.refresh();
  }

  return (
    <form className="card form-grid" onSubmit={onSubmit}>
      <label>
        Nom
        <input className="input" name="nom" required defaultValue={company?.nom ?? ""} />
      </label>
      <div className="form-row">
        <label>
          E-mail
          <input className="input" name="email" type="email" defaultValue={company?.email ?? ""} />
        </label>
        <label>
          Téléphone
          <input className="input" name="telephone" defaultValue={company?.telephone ?? ""} />
        </label>
      </div>
      <label>
        Adresse
        <input className="input" name="adresse" defaultValue={company?.adresse ?? ""} />
      </label>
      <label>
        Site web
        <input className="input" name="siteWeb" defaultValue={company?.siteWeb ?? ""} />
      </label>
      <label>
        Notes
        <textarea className="textarea" name="notes" defaultValue={company?.notes ?? ""} />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <div>
        <button className="btn" disabled={pending} type="submit">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
