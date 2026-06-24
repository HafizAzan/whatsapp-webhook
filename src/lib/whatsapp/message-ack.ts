export type MessageAckStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "played"
  | "error";

export function mapMessageAck(ack: number | undefined): MessageAckStatus {
  switch (ack) {
    case -1:
      return "error";
    case 1:
      return "sent";
    case 2:
      return "delivered";
    case 3:
      return "read";
    case 4:
      return "played";
    default:
      return "pending";
  }
}

export const MESSAGE_ACK_LABELS: Record<MessageAckStatus, string> = {
  pending: "Bheja ja raha hai",
  sent: "Bhej diya (single tick)",
  delivered: "Deliver ho gaya (double tick)",
  read: "Read ho gaya (blue tick)",
  played: "Sun liya",
  error: "Failed",
};
