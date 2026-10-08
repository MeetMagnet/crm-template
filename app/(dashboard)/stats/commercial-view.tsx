"use client";

import { useEffect, useState } from "react";
import type { CohortRow, FunnelStep } from "@/lib/commercial-stats";

type StatsPayload = {
  rdv1WeeklyTarget: number;
  averageDays: number | null;
  maturityThresholdDays: number;
  activity: {
    weeks: Array<{ weekStart: string; newContacts: number; rdv1Count: number; meetings: number }>;
    currentWeek: { weekStart: string; rdv1Count: number };
  };
  cohorts: {
    scope: "global" | "dated";
    preset: string | null;
    rows: CohortRow[];
    funnel: FunnelStep[];
  };
};

function formatDay(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const endIso = end.toISOString().slice(0, 10);
  return `${formatDay(weekStart)} → ${formatDay(endIso)}`;
}

export function CommercialView() {
  const [tab, setTab] = useState<"activity" | "cohorts">("cohorts");
  const [weeks, setWeeks] = useState(13);
  const [scope, setScope] = useState<"global" | "dated">("global");
  const [preset, setPreset] = useState("13w");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [target, setTarget] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      weeks: String(weeks),
      scope,
      preset,
    });
    fetch(`/api/stats/commercial?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Impossible de charger les statistiques.");
        return res.json() as Promise<StatsPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setTarget(data.rdv1WeeklyTarget);
        setError("");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weeks, scope, preset]);

  async function saveTarget(value: number) {
    setTarget(value);
    const res = await fetch("/api/stats/commercial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rdv1WeeklyTarget: value }),
    });
    if (!res.ok) {
      setError("Objectif invalide");
      return;
    }
    setStats((current) => (current ? { ...current, rdv1WeeklyTarget: value } : current));
  }

  const progress = stats
    ? Math.min(100, Math.round((stats.activity.currentWeek.rdv1Count / Math.max(target || 1, 1)) * 100))
    : 0;

  return (
    <div className="page stats-page">
      <div className="stats-head">
        <div>
          <p className="crumb">
            Statistiques <span>/</span> Commercial
          </p>
          <h1>Activité vs cohortes</h1>
        </div>
        <div className="seg">
          <button type="button" className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
            Activité
          </button>
          <button type="button" className={tab === "cohorts" ? "active" : ""} onClick={() => setTab("cohorts")}>
            Cohortes
          </button>
        </div>
      </div>

      {loading && !stats ? <p className="muted stats-pad">Chargement…</p> : null}
      {error ? <p className="error stats-pad">{error}</p> : null}

      {stats ? (
        <div className="stats-kpis">
          <div>
            <span>Cycle moyen</span>
            <strong>{stats.averageDays === null ? "—" : `${stats.averageDays} j`}</strong>
          </div>
          {tab === "cohorts" ? (
            <div>
              <span>Maturité cohorte</span>
              <strong>{stats.maturityThresholdDays} j</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      {stats && tab === "activity" ? (
        <section className="stats-block">
          <div className="stats-toolbar">
            <span>Période</span>
            {[
              { weeks: 4, label: "4 sem." },
              { weeks: 13, label: "3 mois" },
              { weeks: 26, label: "6 mois" },
            ].map((option) => (
              <button
                key={option.weeks}
                type="button"
                className={weeks === option.weeks ? "chip active" : "chip"}
                onClick={() => setWeeks(option.weeks)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="week-progress">
            <div>
              <p>Semaine en cours · {formatDay(stats.activity.currentWeek.weekStart)}</p>
              <strong>
                {stats.activity.currentWeek.rdv1Count} / {target} RDV1
              </strong>
            </div>
            <label>
              Objectif / sem.
              <input
                className="input"
                type="number"
                min={0}
                value={target}
                onChange={(e) => void saveTarget(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="progress-track">
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Semaine (lun. → dim.)</th>
                  <th className="num">New Lead</th>
                  <th className="num">1ers RDV1</th>
                  <th className="num">Meeting</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.activity.weeks].reverse().map((week) => (
                  <tr key={week.weekStart}>
                    <td>{formatWeekRange(week.weekStart)}</td>
                    <td className="num">{week.newContacts}</td>
                    <td className="num">{week.rdv1Count}</td>
                    <td className="num">{week.meetings}</td>
                  </tr>
                ))}
                {stats.activity.weeks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      Aucune donnée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {stats && tab === "cohorts" ? (
        <section className="stats-block">
          <div className="stats-toolbar">
            <span>Périmètre</span>
            <div className="seg">
              <button type="button" className={scope === "global" ? "active" : ""} onClick={() => setScope("global")}>
                Globale
              </button>
              <button type="button" className={scope === "dated" ? "active" : ""} onClick={() => setScope("dated")}>
                Datée
              </button>
            </div>
            {scope === "dated"
              ? [
                  { id: "4w", label: "4 sem." },
                  { id: "13w", label: "3 mois" },
                  { id: "26w", label: "6 mois" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={preset === option.id ? "chip active" : "chip"}
                    onClick={() => setPreset(option.id)}
                  >
                    {option.label}
                  </button>
                ))
              : null}
          </div>
          <h2>Entonnoir</h2>
          <div className="funnel">
            {stats.cohorts.funnel.map((step) => (
              <div className="funnel-row" key={step.key}>
                <span>{step.label}</span>
                <div className="funnel-bar" style={{ width: `${step.widthPct}%` }}>
                  {step.count}
                </div>
                <span className="muted">
                  {step.key === "rdv1"
                    ? "100 %"
                    : `${step.conversionFromRdv1Pct ?? 0} % · ${step.conversionFromPreviousPct ?? 0} % étape`}
                </span>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Semaine cohorte</th>
                  <th className="num">New Lead</th>
                  <th className="num">RDV1</th>
                  <th>Maturité</th>
                  <th className="num">R2</th>
                  <th className="num">Propale</th>
                  <th className="num">Signé</th>
                  <th className="num">R1→Signé</th>
                </tr>
              </thead>
              <tbody>
                {stats.cohorts.rows.map((row) => (
                  <tr key={row.weekStart}>
                    <td>
                      {formatDay(row.weekStart)} – {formatDay(row.weekEnd)}
                    </td>
                    <td className="num">{row.newLeads}</td>
                    <td className="num">{row.rdv1}</td>
                    <td>
                      {row.newLeads > 0 ? (
                        <span className={row.mature ? "badge badge-green" : "badge badge-yellow"}>{row.maturityLabel}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{row.r2}</td>
                    <td className="num">{row.propale}</td>
                    <td className="num">{row.signed}</td>
                    <td className="num">{row.r1ToSignedPct === null ? "—" : `${row.r1ToSignedPct} %`}</td>
                  </tr>
                ))}
                {stats.cohorts.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty">
                      Aucune cohorte sur cette période.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
