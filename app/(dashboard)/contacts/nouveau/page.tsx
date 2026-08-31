import { listCompanies } from "@/lib/companies";
import { ContactForm } from "../contact-form";

export default async function NewContactPage() {
  const companies = await listCompanies();

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Nouveau contact</h1>
          <p>Ajoutez un interlocuteur au pipeline.</p>
        </div>
      </header>
      <ContactForm companies={companies.map((c) => ({ id: c.id, nom: c.nom }))} />
    </>
  );
}
