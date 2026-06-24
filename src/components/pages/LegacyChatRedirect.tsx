"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { chatHashHref } from "@/lib/route-hash";

interface Props {
  chatId: string;
}

/** Purane /chats/[id] links ko hash URL par redirect */
export function LegacyChatRedirect({ chatId }: Props) {
  const router = useRouter();

  useEffect(() => {
    const href = chatHashHref(decodeURIComponent(chatId));
    router.replace(href);
  }, [chatId, router]);

  return (
    <p className="text-center text-sm text-(--text-dim)">Opening conversation...</p>
  );
}
