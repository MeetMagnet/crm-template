"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectMcp() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approveError, setApproveError] = useState("");
  const [clientName, setClientName] = useState("");
  const [redirectHost, setRedirectHost] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | "">("");

  const clientId = params.get("client_id")?.trim() || "";
  const redirectUri = params.get("redirect_uri")?.trim() || "";
  const state = params.get("state")?.trim() || "";
  const codeChallenge = params.get("code_challenge")?.trim() || "";
  const codeChallengeMethod = params.get("code_challenge_method")?.trim() || "S256";
  const scope = params.get("scope")?.trim() || "";
  const resource = params.get("resource")?.trim() || "";
  const responseType = params.get("response_type")?.trim() || "code";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (responseType !== "code") {
        setError("Cette demande OAuth n’est pas supportée (response_type=code requis).");
        setLoading(false);
        return;
      }
      if (!clientId || !redirectUri || !codeChallenge) {
        setError("Demande OAuth incomplète (client_id, redirect_uri, code_challenge).");
        setLoading(false);
        return;
      }
      if (codeChallengeMethod.toUpperCase() !== "S256") {
        setError("Seul PKCE S256 est supporté.");
        setLoading(false);
        return;
      }
      const me = await fetch("/api/auth/me");
      if (me.status === 401) {
        const next = `/connect/mcp${window.location.search}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (me.ok) {
        const user = await me.json();
        if (!cancelled) setEmail(user.email || "");
      }
      const client = await fetch(`/api/mcp-oauth/client/${encodeURIComponent(clientId)}`);
      if (client.status === 401) {
        const next = `/connect/mcp${window.location.search}`;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!client.ok) {
        const data = await client.json().catch(() => ({}));
        if (!cancelled) setError(data.error || "Client OAuth introuvable. Relancez la connexion depuis Claude.");
        setLoading(false);
        return;
      }
      const data = await client.json();
      if (!cancelled) {
        setClientName(data.client_name || "");
        setRedirectHost(data.redirect_host || "");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, codeChallenge, codeChallengeMethod, redirectUri, responseType, router]);

  async function approve(event?: FormEvent) {
    event?.preventDefault();
    setBusy("approve");
    setApproveError("");
    const res = await fetch("/api/mcp-oauth/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state || undefined,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        scope: scope || undefined,
        resource: resource || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.redirect_to) {
      setApproveError(data.error || "Impossible d’autoriser ce connecteur.");
      setBusy("");
      return;
    }
    window.location.href = data.redirect_to;
  }

  async function deny() {
    setBusy("deny");
    const res = await fetch("/api/mcp-oauth/deny", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, state: state || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.redirect_to) {
      window.location.href = data.redirect_to;
      return;
    }
    setError(data.error || "Connexion refusée.");
    setBusy("");
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 520 }}>
        <p className="muted" style={{ margin: 0, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 }}>
          Connexion MCP
        </p>
        <h1 style={{ marginBottom: 8 }}>Autoriser l’accès au CRM</h1>
        <p className="muted">
          {clientName || "Claude"} demande l’accès pour lire et modifier les contacts, les entreprises et les actions.
        </p>
        {loading ? <p className="muted">Vérification de la demande…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {!loading && !error ? (
          <>
            <div className="next-action-box" style={{ marginTop: 16 }}>
              <p style={{ margin: 0 }}>
                <strong>Connecteur :</strong> {clientName || clientId}
              </p>
              <p style={{ margin: "6px 0 0" }}>
                <strong>Compte :</strong> {email || "Compte CRM"}
              </p>
              {redirectHost ? (
                <p style={{ margin: "6px 0 0" }}>
                  <strong>Retour vers :</strong> {redirectHost}
                </p>
              ) : null}
            </div>
            {approveError ? <p className="error">{approveError}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn secondary" type="button" disabled={!!busy} onClick={() => void deny()}>
                {busy === "deny" ? "Refus…" : "Refuser"}
              </button>
              <button className="btn" type="button" disabled={!!busy} onClick={() => void approve()}>
                {busy === "approve" ? "Autorisation…" : "Autoriser"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function ConnectMcpPage() {
  return (
    <Suspense fallback={<div className="login-page">Vérification…</div>}>
      <ConnectMcp />
    </Suspense>
  );
}
