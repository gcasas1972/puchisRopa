import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getAdminSession();
  return session
    ? null
    : NextResponse.json({ error: "Necesitás iniciar sesión como administrador." }, { status: 401 });
}

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
