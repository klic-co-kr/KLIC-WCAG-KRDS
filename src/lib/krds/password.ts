import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PEPPER = process.env.KLIC_KRDS_PEPPER ?? "klic-krds-pepper-v1";

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const digest = createHash("sha256")
    .update(`${s}:${PEPPER}:${password}`)
    .digest("hex");
  return `${s}$${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split("$");
  if (!salt || !digest) return false;
  const next = hashPassword(password, salt);
  const [, nextDigest] = next.split("$");
  if (!nextDigest || nextDigest.length !== digest.length) return false;
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(nextDigest));
  } catch {
    return false;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}
