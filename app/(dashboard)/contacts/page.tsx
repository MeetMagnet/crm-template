import { Suspense } from "react";
import { listCompanies } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { ContactsWorkspace } from "./contacts-workspace";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; state?: string }>;
}) {
  const params = await searchParams;
  const [contacts, companies] = await Promise.all([
    listContacts({ q: params.q, category: params.category, state: params.state }),
    listCompanies(),
  ]);

  return (
    <Suspense>
      <ContactsWorkspace
        initialContacts={contacts.map((c) => ({
          ...c,
          prochaineActionDate: c.prochaineActionDate,
          updatedAt: c.updatedAt,
          actions: undefined,
        }))}
        companies={companies.map((c) => ({ id: c.id, nom: c.nom }))}
      />
    </Suspense>
  );
}
