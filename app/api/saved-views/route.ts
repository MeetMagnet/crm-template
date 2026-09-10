import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createSavedView, listSavedViews } from "@/lib/saved-views";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") || "contacts";
  const views = await listSavedViews(entity);
  return NextResponse.json({ data: views });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const entity = String(body.entity ?? "").trim();
  if (!name || !entity) {
    return NextResponse.json({ error: "name et entity requis" }, { status: 400 });
  }
  const view = await createSavedView({
    name,
    entity,
    viewType: body.viewType ?? "list",
    filters: body.filters ?? {},
    userId: user?.id,
  });
  return NextResponse.json(view, { status: 201 });
}
