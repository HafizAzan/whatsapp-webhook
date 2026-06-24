import { access, rename, rm } from "fs/promises";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
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

async function readRegistry(): Promise<AccountRegistryFile> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
    return { ...defaultRegistry(), ...JSON.parse(raw) };
  } catch {
    return defaultRegistry();
  }
}

async function writeRegistry(data: AccountRegistryFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf-8");
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
  const dir = sessionDirForClientId(clientIdForAccount(accountId));
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
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
  const registry = await readRegistry();
  return registry.activeAccountId;
}

export async function setActiveAccountId(accountId: string | null): Promise<void> {
  const registry = await readRegistry();
  registry.activeAccountId = accountId ? normalizeAccountId(accountId) : null;
  await writeRegistry(registry);
}

export async function upsertLinkedAccount(
  accountId: string,
  pushName: string | null,
  clientId: string
): Promise<LinkedAccountRecord> {
  const id = normalizeAccountId(accountId);
  const registry = await readRegistry();
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
  await writeRegistry(registry);
  return record;
}

export async function removeLinkedAccount(accountId: string): Promise<boolean> {
  const id = normalizeAccountId(accountId);
  const registry = await readRegistry();
  const before = registry.accounts.length;
  registry.accounts = registry.accounts.filter((a) => a.accountId !== id);
  if (registry.activeAccountId === id) {
    registry.activeAccountId = registry.accounts[0]?.accountId ?? null;
  }
  await writeRegistry(registry);
  await clearAccountSession(id);
  return registry.accounts.length < before;
}

export async function getLinkedAccount(accountId: string): Promise<LinkedAccountRecord | null> {
  const registry = await readRegistry();
  const id = normalizeAccountId(accountId);
  return registry.accounts.find((a) => a.accountId === id) ?? null;
}

export async function resolveClientIdForAccount(accountId: string): Promise<string> {
  const account = await getLinkedAccount(accountId);
  return account?.clientId ?? clientIdForAccount(accountId);
}

export async function listLinkedAccounts(): Promise<LinkedAccountSummary[]> {
  const registry = await readRegistry();
  const summaries = await Promise.all(
    registry.accounts.map(async (account) => ({
      ...account,
      hasSession: await accountSessionExists(account.accountId),
    }))
  );
  return summaries.sort((a, b) => b.lastConnectedAt.localeCompare(a.lastConnectedAt));
}
