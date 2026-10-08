import type { ReactNode } from "react";

export function PropertyRow({
  label,
  emoji,
  children,
}: {
  label: string;
  emoji?: string;
  children: ReactNode;
}) {
  return (
    <div className="prop-row">
      <div className="prop-label">
        {emoji ? (
          <span className="prop-emoji" aria-hidden="true">
            {emoji}
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="prop-value">{children}</div>
    </div>
  );
}
