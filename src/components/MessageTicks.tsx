import { mapMessageAck, MESSAGE_ACK_LABELS, type MessageAckStatus } from "@/lib/whatsapp/message-ack";

function TickIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 15" width="14" height="13" className="shrink-0" aria-hidden>
      <path
        fill={color}
        d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"
      />
    </svg>
  );
}

function SingleTickIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 12 11" width="11" height="10" className="shrink-0" aria-hidden>
      <path
        fill={color}
        d="M11.154.01a.477.477 0 0 0-.433-.01L4.254 6.88a.32.32 0 0 1-.484-.032L1.892 4.71a.366.366 0 0 0-.514-.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.368.368 0 0 0-.063-.51z"
      />
    </svg>
  );
}

export function MessageTicks({ ack }: { ack: number }) {
  const status: MessageAckStatus = mapMessageAck(ack);
  const isRead = status === "read" || status === "played";
  const isDelivered = status === "delivered" || isRead;
  const color = isRead ? "#22d3ee" : "#71717a";

  if (status === "error") {
    return (
      <span className="ml-1 text-[10px] text-(--danger)" title={MESSAGE_ACK_LABELS.error}>
        !
      </span>
    );
  }

  return (
    <span className="ml-1 inline-flex items-center" title={MESSAGE_ACK_LABELS[status]}>
      {isDelivered ? <TickIcon color={color} /> : <SingleTickIcon color={color} />}
    </span>
  );
}
