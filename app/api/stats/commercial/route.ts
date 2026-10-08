import { NextResponse } from "next/server";
import { getCommercialStats, setRdv1WeeklyTarget } from "@/lib/commercial-stats";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeks = Number(searchParams.get("weeks") ?? 13);
  const stats = await getCommercialStats({
    weeks,
    scope: searchParams.get("scope") ?? undefined,
    preset: searchParams.get("preset") ?? undefined,
  });
  return NextResponse.json(stats);
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const value = Number(body.rdv1WeeklyTarget);
  if (!Number.isFinite(value) || value < 0 || value > 500) {
    return NextResponse.json({ error: "Objectif invalide" }, { status: 400 });
  }
  const rdv1WeeklyTarget = await setRdv1WeeklyTarget(value);
  return NextResponse.json({ rdv1WeeklyTarget });
}
