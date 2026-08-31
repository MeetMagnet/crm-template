"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCompanyButton({ id, nom }: { id: string; nom: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!confirm(`Supprimer l'entreprise « ${nom} » ?`)) return;
    setPending(true);
    const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setPending(false);
      alert("Suppression impossible");
      return;
    }
    router.push("/companies");
    router.refresh();
  }

  return (
    <button className="btn danger" disabled={pending} onClick={onDelete} type="button">
      {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
