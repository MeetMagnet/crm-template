import { NextResponse } from "next/server";
import {
  createCustomColumn,
  isCustomColumnType,
  listCustomColumns,
  type CustomEntityType,
} from "@/lib/custom-columns";

const ENTITIES: CustomEntityType[] = ["contact", "company", "action"];

function parseEntity(value: string | null): CustomEntityType | null {
  if (value && ENTITIES.includes(value as CustomEntityType)) return value as CustomEntityType;
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = parseEntity(searchParams.get("entityType"));
  if (!entityType) {
    return NextResponse.json({ error: "entityType invalide" }, { status: 400 });
  }
  const data = await listCustomColumns(entityType);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const entityType = parseEntity(String(body.entityType ?? ""));
  if (!entityType) {
    return NextResponse.json({ error: "entityType invalide" }, { status: 400 });
  }
  if (body.type !== undefined && body.type !== "" && !isCustomColumnType(body.type)) {
    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  }
  try {
    const column = await createCustomColumn({
      entityType,
      label: String(body.label ?? ""),
      type: body.type,
      key: typeof body.key === "string" ? body.key : undefined,
    });
    return NextResponse.json(column, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création impossible";
    const status = message.includes("existe déjà") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
