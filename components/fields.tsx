"use client";

import type { ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-4 text-muted">{hint}</span> : null}
    </label>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
      <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
      {children}
    </h3>
  );
}

const inputBase =
  "h-9 w-full rounded-lg border border-line bg-panel px-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/35";

export function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputBase}
    />
  );
}

export function SelectField({
  value,
  options,
  onChange,
  blank,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  blank?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputBase} px-2`}>
      {blank ? <option value="">—</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/**
 * Saisie numérique de dimension avec boutons −/+ accrochés au pas de la grille.
 */
export function DimensionField({
  value,
  onChange,
  step,
  error,
  ariaLabel,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  step: number;
  error?: boolean;
  ariaLabel: string;
}) {
  function nudge(delta: number) {
    const base = value === "" ? 0 : value;
    onChange(Math.max(0, base + delta));
  }

  return (
    <div
      className={`flex h-9 items-stretch overflow-hidden rounded-lg border transition focus-within:ring-2 focus-within:ring-accent/35 ${
        error ? "border-danger bg-danger-bg" : "border-line bg-panel focus-within:border-accent"
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel} moins ${step}`}
        onClick={() => nudge(-step)}
        className="grid w-7 shrink-0 place-items-center text-base text-muted transition hover:bg-accent-wash hover:text-ink"
      >
        −
      </button>
      <input
        value={value}
        type="number"
        inputMode="numeric"
        size={1}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
        className={`min-w-0 flex-1 border-x border-line-soft bg-transparent px-1 text-center text-sm tabular-nums outline-none ${
          error ? "text-danger" : ""
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel} plus ${step}`}
        onClick={() => nudge(step)}
        className="grid w-7 shrink-0 place-items-center text-base text-muted transition hover:bg-accent-wash hover:text-ink"
      >
        +
      </button>
    </div>
  );
}
