import Link from "next/link";
import { notFound } from "next/navigation";
import { listCompanies } from "@/lib/companies";
import { getContact } from "@/lib/contacts";
import {
  ACTION_STATUT_LABELS,
  ACTION_TYPE_LABELS,
  CONTACT_STATUT_LABELS,
  formatDateTime,
} from "@/lib/labels";
import { ActionControls } from "../action-controls";
import { ActionForm } from "../action-form";
import { ContactForm } from "../contact-form";
import { DeleteContactButton } from "../delete-button";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, companies] = await Promise.all([getContact(id), listCompanies()]);
  if (!contact) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{contact.nom}</h1>
          <p>
            <span className={`badge badge-${contact.statut}`}>{CONTACT_STATUT_LABELS[contact.statut]}</span>
            {contact.company ? (
              <>
                {" "}
                · <Link href={`/companies/${contact.company.id}`}>{contact.company.nom}</Link>
              </>
            ) : null}
          </p>
        </div>
        <DeleteContactButton id={contact.id} nom={contact.nom} />
      </header>

      <div className="detail-grid">
        <section>
          <h2 style={{ marginTop: 0 }}>Fiche</h2>
          <ContactForm
            companies={companies.map((c) => ({ id: c.id, nom: c.nom }))}
            contact={{
              id: contact.id,
              nom: contact.nom,
              email: contact.email,
              telephone: contact.telephone,
              statut: contact.statut,
              companyId: contact.companyId,
            }}
          />
        </section>
        <section>
          <h2 style={{ marginTop: 0 }}>Nouvelle action</h2>
          <ActionForm contactId={contact.id} />
        </section>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>Actions</h2>
        {contact.actions.length === 0 ? (
          <p className="empty card">Aucune action liée à ce contact.</p>
        ) : (
          <div className="actions-list">
            {contact.actions.map((action) => (
              <article className="card action-item" key={action.id}>
                <header>
                  <div>
                    <strong>{action.titre}</strong>
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      {ACTION_TYPE_LABELS[action.type]} · prévu {formatDateTime(action.datePrevue)}
                      {action.dateRealisation ? ` · réalisé ${formatDateTime(action.dateRealisation)}` : ""}
                    </p>
                  </div>
                  <span className={`badge badge-${action.statut}`}>{ACTION_STATUT_LABELS[action.statut]}</span>
                </header>
                {action.contenu ? <p style={{ marginBottom: 12 }}>{action.contenu}</p> : null}
                <ActionControls id={action.id} statut={action.statut} />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
