import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { ensureDbSchema, getSql } from "@/lib/db/schema";
import { isDbEnabled } from "@/lib/db/config";
import { AUTH_PATH } from "@/lib/whatsapp/account-registry";

const execFileAsync = promisify(execFile);

export async function sessionExistsInDb(clientId: string): Promise<boolean> {
  if (!isDbEnabled()) return false;
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM wa_session_backups WHERE client_id = ${clientId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function restoreSessionFromDb(clientId: string): Promise<boolean> {
  if (!isDbEnabled()) return false;

  try {
    await ensureDbSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT data FROM wa_session_backups WHERE client_id = ${clientId} LIMIT 1
    `;
    const data = rows[0]?.data as Buffer | undefined;
    if (!data?.length) return false;

    const tmpArchive = path.join("/tmp", `wa-restore-${clientId}.tar.gz`);
    await writeFile(tmpArchive, data);
    await mkdir(AUTH_PATH, { recursive: true });
    await rm(path.join(AUTH_PATH, `session-${clientId}`), { recursive: true, force: true });
    await execFileAsync("tar", ["-xzf", tmpArchive, "-C", AUTH_PATH]);
    await rm(tmpArchive, { force: true });
    return true;
  } catch (err) {
    console.warn("restoreSessionFromDb:", err);
    return false;
  }
}

export async function backupSessionToDb(clientId: string): Promise<void> {
  if (!isDbEnabled()) return;

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

    const archive = await readFile(tmpArchive);
    await ensureDbSchema();
    const sql = getSql();
    await sql`
      INSERT INTO wa_session_backups (client_id, data, updated_at)
      VALUES (${clientId}, ${archive}, NOW())
      ON CONFLICT (client_id) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `;
  } catch (err) {
    console.warn("backupSessionToDb:", err);
  } finally {
    await rm(tmpArchive, { force: true }).catch(() => undefined);
  }
}

export async function deleteSessionFromDb(clientId: string): Promise<void> {
  if (!isDbEnabled()) return;
  await ensureDbSchema();
  const sql = getSql();
  await sql`DELETE FROM wa_session_backups WHERE client_id = ${clientId}`;
}
