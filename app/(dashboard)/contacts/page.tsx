import { Suspense } from "react";
import { listCompanies } from "@/lib/companies";
import { ContactsWorkspace } from "./contacts-workspace";

export default async function ContactsPage() {
  const companies = await listCompanies({}, { pageSize: 1000 });
  return (
    <Suspense>
      <ContactsWorkspace companies={companies.data.map((c) => ({ id: c.id, nom: c.nom }))} />
    </Suspense>
  );
}
