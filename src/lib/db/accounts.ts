import { ensureDbSchema, getSql } from "@/lib/db/schema";
import type { LinkedAccountRecord } from "@/lib/whatsapp/account-registry";

type AccountRow = {
  account_id: string;
  client_id: string;
  push_name: string | null;
  linked_at: Date | string;
  last_connected_at: Date | string;
};

function rowToRecord(row: AccountRow): LinkedAccountRecord {
  return {
    accountId: row.account_id,
    clientId: row.client_id,
    pushName: row.push_name,
    linkedAt: new Date(row.linked_at).toISOString(),
    lastConnectedAt: new Date(row.last_connected_at).toISOString(),
  };
}

export async function dbGetActiveAccountId(): Promise<string | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT value FROM app_settings WHERE key = 'active_account_id' LIMIT 1
  `;
  return rows[0]?.value ?? null;
}

export async function dbSetActiveAccountId(accountId: string | null): Promise<void> {
  await ensureDbSchema();
  const sql = getSql();
  if (!accountId) {
    await sql`DELETE FROM app_settings WHERE key = 'active_account_id'`;
    return;
  }
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('active_account_id', ${accountId})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function dbListLinkedAccounts(): Promise<LinkedAccountRecord[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT account_id, client_id, push_name, linked_at, last_connected_at
    FROM linked_accounts
    ORDER BY last_connected_at DESC
  `;
  return rows.map((row) => rowToRecord(row as AccountRow));
}

export async function dbGetLinkedAccount(accountId: string): Promise<LinkedAccountRecord | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT account_id, client_id, push_name, linked_at, last_connected_at
    FROM linked_accounts
    WHERE account_id = ${accountId}
    LIMIT 1
  `;
  const row = rows[0] as AccountRow | undefined;
  return row ? rowToRecord(row) : null;
}

export async function dbUpsertLinkedAccount(
  accountId: string,
  pushName: string | null,
  clientId: string,
  linkedAt?: string
): Promise<LinkedAccountRecord> {
  await ensureDbSchema();
  const sql = getSql();
  const now = new Date().toISOString();
  const existing = await dbGetLinkedAccount(accountId);

  const record: LinkedAccountRecord = {
    accountId,
    clientId,
    pushName: pushName ?? existing?.pushName ?? null,
    linkedAt: existing?.linkedAt ?? linkedAt ?? now,
    lastConnectedAt: now,
  };

  await sql`
    INSERT INTO linked_accounts (account_id, client_id, push_name, linked_at, last_connected_at)
    VALUES (
      ${record.accountId},
      ${record.clientId},
      ${record.pushName},
      ${record.linkedAt},
      ${record.lastConnectedAt}
    )
    ON CONFLICT (account_id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      push_name = COALESCE(EXCLUDED.push_name, linked_accounts.push_name),
      last_connected_at = EXCLUDED.last_connected_at
  `;

  await dbSetActiveAccountId(accountId);
  return record;
}

export async function dbRemoveLinkedAccount(accountId: string): Promise<LinkedAccountRecord | null> {
  await ensureDbSchema();
  const sql = getSql();
  const existing = await dbGetLinkedAccount(accountId);
  if (!existing) return null;

  await sql`DELETE FROM linked_accounts WHERE account_id = ${accountId}`;

  const active = await dbGetActiveAccountId();
  if (active === accountId) {
    const remaining = await dbListLinkedAccounts();
    await dbSetActiveAccountId(remaining[0]?.accountId ?? null);
  }

  return existing;
}
