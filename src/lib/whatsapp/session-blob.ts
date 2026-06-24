import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { AUTH_PATH } from "@/lib/whatsapp/account-registry";

const execFileAsync = promisify(execFile);

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL);
}

function sessionBlobKey(clientId: string): string {
  return `wa-sessions/${clientId}.tar.gz`;
}

export async function sessionExistsInBlob(clientId: string): Promise<boolean> {
  const { sessionExistsInDb } = await import("@/lib/db/sessions");
  if (await sessionExistsInDb(clientId)) return true;
  if (!blobEnabled()) return false;
  try {
    const { list } = await import("@vercel/blob");
    const key = sessionBlobKey(clientId);
    const found = await list({ prefix: key, limit: 1 });
    return found.blobs.some((b) => b.pathname === key);
  } catch {
    return false;
  }
}

export async function restoreSessionFromBlob(clientId: string): Promise<boolean> {
  const { restoreSessionFromDb } = await import("@/lib/db/sessions");
  if (await restoreSessionFromDb(clientId)) return true;
  if (!blobEnabled()) return false;

  try {
    const { list } = await import("@vercel/blob");
    const key = sessionBlobKey(clientId);
    const found = await list({ prefix: key, limit: 1 });
    const item = found.blobs.find((b) => b.pathname === key);
    if (!item?.url) return false;

    const tmpArchive = path.join("/tmp", `wa-restore-${clientId}.tar.gz`);
    const res = await fetch(item.url);
    if (!res.ok) return false;

    await writeFile(tmpArchive, Buffer.from(await res.arrayBuffer()));
    await mkdir(AUTH_PATH, { recursive: true });
    await rm(path.join(AUTH_PATH, `session-${clientId}`), { recursive: true, force: true });
    await execFileAsync("tar", ["-xzf", tmpArchive, "-C", AUTH_PATH]);
    await rm(tmpArchive, { force: true });
    return true;
  } catch (err) {
    console.warn("restoreSessionFromBlob:", err);
    return false;
  }
}

export async function backupSessionToBlob(clientId: string): Promise<void> {
  const { backupSessionToDb } = await import("@/lib/db/sessions");
  await backupSessionToDb(clientId);
  if (!blobEnabled()) return;

  const sessionDir = path.join(AUTH_PATH, `session-${clientId}`);
  const tmpArchive = path.join("/tmp", `wa-backup-${clientId}.tar.gz`);

  try {
    await readFile(path.join(sessionDir, "Default", "Preferences"));
  } catch {
    return;
  }

  try {
    await execFileAsync("tar", [
      "-czf",
      tmpArchive,
      "-C",
      AUTH_PATH,
      `session-${clientId}`,
    ]);

    const { put } = await import("@vercel/blob");
    const body = await readFile(tmpArchive);
    await put(sessionBlobKey(clientId), body, {
      access: "public",
      addRandomSuffix: false,
    });
  } catch (err) {
    console.warn("backupSessionToBlob:", err);
  } finally {
    await rm(tmpArchive, { force: true }).catch(() => undefined);
  }
}

const REGISTRY_BLOB_KEY = "wa-accounts/accounts.json";

export async function restoreRegistryFromBlob(): Promise<string | null> {
  if (!blobEnabled()) return null;
  try {
    const { list } = await import("@vercel/blob");
    const found = await list({ prefix: REGISTRY_BLOB_KEY, limit: 1 });
    const item = found.blobs.find((b) => b.pathname === REGISTRY_BLOB_KEY);
    if (!item?.url) return null;
    const res = await fetch(item.url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function backupRegistryToBlob(json: string): Promise<void> {
  if (!blobEnabled()) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(REGISTRY_BLOB_KEY, json, {
      access: "public",
      addRandomSuffix: false,
    });
  } catch (err) {
    console.warn("backupRegistryToBlob:", err);
  }
}

export async function deleteSessionFromBlob(clientId: string): Promise<void> {
  const { deleteSessionFromDb } = await import("@/lib/db/sessions");
  await deleteSessionFromDb(clientId);
  if (!blobEnabled()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(sessionBlobKey(clientId));
  } catch {
    // ignore
  }
}
