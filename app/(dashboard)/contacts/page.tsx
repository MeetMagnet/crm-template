import Link from "next/link";
import { Suspense } from "react";
import { listContacts } from "@/lib/contacts";
import { CONTACT_STATUT_LABELS, formatDate } from "@/lib/labels";
import { ContactFilters } from "./filters";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const contacts = await listContacts({ q: params.q, statut: params.statut });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Contacts</h1>
          <p>Créer, rechercher et suivre vos interlocuteurs.</p>
        </div>
        <Link className="btn" href="/contacts/nouveau">
          Nouveau contact
        </Link>
      </header>

      <Suspense>
        <ContactFilters currentStatut={params.statut} />
      </Suspense>

      <section className="card">
        {contacts.length === 0 ? (
          <p className="empty">Aucun contact. Créez-en un pour commencer.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Entreprise</th>
                  <th>E-mail</th>
                  <th>Téléphone</th>
                  <th>Statut</th>
                  <th>Mise à jour</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr className="row-link" key={contact.id}>
                    <td>
                      <Link href={`/contacts/${contact.id}`}>{contact.nom}</Link>
                    </td>
                    <td>
                      {contact.company ? (
                        <Link href={`/companies/${contact.company.id}`}>{contact.company.nom}</Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{contact.email ?? "—"}</td>
                    <td>{contact.telephone ?? "—"}</td>
                    <td>
                      <span className={`badge badge-${contact.statut}`}>
                        {CONTACT_STATUT_LABELS[contact.statut]}
                      </span>
                    </td>
                    <td className="muted">{formatDate(contact.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
