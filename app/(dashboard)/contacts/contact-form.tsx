"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; nom: string };

type ContactFormProps = {
  companies: Option[];
  contact?: {
    id: string;
    nom: string;
    email: string | null;
    telephone: string | null;
    statut: string;
    companyId: string | null;
  };
};

export function ContactForm({ companies, contact }: ContactFormProps) {
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
      statut: String(form.get("statut") ?? "lead"),
      companyId: String(form.get("companyId") ?? "") || null,
    };

    const url = contact ? `/api/contacts/${contact.id}` : "/api/contacts";
    const res = await fetch(url, {
      method: contact ? "PATCH" : "POST",
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
    router.push(`/contacts/${saved.id}`);
    router.refresh();
  }

  return (
    <form className="card form-grid" onSubmit={onSubmit}>
      <label>
        Nom
        <input className="input" name="nom" required defaultValue={contact?.nom ?? ""} />
      </label>
      <div className="form-row">
        <label>
          E-mail
          <input className="input" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </label>
        <label>
          Téléphone
          <input className="input" name="telephone" defaultValue={contact?.telephone ?? ""} />
        </label>
      </div>
      <div className="form-row">
        <label>
          Statut
          <select className="select" name="statut" defaultValue={contact?.statut ?? "lead"}>
            <option value="lead">Lead</option>
            <option value="contacte">Contacté</option>
            <option value="rdv">RDV</option>
            <option value="client">Client</option>
            <option value="perdu">Perdu</option>
          </select>
        </label>
        <label>
          Entreprise
          <select className="select" name="companyId" defaultValue={contact?.companyId ?? ""}>
            <option value="">Aucune</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div>
        <button className="btn" disabled={pending} type="submit">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
