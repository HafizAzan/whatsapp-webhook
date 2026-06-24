import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const user = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || "neondb";
  if (!host || !user || !password) {
    throw new Error("Set DATABASE_URL or DB_HOST/DB_USERNAME/DB_PASSWORD");
  }
  const ssl = process.env.DB_SSL === "true" ? "?sslmode=require" : "";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}${ssl}`;
}

const sql = neon(getDatabaseUrl());
const dataDir = path.join(process.cwd(), "data");

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`;
  await sql`CREATE TABLE IF NOT EXISTS linked_accounts (
    account_id TEXT PRIMARY KEY, client_id TEXT NOT NULL, push_name TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, direction TEXT NOT NULL,
    method TEXT NOT NULL, endpoint TEXT NOT NULL, payload_fields JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY, account_id TEXT, webhook_id TEXT, received_at TIMESTAMPTZ NOT NULL,
    method TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}', raw_query TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS smart_replies (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, keyword TEXT NOT NULL, reply TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS scheduled_messages (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, phone TEXT NOT NULL, message TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, contacts JSONB NOT NULL DEFAULT '[]',
    message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS saved_media (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, chat_id TEXT NOT NULL, mime_type TEXT NOT NULL,
    filename TEXT NOT NULL, relative_path TEXT NOT NULL, message_type TEXT NOT NULL,
    is_view_once BOOLEAN NOT NULL DEFAULT false, caption TEXT NOT NULL DEFAULT '',
    from_me BOOLEAN NOT NULL DEFAULT false, saved_at TIMESTAMPTZ NOT NULL, data BYTEA NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS wa_session_backups (
    client_id TEXT PRIMARY KEY, data BYTEA NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function migrateAccounts() {
  const accountsPath = path.join(dataDir, "accounts.json");
  try {
    const raw = await readFile(accountsPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.activeAccountId) {
      await sql`
        INSERT INTO app_settings (key, value) VALUES ('active_account_id', ${parsed.activeAccountId})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `;
    }
    for (const account of parsed.accounts ?? []) {
      await sql`
        INSERT INTO linked_accounts (account_id, client_id, push_name, linked_at, last_connected_at)
        VALUES (${account.accountId}, ${account.clientId}, ${account.pushName}, ${account.linkedAt}, ${account.lastConnectedAt})
        ON CONFLICT (account_id) DO UPDATE SET
          client_id = EXCLUDED.client_id,
          push_name = EXCLUDED.push_name,
          last_connected_at = EXCLUDED.last_connected_at
      `;
    }
    console.log(`Migrated ${parsed.accounts?.length ?? 0} linked accounts`);
  } catch {
    console.log("No accounts.json to migrate");
  }
}

async function migrateStore() {
  const storePath = path.join(dataDir, "store.json");
  try {
    const raw = await readFile(storePath, "utf-8");
    const store = JSON.parse(raw);
    for (const w of store.webhooks ?? []) {
      await sql`
        INSERT INTO webhooks (id, account_id, name, direction, method, endpoint, payload_fields, enabled, created_at, updated_at)
        VALUES (${w.id}, ${w.accountId}, ${w.name}, ${w.direction}, ${w.method}, ${w.endpoint}, ${JSON.stringify(w.payloadFields)}, ${w.enabled}, ${w.createdAt}, ${w.updatedAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    for (const e of store.events ?? []) {
      await sql`
        INSERT INTO webhook_events (id, account_id, webhook_id, received_at, method, payload, raw_query)
        VALUES (${e.id}, ${e.accountId ?? null}, ${e.webhookId ?? null}, ${e.receivedAt}, ${e.method}, ${JSON.stringify(e.payload)}, ${e.rawQuery ?? null})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    for (const r of store.smartReplies ?? []) {
      await sql`
        INSERT INTO smart_replies (id, account_id, keyword, reply, enabled, created_at)
        VALUES (${r.id}, ${r.accountId}, ${r.keyword}, ${r.reply}, ${r.enabled}, ${r.createdAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    for (const m of store.scheduledMessages ?? []) {
      await sql`
        INSERT INTO scheduled_messages (id, account_id, phone, message, scheduled_at, status, created_at)
        VALUES (${m.id}, ${m.accountId}, ${m.phone}, ${m.message}, ${m.scheduledAt}, ${m.status}, ${m.createdAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    for (const b of store.broadcasts ?? []) {
      await sql`
        INSERT INTO broadcasts (id, account_id, name, contacts, message, status, created_at)
        VALUES (${b.id}, ${b.accountId}, ${b.name}, ${JSON.stringify(b.contacts)}, ${b.message}, ${b.status}, ${b.createdAt})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    console.log("Migrated store.json");
  } catch {
    console.log("No store.json to migrate");
  }
}

async function migrateMediaIndex() {
  const indexPath = path.join(dataDir, "media-index.json");
  try {
    const raw = await readFile(indexPath, "utf-8");
    const index = JSON.parse(raw);
    let count = 0;
    for (const record of Object.values(index)) {
      const filePath = path.join(dataDir, "media", record.relativePath);
      try {
        const bytes = await readFile(filePath);
        if (!bytes.length) continue;
        await sql`
          INSERT INTO saved_media (
            id, account_id, chat_id, mime_type, filename, relative_path,
            message_type, is_view_once, caption, from_me, saved_at, data
          )
          VALUES (
            ${record.id}, ${record.accountId}, ${record.chatId}, ${record.mimeType},
            ${record.filename}, ${record.relativePath}, ${record.messageType},
            ${record.isViewOnce}, ${record.caption}, ${record.fromMe}, ${record.savedAt}, ${bytes}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        count++;
      } catch {
        // skip missing files
      }
    }
    console.log(`Migrated ${count} media files`);
  } catch {
    console.log("No media-index.json to migrate");
  }
}

async function main() {
  await ensureSchema();
  await migrateAccounts();
  await migrateStore();
  await migrateMediaIndex();
  console.log("Migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
