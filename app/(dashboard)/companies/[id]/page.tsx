import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";
import { CONTACT_STATUT_LABELS } from "@/lib/labels";
import { CompanyForm } from "../company-form";
import { DeleteCompanyButton } from "../delete-button";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{company.nom}</h1>
          <p>{company.adresse || "Pas d’adresse renseignée"}</p>
        </div>
        <DeleteCompanyButton id={company.id} nom={company.nom} />
      </header>

      <div className="detail-grid">
        <section>
          <h2 style={{ marginTop: 0 }}>Fiche</h2>
          <CompanyForm
            company={{
              id: company.id,
              nom: company.nom,
              email: company.email,
              telephone: company.telephone,
              adresse: company.adresse,
              siteWeb: company.siteWeb,
              notes: company.notes,
            }}
          />
        </section>
        <section>
          <h2 style={{ marginTop: 0 }}>Contacts</h2>
          <div className="card">
            {company.contacts.length === 0 ? (
              <p className="empty">Aucun contact rattaché.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.contacts.map((contact) => (
                      <tr key={contact.id}>
                        <td>
                          <Link href={`/contacts/${contact.id}`}>{contact.nom}</Link>
                        </td>
                        <td>
                          <span className={`badge badge-${contact.statut}`}>
                            {CONTACT_STATUT_LABELS[contact.statut]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
