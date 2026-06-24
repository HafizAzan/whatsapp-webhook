import { isDbEnabled } from "@/lib/db/config";
import * as dbStore from "@/lib/db/app-store";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  BroadcastList,
  ScheduledMessage,
  SmartReply,
  WebhookConfig,
  WebhookEvent,
} from "./types";
import { getDataDir } from "@/lib/data-dir";

const DATA_DIR = getDataDir();

interface StoreData {
  webhooks: WebhookConfig[];
  events: WebhookEvent[];
  smartReplies: SmartReply[];
  scheduledMessages: ScheduledMessage[];
  broadcasts: BroadcastList[];
}

const DEFAULT_DATA: StoreData = {
  webhooks: [],
  events: [],
  smartReplies: [],
  scheduledMessages: [],
  broadcasts: [],
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStoreFile(): Promise<StoreData> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "store.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

async function writeStoreFile(data: StoreData) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, "store.json");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function forAccount<T extends { accountId?: string }>(items: T[], accountId: string): T[] {
  return items.filter((item) => item.accountId === accountId);
}

export async function getWebhooks(accountId: string): Promise<WebhookConfig[]> {
  if (isDbEnabled()) return dbStore.dbGetWebhooks(accountId);
  const store = await readStoreFile();
  return forAccount(store.webhooks, accountId);
}

export async function getWebhook(id: string, accountId: string): Promise<WebhookConfig | null> {
  if (isDbEnabled()) return dbStore.dbGetWebhook(id, accountId);
  const store = await readStoreFile();
  return store.webhooks.find((w) => w.id === id && w.accountId === accountId) ?? null;
}

