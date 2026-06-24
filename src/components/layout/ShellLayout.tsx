"use client";

import type { ReactNode } from "react";
import { ConnectionGuard } from "@/components/ConnectionGuard";
import { AppShell } from "@/components/layout/AppShell";

export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <ConnectionGuard>
      <AppShell>{children}</AppShell>
    </ConnectionGuard>
  );
}
