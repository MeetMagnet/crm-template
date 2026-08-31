import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CONTACT_STATUTS, CONTACT_STATUT_LABELS, formatDateTime } from "@/lib/labels";

export default async function DashboardPage() {
  const [contactCount, companyCount, openActions, clients, recentActions] = await Promise.all([
    prisma.contact.count(),
    prisma.company.count(),
    prisma.action.count({ where: { statut: { not: "termine" } } }),
    prisma.contact.count({ where: { statut: "client" } }),
    prisma.action.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
  ]);

  const byStatut = await prisma.contact.groupBy({
    by: ["statut"],
    _count: { _all: true },
  });
  const counts = Object.fromEntries(byStatut.map((row) => [row.statut, row._count._all]));

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d’ensemble des contacts, du pipeline et des actions en cours.</p>
        </div>
        <Link className="btn" href="/contacts/nouveau">
          Nouveau contact
        </Link>
      </header>

      <section className="stats">
        <div className="card stat">
          <span>Contacts</span>
          <strong>{contactCount}</strong>
        </div>
        <div className="card stat">
          <span>Entreprises</span>
          <strong>{companyCount}</strong>
        </div>
        <div className="card stat">
          <span>Clients</span>
          <strong>{clients}</strong>
        </div>
        <div className="card stat">
          <span>Actions ouvertes</span>
          <strong>{openActions}</strong>
        </div>
      </section>

      <section className="stats">
        {CONTACT_STATUTS.map((statut) => (
          <div className="card stat" key={statut}>
            <span>{CONTACT_STATUT_LABELS[statut]}</span>
            <strong>{counts[statut] ?? 0}</strong>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="page-header" style={{ padding: "16px 16px 0" }}>
          <h1 style={{ fontSize: 18 }}>Dernières actions</h1>
          <Link href="/pipeline">Voir le pipeline</Link>
        </div>
        {recentActions.length === 0 ? (
          <p className="empty">Aucune action pour le moment.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Contact</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActions.map((action) => (
                  <tr key={action.id}>
                    <td>{action.titre}</td>
                    <td>
                      <Link href={`/contacts/${action.contactId}`}>{action.contact.nom}</Link>
                    </td>
                    <td className="muted">{formatDateTime(action.createdAt)}</td>
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
