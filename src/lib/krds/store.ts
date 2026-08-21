import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StoreData } from "./types";
import { hashPassword, newId } from "./password";

const DATA_DIR = path.join(process.cwd(), ".data", "klic-krds");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function seedStore(): StoreData {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: newId("usr"),
        email: "demo@klic.local",
        name: "KLIC 데모",
        role: "user",
        plan: "standard",
        passwordHash: hashPassword("demo1234"),
        createdAt: now,
      },
      {
        id: newId("usr"),
        email: "admin@klic.local",
        name: "KLIC 관리",
        role: "admin",
        plan: "premium",
        passwordHash: hashPassword("admin1234"),
        createdAt: now,
      },
    ],
    sessions: [],
    analyses: [],
    contacts: [],
    seededAt: now,
  };
}

function ensureDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

export function readStore(): StoreData {
  ensureDir();
  try {
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    if (!parsed.users?.length) return seedStore();
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      analyses: parsed.analyses ?? [],
      contacts: parsed.contacts ?? [],
      seededAt: parsed.seededAt ?? new Date().toISOString(),
    };
  } catch {
    const seeded = seedStore();
    writeStore(seeded);
    return seeded;
  }
}

export function writeStore(store: StoreData): void {
  ensureDir();
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  renameSync(tmp, STORE_PATH);
}

export function mutateStore<T>(fn: (store: StoreData) => T): T {
  const store = readStore();
  const result = fn(store);
  writeStore(store);
  return result;
}

export function purgeExpiredSessions(store: StoreData, now = Date.now()): void {
  store.sessions = store.sessions.filter(
    (s) => new Date(s.expiresAt).getTime() > now,
  );
}
