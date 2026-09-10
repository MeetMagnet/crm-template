import { Suspense } from "react";
import { ActionsWorkspace } from "./actions-workspace";

export default function ActionsPage() {
  return (
    <Suspense>
      <ActionsWorkspace />
    </Suspense>
  );
}
