import { NextResponse } from "next/server";
import { requireMcpAuth } from "@/lib/auth-mcp";
import { addNote, listActions } from "@/lib/actions";
import { createContact, listContacts, updateContact } from "@/lib/contacts";
import { PERSON_STATES, isPersonState } from "@/lib/labels";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const tools = [
  {
    name: "list_contacts",
    description: "Liste les contacts du CRM, avec recherche et filtres catégorie/état.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Recherche texte (nom, email, téléphone, entreprise)" },
        category: {
          type: "string",
          enum: ["lead", "prospect", "client", "ex_clients", "autres"],
        },
        state: { type: "string", enum: PERSON_STATES },
      },
    },
  },
  {
    name: "create_contact",
    description: "Crée un nouveau contact dans le CRM.",
    inputSchema: {
      type: "object",
      properties: {
        prenom: { type: "string" },
        nom: { type: "string" },
        email: { type: "string" },
        telephone: { type: "string" },
        category: {
          type: "string",
          enum: ["lead", "prospect", "client", "ex_clients", "autres"],
        },
        state: { type: "string", enum: PERSON_STATES },
        companyId: { type: "string" },
      },
    },
  },
  {
    name: "update_contact_state",
    description: "Met à jour l'état / la catégorie d'un contact (taxonomie MeetMagnet).",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        state: { type: "string", enum: PERSON_STATES },
        category: {
          type: "string",
          enum: ["lead", "prospect", "client", "ex_clients", "autres"],
        },
      },
      required: ["contactId"],
    },
  },
  {
    name: "list_actions",
    description: "Liste les actions, avec filtres optionnels.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        contactId: { type: "string" },
        statut: { type: "string", enum: ["a_faire", "en_cours", "termine"] },
      },
    },
  },
  {
    name: "add_note",
    description: "Ajoute une note liée à un contact.",
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
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function fail(id: JsonRpcId | undefined, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function GET(request: Request) {
  const auth = requireMcpAuth(request);
  if (auth) return auth;
  return NextResponse.json({
    status: "ok",
    protocolVersion: PROTOCOL_VERSION,
    tools: tools.map((t) => t.name),
  });
}

export async function POST(request: Request) {
  const auth = requireMcpAuth(request);
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
        const contacts = await listContacts({
          q: typeof args.query === "string" ? args.query : undefined,
          category: typeof args.category === "string" ? args.category : undefined,
          state: typeof args.state === "string" ? args.state : undefined,
        });
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
        });
      }

      if (name === "create_contact") {
        const prenom = String(args.prenom ?? "").trim();
        const nom = String(args.nom ?? "").trim();
        if (!prenom && !nom) return fail(id, -32602, "prenom ou nom requis");
        const contact = await createContact({
          prenom,
          nom,
          email: typeof args.email === "string" ? args.email : null,
          telephone: typeof args.telephone === "string" ? args.telephone : null,
          category: args.category as never,
          state: args.state as never,
          companyId: typeof args.companyId === "string" ? args.companyId : null,
        });
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(contact, null, 2) }],
        });
      }

      if (name === "update_contact_state") {
        const contactId = String(args.contactId ?? "");
        if (!contactId) return fail(id, -32602, "contactId requis");
        if (args.state !== undefined && !isPersonState(args.state)) {
          return fail(id, -32602, "state invalide");
        }
        const contact = await updateContact(contactId, {
          state: isPersonState(args.state) ? args.state : undefined,
          category: args.category as never,
        });
        if (!contact) return fail(id, -32004, "Contact introuvable");
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(contact, null, 2) }],
        });
      }

      if (name === "list_actions") {
        const actions = await listActions({
          q: typeof args.query === "string" ? args.query : undefined,
          contactId: typeof args.contactId === "string" ? args.contactId : undefined,
          statut: typeof args.statut === "string" ? args.statut : undefined,
        });
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
        });
      }

      if (name === "add_note") {
        const contactId = String(args.contactId ?? "");
        const titre = String(args.titre ?? "").trim();
        if (!contactId || !titre) return fail(id, -32602, "contactId et titre requis");
        const note = await addNote(contactId, titre, String(args.contenu ?? ""));
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
        });
      }

      return fail(id, -32601, `Outil inconnu: ${name}`);
    } catch (error) {
      return fail(id, -32000, error instanceof Error ? error.message : "Erreur outil");
    }
  }

  return fail(id, -32601, `Méthode inconnue: ${method}`);
}
