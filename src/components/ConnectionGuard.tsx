"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/contexts/AppContext";

export function ConnectionGuard({ children }: { children: React.ReactNode }) {
  const { waState, statusLoaded } = useApp();
  const router = useRouter();

  const isReady = waState?.status === "ready";
  const awaitingStatus = !statusLoaded && waState === null;

  useEffect(() => {
    if (!statusLoaded) return;
    if (!isReady) router.replace("/login");
  }, [statusLoaded, isReady, router]);

  if (awaitingStatus) {
    return (
      <div className="flex h-screen items-center justify-center bg-(--bg-base)">
        <div className="flex flex-col items-center gap-4 page-enter">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
          <p className="text-sm text-(--text-dim)">Checking channel link...</p>
        </div>
      </div>
    );
  }

  if (statusLoaded && !isReady) return null;

  return children;
}
