"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ActionForm({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      contactId,
      type: String(form.get("type") ?? "note"),
      titre: String(form.get("titre") ?? ""),
      contenu: String(form.get("contenu") ?? ""),
      statut: String(form.get("statut") ?? "a_faire"),
      datePrevue: String(form.get("datePrevue") ?? "") || null,
    };

    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Création impossible");
      setPending(false);
      return;
    }

    formEl.reset();
    setPending(false);
    router.refresh();
  }

  return (
    <form className="card form-grid" onSubmit={onSubmit}>
      <label>
        Titre
        <input className="input" name="titre" required placeholder="Ex. Relance téléphonique" />
      </label>
      <div className="form-row">
        <label>
          Type
          <select className="select" name="type" defaultValue="note">
            <option value="note">Note</option>
            <option value="appel">Appel</option>
            <option value="email">E-mail</option>
            <option value="rendez_vous">Rendez-vous</option>
            <option value="autre">Autre</option>
          </select>
        </label>
        <label>
          Statut
          <select className="select" name="statut" defaultValue="a_faire">
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>
        </label>
      </div>
      <label>
        Date prévue
        <input className="input" name="datePrevue" type="datetime-local" />
      </label>
      <label>
        Contenu
        <textarea className="textarea" name="contenu" placeholder="Détails de l'action" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <div>
        <button className="btn" disabled={pending} type="submit">
          {pending ? "Ajout…" : "Ajouter l'action"}
        </button>
      </div>
    </form>
  );
}
