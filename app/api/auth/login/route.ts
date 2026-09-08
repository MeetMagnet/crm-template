import { NextResponse } from "next/server";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
}
