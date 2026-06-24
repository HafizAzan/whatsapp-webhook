import { access, rename, rm } from "fs/promises";
import { promises as fs } from "fs";
import path from "path";
import { isDbEnabled } from "@/lib/db/config";
import {
  dbGetActiveAccountId,
  dbGetLinkedAccount,
  dbListLinkedAccounts,
  dbRemoveLinkedAccount,
  dbSetActiveAccountId,
  dbUpsertLinkedAccount,
} from "@/lib/db/accounts";
import { sessionExistsInDb } from "@/lib/db/sessions";
import { getDataDir } from "@/lib/data-dir";

const DATA_DIR = getDataDir();
const REGISTRY_PATH = path.join(DATA_DIR, "accounts.json");
export const AUTH_PATH = path.join(DATA_DIR, ".wwebjs_auth");

export interface LinkedAccountRecord {
  accountId: string;
  clientId: string;
  pushName: string | null;
  linkedAt: string;
  lastConnectedAt: string;
}

interface AccountRegistryFile {
  activeAccountId: string | null;
  accounts: LinkedAccountRecord[];
}

export interface LinkedAccountSummary extends LinkedAccountRecord {
  hasSession: boolean;
}

function defaultRegistry(): AccountRegistryFile {
  return { activeAccountId: null, accounts: [] };
}

async function readRegistryFile(): Promise<AccountRegistryFile> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
    return { ...defaultRegistry(), ...JSON.parse(raw) };
  } catch {
    if (process.env.VERCEL) {
      const { restoreRegistryFromBlob } = await import("./session-blob");
      const blobJson = await restoreRegistryFromBlob();
      if (blobJson) {
        const parsed = { ...defaultRegistry(), ...JSON.parse(blobJson) };
        await fs.writeFile(REGISTRY_PATH, JSON.stringify(parsed, null, 2), "utf-8");
        return parsed;
      }
    }
    return defaultRegistry();
  }
}

async function writeRegistryFile(data: AccountRegistryFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(REGISTRY_PATH, json, "utf-8");
  if (process.env.VERCEL && !isDbEnabled()) {
    const { backupRegistryToBlob } = await import("./session-blob");
    void backupRegistryToBlob(json);
  }
}

export function normalizeAccountId(value: string): string {
  return value.replace(/\D/g, "");
}

export function clientIdForAccount(accountId: string): string {
  return `acc-${normalizeAccountId(accountId)}`;
}

export function sessionDirForClientId(clientId: string): string {
  return path.join(AUTH_PATH, `session-${clientId}`);
}

export async function accountSessionExists(accountId: string): Promise<boolean> {
  const normalized = normalizeAccountId(accountId);
  const account = await getLinkedAccount(normalized);
  const clientIds = new Set<string>([clientIdForAccount(normalized)]);
  if (account?.clientId) clientIds.add(account.clientId);

  for (const clientId of clientIds) {
    try {
      await access(sessionDirForClientId(clientId));
      return true;
    } catch {
      // try next
    }
  }

  for (const clientId of clientIds) {
    if (await sessionExistsInDb(clientId)) return true;
    if (process.env.VERCEL) {
      const { sessionExistsInBlob } = await import("./session-blob");
      if (await sessionExistsInBlob(clientId)) return true;
    }
  }
  return false;
}

