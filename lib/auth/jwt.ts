import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

const JWT_SECRET = new TextEncoder().encode(jwtSecret);

export interface BrokerJWTPayload extends JWTPayload {
  brokerId: string;
  email: string;
  name: string;
  role: "broker" | "manager" | "admin";
  agencyId?: string;
}

export async function signAccessToken(
  payload: Omit<BrokerJWTPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .setIssuer("callcrm")
    .setAudience("callcrm-client")
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<BrokerJWTPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: "callcrm",
    audience: "callcrm-client",
  });
  return payload as BrokerJWTPayload;
}

export function extractBearerToken(
  authHeader: string | null
): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}