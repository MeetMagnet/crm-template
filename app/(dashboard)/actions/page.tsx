import { listActions } from "@/lib/actions";
import { ActionsWorkspace } from "./actions-workspace";

export default async function ActionsPage() {
  const actions = await listActions();
  return <ActionsWorkspace initialActions={actions} />;
}
