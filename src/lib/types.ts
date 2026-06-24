export type WebhookDirection = "outgoing" | "incoming";
export type WebhookMethod = "GET" | "POST" | "PUT";

export type PayloadField =
  | "messageType"
  | "messageTimestamp"
  | "messageContent"
  | "senderPhoneNumber"
  | "senderPhoneBookName"
  | "senderWhatsAppName"
  | "groupName";

export interface WebhookConfig {
  id: string;
  accountId: string;
  name: string;
  direction: WebhookDirection;
  method: WebhookMethod;
  endpoint: string;
  payloadFields: PayloadField[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  accountId?: string;
  webhookId?: string;
  receivedAt: string;
  method: string;
  payload: Record<string, string>;
  rawQuery?: string;
}

export interface SmartReply {
  id: string;
  accountId: string;
  keyword: string;
  reply: string;
  enabled: boolean;
  createdAt: string;
}

export interface ScheduledMessage {
  id: string;
  accountId: string;
  phone: string;
  message: string;
  scheduledAt: string;
  status: "pending" | "sent" | "failed";
  createdAt: string;
}

export interface BroadcastList {
  id: string;
  accountId: string;
  name: string;
  contacts: string[];
  message: string;
  status: "draft" | "scheduled" | "sent";
  createdAt: string;
}

export const PAYLOAD_FIELD_LABELS: Record<PayloadField, string> = {
  messageType: "Message type",
  messageTimestamp: "Message timestamp",
  messageContent: "Message content (Text only)",
  senderPhoneNumber: "Message sender phone number",
  senderPhoneBookName: "Message sender phone book name",
  senderWhatsAppName: "Message sender WhatsApp account name",
  groupName: "Message group name",
};

export const ALL_PAYLOAD_FIELDS: PayloadField[] = [
  "messageType",
  "messageTimestamp",
  "messageContent",
  "senderPhoneNumber",
  "senderPhoneBookName",
  "senderWhatsAppName",
  "groupName",
];
