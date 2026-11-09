import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const cookieName = "pachus_admin_session";
const sessionDurationSeconds = 60 * 60 * 8;

function getSessionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export function getAdminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!email || !passwordHash) {
    throw new Error("Faltan ADMIN_EMAIL o ADMIN_PASSWORD_HASH para habilitar el acceso administrador.");
  }
  return { email, passwordHash };
}

export async function createAdminSession(email: string) {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(getSessionKey());

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getAdminSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;

  const { email } = getAdminCredentials();
  const sessionKey = getSessionKey();
  try {
    const { payload } = await jwtVerify(token, sessionKey);
    if (payload.sub !== email || payload.role !== "admin") return null;
    return { email };
  } catch {
    return null;
  }
}
