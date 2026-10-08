"use client";

import { useEffect, useState } from "react";

type Connection = {
  clientId: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
  active: boolean;
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    setUrl(`${window.location.origin}/mcp`);
    void fetch("/api/mcp-oauth/connections")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => setConnections(data.data ?? []));
  }, []);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1>Paramètres</h1>
      </div>
      <div className="page-body" style={{ maxWidth: 760 }}>
        <section className="prop-sheet" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Connecteur MCP</h2>
          <p className="muted">
            Collez cette URL dans Claude (connecteur personnalisé). Claude ouvre le CRM : vous validez l’accès avec votre compte, sans coller de jeton.
          </p>
          <div className="inline-field">
            <input className="input" readOnly value={url} aria-label="URL du connecteur MCP" style={{ flex: 1 }} />
            <button className="btn" type="button" onClick={() => void copy()}>
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Dans Claude : Paramètres → Connecteurs → Ajouter un connecteur personnalisé, puis collez l’URL. L’autorisation se fait dans le navigateur.
          </p>
        </section>

        <section className="prop-sheet" style={{ padding: 16, marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Connexions</h2>
          {connections.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>Aucune application n’a encore été autorisée.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {connections.map((connection) => (
                <li key={connection.clientId} style={{ borderTop: "1px solid #f1f1ef", paddingTop: 8 }}>
                  <strong>{connection.clientName}</strong>
                  <span className={connection.active ? "badge badge-green" : "badge badge-gray"} style={{ marginLeft: 8 }}>
                    {connection.active ? "Actif" : "Expiré"}
                  </span>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    Autorisé le {formatWhen(connection.createdAt)} · Dernier usage {formatWhen(connection.lastUsedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