export async function clearAccountSession(accountId: string): Promise<void> {
  const dir = sessionDirForClientId(clientIdForAccount(accountId));
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function migrateAuthSession(fromClientId: string, toClientId: string): Promise<void> {
  if (fromClientId === toClientId) return;
  const fromDir = sessionDirForClientId(fromClientId);
  const toDir = sessionDirForClientId(toClientId);
  try {
    await access(fromDir);
  } catch {
    return;
  }
  await rm(toDir, { recursive: true, force: true });
  await rename(fromDir, toDir);
}

export async function getActiveAccountId(): Promise<string | null> {
  if (isDbEnabled()) return dbGetActiveAccountId();
  const registry = await readRegistryFile();
  return registry.activeAccountId;
}

export async function setActiveAccountId(accountId: string | null): Promise<void> {
  if (isDbEnabled()) {
    await dbSetActiveAccountId(accountId ? normalizeAccountId(accountId) : null);
    return;
  }
  const registry = await readRegistryFile();
  registry.activeAccountId = accountId ? normalizeAccountId(accountId) : null;
  await writeRegistryFile(registry);
}

export async function upsertLinkedAccount(
  accountId: string,
  pushName: string | null,
  clientId: string
): Promise<LinkedAccountRecord> {
  const id = normalizeAccountId(accountId);
  if (isDbEnabled()) {
    return dbUpsertLinkedAccount(id, pushName, clientId);
  }

  const registry = await readRegistryFile();
  const now = new Date().toISOString();
  const existing = registry.accounts.find((a) => a.accountId === id);
  const record: LinkedAccountRecord = {
    accountId: id,
    clientId,
    pushName: pushName ?? existing?.pushName ?? null,
    linkedAt: existing?.linkedAt ?? now,
    lastConnectedAt: now,
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    registry.accounts.push(record);
  }

  registry.activeAccountId = id;
  registry.accounts.sort((a, b) => b.lastConnectedAt.localeCompare(a.lastConnectedAt));
  await writeRegistryFile(registry);
  return record;
}

export async function clearSessionsForAccount(
  accountId: string,
  clientId?: string | null
): Promise<void> {
  const id = normalizeAccountId(accountId);
  const clientIds = new Set<string>();
  if (clientId) clientIds.add(clientId);
  clientIds.add(clientIdForAccount(id));

  for (const cid of clientIds) {
    try {
      await rm(sessionDirForClientId(cid), { recursive: true, force: true });
    } catch {
      // ignore missing / locked session dirs
    }
    const { deleteSessionFromDb } = await import("@/lib/db/sessions");
    void deleteSessionFromDb(cid);
    if (process.env.VERCEL) {
      const { deleteSessionFromBlob } = await import("./session-blob");
      void deleteSessionFromBlob(cid);
    }
  }
}

export async function removeLinkedAccount(accountId: string): Promise<boolean> {
  const id = normalizeAccountId(accountId);

  if (isDbEnabled()) {
    const removed = await dbRemoveLinkedAccount(id);
    if (!removed) return false;
    await clearSessionsForAccount(id, removed.clientId);
    return true;
  }

  const registry = await readRegistryFile();
  const account = registry.accounts.find((a) => a.accountId === id);
  const before = registry.accounts.length;
  registry.accounts = registry.accounts.filter((a) => a.accountId !== id);
  if (registry.activeAccountId === id) {
    registry.activeAccountId = registry.accounts[0]?.accountId ?? null;
  }

  try {
    await writeRegistryFile(registry);
  } catch (err) {
    console.error("removeLinkedAccount writeRegistry:", err);
    throw err;
  }

  await clearSessionsForAccount(id, account?.clientId);
  return registry.accounts.length < before;
}

export async function getLinkedAccount(accountId: string): Promise<LinkedAccountRecord | null> {
  const id = normalizeAccountId(accountId);
  if (isDbEnabled()) return dbGetLinkedAccount(id);
  const registry = await readRegistryFile();
  return registry.accounts.find((a) => a.accountId === id) ?? null;
}

export async function resolveClientIdForAccount(accountId: string): Promise<string> {
  const account = await getLinkedAccount(accountId);
  return account?.clientId ?? clientIdForAccount(accountId);
}

export async function listLinkedAccounts(): Promise<LinkedAccountSummary[]> {
  const accounts = isDbEnabled()
    ? await dbListLinkedAccounts()
    : (await readRegistryFile()).accounts;

  const summaries = await Promise.all(
    accounts.map(async (account) => ({
      ...account,
      hasSession: await accountSessionExists(account.accountId),
    }))
  );
  return summaries.sort((a, b) => b.lastConnectedAt.localeCompare(a.lastConnectedAt));
}
