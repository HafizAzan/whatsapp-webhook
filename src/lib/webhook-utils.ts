import type { PayloadField } from "./types";
import { ALL_PAYLOAD_FIELDS } from "./types";

const FIELD_ALIASES: Record<PayloadField, string[]> = {
  messageType: ["messageType", "message_type", "type"],
  messageTimestamp: ["messageTimestamp", "message_timestamp", "timestamp"],
  messageContent: ["messageContent", "message_content", "content", "text", "body"],
  senderPhoneNumber: ["senderPhoneNumber", "sender_phone_number", "phone", "from"],
  senderPhoneBookName: ["senderPhoneBookName", "sender_phone_book_name", "phoneBookName"],
  senderWhatsAppName: ["senderWhatsAppName", "sender_whatsapp_name", "whatsappName", "pushName"],
  groupName: ["groupName", "group_name", "group"],
};

export function extractPayload(
  source: Record<string, string | undefined>
): Record<string, string> {
  const payload: Record<string, string> = {};

  for (const field of ALL_PAYLOAD_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    for (const alias of aliases) {
      const value = source[alias];
      if (value !== undefined && value !== "") {
        payload[field] = value;
        break;
      }
    }
  }

  return payload;
}

export function buildWebhookUrl(
  baseUrl: string,
  payload: Record<string, string>,
  fields: PayloadField[]
): string {
  const url = new URL(baseUrl);
  for (const field of fields) {
    if (payload[field]) {
      url.searchParams.set(field, payload[field]);
    }
  }
  return url.toString();
}
