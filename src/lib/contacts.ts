import type { WhatsAppChatItem } from "@/lib/whatsapp/client";
import type { ContactTag } from "@/components/ContactTagPicker";

/** WhatsApp chat id — phone number nahi (@lid, @c.us, @g.us) */
export function chatToContactTag(chat: WhatsAppChatItem): ContactTag {
  return {
    value: chat.id,
    label: chat.isGroup ? `${chat.name} (Group)` : chat.name,
  };
}

export function contactDisplayLabel(
  contactValue: string,
  chats: WhatsAppChatItem[]
): string {
  const chat = chats.find((c) => c.id === contactValue);
  if (chat) return chat.isGroup ? `${chat.name} (Group)` : chat.name;

  if (contactValue.includes("@")) {
    return contactValue.split("@")[0] || contactValue;
  }

  const digits = contactValue.replace(/\D/g, "");
  return digits ? `+${digits}` : contactValue;
}

export function isPhoneDigits(value: string) {
  return /^\d{10,15}$/.test(value.replace(/\D/g, ""));
}
