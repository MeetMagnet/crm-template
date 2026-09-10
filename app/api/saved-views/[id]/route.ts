import { NextResponse } from "next/server";
import { deleteSavedView, updateSavedView } from "@/lib/saved-views";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    const view = await updateSavedView(id, {
      name: body.name,
      viewType: body.viewType,
      filters: body.filters,
      isShared: body.isShared,
    });
    return NextResponse.json(view);
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    await deleteSavedView(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
}
