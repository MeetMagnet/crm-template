import Link from "next/link";
import { listCompanies } from "@/lib/companies";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const companies = await listCompanies(params.q);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Entreprises</h1>
          <p>Organisations auxquelles sont rattachés vos contacts.</p>
        </div>
        <Link className="btn" href="/companies/nouveau">
          Nouvelle entreprise
        </Link>
      </header>

      <section className="card">
        {companies.length === 0 ? (
          <p className="empty">Aucune entreprise pour le moment.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th>Téléphone</th>
                  <th>Contacts</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr className="row-link" key={company.id}>
                    <td>
                      <Link href={`/companies/${company.id}`}>{company.nom}</Link>
                    </td>
                    <td>{company.email ?? "—"}</td>
                    <td>{company.telephone ?? "—"}</td>
                    <td>{company._count.contacts}</td>
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
