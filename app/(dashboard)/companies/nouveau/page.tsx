import { CompanyForm } from "../company-form";

export default function NewCompanyPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Nouvelle entreprise</h1>
          <p>Ajoutez une organisation au CRM.</p>
        </div>
      </header>
      <CompanyForm />
    </>
  );
}
