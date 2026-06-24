import { randomUUID } from "crypto";
import { ensureDbSchema, getSql } from "@/lib/db/schema";
import type {
  BroadcastList,
  ScheduledMessage,
  SmartReply,
  WebhookConfig,
  WebhookEvent,
} from "@/lib/types";

function mapWebhook(row: Record<string, unknown>): WebhookConfig {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    direction: row.direction as WebhookConfig["direction"],
    method: row.method as WebhookConfig["method"],
    endpoint: String(row.endpoint),
    payloadFields: (row.payload_fields as WebhookConfig["payloadFields"]) ?? [],
    enabled: Boolean(row.enabled),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapSmartReply(row: Record<string, unknown>): SmartReply {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    keyword: String(row.keyword),
    reply: String(row.reply),
    enabled: Boolean(row.enabled),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapScheduled(row: Record<string, unknown>): ScheduledMessage {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    phone: String(row.phone),
    message: String(row.message),
    scheduledAt: new Date(String(row.scheduled_at)).toISOString(),
    status: row.status as ScheduledMessage["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapBroadcast(row: Record<string, unknown>): BroadcastList {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    contacts: (row.contacts as string[]) ?? [],
    message: String(row.message),
    status: row.status as BroadcastList["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapEvent(row: Record<string, unknown>): WebhookEvent {
  return {
    id: String(row.id),
    accountId: row.account_id ? String(row.account_id) : undefined,
    webhookId: row.webhook_id ? String(row.webhook_id) : undefined,
    receivedAt: new Date(String(row.received_at)).toISOString(),
    method: String(row.method),
    payload: (row.payload as Record<string, string>) ?? {},
    rawQuery: row.raw_query ? String(row.raw_query) : undefined,
  };
}

export async function dbGetWebhooks(accountId: string): Promise<WebhookConfig[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM webhooks WHERE account_id = ${accountId} ORDER BY created_at DESC
  `;
  return rows.map((row) => mapWebhook(row as Record<string, unknown>));
}

export async function dbGetWebhook(id: string, accountId: string): Promise<WebhookConfig | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM webhooks WHERE id = ${id} AND account_id = ${accountId} LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? mapWebhook(row) : null;
}

export async function dbCreateWebhook(
  accountId: string,
  data: Omit<WebhookConfig, "id" | "accountId" | "createdAt" | "updatedAt">
): Promise<WebhookConfig> {
  await ensureDbSchema();
  const sql = getSql();
  const now = new Date().toISOString();
  const webhook: WebhookConfig = {
    ...data,
    accountId,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await sql`
    INSERT INTO webhooks (
      id, account_id, name, direction, method, endpoint,
      payload_fields, enabled, created_at, updated_at
    )
    VALUES (
      ${webhook.id},
      ${webhook.accountId},
      ${webhook.name},
      ${webhook.direction},
      ${webhook.method},
      ${webhook.endpoint},
      ${JSON.stringify(webhook.payloadFields)},
      ${webhook.enabled},
      ${webhook.createdAt},
      ${webhook.updatedAt}
    )
  `;
  return webhook;
}

export async function dbUpdateWebhook(
  id: string,
  accountId: string,
  data: Partial<Omit<WebhookConfig, "id" | "accountId" | "createdAt">>
): Promise<WebhookConfig | null> {
  const existing = await dbGetWebhook(id, accountId);
  if (!existing) return null;

  const updated: WebhookConfig = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await ensureDbSchema();
  const sql = getSql();
  await sql`
    UPDATE webhooks SET
      name = ${updated.name},
      direction = ${updated.direction},
      method = ${updated.method},
      endpoint = ${updated.endpoint},
      payload_fields = ${JSON.stringify(updated.payloadFields)},
      enabled = ${updated.enabled},
      updated_at = ${updated.updatedAt}
    WHERE id = ${id} AND account_id = ${accountId}
  `;
  return updated;
}

export async function dbDeleteWebhook(id: string, accountId: string): Promise<boolean> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM webhooks WHERE id = ${id} AND account_id = ${accountId} RETURNING id
  `;
  return rows.length > 0;
}

export async function dbAddEvent(
  event: Omit<WebhookEvent, "id" | "receivedAt">,
  accountId?: string
): Promise<WebhookEvent> {
  await ensureDbSchema();
  const sql = getSql();
  const record: WebhookEvent = {
    ...event,
    accountId,
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO webhook_events (id, account_id, webhook_id, received_at, method, payload, raw_query)
    VALUES (
      ${record.id},
      ${record.accountId ?? null},
      ${record.webhookId ?? null},
      ${record.receivedAt},
      ${record.method},
      ${JSON.stringify(record.payload)},
      ${record.rawQuery ?? null}
    )
  `;

  if (accountId) {
    await sql`
      DELETE FROM webhook_events
      WHERE id IN (
        SELECT id FROM webhook_events
        WHERE account_id = ${accountId}
        ORDER BY received_at DESC
        OFFSET 500
      )
    `;
  }

  return record;
}

export async function dbGetEvents(accountId: string, limit = 50): Promise<WebhookEvent[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM webhook_events
    WHERE account_id = ${accountId}
    ORDER BY received_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => mapEvent(row as Record<string, unknown>));
}

export async function dbGetSmartReplies(accountId: string): Promise<SmartReply[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM smart_replies WHERE account_id = ${accountId} ORDER BY created_at DESC
  `;
  return rows.map((row) => mapSmartReply(row as Record<string, unknown>));
}

export async function dbCreateSmartReply(
  accountId: string,
  data: Omit<SmartReply, "id" | "accountId" | "createdAt">
): Promise<SmartReply> {
  await ensureDbSchema();
  const sql = getSql();
  const reply: SmartReply = {
    ...data,
    accountId,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO smart_replies (id, account_id, keyword, reply, enabled, created_at)
    VALUES (
      ${reply.id},
      ${reply.accountId},
      ${reply.keyword},
      ${reply.reply},
      ${reply.enabled},
      ${reply.createdAt}
    )
  `;
  return reply;
}

export async function dbDeleteSmartReply(id: string, accountId: string): Promise<boolean> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM smart_replies WHERE id = ${id} AND account_id = ${accountId} RETURNING id
  `;
  return rows.length > 0;
}

export async function dbGetScheduledMessages(accountId: string): Promise<ScheduledMessage[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM scheduled_messages WHERE account_id = ${accountId} ORDER BY created_at DESC
  `;
  return rows.map((row) => mapScheduled(row as Record<string, unknown>));
}

export async function dbCreateScheduledMessage(
  accountId: string,
  data: Omit<ScheduledMessage, "id" | "accountId" | "createdAt" | "status">
): Promise<ScheduledMessage> {
  await ensureDbSchema();
  const sql = getSql();
  const msg: ScheduledMessage = {
    ...data,
    accountId,
    id: randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO scheduled_messages (
      id, account_id, phone, message, scheduled_at, status, created_at
    )
    VALUES (
      ${msg.id},
      ${msg.accountId},
      ${msg.phone},
      ${msg.message},
      ${msg.scheduledAt},
      ${msg.status},
      ${msg.createdAt}
    )
  `;
  return msg;
}

export async function dbDeleteScheduledMessage(id: string, accountId: string): Promise<boolean> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM scheduled_messages WHERE id = ${id} AND account_id = ${accountId} RETURNING id
  `;
  return rows.length > 0;
}

export async function dbGetBroadcasts(accountId: string): Promise<BroadcastList[]> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM broadcasts WHERE account_id = ${accountId} ORDER BY created_at DESC
  `;
  return rows.map((row) => mapBroadcast(row as Record<string, unknown>));
}

export async function dbCreateBroadcast(
  accountId: string,
  data: Omit<BroadcastList, "id" | "accountId" | "createdAt" | "status">
): Promise<BroadcastList> {
  await ensureDbSchema();
  const sql = getSql();
  const broadcast: BroadcastList = {
    ...data,
    accountId,
    id: randomUUID(),
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  await sql`
    INSERT INTO broadcasts (id, account_id, name, contacts, message, status, created_at)
    VALUES (
      ${broadcast.id},
      ${broadcast.accountId},
      ${broadcast.name},
      ${JSON.stringify(broadcast.contacts)},
      ${broadcast.message},
      ${broadcast.status},
      ${broadcast.createdAt}
    )
  `;
  return broadcast;
}

export async function dbDeleteBroadcast(id: string, accountId: string): Promise<boolean> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM broadcasts WHERE id = ${id} AND account_id = ${accountId} RETURNING id
  `;
  return rows.length > 0;
}

export async function dbUpdateBroadcast(
  id: string,
  accountId: string,
  data: Partial<Pick<BroadcastList, "name" | "contacts" | "message" | "status">>
): Promise<BroadcastList | null> {
  const existing = await dbGetBroadcastById(id, accountId);
  if (!existing) return null;

  const updated: BroadcastList = { ...existing, ...data };
  await ensureDbSchema();
  const sql = getSql();
  await sql`
    UPDATE broadcasts SET
      name = ${updated.name},
      contacts = ${JSON.stringify(updated.contacts)},
      message = ${updated.message},
      status = ${updated.status}
    WHERE id = ${id} AND account_id = ${accountId}
  `;
  return updated;
}

export async function dbGetBroadcastById(
  id: string,
  accountId: string
): Promise<BroadcastList | null> {
  await ensureDbSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM broadcasts WHERE id = ${id} AND account_id = ${accountId} LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? mapBroadcast(row) : null;
}
