import type { PersonState } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TARGET_KEY = "rdv1_weekly_target";
const DEFAULT_TARGET = 10;
export const MATURITY_DAYS = 28;

const RDV1: PersonState[] = [
  "rdv_decouverte",
  "rencontre",
  "rdv2_planifie",
  "relance_suite_rdv",
  "propale",
  "kickoff",
  "done",
];
const R2: PersonState[] = ["rdv2_planifie", "relance_suite_rdv", "propale", "kickoff", "done"];
const PROPALE: PersonState[] = ["propale", "kickoff", "done"];
const SIGNED: PersonState[] = ["kickoff", "done"];

const RANK: Record<string, number> = {};
for (const state of RDV1) RANK[state] = 1;
for (const state of R2) RANK[state] = 2;
for (const state of PROPALE) RANK[state] = 3;
for (const state of SIGNED) RANK[state] = 4;

export type ActivityWeek = {
  weekStart: string;
  newContacts: number;
  rdv1Count: number;
  meetings: number;
};

export type CohortRow = {
  weekStart: string;
  weekEnd: string;
  newLeads: number;
  rdv1: number;
  mature: boolean;
  maturityLabel: string;
  r2: number;
  propale: number;
  signed: number;
  r1ToSignedPct: number | null;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  conversionFromRdv1Pct: number | null;
  conversionFromPreviousPct: number | null;
  widthPct: number;
};

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function weekStartUtc(date: Date) {
  const day = utcDay(date);
  const dow = day.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  day.setUTCDate(day.getUTCDate() + diff);
  return day;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inRange(date: Date, start: Date, endExclusive: Date) {
  return date >= start && date < endExclusive;
}

function rankOf(state: string | null | undefined) {
  if (!state) return 0;
  return RANK[state] ?? 0;
}

type HistoryPoint = { at: Date; state: PersonState };

function firstReached(points: HistoryPoint[], current: PersonState, createdAt: Date, minRank: number) {
  const hits = points.filter((point) => rankOf(point.state) >= minRank).map((point) => point.at);
  if (!hits.length && rankOf(current) >= minRank) hits.push(createdAt);
  if (!hits.length) return null;
  return hits.reduce((min, date) => (date < min ? date : min));
}

async function readTarget() {
  const row = await prisma.setting.findUnique({ where: { key: TARGET_KEY } });
  const value = Number(row?.value);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TARGET;
}

export async function setRdv1WeeklyTarget(value: number) {
  const safe = Math.max(0, Math.round(value));
  await prisma.setting.upsert({
    where: { key: TARGET_KEY },
    create: { key: TARGET_KEY, value: String(safe) },
    update: { value: String(safe) },
  });
  return safe;
}

export async function getCommercialStats(options: { weeks?: number; scope?: string; preset?: string }) {
  const weeks = options.weeks === 4 || options.weeks === 26 ? options.weeks : 13;
  const scope = options.scope === "dated" ? "dated" : "global";
  const presetWeeks = options.preset === "4w" ? 4 : options.preset === "26w" ? 26 : 13;

  const [target, contacts, meetings] = await Promise.all([
    readTarget(),
    prisma.contact.findMany({
      select: {
        id: true,
        createdAt: true,
        state: true,
        stateHistory: { select: { newState: true, createdAt: true } },
      },
    }),
    prisma.action.findMany({
      where: { channel: "meeting" },
      select: { datePrevue: true, dateRealisation: true, createdAt: true },
    }),
  ]);

  const people = contacts.map((contact) => {
    const points: HistoryPoint[] = contact.stateHistory.map((row) => ({
      at: row.createdAt,
      state: row.newState,
    }));
    return {
      createdAt: contact.createdAt,
      rdv1At: firstReached(points, contact.state, contact.createdAt, 1),
      r2At: firstReached(points, contact.state, contact.createdAt, 2),
      propaleAt: firstReached(points, contact.state, contact.createdAt, 3),
      signedAt: firstReached(points, contact.state, contact.createdAt, 4),
    };
  });

  const now = new Date();
  const currentWeek = weekStartUtc(now);
  const activityStart = addDays(currentWeek, -(weeks - 1) * 7);
  const activityWeeks: ActivityWeek[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const start = addDays(activityStart, index * 7);
    const end = addDays(start, 7);
    activityWeeks.push({
      weekStart: iso(start),
      newContacts: people.filter((person) => inRange(person.createdAt, start, end)).length,
      rdv1Count: people.filter((person) => person.rdv1At && inRange(person.rdv1At, start, end)).length,
      meetings: meetings.filter((action) => {
        const when = action.dateRealisation ?? action.datePrevue ?? action.createdAt;
        return inRange(when, start, end);
      }).length,
    });
  }

  const current = activityWeeks[activityWeeks.length - 1];
  const cohortSpan = scope === "dated" ? presetWeeks : 52;
  const cohortStart = addDays(currentWeek, -(cohortSpan - 1) * 7);
  const cohortMap = new Map<string, CohortRow>();

  for (let index = 0; index < cohortSpan; index += 1) {
    const start = addDays(cohortStart, index * 7);
    const end = addDays(start, 7);
    const key = iso(start);
    const mature = addDays(end, MATURITY_DAYS) <= utcDay(now);
    cohortMap.set(key, {
      weekStart: key,
      weekEnd: iso(addDays(end, -1)),
      newLeads: 0,
      rdv1: 0,
      mature,
      maturityLabel: mature ? "Mature" : "En cours",
      r2: 0,
      propale: 0,
      signed: 0,
      r1ToSignedPct: null,
    });
  }

  for (const person of people) {
    const key = iso(weekStartUtc(person.createdAt));
    const row = cohortMap.get(key);
    if (!row) continue;
    row.newLeads += 1;
    if (person.rdv1At) row.rdv1 += 1;
    if (person.r2At) row.r2 += 1;
    if (person.propaleAt) row.propale += 1;
    if (person.signedAt) row.signed += 1;
  }

  const cohortRows = [...cohortMap.values()]
    .filter((row) => (scope === "global" ? row.newLeads > 0 : true))
    .map((row) => ({
      ...row,
      r1ToSignedPct: row.mature && row.rdv1 > 0 ? Math.round((row.signed / row.rdv1) * 100) : null,
    }))
    .reverse();

  const totals = cohortRows.reduce(
    (sum, row) => ({
      rdv1: sum.rdv1 + row.rdv1,
      r2: sum.r2 + row.r2,
      propale: sum.propale + row.propale,
      signed: sum.signed + row.signed,
    }),
    { rdv1: 0, r2: 0, propale: 0, signed: 0 },
  );

  const steps = [
    { key: "rdv1", label: "RDV1", count: totals.rdv1 },
    { key: "r2", label: "RDV2", count: totals.r2 },
    { key: "propale", label: "Propale", count: totals.propale },
    { key: "signed", label: "Signé", count: totals.signed },
  ];
  const funnel: FunnelStep[] = steps.map((step, index) => {
    const previous = index === 0 ? step.count : steps[index - 1].count;
    return {
      ...step,
      conversionFromRdv1Pct: totals.rdv1 > 0 ? Math.round((step.count / totals.rdv1) * 100) : null,
      conversionFromPreviousPct: index === 0 || previous === 0 ? null : Math.round((step.count / previous) * 100),
      widthPct: totals.rdv1 > 0 ? Math.max(8, Math.round((step.count / totals.rdv1) * 100)) : 8,
    };
  });

  const cycles = people
    .filter((person) => person.signedAt)
    .map((person) => Math.max(0, Math.round((person.signedAt!.getTime() - person.createdAt.getTime()) / 86400000)))
    .slice(0, 20);
  const averageDays = cycles.length
    ? Math.round(cycles.reduce((sum, days) => sum + days, 0) / cycles.length)
    : null;

  return {
    rdv1WeeklyTarget: target,
    averageDays,
    maturityThresholdDays: MATURITY_DAYS,
    activity: {
      weeks: activityWeeks,
      currentWeek: {
        weekStart: current?.weekStart ?? iso(currentWeek),
        rdv1Count: current?.rdv1Count ?? 0,
      },
    },
    cohorts: {
      scope,
      preset: scope === "dated" ? (presetWeeks === 4 ? "4w" : presetWeeks === 26 ? "26w" : "13w") : null,
      rows: cohortRows,
      funnel,
    },
  };
}
