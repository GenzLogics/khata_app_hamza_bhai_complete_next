import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type TokenPayload = {
  sub: string;
  email: string;
  type: "access" | "refresh";
};

function getSecretKey() {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

function getAlgorithm() {
  return process.env.ALGORITHM || "HS256";
}

function getAccessTokenExpireMinutes() {
  return parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "30", 10);
}

function getRefreshTokenExpireDays() {
  return parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || "7", 10);
}

export async function createAccessToken(payload: Omit<TokenPayload, "type">) {
  const secretKey = getSecretKey();
  const expireMinutes = getAccessTokenExpireMinutes();
  const algorithm = getAlgorithm();
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setExpirationTime(`${expireMinutes}m`)
    .sign(secretKey);
}

export async function createRefreshToken(payload: Omit<TokenPayload, "type">) {
  const secretKey = getSecretKey();
  const expireDays = getRefreshTokenExpireDays();
  const algorithm = getAlgorithm();
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setExpirationTime(`${expireDays}d`)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const secretKey = getSecretKey();
    const algorithm = getAlgorithm();
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [algorithm] });
    if (payload.type !== "access") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const secretKey = getSecretKey();
    const algorithm = getAlgorithm();
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [algorithm] });
    if (payload.type !== "refresh") return null;
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function getAccessTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get("access_token")?.value;
}

export async function getRefreshTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get("refresh_token")?.value;
}

export async function setAccessTokenCookie(token: string) {
  const cookieStore = await cookies();
  const expireMinutes = getAccessTokenExpireMinutes();
  cookieStore.set("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: expireMinutes * 60,
    path: "/",
  });
}

export async function setRefreshTokenCookie(token: string) {
  const cookieStore = await cookies();
  const expireDays = getRefreshTokenExpireDays();
  cookieStore.set("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: expireDays * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
}
