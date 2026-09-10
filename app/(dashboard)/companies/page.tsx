import { Suspense } from "react";
import { CompaniesWorkspace } from "./companies-workspace";

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompaniesWorkspace />
    </Suspense>
  );
}
