import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { createAdminSession, getAdminCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
      return NextResponse.json({ error: "Ingresá tu correo y contraseña." }, { status: 400 });
    }

    const { email, password } = body;
    if (typeof email !== "string" || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) {
      return NextResponse.json({ error: "Ingresá tu correo y contraseña." }, { status: 400 });
    }

    const credentials = getAdminCredentials();
    const passwordMatches = await compare(password, credentials.passwordHash);
    if (email.trim().toLowerCase() !== credentials.email || !passwordMatches) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }

    await createAdminSession(credentials.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    }
    console.error("No se pudo iniciar la sesión de administración.", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Revisá la configuración del servidor." }, { status: 500 });
  }
}
