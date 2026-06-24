"use client";

import { useTranslation } from "react-i18next";
import { setAppLocale, type AppLocale } from "@/i18n";

const OPTIONS: { value: AppLocale; labelKey: "language.english" | "language.romanUrdu" }[] = [
  { value: "en", labelKey: "language.english" },
  { value: "ur", labelKey: "language.romanUrdu" },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.language === "ur" ? "ur" : "en";

  return (
    <div className="mb-6">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-(--text-dim)">
        {t("language.label")}
      </p>
      <div className="flex rounded-xl border border-(--border) bg-(--bg-surface) p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setAppLocale(opt.value)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              current === opt.value
                ? "bg-(--accent-dim) text-(--accent-bright)"
                : "text-(--text-dim) hover:text-(--text-muted)"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
