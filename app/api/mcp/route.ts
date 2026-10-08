import { NextResponse } from "next/server";
import type { ActionChannel, ActionStatut, PersonCategory, PersonState } from "@prisma/client";
import { requireMcpAuth } from "@/lib/auth-mcp";
import { corsHeaders, corsPreflight } from "@/lib/mcp-public";
import { addNote, createAction, deleteAction, getAction, listActions, updateAction } from "@/lib/actions";
import { createCompany, deleteCompany, getCompany, listCompanies, updateCompany } from "@/lib/companies";
import { createContact, deleteContact, getContact, listContacts, updateContact } from "@/lib/contacts";
import {
  ACTION_CHANNELS,
  ACTION_STATUTS,
  PERSON_CATEGORIES,
  PERSON_STATES,
  isActionChannel,
  isActionStatut,
  isPersonCategory,
  isPersonState,
  parseOptionalDate,
} from "@/lib/labels";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const categorySchema = { type: "string", enum: PERSON_CATEGORIES };
const stateSchema = { type: "string", enum: PERSON_STATES };
const channelSchema = { type: "string", enum: ACTION_CHANNELS };
const statutSchema = { type: "string", enum: ACTION_STATUTS };

const tools = [
  {
    name: "list_contacts",
    description: "Liste les contacts (recherche, catégorie, état).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: categorySchema,
        state: stateSchema,
      },
    },
  },
  {
    name: "get_contact",
    description: "Lit une fiche contact, avec entreprise, actions et parcours.",
    inputSchema: { type: "object", properties: { contactId: { type: "string" } }, required: ["contactId"] },
  },
  {
    name: "create_contact",
    description: "Crée un contact.",
    inputSchema: {
      type: "object",
      properties: {
        prenom: { type: "string" },
        nom: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        poste: { type: "string" },
        linkedinUrl: { type: "string" },
        description: { type: "string" },
        adresse: { type: "string" },
        pays: { type: "string" },
        source: { type: "string" },
        category: categorySchema,
        state: stateSchema,
        companyId: { type: "string" },
        prochaineActionTitre: { type: "string" },
        prochaineActionDate: { type: "string" },
      },
    },
  },
  {
    name: "update_contact",
    description: "Modifie les champs d'un contact. Seuls les champs envoyés changent.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        prenom: { type: "string" },
        nom: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        poste: { type: "string" },
        linkedinUrl: { type: "string" },
        description: { type: "string" },
        adresse: { type: "string" },
        pays: { type: "string" },
        source: { type: "string" },
        category: categorySchema,
        state: stateSchema,
        companyId: { type: "string" },
        prochaineActionTitre: { type: "string" },
        prochaineActionDate: { type: "string" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "update_contact_state",
    description: "Change l'état ou la catégorie d'un contact.",
    inputSchema: {
      type: "object",
      properties: { contactId: { type: "string" }, state: stateSchema, category: categorySchema },
      required: ["contactId"],
    },
  },
  {
    name: "delete_contact",
    description: "Supprime un contact et ses actions.",
    inputSchema: { type: "object", properties: { contactId: { type: "string" } }, required: ["contactId"] },
  },
  {
    name: "list_companies",
    description: "Liste les entreprises.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
  },
  {
    name: "get_company",
    description: "Lit une fiche entreprise et ses contacts.",
    inputSchema: { type: "object", properties: { companyId: { type: "string" } }, required: ["companyId"] },
  },
  {
    name: "create_company",
    description: "Crée une entreprise.",
    inputSchema: {
      type: "object",
      properties: {
        nom: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        adresse: { type: "string" },
        siteWeb: { type: "string" },
        siret: { type: "string" },
        linkedinUrl: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
      },
      required: ["nom"],
    },
  },
  {
    name: "update_company",
    description: "Modifie une entreprise. Seuls les champs envoyés changent.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        nom: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        adresse: { type: "string" },
        siteWeb: { type: "string" },
        siret: { type: "string" },
        linkedinUrl: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
      },
      required: ["companyId"],
    },
  },
  {
    name: "delete_company",
    description: "Supprime une entreprise. Les contacts restent, détachés.",
    inputSchema: { type: "object", properties: { companyId: { type: "string" } }, required: ["companyId"] },
  },
  {
    name: "list_actions",
    description: "Liste les actions.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        contactId: { type: "string" },
        statut: statutSchema,
        channel: channelSchema,
      },
    },
  },
  {
    name: "get_action",
    description: "Lit une action.",
    inputSchema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] },
  },
  {
    name: "create_action",
    description: "Crée une action sur un contact.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        channel: channelSchema,
        titre: { type: "string" },
        contenu: { type: "string" },
        statut: statutSchema,
        datePrevue: { type: "string" },
      },
      required: ["contactId", "titre"],
    },
  },
  {
    name: "update_action",
    description: "Modifie une action (titre, canal, statut, date, note).",
    inputSchema: {
      type: "object",
      properties: {
        actionId: { type: "string" },
        channel: channelSchema,
        titre: { type: "string" },
        contenu: { type: "string" },
        statut: statutSchema,
        datePrevue: { type: "string" },
      },
      required: ["actionId"],
    },
  },
  {
    name: "complete_action",
    description: "Marque une action comme terminée.",
    inputSchema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] },
  },
  {
    name: "delete_action",
    description: "Supprime une action.",
    inputSchema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] },
  },
  {
    name: "add_note",
    description: "Ajoute une note terminée sur un contact.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        titre: { type: "string" },
        contenu: { type: "string" },
      },
      required: ["contactId", "titre"],
    },
  },
];

