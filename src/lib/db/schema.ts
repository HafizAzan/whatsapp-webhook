import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl, isDbEnabled } from "@/lib/db/config";

let schemaReady: Promise<void> | null = null;

export function getSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Database is not configured");
  }
  return neon(url);
}

export async function ensureDbSchema(): Promise<void> {
  if (!isDbEnabled()) return;
  if (!schemaReady) {
    schemaReady = runSchema();
  }
  await schemaReady;
}

async function runSchema(): Promise<void> {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS linked_accounts (
      account_id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      push_name TEXT,
      linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_linked_accounts_last
    ON linked_accounts (last_connected_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      direction TEXT NOT NULL,
      method TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload_fields JSONB NOT NULL DEFAULT '[]',
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhooks_account ON webhooks (account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      webhook_id TEXT,
      received_at TIMESTAMPTZ NOT NULL,
      method TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      raw_query TEXT
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_account
    ON webhook_events (account_id, received_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS smart_replies (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      reply TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_smart_replies_account ON smart_replies (account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_scheduled_messages_account
    ON scheduled_messages (account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contacts JSONB NOT NULL DEFAULT '[]',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_broadcasts_account ON broadcasts (account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS saved_media (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      message_type TEXT NOT NULL,
      is_view_once BOOLEAN NOT NULL DEFAULT false,
      caption TEXT NOT NULL DEFAULT '',
      from_me BOOLEAN NOT NULL DEFAULT false,
      saved_at TIMESTAMPTZ NOT NULL,
      data BYTEA NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_saved_media_chat ON saved_media (chat_id, saved_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_saved_media_account ON saved_media (account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS wa_session_backups (
      client_id TEXT PRIMARY KEY,
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
