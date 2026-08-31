import { listContacts } from "@/lib/contacts";
import { PipelineBoard } from "./pipeline-board";

export default async function PipelinePage() {
  const contacts = await listContacts();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Pipeline</h1>
          <p>Glissez un contact d’une colonne à l’autre pour changer son statut.</p>
        </div>
      </header>
      <PipelineBoard
        key={contacts.map((c) => `${c.id}:${c.statut}`).join("|")}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          nom: contact.nom,
          email: contact.email,
          statut: contact.statut,
          company: contact.company ? { nom: contact.company.nom } : null,
        }))}
      />
    </>
  );
}
