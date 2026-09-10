import { NextResponse } from "next/server";
import { deleteCustomColumn, isCustomColumnType, updateCustomColumn } from "@/lib/custom-columns";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (body.type !== undefined && body.type !== "" && !isCustomColumnType(body.type)) {
    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  }
  try {
    const column = await updateCustomColumn(id, {
      label: body.label,
      type: body.type,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
    });
    return NextResponse.json(column);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    await deleteCustomColumn(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