export async function createWebhook(
  accountId: string,
  data: Omit<WebhookConfig, "id" | "accountId" | "createdAt" | "updatedAt">
): Promise<WebhookConfig> {
  if (isDbEnabled()) return dbStore.dbCreateWebhook(accountId, data);
  const store = await readStoreFile();
  const now = new Date().toISOString();
  const webhook: WebhookConfig = {
    ...data,
    accountId,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  store.webhooks.push(webhook);
  await writeStoreFile(store);
  return webhook;
}

export async function updateWebhook(
  id: string,
  accountId: string,
  data: Partial<Omit<WebhookConfig, "id" | "accountId" | "createdAt">>
): Promise<WebhookConfig | null> {
  if (isDbEnabled()) return dbStore.dbUpdateWebhook(id, accountId, data);
  const store = await readStoreFile();
  const index = store.webhooks.findIndex((w) => w.id === id && w.accountId === accountId);
  if (index === -1) return null;
  store.webhooks[index] = {
    ...store.webhooks[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await writeStoreFile(store);
  return store.webhooks[index];
}

export async function deleteWebhook(id: string, accountId: string): Promise<boolean> {
  if (isDbEnabled()) return dbStore.dbDeleteWebhook(id, accountId);
  const store = await readStoreFile();
  const before = store.webhooks.length;
  store.webhooks = store.webhooks.filter((w) => !(w.id === id && w.accountId === accountId));
  if (store.webhooks.length === before) return false;
  await writeStoreFile(store);
  return true;
}

export async function addEvent(
  event: Omit<WebhookEvent, "id" | "receivedAt">,
  accountId?: string
): Promise<WebhookEvent> {
  if (isDbEnabled()) return dbStore.dbAddEvent(event, accountId);
  const store = await readStoreFile();
  const record: WebhookEvent = {
    ...event,
    accountId,
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
  };
  store.events.unshift(record);
  if (store.events.length > 500) {
    store.events = store.events.slice(0, 500);
  }
  await writeStoreFile(store);
  return record;
}

export async function getEvents(accountId: string, limit = 50): Promise<WebhookEvent[]> {
  if (isDbEnabled()) return dbStore.dbGetEvents(accountId, limit);
  const store = await readStoreFile();
  return forAccount(store.events, accountId).slice(0, limit);
}

export async function getSmartReplies(accountId: string): Promise<SmartReply[]> {
  if (isDbEnabled()) return dbStore.dbGetSmartReplies(accountId);
  const store = await readStoreFile();
  return forAccount(store.smartReplies, accountId);
}

export async function createSmartReply(
  accountId: string,
  data: Omit<SmartReply, "id" | "accountId" | "createdAt">
): Promise<SmartReply> {
  if (isDbEnabled()) return dbStore.dbCreateSmartReply(accountId, data);
  const store = await readStoreFile();
  const reply: SmartReply = {
    ...data,
    accountId,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store.smartReplies.push(reply);
  await writeStoreFile(store);
  return reply;
}

export async function deleteSmartReply(id: string, accountId: string): Promise<boolean> {
  if (isDbEnabled()) return dbStore.dbDeleteSmartReply(id, accountId);
  const store = await readStoreFile();
  const before = store.smartReplies.length;
  store.smartReplies = store.smartReplies.filter(
    (r) => !(r.id === id && r.accountId === accountId)
  );
  if (store.smartReplies.length === before) return false;
  await writeStoreFile(store);
  return true;
}

export async function getScheduledMessages(accountId: string): Promise<ScheduledMessage[]> {
  if (isDbEnabled()) return dbStore.dbGetScheduledMessages(accountId);
  const store = await readStoreFile();
  return forAccount(store.scheduledMessages, accountId);
}

export async function createScheduledMessage(
  accountId: string,
  data: Omit<ScheduledMessage, "id" | "accountId" | "createdAt" | "status">
): Promise<ScheduledMessage> {
  if (isDbEnabled()) return dbStore.dbCreateScheduledMessage(accountId, data);
  const store = await readStoreFile();
  const msg: ScheduledMessage = {
    ...data,
    accountId,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.scheduledMessages.push(msg);
  await writeStoreFile(store);
  return msg;
}

export async function deleteScheduledMessage(id: string, accountId: string): Promise<boolean> {
  if (isDbEnabled()) return dbStore.dbDeleteScheduledMessage(id, accountId);
  const store = await readStoreFile();
  const before = store.scheduledMessages.length;
  store.scheduledMessages = store.scheduledMessages.filter(
    (m) => !(m.id === id && m.accountId === accountId)
  );
  if (store.scheduledMessages.length === before) return false;
  await writeStoreFile(store);
  return true;
}

export async function getBroadcasts(accountId: string): Promise<BroadcastList[]> {
  if (isDbEnabled()) return dbStore.dbGetBroadcasts(accountId);
  const store = await readStoreFile();
  return forAccount(store.broadcasts, accountId);
}

export async function createBroadcast(
  accountId: string,
  data: Omit<BroadcastList, "id" | "accountId" | "createdAt" | "status">
): Promise<BroadcastList> {
  if (isDbEnabled()) return dbStore.dbCreateBroadcast(accountId, data);
  const store = await readStoreFile();
  const broadcast: BroadcastList = {
    ...data,
    accountId,
    id: randomUUID(),
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  store.broadcasts.push(broadcast);
  await writeStoreFile(store);
  return broadcast;
}

export async function deleteBroadcast(id: string, accountId: string): Promise<boolean> {
  if (isDbEnabled()) return dbStore.dbDeleteBroadcast(id, accountId);
  const store = await readStoreFile();
  const before = store.broadcasts.length;
  store.broadcasts = store.broadcasts.filter((b) => !(b.id === id && b.accountId === accountId));
  if (store.broadcasts.length === before) return false;
  await writeStoreFile(store);
  return true;
}

export async function updateBroadcast(
  id: string,
  accountId: string,
  data: Partial<Pick<BroadcastList, "name" | "contacts" | "message" | "status">>
): Promise<BroadcastList | null> {
  if (isDbEnabled()) return dbStore.dbUpdateBroadcast(id, accountId, data);
  const store = await readStoreFile();
  const index = store.broadcasts.findIndex((b) => b.id === id && b.accountId === accountId);
  if (index === -1) return null;
  store.broadcasts[index] = { ...store.broadcasts[index], ...data };
  await writeStoreFile(store);
  return store.broadcasts[index];
}

export async function getBroadcastById(
  id: string,
  accountId: string
): Promise<BroadcastList | null> {
  if (isDbEnabled()) return dbStore.dbGetBroadcastById(id, accountId);
  const store = await readStoreFile();
  return store.broadcasts.find((b) => b.id === id && b.accountId === accountId) ?? null;
}
