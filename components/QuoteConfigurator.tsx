"use client";

import { useEffect, useMemo, useState } from "react";
import { tables } from "@/lib/data";
import type { DevisLine } from "@/lib/types";
import { computeLine, emptyLine, euro, formatPercent, totals } from "@/lib/pricing";
import { LineDrawer } from "@/components/LineDrawer";
import { PrintView } from "@/components/PrintView";

const STORAGE_KEY = "arc-devis-v1";

type HeaderInfo = {
  chantier: string;
  adresse: string;
  reference: string;
  uw: string;
  sw: string;
  acoustique: string;
  aev: string;
  demandeur: string;
  societe: string;
  telephone: string;
  email: string;
};

type LineEntry = { id: string; line: DevisLine };

const defaultHeader: HeaderInfo = {
  chantier: "",
  adresse: "",
  reference: "",
  uw: "",
  sw: "",
  acoustique: "",
  aev: "",
  demandeur: "Bruno ROBEIL",
  societe: "A.R.C ALUMINIUM",
  telephone: "+33 (0)4 76 55 09 64",
  email: "contact@arc-alu.fr",
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

function makeEntry(line: DevisLine = emptyLine()): LineEntry {
  return { id: makeId(), line };
}

export function QuoteConfigurator() {
  const [hydrated, setHydrated] = useState(false);
  const [remisePercent, setRemisePercent] = useState(String(tables.remiseDefault * 100).replace(".", ","));
  const [header, setHeader] = useState<HeaderInfo>(defaultHeader);
  // SSR-stable initial id to avoid hydration mismatch; replaced by localStorage after mount.
  const [entries, setEntries] = useState<LineEntry[]>(() => [{ id: "line-1", line: emptyLine() }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const remise = parseFrenchNumber(remisePercent) / 100;
  const safeRemise = Number.isFinite(remise) ? Math.min(1, Math.max(0, remise)) : tables.remiseDefault;

  const results = useMemo(
    () => entries.map((entry) => computeLine(entry.line, tables, safeRemise)),
    [entries, safeRemise],
  );
  const quoteTotals = useMemo(() => totals(results, safeRemise), [results, safeRemise]);
  const requestDate = useMemo(() => new Intl.DateTimeFormat("fr-FR").format(new Date()), []);

  // --- Restauration autosave (après montage pour éviter un mismatch d'hydratation) ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{ entries: LineEntry[]; header: HeaderInfo; remisePercent: string }>;
        if (Array.isArray(saved.entries) && saved.entries.length > 0) {
          setEntries(saved.entries.map((entry) => ({ id: entry.id ?? makeId(), line: { ...emptyLine(), ...entry.line } })));
        }
        if (saved.header) setHeader({ ...defaultHeader, ...saved.header });
        if (typeof saved.remisePercent === "string") setRemisePercent(saved.remisePercent);
      }
    } catch {
      // données corrompues : on repart des valeurs par défaut
    }
    setHydrated(true);
  }, []);

  // --- Sauvegarde autosave ---
  useEffect(() => {
    if (!hydrated) return;
    const payload = JSON.stringify({ entries, header, remisePercent });
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // quota dépassé / mode privé : on ignore silencieusement
    }
  }, [entries, header, remisePercent, hydrated]);

  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId);
  const selected = selectedIndex >= 0 ? entries[selectedIndex] : null;
  const filledCount = entries.filter((entry) => entry.line.type).length;

  function updateLine(id: string, patch: Partial<DevisLine>) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, line: { ...entry.line, ...patch } } : entry)));
  }

  function addLine() {
    const entry = makeEntry();
    setEntries((current) => [...current, entry]);
    setSelectedId(entry.id);
  }

  function duplicateLine(id: string) {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      if (index < 0) return current;
      const copy = makeEntry({ ...current[index].line });
      const next = [...current];
      next.splice(index + 1, 0, copy);
      setSelectedId(copy.id);
      return next;
    });
  }

  function deleteLine(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveLine(id: string, direction: -1 | 1) {
    setEntries((current) => {
      const index = current.findIndex((entry) => entry.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function applyAspectToAll(source: DevisLine) {
    setEntries((current) =>
      current.map((entry) => ({
        ...entry,
        line: { ...entry.line, famille: source.famille, vitrage: source.vitrage, dormant: source.dormant },
      })),
    );
  }

  function resetAll() {
    if (!window.confirm("Réinitialiser le devis ? Toutes les lignes seront effacées.")) return;
    setEntries([makeEntry()]);
    setSelectedId(null);
  }

  return (
    <main className="min-h-screen text-[13px] text-ink">
      {/* Barre de marque */}
      <div className="border-b border-line bg-panel print:hidden">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/arc-logo.svg" alt="A.R.C Aluminium" className="h-9 w-auto" />
          <div className="flex items-center gap-2 rounded-full bg-accent-tint px-3.5 py-1.5 text-xs font-semibold text-ink">
            <span className="h-2 w-2 rounded-full bg-accent-strong" aria-hidden />
            Configurateur de devis
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 pb-28 sm:px-6 lg:px-8 print:hidden">
        {/* Hero / titre */}
        <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="flex flex-col gap-5 border-b border-line-soft px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-strong">Fourniture seule</p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
                Devis menuiseries <span className="bg-accent-tint px-1.5 box-decoration-clone">aluminium</span>
              </h1>
              <p className="mt-2 text-sm text-muted">
                Configurez chaque ouvrage, le prix net HT se calcule en temps réel.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:w-[320px]">
              <Field label="Date de la demande" value={requestDate} readOnly />
              <Field
                label="Remise client (%)"
                value={remisePercent}
                onChange={(value) => setRemisePercent(value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <section className="grid gap-0 lg:grid-cols-[1.2fr_1fr_1fr]">
            <InfoBlock
              title="Informations chantier"
              fields={[["Nom du chantier", "chantier"], ["Adresse", "adresse"], ["Référence affaire", "reference"]]}
              data={header}
              onChange={(key, value) => setHeader((current) => ({ ...current, [key]: value }))}
            />
            <InfoBlock
              title="Performances"
              fields={[["Uw", "uw"], ["Facteur solaire Sw", "sw"], ["Affaiblissement acoustique", "acoustique"], ["AEV", "aev"]]}
              data={header}
              onChange={(key, value) => setHeader((current) => ({ ...current, [key]: value }))}
            />
            <InfoBlock
              title="Demandeur"
              fields={[["Demande émise par", "demandeur"], ["Société", "societe"], ["Tél", "telephone"], ["E-mail", "email"]]}
              data={header}
              onChange={(key, value) => setHeader((current) => ({ ...current, [key]: value }))}
            />
          </section>
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h2 className="text-base font-bold">Menuiseries</h2>
              <p className="text-xs text-muted">
                {filledCount} ligne(s) renseignée(s) · {tables.lists.types.length} gammes disponibles
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold transition hover:bg-line-soft"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold transition hover:bg-line-soft"
              >
                Imprimer / PDF
              </button>
              <button
                type="button"
                onClick={addLine}
                className="rounded-lg bg-ink px-3 py-2 text-sm font-bold text-panel transition hover:bg-ink-soft"
              >
                + Ajouter une menuiserie
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <EmptyState onAdd={addLine} />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-accent-wash text-left text-[11px] uppercase tracking-[0.05em] text-muted">
                  <th className="w-10 px-3 py-2.5 font-bold">N°</th>
                  <th className="px-3 py-2.5 font-bold">Menuiserie</th>
                  <th className="px-3 py-2.5 font-bold">Dimensions</th>
                  <th className="px-3 py-2.5 text-right font-bold">Qté</th>
                  <th className="px-3 py-2.5 text-right font-bold">P.U. net HT</th>
                  <th className="px-3 py-2.5 text-right font-bold">Total net HT</th>
                  <th className="w-32 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const result = results[index];
                  const hasDims = entry.line.L !== "" && entry.line.H !== "";
                  const isSelected = entry.id === selectedId;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={`cursor-pointer border-b border-line-soft align-middle transition hover:bg-accent-wash ${
                        isSelected ? "bg-accent-wash" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-bold text-muted">{index + 1}</td>
                      <td className="px-3 py-3">
                        {entry.line.type ? (
                          <div>
                            <p className="font-semibold">{entry.line.type}</p>
                            <p className="text-xs text-muted">
                              {[entry.line.localisation, entry.line.famille].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted">Ligne vide — cliquer pour configurer</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {hasDims ? (
                          <span className={result.horsAbaque ? "font-semibold text-danger" : "tabular-nums"}>
                            {entry.line.L} × {entry.line.H} mm
                            {result.horsAbaque ? " ⚠" : ""}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{entry.line.qte || 0}</td>
                      <td className="px-3 py-3 text-right">
                        {result.error ? (
                          <span className="text-xs text-danger">{result.error}</span>
                        ) : typeof result.price === "number" ? (
                          <span className="tabular-nums">{euro(result.price)}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">
                        {result.total ? euro(result.total) : <span className="font-normal text-muted">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
                          <RowButton label="Monter" disabled={index === 0} onClick={() => moveLine(entry.id, -1)}>↑</RowButton>
                          <RowButton label="Descendre" disabled={index === entries.length - 1} onClick={() => moveLine(entry.id, 1)}>↓</RowButton>
                          <RowButton label="Dupliquer" onClick={() => duplicateLine(entry.id)}>⧉</RowButton>
                          <RowButton label="Supprimer" danger onClick={() => deleteLine(entry.id)}>✕</RowButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Barre de totaux collante (écran) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-8 gap-y-1 px-5 py-3 text-sm">
          <span className="mr-auto inline-flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            Remise {formatPercent(safeRemise)}
          </span>
          <TotalChip label="Total HT lignes" value={quoteTotals.totalLignes} />
          <TotalChip label="Forfait couleur" value={quoteTotals.forfaitCouleur} />
          <div className="flex items-center gap-2 rounded-xl bg-ink px-4 py-1.5">
            <span className="text-xs font-medium text-panel/70">Total net HT</span>
            <span className="text-lg font-extrabold tabular-nums text-accent">{euro(quoteTotals.totalNetHT)}</span>
          </div>
        </div>
      </div>

      {selected ? (
        <LineDrawer
          index={selectedIndex}
          line={selected.line}
          result={results[selectedIndex]}
          remise={safeRemise}
          onChange={(patch) => updateLine(selected.id, patch)}
          onClose={() => setSelectedId(null)}
          onDuplicate={() => duplicateLine(selected.id)}
          onDelete={() => deleteLine(selected.id)}
          onApplyAspectToAll={() => applyAspectToAll(selected.line)}
        />
      ) : null}

      <PrintView
        header={header}
        requestDate={requestDate}
        entries={entries}
        results={results}
        totals={quoteTotals}
      />
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-16 text-center">
      <p className="text-sm text-muted">Aucune menuiserie pour l’instant.</p>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-panel transition hover:bg-ink-soft"
      >
        + Ajouter votre première menuiserie
      </button>
    </div>
  );
}

function RowButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-lg text-sm transition disabled:opacity-30 ${
        danger ? "text-danger hover:bg-danger-bg" : "text-muted hover:bg-line-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function TotalChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{euro(value)}</span>
    </div>
  );
}

function InfoBlock({
  title,
  fields,
  data,
  onChange,
}: {
  title: string;
  fields: Array<[string, keyof HeaderInfo]>;
  data: HeaderInfo;
  onChange: (key: keyof HeaderInfo, value: string) => void;
}) {
  return (
    <div className="border-b border-line-soft p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink">
        <span className="h-3 w-1 rounded-full bg-accent" aria-hidden />
        {title}
      </h2>
      <div className="grid gap-2.5">
        {fields.map(([label, key]) => (
          <Field key={key} label={label} value={data[key]} onChange={(value) => onChange(key, value)} />
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  inputMode,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  inputMode?: "decimal";
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{label}</span>
      <input
        value={value}
        readOnly={readOnly}
        inputMode={inputMode}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-panel px-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/35 read-only:bg-line-soft read-only:text-muted"
      />
    </label>
  );
}

function parseFrenchNumber(value: string) {
  return Number(value.replace(",", "."));
}
