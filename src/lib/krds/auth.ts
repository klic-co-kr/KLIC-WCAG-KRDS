import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { mutateStore, purgeExpiredSessions } from "./store";
import { hashPassword, newId, newToken, verifyPassword } from "./password";
import type { PublicUser, User } from "./types";
import { toPublicUser } from "./types";

export const SESSION_COOKIE = "klic_krds_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7d

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function registerUser(input: {
  email: string;
  password: string;
  name: string;
}): PublicUser {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || input.password.length < 6) {
    throw new AuthError("이메일/비밀번호 형식이 올바르지 않습니다.", 400);
  }
  return mutateStore((store) => {
    if (store.users.some((u) => u.email === email)) {
      throw new AuthError("이미 등록된 이메일입니다.", 409);
    }
    const user: User = {
      id: newId("usr"),
      email,
      name: input.name.trim() || email.split("@")[0],
      role: "user",
      plan: "free",
      passwordHash: hashPassword(input.password),
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);
    return toPublicUser(user);
  });
}

export function loginUser(emailRaw: string, password: string): {
  user: PublicUser;
  token: string;
  expiresAt: string;
} {
  const email = emailRaw.trim().toLowerCase();
  return mutateStore((store) => {
    purgeExpiredSessions(store);
    const user = store.users.find((u: any) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AuthError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
    }
    const token = newToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    store.sessions.push({
      id: newId("ses"),
      userId: user.id,
      token,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    return { user: toPublicUser(user), token, expiresAt };
  });
}

export function logoutByToken(token: string | undefined): void {
  if (!token) return;
  mutateStore((store) => {
    store.sessions = store.sessions.filter((s: any) => s.token !== token);
  });
}

function findUserByToken(token: string | undefined): User | null {
  if (!token) return null;
  return mutateStore((store) => {
    purgeExpiredSessions(store);
    const session = store.sessions.find(
      (s) => s.token === token && new Date(s.expiresAt).getTime() > Date.now(),
    );
    if (!session) return null;
    return store.users.find((u: any) => u.id === session.userId) ?? null;
  });
}

export function getTokenFromRequest(req: NextRequest): string | undefined {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function getTokenFromCookies(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export function requireUserFromToken(token: string | undefined): User {
  const user = findUserByToken(token);
  if (!user) throw new AuthError("로그인이 필요합니다.", 401);
  return user;
}

export async function requireUserFromCookies(): Promise<User> {
  const token = await getTokenFromCookies();
  return requireUserFromToken(token);
}

export function tryUserFromToken(token: string | undefined): User | null {
  return findUserByToken(token);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // localhost HTTP 데모 기본 off. HTTPS 배포 시 VC_COOKIE_SECURE=1
  secure: process.env.VC_COOKIE_SECURE === "1",
  maxAge: SESSION_TTL_MS / 1000,
};
