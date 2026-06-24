import { ensureDbSchema, getSql } from "@/lib/db/schema";
import type { SavedMediaRecord } from "@/lib/whatsapp/media-storage";

type MediaRow = {
  id: string;
  account_id: string;
  chat_id: string;
  mime_type: string;
  filename: string;
  relative_path: string;
  message_type: string;
  is_view_once: boolean;
  caption: string;
  from_me: boolean;
  saved_at: Date | string;
};

function rowToRecord(row: MediaRow): SavedMediaRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    chatId: row.chat_id,
    mimeType: row.mime_type,
    filename: row.filename,
    relativePath: row.relative_path,
    messageType: row.message_type,
    isViewOnce: row.is_view_once,
    caption: row.caption,
    fromMe: row.from_me,
    savedAt: new Date(row.saved_at).toISOString(),
  };
}

export async function dbGetMediaRecord(messageId: string): Promise<SavedMediaRecord | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, account_id, chat_id, mime_type, filename, relative_path,
           message_type, is_view_once, caption, from_me, saved_at
    FROM saved_media
    WHERE id = ${messageId}
    LIMIT 1
  `;
  const row = rows[0] as MediaRow | undefined;
  return row ? rowToRecord(row) : null;
}

export async function dbGetMediaBytes(messageId: string): Promise<Buffer | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT data FROM saved_media WHERE id = ${messageId} LIMIT 1
  `;
  const data = rows[0]?.data as Buffer | undefined;
  return data?.length ? data : null;
}

export async function dbMediaFileExists(messageId: string): Promise<boolean> {
  const bytes = await dbGetMediaBytes(messageId);
  return Boolean(bytes?.length);
}

export async function dbListSavedMediaForChat(chatId: string): Promise<SavedMediaRecord[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, account_id, chat_id, mime_type, filename, relative_path,
           message_type, is_view_once, caption, from_me, saved_at
    FROM saved_media
    WHERE chat_id = ${chatId} AND is_view_once = true
    ORDER BY saved_at DESC
  `;
  return rows.map((row) => rowToRecord(row as MediaRow));
}

export async function dbRemoveMediaRecord(messageId: string): Promise<void> {
  await ensureDbSchema();
  const sql = getSql();
  await sql`DELETE FROM saved_media WHERE id = ${messageId}`;
}

export async function dbSaveMediaRecord(
  record: SavedMediaRecord,
  bytes: Buffer
): Promise<SavedMediaRecord> {
  await ensureDbSchema();
  const sql = getSql();
  await sql`
    INSERT INTO saved_media (
      id, account_id, chat_id, mime_type, filename, relative_path,
      message_type, is_view_once, caption, from_me, saved_at, data
    )
    VALUES (
      ${record.id},
      ${record.accountId},
      ${record.chatId},
      ${record.mimeType},
      ${record.filename},
      ${record.relativePath},
      ${record.messageType},
      ${record.isViewOnce},
      ${record.caption},
      ${record.fromMe},
      ${record.savedAt},
      ${bytes}
    )
    ON CONFLICT (id) DO UPDATE SET
      mime_type = EXCLUDED.mime_type,
      filename = EXCLUDED.filename,
      relative_path = EXCLUDED.relative_path,
      message_type = EXCLUDED.message_type,
      is_view_once = EXCLUDED.is_view_once,
      caption = EXCLUDED.caption,
      from_me = EXCLUDED.from_me,
      saved_at = EXCLUDED.saved_at,
      data = EXCLUDED.data
  `;
  return record;
}
