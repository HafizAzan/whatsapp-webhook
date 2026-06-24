"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginScreen } from "@/components/LoginScreen";
import { useApp } from "@/contexts/AppContext";

function LoginPageInner() {
  const { waState } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const addingAccount = searchParams.get("add") === "1";

  useEffect(() => {
    if (waState?.status === "ready" && !addingAccount) router.replace("/chats");
  }, [waState?.status, router, addingAccount]);

  if (waState?.status === "ready" && !addingAccount) return null;

  return <LoginScreen />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
