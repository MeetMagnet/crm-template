import { NextResponse } from "next/server";
import { requireMcpAuth } from "@/lib/auth-mcp";
import { addNote } from "@/lib/actions";
import { createContact, listContacts, updateContactStatut } from "@/lib/contacts";
import { isContactStatut } from "@/lib/labels";

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
    description: "Liste les contacts du CRM, avec recherche optionnelle par nom/email et filtre de statut.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Recherche texte (nom, email, téléphone, entreprise)" },
        statut: {
          type: "string",
          enum: ["lead", "contacte", "rdv", "client", "perdu"],
          description: "Filtrer par statut du pipeline",
        },
      },
    },
  },
  {
    name: "create_contact",
    description: "Crée un nouveau contact dans le CRM.",
    inputSchema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Nom du contact" },
        email: { type: "string" },
        telephone: { type: "string" },
        statut: {
          type: "string",
          enum: ["lead", "contacte", "rdv", "client", "perdu"],
        },
        companyId: { type: "string", description: "Identifiant d'entreprise existante" },
      },
      required: ["nom"],
    },
  },
  {
    name: "update_contact_status",
    description: "Met à jour le statut pipeline d'un contact.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string" },
        statut: {
          type: "string",
          enum: ["lead", "contacte", "rdv", "client", "perdu"],
        },
      },
      required: ["contactId", "statut"],
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

export async function POST(request: Request) {
  const authError = requireMcpAuth(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as JsonRpcRequest | JsonRpcRequest[] | null;
  if (!body) {
    return NextResponse.json(rpcError(null, -32700, "JSON invalide"), { status: 400 });
  }

  if (Array.isArray(body)) {
    const results = [];
    for (const item of body) {
      results.push(await handleRpc(item));
    }
    return NextResponse.json(results);
  }

  const result = await handleRpc(body);
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  const authError = requireMcpAuth(request);
  if (authError) return authError;
  return NextResponse.json({
    name: "crm-mcp",
    version: "1.0.0",
    protocolVersion: PROTOCOL_VERSION,
    tools: tools.map((tool) => tool.name),
  });
}

async function handleRpc(request: JsonRpcRequest) {
  const id = request.id ?? null;
  const method = request.method;
  const params = (request.params ?? {}) as Record<string, unknown>;

  try {
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "crm-mcp", version: "1.0.0" },
        });
      case "notifications/initialized":
        return rpcResult(id, {});
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools });
      case "tools/call":
        return rpcResult(id, await callTool(params));
      default:
        return rpcError(id, -32601, `Méthode inconnue : ${method ?? ""}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return rpcError(id, -32000, message);
  }
}

async function callTool(params: Record<string, unknown>) {
  const name = typeof params.name === "string" ? params.name : "";
  const args = (params.arguments ?? {}) as Record<string, unknown>;

  let payload: unknown;

  if (name === "list_contacts") {
    const query = typeof args.query === "string" ? args.query : undefined;
    const statut = typeof args.statut === "string" ? args.statut : undefined;
    payload = await listContacts({ q: query, statut });
  } else if (name === "create_contact") {
    if (typeof args.nom !== "string" || args.nom.trim() === "") {
      throw new Error("Le nom est obligatoire");
    }
    const statut = args.statut;
    payload = await createContact({
      nom: args.nom,
      email: typeof args.email === "string" ? args.email : null,
      telephone: typeof args.telephone === "string" ? args.telephone : null,
      statut: isContactStatut(statut) ? statut : "lead",
      companyId: typeof args.companyId === "string" ? args.companyId : null,
    });
  } else if (name === "update_contact_status") {
    if (typeof args.contactId !== "string") {
      throw new Error("contactId est obligatoire");
    }
    if (!isContactStatut(args.statut)) {
      throw new Error("Statut invalide");
    }
    payload = await updateContactStatut(args.contactId, args.statut);
  } else if (name === "add_note") {
    if (typeof args.contactId !== "string") {
      throw new Error("contactId est obligatoire");
    }
    const titre = typeof args.titre === "string" ? args.titre.trim() : "";
    if (!titre) {
      throw new Error("Le titre est obligatoire");
    }
    const contenu = typeof args.contenu === "string" ? args.contenu : "";
    payload = await addNote(args.contactId, titre, contenu);
  } else {
    throw new Error(`Outil inconnu : ${name}`);
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
