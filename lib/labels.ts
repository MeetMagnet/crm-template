import type { ActionStatut, ActionType, ContactStatut } from "@prisma/client";

export const CONTACT_STATUTS: ContactStatut[] = [
  "lead",
  "contacte",
  "rdv",
  "client",
  "perdu",
];

export const ACTION_TYPES: ActionType[] = [
  "note",
  "appel",
  "email",
  "rendez_vous",
  "autre",
];

export const ACTION_STATUTS: ActionStatut[] = ["a_faire", "en_cours", "termine"];

export const CONTACT_STATUT_LABELS: Record<ContactStatut, string> = {
  lead: "Lead",
  contacte: "Contacté",
  rdv: "RDV",
  client: "Client",
  perdu: "Perdu",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  note: "Note",
  appel: "Appel",
  email: "E-mail",
  rendez_vous: "Rendez-vous",
  autre: "Autre",
};

export const ACTION_STATUT_LABELS: Record<ActionStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

export function isContactStatut(value: unknown): value is ContactStatut {
  return typeof value === "string" && CONTACT_STATUTS.includes(value as ContactStatut);
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPES.includes(value as ActionType);
}

export function isActionStatut(value: unknown): value is ActionStatut {
  return typeof value === "string" && ACTION_STATUTS.includes(value as ActionStatut);
}

export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
