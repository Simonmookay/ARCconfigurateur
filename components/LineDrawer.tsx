"use client";

import { useEffect, useMemo } from "react";
import { tables } from "@/lib/data";
import type { DevisLine, LineResult } from "@/lib/types";
import {
  buildComment,
  compatibleProfiles,
  euro,
  isHorsAbaque,
  isPorteLourde,
  priceBreakdown,
} from "@/lib/pricing";
import { Combobox, type ComboOption } from "@/components/Combobox";
import { DimensionField, Field, SectionTitle, SelectField, TextField } from "@/components/fields";

const vitrageOptions: ComboOption[] = tables.vitrageList.map((vitrage) => ({
  value: vitrage.code,
  label: vitrage.code,
  hint: vitrage.pv > 0 ? `+${euro(vitrage.pv)}` : "inclus",
  group: vitrage.category,
}));

export function LineDrawer({
  index,
  line,
  result,
  remise,
  onChange,
  onClose,
  onDuplicate,
  onDelete,
  onApplyAspectToAll,
}: {
  index: number;
  line: DevisLine;
  result: LineResult;
  remise: number;
  onChange: (patch: Partial<DevisLine>) => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onApplyAspectToAll: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const route = line.type ? tables.routing[line.type] : undefined;
  const abaque = line.type ? tables.abaques[line.type] : undefined;
  const porte = isPorteLourde(line.type);
  const profiles = useMemo(() => compatibleProfiles(line.type, tables), [line.type]);
  const supportsTM = profiles.length > 1;
  const breakdown = priceBreakdown(line, tables, remise);

  const widthError = line.type !== "" && line.L !== "" && isHorsAbaque({ ...line, H: "" }, tables);
  const heightError = line.type !== "" && line.H !== "" && isHorsAbaque({ ...line, L: "" }, tables);

  function dimensionHint(error: boolean, snapped: number | null, bounds?: [number, number]) {
    if (!bounds) return null;
    if (error) return <span className="text-danger">Hors abaque ({bounds[0]}–{bounds[1]} mm)</span>;
    const parts = [`Abaque ${bounds[0]}–${bounds[1]} mm`];
    if (snapped != null) parts.push(`accroché à ${snapped} mm`);
    return parts.join(" · ");
  }

  const comment = buildComment(line, tables);

  return (
    <div className="fixed inset-0 z-40 print:hidden">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-paper shadow-2xl"
        role="dialog"
        aria-label={`Édition ligne ${index + 1}`}
      >
        <header className="flex items-center justify-between border-b border-line bg-panel px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-sm font-bold text-accent">
              {index + 1}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Menuiserie</p>
              <h2 className="text-base font-bold">{line.type || "Nouvelle menuiserie"}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 place-items-center rounded-lg text-lg text-muted transition hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4">
            <SectionTitle>Type &amp; dimensions</SectionTitle>
            <Field label="Type de menuiserie">
              <SelectField value={line.type} options={tables.lists.types} onChange={(value) => onChange({ type: value })} blank />
            </Field>
            <Field label="Localisation">
              <TextField value={line.localisation} placeholder="ex. Séjour Sud" onChange={(value) => onChange({ localisation: value })} />
            </Field>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
              <Field label="Largeur" hint={dimensionHint(widthError, result.snappedW, abaque ? [abaque.L_min, abaque.L_max] : undefined)}>
                <DimensionField
                  value={line.L}
                  step={route?.width_step ?? 100}
                  error={widthError}
                  ariaLabel="Largeur en mm"
                  onChange={(value) => onChange({ L: value })}
                />
              </Field>
              <Field label="Hauteur" hint={dimensionHint(heightError, result.snappedH, abaque ? [abaque.H_min, abaque.H_max] : undefined)}>
                <DimensionField
                  value={line.H}
                  step={route?.height_step ?? 100}
                  error={heightError}
                  ariaLabel="Hauteur en mm"
                  onChange={(value) => onChange({ H: value })}
                />
              </Field>
              <Field label="Qté">
                <DimensionField
                  value={line.qte}
                  step={1}
                  ariaLabel="Quantité"
                  onChange={(value) => onChange({ qte: value })}
                />
              </Field>
            </div>

            <SectionTitle>Aspect</SectionTitle>
            <Field label="Famille couleur">
              <SelectField value={line.famille} options={tables.lists.familles} onChange={(value) => onChange({ famille: value })} />
            </Field>
            <Field label="Vitrage">
              <Combobox
                value={line.vitrage}
                options={vitrageOptions}
                onChange={(value) => onChange({ vitrage: value })}
                searchPlaceholder="Rechercher un vitrage…"
              />
            </Field>
            <Field label="Type de dormant">
              <SelectField value={line.dormant} options={tables.lists.dormants} onChange={(value) => onChange({ dormant: value })} />
            </Field>
            <button
              type="button"
              onClick={onApplyAspectToAll}
              className="justify-self-start text-xs font-semibold text-ink decoration-accent decoration-2 underline-offset-4 hover:underline"
            >
              Appliquer cet aspect (couleur, vitrage, dormant) à toutes les lignes
            </button>

            <SectionTitle>Compléments</SectionTitle>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={line.ventilation === "OUI"}
                onChange={(event) => onChange({ ventilation: event.target.checked ? "OUI" : "NON" })}
                className="h-4 w-4 accent-accent"
              />
              Grille de ventilation <span className="text-muted">(+25 €)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Habillage extérieur">
                <SelectField value={line.habillage} options={tables.lists.habillages} onChange={(value) => onChange({ habillage: value })} />
              </Field>
              <Field label="Bavette">
                <SelectField value={line.bavette} options={tables.lists.bavettes} onChange={(value) => onChange({ bavette: value })} />
              </Field>
            </div>

            {supportsTM ? (
              <>
                <SectionTitle>Traverses &amp; meneaux</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="T/M 1">
                    <SelectField value={line.optTM1} options={profiles} onChange={(value) => onChange({ optTM1: value })} />
                  </Field>
                  <Field label="T/M 2">
                    <SelectField value={line.optTM2} options={profiles} onChange={(value) => onChange({ optTM2: value })} />
                  </Field>
                  <Field label="T/M 3">
                    <SelectField value={line.optTM3} options={profiles} onChange={(value) => onChange({ optTM3: value })} />
                  </Field>
                </div>
              </>
            ) : null}

            {porte ? (
              <>
                <SectionTitle>Option porte</SectionTitle>
                <Field label="Option">
                  <SelectField value={line.optionPorte} options={tables.lists.doorOptions} onChange={(value) => onChange({ optionPorte: value })} />
                </Field>
              </>
            ) : null}

            <SectionTitle>Observations</SectionTitle>
            <textarea
              value={line.observations}
              onChange={(event) => onChange({ observations: event.target.value })}
              rows={2}
              className="w-full rounded-lg border border-line bg-panel px-2.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/35"
            />

            <SectionTitle>Détail du prix</SectionTitle>
            {result.error ? (
              <p className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">⚠ {result.error}</p>
            ) : breakdown ? (
              <div className="overflow-hidden rounded-lg border border-line bg-panel">
                <dl className="divide-y divide-line-soft text-sm">
                  {breakdown.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-4 px-3 py-1.5">
                      <dt className="text-ink-soft">{row.label}</dt>
                      <dd className={`tabular-nums ${row.amount < 0 ? "text-accent-strong" : ""}`}>
                        {row.amount < 0 ? "−" : ""}
                        {euro(Math.abs(row.amount))}
                      </dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 bg-ink px-3 py-2.5 font-bold text-panel">
                    <dt>Prix unitaire net HT</dt>
                    <dd className="tabular-nums text-accent">{typeof result.price === "number" ? euro(result.price) : ""}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted">
                Renseignez le type et les dimensions pour voir le prix.
              </p>
            )}

            {comment ? (
              <details className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                <summary className="cursor-pointer font-semibold text-ink">Commentaire généré</summary>
                <p className="mt-2 whitespace-pre-line text-ink-soft">{comment}</p>
              </details>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line bg-panel px-5 py-3">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold transition hover:bg-line-soft"
          >
            Dupliquer
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-danger/30 bg-panel px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-bg"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-bold text-panel transition hover:bg-ink-soft"
          >
            Terminé
          </button>
        </footer>
      </aside>
    </div>
  );
}
