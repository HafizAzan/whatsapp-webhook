"use client";

import { useCallback, useSyncExternalStore } from "react";
import { decodeRouteRef, encodeRouteRef } from "@/lib/route-hash";

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHashToken() {
  const raw = window.location.hash.replace(/^#/, "");
  return raw || null;
}

export function useHashRef() {
  const token = useSyncExternalStore(subscribeHash, getHashToken, () => null);
  const decoded = token ? decodeRouteRef(token) : null;

  const setRef = useCallback((value: string) => {
    window.location.hash = encodeRouteRef(value);
  }, []);

  const clearRef = useCallback(() => {
    const path = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", path);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  return { token, decoded, setRef, clearRef };
}
