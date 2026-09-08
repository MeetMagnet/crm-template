"use client";

export function SidePeek({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="side-peek-overlay" onClick={onClose} />
      <aside className="side-peek" role="dialog" aria-modal="true">
        <header className="side-peek-header">
          <div>
            <h2>{title}</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {actions}
            <button className="btn ghost small" type="button" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>
        </header>
        <div className="side-peek-body">{children}</div>
      </aside>
    </>
  );
}
