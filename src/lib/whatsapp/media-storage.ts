import { access, readFile } from "fs/promises";
import { promises as fs } from "fs";
import path from "path";
import type { Message } from "whatsapp-web.js";
import { isDbEnabled } from "@/lib/db/config";
import {
  dbGetMediaRecord,
  dbListSavedMediaForChat,
  dbMediaFileExists,
  dbRemoveMediaRecord,
  dbSaveMediaRecord,
  dbGetMediaBytes,
} from "@/lib/db/media";
import { getDataDir } from "@/lib/data-dir";

const DATA_DIR = getDataDir();
const MEDIA_DIR = path.join(DATA_DIR, "media");
const INDEX_PATH = path.join(DATA_DIR, "media-index.json");

export const MEDIA_MESSAGE_TYPES = new Set([
  "image",
  "video",
  "audio",
  "ptt",
  "document",
  "sticker",
]);

export interface SavedMediaRecord {
  id: string;
  accountId: string;
  chatId: string;
  mimeType: string;
  filename: string;
  relativePath: string;
  messageType: string;
  isViewOnce: boolean;
  caption: string;
  fromMe: boolean;
  savedAt: string;
}

type MediaIndex = Record<string, SavedMediaRecord>;

async function readIndexFile(): Promise<MediaIndex> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    return JSON.parse(raw) as MediaIndex;
  } catch {
    return {};
  }
}

async function writeIndexFile(index: MediaIndex) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

function fileToken(messageId: string): string {
  return Buffer.from(messageId).toString("base64url");
}

function extFromMime(mimeType: string, filename?: string | null): string {
  if (filename?.includes(".")) {
    return filename.split(".").pop()!.toLowerCase();
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  return map[mimeType] ?? mimeType.split("/")[1]?.split(";")[0] ?? "bin";
}

export function isMediaMessageType(type: string): boolean {
  return MEDIA_MESSAGE_TYPES.has(type);
}

export function isViewOnceMessage(msg: Message): boolean {
  if (msg.isEphemeral) return true;
  const raw = (msg as Message & { _data?: Record<string, unknown> })._data;
  if (!raw || typeof raw !== "object") return false;
  if (raw.isViewOnce === true) return true;
  if (raw.viewOnce === true) return true;
  if (raw.isViewOnceV2 === true) return true;
  if (raw.viewMode === "ONCE" || raw.viewMode === 2) return true;
  return false;
}

export async function listSavedMediaForChat(chatId: string): Promise<SavedMediaRecord[]> {
  if (isDbEnabled()) return dbListSavedMediaForChat(chatId);
  const index = await readIndexFile();
  return Object.values(index)
    .filter((item) => item.chatId === chatId && item.isViewOnce)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function mediaApiUrl(messageId: string): string {
  return `/api/whatsapp/media?id=${encodeURIComponent(messageId)}`;
}

export async function getMediaRecord(messageId: string): Promise<SavedMediaRecord | null> {
  if (isDbEnabled()) return dbGetMediaRecord(messageId);
  const index = await readIndexFile();
  return index[messageId] ?? null;
}

export async function getMediaAbsolutePath(messageId: string): Promise<string | null> {
  if (isDbEnabled()) {
    const record = await getMediaRecord(messageId);
    return record ? `db://${messageId}` : null;
  }
  const record = await getMediaRecord(messageId);
  if (!record) return null;
  return path.join(MEDIA_DIR, record.relativePath);
}

export async function getMediaBytes(messageId: string): Promise<Buffer | null> {
  if (isDbEnabled()) return dbGetMediaBytes(messageId);
  const filePath = await getMediaAbsolutePath(messageId);
  if (!filePath) return null;
  try {
    const bytes = await readFile(filePath);
    return bytes.byteLength ? bytes : null;
  } catch {
    return null;
  }
}

export async function mediaFileExists(messageId: string): Promise<boolean> {
  if (isDbEnabled()) return dbMediaFileExists(messageId);
  const filePath = await getMediaAbsolutePath(messageId);
  if (!filePath) return false;
  try {
    await access(filePath);
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

export async function removeMediaRecord(messageId: string) {
  if (isDbEnabled()) {
    await dbRemoveMediaRecord(messageId);
    return;
  }
  const index = await readIndexFile();
  if (!index[messageId]) return;
  delete index[messageId];
  await writeIndexFile(index);
}

function normalizeBase64(data: string): string {
  const trimmed = data.trim();
  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    if (comma !== -1) return trimmed.slice(comma + 1);
  }
  return trimmed.replace(/\s/g, "");
}

export async function saveMessageMediaFromWa(
  msg: Message,
  accountId: string,
  chatId: string,
  options?: { force?: boolean }
): Promise<SavedMediaRecord | null> {
  const messageId = msg.id?._serialized;
  if (!messageId) return null;

  const existing = await getMediaRecord(messageId);
  if (existing && !options?.force) {
    if (await mediaFileExists(messageId)) return existing;
    await removeMediaRecord(messageId);
  }

  const shouldCapture =
    msg.hasMedia || isMediaMessageType(msg.type) || isViewOnceMessage(msg);
  if (!shouldCapture) return null;

  try {
    await msg.reload();
  } catch {
    // message may not be in WA cache anymore
  }

  const downloaded = await msg.downloadMedia();
  if (!downloaded?.data) return null;

  const ext = extFromMime(downloaded.mimetype, downloaded.filename);
  const relativePath = path.join(accountId, `${fileToken(messageId)}.${ext}`).replace(/\\/g, "/");
  const bytes = Buffer.from(normalizeBase64(downloaded.data), "base64");
  if (bytes.length === 0) return null;

  const record: SavedMediaRecord = {
    id: messageId,
    accountId,
    chatId,
    mimeType: downloaded.mimetype,
    filename: downloaded.filename || `${fileToken(messageId)}.${ext}`,
    relativePath,
    messageType: msg.type,
    isViewOnce: isViewOnceMessage(msg),
    caption: msg.body || "",
    fromMe: Boolean(msg.fromMe),
    savedAt: new Date().toISOString(),
  };

  if (isDbEnabled()) {
    return dbSaveMediaRecord(record, bytes);
  }

  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const absolutePath = path.join(MEDIA_DIR, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);

  const index = await readIndexFile();
  index[messageId] = record;
  await writeIndexFile(index);

  return record;
}
