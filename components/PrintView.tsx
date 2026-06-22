"use client";

import { tables } from "@/lib/data";
import type { DevisLine, LineResult } from "@/lib/types";
import { buildComment, euro, formatPercent } from "@/lib/pricing";

type HeaderInfo = Record<string, string>;

export function PrintView({
  header,
  requestDate,
  entries,
  results,
  totals,
}: {
  header: HeaderInfo;
  requestDate: string;
  entries: Array<{ id: string; line: DevisLine }>;
  results: LineResult[];
  totals: { totalLignes: number; forfaitCouleur: number; totalNetHT: number; remise: number };
}) {
  const filled = entries
    .map((entry, index) => ({ entry, result: results[index], index }))
    .filter(({ entry }) => entry.line.type !== "");

  return (
    <div className="hidden text-[12px] text-ink print:block">
      <div className="mb-4 flex items-start justify-between border-b border-ink pb-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/arc-logo.svg" alt="A.R.C Aluminium" className="mb-1.5 h-8 w-auto" />
          <h1 className="text-base font-bold">DEVIS — FOURNITURE SEULE — MENUISERIES ALUMINIUM</h1>
          <p className="mt-1 text-[11px]">Date de la demande : {requestDate}</p>
        </div>
        <div className="text-right text-[11px] leading-5">
          <p className="font-semibold">{header.societe}</p>
          <p>{header.demandeur}</p>
          <p>{header.telephone}</p>
          <p>{header.email}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-[11px] leading-5">
        <div>
          <p className="font-bold uppercase tracking-wide text-accent-strong">Chantier</p>
          <p>{header.chantier || "—"}</p>
          <p>{header.adresse}</p>
          {header.reference ? <p>Réf. affaire : {header.reference}</p> : null}
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-accent-strong">Performances</p>
          {header.uw ? <p>Uw : {header.uw}</p> : null}
          {header.sw ? <p>Sw : {header.sw}</p> : null}
          {header.acoustique ? <p>Acoustique : {header.acoustique}</p> : null}
          {header.aev ? <p>AEV : {header.aev}</p> : null}
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-ink text-left">
            <th className="py-1 pr-2">N°</th>
            <th className="py-1 pr-2">Désignation</th>
            <th className="py-1 pr-2 text-right">Qté</th>
            <th className="py-1 pr-2 text-right">P.U. net HT</th>
            <th className="py-1 text-right">Total net HT</th>
          </tr>
        </thead>
        <tbody>
          {filled.map(({ entry, result, index }) => (
            <tr key={entry.id} className="border-b border-line align-top">
              <td className="py-1.5 pr-2">{index + 1}</td>
              <td className="py-1.5 pr-2">
                {entry.line.localisation ? <span className="font-semibold">{entry.line.localisation} — </span> : null}
                <span className="whitespace-pre-line">{buildComment(entry.line, tables)}</span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{entry.line.qte || 0}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {result.error ? "—" : typeof result.price === "number" ? euro(result.price) : "—"}
              </td>
              <td className="py-1.5 text-right tabular-nums">{result.total ? euro(result.total) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 w-72 text-[12px]">
        <div className="flex justify-between py-0.5">
          <span>Total HT des lignes</span>
          <span className="tabular-nums">{euro(totals.totalLignes)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span>Forfait couleur</span>
          <span className="tabular-nums">{euro(totals.forfaitCouleur)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-ink pt-1 text-sm font-bold">
          <span>TOTAL NET HT</span>
          <span className="tabular-nums">{euro(totals.totalNetHT)}</span>
        </div>
        <p className="mt-1 text-right text-[10px] text-muted">Remise appliquée : {formatPercent(totals.remise)}</p>
      </div>
    </div>
  );
}
