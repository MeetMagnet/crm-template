"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, useState } from "react";
import { CONTACT_STATUTS, CONTACT_STATUT_LABELS } from "@/lib/labels";
import type { ContactStatut } from "@prisma/client";

type Card = {
  id: string;
  nom: string;
  email: string | null;
  statut: ContactStatut;
  company: { nom: string } | null;
};

export function PipelineBoard({ contacts }: { contacts: Card[] }) {
  const router = useRouter();
  const [items, setItems] = useState(contacts);

  async function move(contactId: string, statut: ContactStatut) {
    setItems((current) =>
      current.map((item) => (item.id === contactId ? { ...item, statut } : item)),
    );
    const res = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (!res.ok) {
      router.refresh();
      return;
    }
    router.refresh();
  }

  function onDrop(event: DragEvent<HTMLElement>, statut: ContactStatut) {
    event.preventDefault();
    const contactId = event.dataTransfer.getData("text/plain");
    if (contactId) void move(contactId, statut);
  }

  return (
    <div className="pipeline">
      {CONTACT_STATUTS.map((statut) => {
        const column = items.filter((item) => item.statut === statut);
        return (
          <section
            className="column"
            key={statut}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, statut)}
          >
            <h2>
              <span>{CONTACT_STATUT_LABELS[statut]}</span>
              <span className="muted">{column.length}</span>
            </h2>
            {column.map((contact) => (
              <article
                className="kanban-card"
                draggable
                key={contact.id}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", contact.id)}
              >
                <h3>
                  <Link href={`/contacts/${contact.id}`}>{contact.nom}</Link>
                </h3>
                <p className="muted" style={{ margin: 0 }}>
                  {contact.company?.nom ?? contact.email ?? "Sans entreprise"}
                </p>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
