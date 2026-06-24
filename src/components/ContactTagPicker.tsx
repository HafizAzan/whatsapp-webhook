"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { chatToContactTag, isPhoneDigits } from "@/lib/contacts";

export interface ContactTag {
  value: string;
  label: string;
}

interface ContactTagPickerProps {
  value: ContactTag[];
  onChange: (tags: ContactTag[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function normalizePhone(input: string) {
  return input.replace(/\D/g, "");
}

export function ContactTagPicker({
  value,
  onChange,
  placeholder = "Name ya number likhein...",
  disabled = false,
}: ContactTagPickerProps) {
  const { waState, waChats } = useApp();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selectedValues = useMemo(() => new Set(value.map((t) => t.value)), [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = normalizePhone(query);

    const fromChats = waChats
      .filter((chat) => !selectedValues.has(chat.id))
      .filter((chat) => {
        if (!q && !digits) return true;
        const name = chat.name.toLowerCase();
        return name.includes(q) || (digits && chat.id.includes(digits));
      })
      .slice(0, 8)
      .map(chatToContactTag);

    if (digits.length >= 10 && !selectedValues.has(digits)) {
      const alreadyListed = fromChats.some((t) => t.value === digits);
      if (!alreadyListed && isPhoneDigits(digits)) {
        fromChats.unshift({ value: digits, label: `+${digits}` });
      }
    }

    return fromChats;
  }, [query, waChats, selectedValues]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function addTag(tag: ContactTag) {
    if (selectedValues.has(tag.value)) return;
    onChange([...value, tag]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(tagValue: string) {
    onChange(value.filter((t) => t.value !== tagValue));
  }

  function tryAddFromQuery() {
    const digits = normalizePhone(query);
    if (digits.length >= 10 && isPhoneDigits(digits)) {
      const match = suggestions.find((s) => s.value === digits) ?? {
        value: digits,
        label: `+${digits}`,
      };
      addTag(match);
      return;
    }
    if (suggestions[highlight]) {
      addTag(suggestions[highlight]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      tryAddFromQuery();
      return;
    }
    if (e.key === "Backspace" && !query && value.length > 0) {
      removeTag(value[value.length - 1].value);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const notConnected = waState?.status !== "ready";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`input-field flex min-h-[46px] flex-wrap items-center gap-2 py-2! ${
          disabled ? "pointer-events-none opacity-50" : "cursor-text"
        }`}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {value.map((tag) => (
          <span
            key={tag.value}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-accent-soft bg-(--accent-dim) py-1 pl-2.5 pr-1 text-xs text-(--accent-bright)"
          >
            <span className="truncate">{tag.label}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag.value);
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-(--text-muted) hover-bg-danger-chip hover:text-(--danger)"
                aria-label={`Remove ${tag.label}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          id={listId}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm text-(--text) outline-none placeholder:text-(--text-dim) disabled:cursor-not-allowed"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
        />
      </div>

      {notConnected && !disabled && (
        <p className="mt-1.5 text-xs text-(--text-dim)">
          Contacts dropdown ke liye WhatsApp connect karein — manual number bhi add ho sakta hai
        </p>
      )}

      {open && !disabled && suggestions.length > 0 && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-(--border-strong) bg-(--bg-card) py-1 shadow-xl"
        >
          {suggestions.map((item, index) => (
            <li key={`${item.value}-${index}`} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => addTag(item)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  index === highlight
                    ? "bg-(--accent-dim) text-(--accent-bright)"
                    : "text-(--text-muted) hover:bg-(--bg-hover)"
                }`}
              >
                <span className="avatar-ring h-8 w-8 shrink-0 text-[10px]">
                  {item.label[0]?.toUpperCase() || "?"}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !disabled && query && suggestions.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-(--border) bg-(--bg-card) px-3 py-2.5 text-xs text-(--text-dim)">
          Koi match nahi — kam az kam 10 digit number enter karein
        </div>
      )}
    </div>
  );
}
