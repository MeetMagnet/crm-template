"use client";

import { FormEvent, useEffect, useState } from "react";
import { CUSTOM_COLUMN_TYPES, type CustomColumnType, type CustomEntityType } from "@/lib/custom-columns";

export type CustomColumnDraft = {
  id?: string;
  label: string;
  type: CustomColumnType;
  key?: string;
};

export function CustomColumnModal({
  open,
  entityType,
  column,
  onClose,
  onSaved,
}: {
  open: boolean;
  entityType: CustomEntityType;
  column?: CustomColumnDraft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumnType>("text");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const editing = !!column?.id;

  useEffect(() => {
    if (!open) return;
    setLabel(column?.label ?? "");
    setType(column?.type ?? "text");
    setError("");
  }, [open, column]);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const res = await fetch(editing ? `/api/custom-columns/${column!.id}` : "/api/custom-columns", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        label,
        type,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Enregistrement impossible");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card form-grid" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h3>{editing ? "Modifier la colonne" : "Ajouter une colonne"}</h3>
        <label>
          Nom
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label>
          Type
          <select className="select" value={type} onChange={(e) => setType(e.target.value as CustomColumnType)}>
            {CUSTOM_COLUMN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === "text"
                  ? "Texte"
                  : t === "number"
                    ? "Nombre"
                    : t === "date"
                      ? "Date"
                      : "Oui / Non"}
              </option>
            ))}
          </select>
        </label>
        {editing && column?.key ? <p className="muted">Clé technique : {column.key}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn secondary small" type="button" onClick={onClose}>
            Annuler
          </button>
          <button className="btn small" disabled={pending} type="submit">
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function CustomFieldInputs({
  columns,
  values,
  onChange,
}: {
  columns: Array<{ key: string; label: string; type: string }>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!columns.length) return null;
  return (
    <>
      {columns.map((col) => (
        <label key={col.key}>
          {col.label}
          {col.type === "boolean" ? (
            <select
              className="select"
              value={values[col.key] === true ? "true" : values[col.key] === false ? "false" : ""}
              onChange={(e) =>
                onChange(col.key, e.target.value === "" ? null : e.target.value === "true")
              }
            >
              <option value="">—</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          ) : (
            <input
              className="input"
              type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
              value={
                values[col.key] === null || values[col.key] === undefined ? "" : String(values[col.key])
              }
              onChange={(e) =>
                onChange(
                  col.key,
                  e.target.value === ""
                    ? null
                    : col.type === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                )
              }
            />
          )}
        </label>
      ))}
    </>
  );
}
