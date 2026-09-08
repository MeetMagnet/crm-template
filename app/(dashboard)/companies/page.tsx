import { Suspense } from "react";
import { listCompanies } from "@/lib/companies";
import { CompaniesWorkspace } from "./companies-workspace";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <Suspense>
      <CompaniesWorkspace initialCompanies={companies} />
    </Suspense>
  );
}
