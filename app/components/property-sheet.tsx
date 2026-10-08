import type { ReactNode } from "react";

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop-row">
      <div className="prop-label">{label}</div>
      <div className="prop-value">{children}</div>
    </div>
  );
}
