import * as jose from "jose";

const SECRET = process.env.SUPER_SECRET_KEY;

function getSecret(): Uint8Array {
  if (!SECRET) {
    throw new Error("Falta SUPER_SECRET_KEY en las variables de entorno");
  }
  return new TextEncoder().encode(SECRET);
}

export type AuthPayload = {
  role: string;
  username: string;
  id: string;
};

export async function signToken(payload: AuthPayload): Promise<string> {
  const secret = getSecret();
  const token = await new jose.SignJWT({
    role: payload.role,
    username: payload.username,
    id: payload.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return token;
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify<AuthPayload>(token, secret);
    if (
      typeof payload.role === "string" &&
      typeof payload.username === "string" &&
      typeof payload.id === "string"
    ) {
      return { role: payload.role, username: payload.username, id: payload.id };
    }
    return null;
  } catch {
    return null;
  }
}
