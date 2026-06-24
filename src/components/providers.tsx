"use client";

import { I18nextProvider } from "react-i18next";
import { AppProvider } from "@/contexts/AppContext";
import i18n from "@/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <AppProvider>{children}</AppProvider>
    </I18nextProvider>
  );
}
