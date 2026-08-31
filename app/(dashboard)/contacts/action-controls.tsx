"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ActionControls({ id, statut }: { id: string; statut: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setPending(true);
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      alert("Mise à jour impossible");
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {statut !== "en_cours" && statut !== "termine" ? (
        <button className="btn secondary small" disabled={pending} onClick={() => patch({ statut: "en_cours" })} type="button">
          Démarrer
        </button>
      ) : null}
      {statut !== "termine" ? (
        <button className="btn small" disabled={pending} onClick={() => patch({ cloturer: true })} type="button">
          Clôturer
        </button>
      ) : null}
    </div>
  );
}