function ok(id: JsonRpcId | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, { headers: corsHeaders() });
}

function fail(id: JsonRpcId | undefined, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { headers: corsHeaders() });
}

function text(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function str(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function optionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function contactInput(args: Record<string, unknown>) {
  return {
    prenom: str(args.prenom),
    nom: str(args.nom),
    email: optionalString(args.email),
    telephone: optionalString(args.telephone),
    poste: optionalString(args.poste),
    linkedinUrl: optionalString(args.linkedinUrl),
    description: optionalString(args.description),
    adresse: optionalString(args.adresse),
    pays: optionalString(args.pays),
    source: optionalString(args.source),
    category: isPersonCategory(args.category) ? (args.category as PersonCategory) : undefined,
    state: isPersonState(args.state) ? (args.state as PersonState) : undefined,
    companyId: args.companyId === null ? null : str(args.companyId),
    prochaineActionTitre: optionalString(args.prochaineActionTitre),
    prochaineActionDate:
      args.prochaineActionDate !== undefined ? parseOptionalDate(args.prochaineActionDate) ?? null : undefined,
    customFields: record(args.customFields),
  };
}

function companyInput(args: Record<string, unknown>) {
  return {
    nom: str(args.nom),
    email: optionalString(args.email),
    telephone: optionalString(args.telephone),
    adresse: optionalString(args.adresse),
    siteWeb: optionalString(args.siteWeb),
    siret: optionalString(args.siret),
    linkedinUrl: optionalString(args.linkedinUrl),
    description: optionalString(args.description),
    notes: optionalString(args.notes),
    customFields: record(args.customFields),
  };
}

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const auth = await requireMcpAuth(request);
  if (auth) return auth;
  return NextResponse.json(
    {
      status: "ok",
      protocolVersion: PROTOCOL_VERSION,
      tools: tools.map((tool) => tool.name),
    },
    { headers: corsHeaders() },
  );
}

export async function POST(request: Request) {
  const auth = await requireMcpAuth(request);
  if (auth) return auth;

  const body = (await request.json().catch(() => null)) as JsonRpcRequest | null;
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return fail(body?.id, -32600, "Requête JSON-RPC invalide");
  }

  const { id, method, params = {} } = body;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "crm-template", version: "1.0.0" },
    });
  }

  if (method === "tools/list") {
    return ok(id, { tools });
  }

  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    try {
      if (name === "list_contacts") {
        return ok(id, text(await listContacts({ q: str(args.query), category: str(args.category), state: str(args.state) }, { pageSize: 1000 })));
      }
      if (name === "get_contact") {
        const contact = await getContact(String(args.contactId ?? ""));
        if (!contact) return fail(id, -32004, "Contact introuvable");
        return ok(id, text(contact));
      }
      if (name === "create_contact") {
        const input = contactInput(args);
        if (!input.prenom?.trim() && !input.nom?.trim()) return fail(id, -32602, "prenom ou nom requis");
        return ok(id, text(await createContact(input)));
      }
      if (name === "update_contact" || name === "update_contact_state") {
        const contactId = String(args.contactId ?? "");
        if (!contactId) return fail(id, -32602, "contactId requis");
        if (args.state !== undefined && !isPersonState(args.state)) return fail(id, -32602, "state invalide");
        if (args.category !== undefined && !isPersonCategory(args.category)) return fail(id, -32602, "category invalide");
        const contact = await updateContact(contactId, contactInput(args));
        if (!contact) return fail(id, -32004, "Contact introuvable");
        return ok(id, text(contact));
      }
      if (name === "delete_contact") {
        const contactId = String(args.contactId ?? "");
        if (!contactId) return fail(id, -32602, "contactId requis");
        await deleteContact(contactId);
        return ok(id, text({ ok: true }));
      }
      if (name === "list_companies") {
        return ok(id, text(await listCompanies({ q: str(args.query) }, { pageSize: 1000 })));
      }
      if (name === "get_company") {
        const company = await getCompany(String(args.companyId ?? ""));
        if (!company) return fail(id, -32004, "Entreprise introuvable");
        return ok(id, text(company));
      }
      if (name === "create_company") {
        const input = companyInput(args);
        if (!input.nom?.trim()) return fail(id, -32602, "nom requis");
        return ok(id, text(await createCompany(input)));
      }
      if (name === "update_company") {
        const companyId = String(args.companyId ?? "");
        if (!companyId) return fail(id, -32602, "companyId requis");
        try {
          return ok(id, text(await updateCompany(companyId, companyInput(args))));
        } catch {
          return fail(id, -32004, "Entreprise introuvable");
        }
      }
      if (name === "delete_company") {
        const companyId = String(args.companyId ?? "");
        if (!companyId) return fail(id, -32602, "companyId requis");
        await deleteCompany(companyId);
        return ok(id, text({ ok: true }));
      }
      if (name === "list_actions") {
        return ok(
          id,
          text(
            await listActions(
              { q: str(args.query), contactId: str(args.contactId), statut: str(args.statut), channel: str(args.channel) },
              { pageSize: 1000 },
            ),
          ),
        );
      }
      if (name === "get_action") {
        const action = await getAction(String(args.actionId ?? ""));
        if (!action) return fail(id, -32004, "Action introuvable");
        return ok(id, text(action));
      }
      if (name === "create_action") {
        const contactId = str(args.contactId);
        const titre = str(args.titre)?.trim();
        if (!contactId || !titre) return fail(id, -32602, "contactId et titre requis");
        if (args.channel !== undefined && !isActionChannel(args.channel)) return fail(id, -32602, "channel invalide");
        if (args.statut !== undefined && !isActionStatut(args.statut)) return fail(id, -32602, "statut invalide");
        return ok(
          id,
          text(
            await createAction({
              contactId,
              channel: (isActionChannel(args.channel) ? args.channel : "note") as ActionChannel,
              titre,
              contenu: str(args.contenu) ?? "",
              statut: isActionStatut(args.statut) ? (args.statut as ActionStatut) : "a_faire",
              datePrevue: args.datePrevue !== undefined ? parseOptionalDate(args.datePrevue) ?? null : null,
            }),
          ),
        );
      }
      if (name === "update_action" || name === "complete_action") {
        const actionId = String(args.actionId ?? "");
        if (!actionId) return fail(id, -32602, "actionId requis");
        if (args.channel !== undefined && !isActionChannel(args.channel)) return fail(id, -32602, "channel invalide");
        if (args.statut !== undefined && !isActionStatut(args.statut)) return fail(id, -32602, "statut invalide");
        const action = await updateAction(actionId, {
          channel: isActionChannel(args.channel) ? args.channel : undefined,
          titre: str(args.titre),
          contenu: str(args.contenu),
          statut: name === "complete_action" ? "termine" : isActionStatut(args.statut) ? args.statut : undefined,
          datePrevue: args.datePrevue !== undefined ? parseOptionalDate(args.datePrevue) ?? null : undefined,
        });
        if (!action) return fail(id, -32004, "Action introuvable");
        return ok(id, text(action));
      }
      if (name === "delete_action") {
        const actionId = String(args.actionId ?? "");
        if (!actionId) return fail(id, -32602, "actionId requis");
        await deleteAction(actionId);
        return ok(id, text({ ok: true }));
      }
      if (name === "add_note") {
        const contactId = String(args.contactId ?? "");
        const titre = String(args.titre ?? "").trim();
        if (!contactId || !titre) return fail(id, -32602, "contactId et titre requis");
        return ok(id, text(await addNote(contactId, titre, String(args.contenu ?? ""))));
      }
      return fail(id, -32601, `Outil inconnu: ${name}`);
    } catch (error) {
      return fail(id, -32000, error instanceof Error ? error.message : "Erreur outil");
    }
  }

  return fail(id, -32601, `Méthode inconnue: ${method}`);
}
