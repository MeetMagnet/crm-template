"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent } from "react";

export function ContactFilters({ currentStatut }: { currentStatut?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    const q = String(form.get("q") ?? "").trim();
    const statut = String(form.get("statut") ?? "");
    if (q) params.set("q", q);
    if (statut) params.set("statut", statut);
    router.push(`/contacts${params.size ? `?${params}` : ""}`);
  }

  return (
    <form className="toolbar" onSubmit={onSubmit}>
      <input
        className="input"
        name="q"
        placeholder="Rechercher un contact…"
        defaultValue={searchParams.get("q") ?? ""}
        style={{ maxWidth: 280 }}
      />
      <select className="select" name="statut" defaultValue={currentStatut ?? ""} style={{ maxWidth: 180 }}>
        <option value="">Tous les statuts</option>
        <option value="lead">Lead</option>
        <option value="contacte">Contacté</option>
        <option value="rdv">RDV</option>
        <option value="client">Client</option>
        <option value="perdu">Perdu</option>
      </select>
      <button className="btn secondary" type="submit">
        Filtrer
      </button>
    </form>
  );
}
