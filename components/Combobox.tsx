"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ComboOption = {
  value: string;
  label: string;
  hint?: string;
  group?: string;
};

/**
 * Liste déroulante avec recherche au clavier, groupes et indice à droite.
 * Pensée pour les longues listes (ex. 57 vitrages).
 */
export function Combobox({
  value,
  options,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
}: {
  value: string;
  options: ComboOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.group ?? ""}`.toLowerCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const current = options.findIndex((option) => option.value === value);
      setActive(current >= 0 ? current : 0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, options, value]);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  function commit(option: ComboOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option) commit(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-panel px-2.5 text-left text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/35"
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
        <span className="shrink-0 text-muted">▾</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
          <div className="border-b border-line-soft p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-line px-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">Aucun résultat</p>
            ) : (
              filtered.map((option, index) => {
                const previous = filtered[index - 1];
                const showGroup = option.group && option.group !== previous?.group;
                return (
                  <div key={option.value}>
                    {showGroup ? (
                      <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                        {option.group}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => commit(option)}
                      ref={(node) => {
                        if (index === active && node && open) node.scrollIntoView({ block: "nearest" });
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                        index === active ? "bg-accent-tint" : ""
                      } ${option.value === value ? "font-semibold text-ink" : ""}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="shrink-0 tabular-nums text-xs text-muted">{option.hint}</span>
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
