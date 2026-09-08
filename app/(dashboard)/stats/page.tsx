import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PERSON_CATEGORIES,
  PERSON_CATEGORY_LABELS,
  PERSON_STATE_LABELS,
  contactDisplayName,
  formatDate,
} from "@/lib/labels";
import type { PersonState } from "@prisma/client";

export default async function StatsPage() {
  const [byCategory, byState, openActions, overdueContacts, recentHistory] = await Promise.all([
    prisma.contact.groupBy({ by: ["category"], _count: { _all: true } }),
    prisma.contact.groupBy({ by: ["state"], _count: { _all: true } }),
    prisma.action.count({ where: { statut: { not: "termine" } } }),
    prisma.contact.findMany({
      where: {
        prochaineActionDate: { lt: new Date() },
        NOT: { prochaineActionTitre: null },
      },
      take: 10,
      orderBy: { prochaineActionDate: "asc" },
      include: { company: true },
    }),
    prisma.contactStateHistory.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { contact: true },
    }),
  ]);

  const categoryCounts = Object.fromEntries(byCategory.map((r) => [r.category, r._count._all]));
  const stateCounts = Object.fromEntries(byState.map((r) => [r.state, r._count._all]));

  return (
    <div className="page">
      <div className="page-toolbar">
        <div>
          <h1>Statistiques</h1>
        </div>
      </div>

      <div className="stats-grid">
        {PERSON_CATEGORIES.map((cat) => (
          <div className="stat-card" key={cat}>
            <span>{PERSON_CATEGORY_LABELS[cat]}</span>
            <strong>{categoryCounts[cat] ?? 0}</strong>
          </div>
        ))}
        <div className="stat-card">
          <span>Actions ouvertes</span>
          <strong>{openActions}</strong>
        </div>
      </div>

      <section style={{ padding: "0 16px 24px" }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Répartition par état</h2>
        <div className="stats-grid" style={{ padding: 0 }}>
          {(Object.keys(stateCounts) as PersonState[])
            .sort((a, b) => (stateCounts[b] ?? 0) - (stateCounts[a] ?? 0))
            .map((state) => (
              <div className="stat-card" key={state}>
                <span>{PERSON_STATE_LABELS[state] ?? state}</span>
                <strong>{stateCounts[state] ?? 0}</strong>
              </div>
            ))}
        </div>
      </section>

      <section style={{ padding: "0 16px 24px" }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Actions en retard</h2>
        {overdueContacts.length === 0 ? (
          <p className="muted">Aucune action en retard.</p>
        ) : (
          <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Action</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {overdueContacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/contacts?contact=${c.id}`}>{contactDisplayName(c)}</Link>
                    </td>
                    <td>{c.prochaineActionTitre}</td>
                    <td className="muted">{formatDate(c.prochaineActionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ padding: "0 16px 32px" }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Derniers changements d’état</h2>
        {recentHistory.length === 0 ? (
          <p className="muted">Pas encore d’historique.</p>
        ) : (
          <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Passage</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Link href={`/contacts?contact=${h.contactId}`}>{contactDisplayName(h.contact)}</Link>
                    </td>
                    <td>
                      {h.previousState ? PERSON_STATE_LABELS[h.previousState] : "—"} →{" "}
                      {PERSON_STATE_LABELS[h.newState]}
                    </td>
                    <td className="muted">{formatDate(h.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
