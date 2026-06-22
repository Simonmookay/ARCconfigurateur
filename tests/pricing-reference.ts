import { tables } from "../lib/data";
import { compatibleProfiles, computeLine, emptyLine, priceBreakdown, snap, tarifBaie, totals, xlRound } from "../lib/pricing";
import type { DevisLine } from "../lib/types";

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function close(actual: number | null, expected: number, label: string) {
  check(
    label,
    typeof actual === "number" && Math.abs(actual - expected) <= 0.001,
    `expected ${expected}, got ${actual}`,
  );
}

function line(overrides: Partial<DevisLine>): DevisLine {
  return { ...emptyLine(), ...overrides };
}

const remise = tables.remiseDefault; // 0.515

// --- Cas de référence (spec §10) : doit tomber au centime près ---
{
  const ref = line({
    type: "Coulissant 2 vantaux 2 rails",
    L: 1800,
    H: 1200,
    qte: 1,
    ventilation: "OUI",
    habillage: "Cornière 60×30",
    bavette: "Bavette 74 mm (N99987)",
  });
  const r = computeLine(ref, tables, remise);
  check("référence: tarifBaie = 1997", r.tarifBaie === 1997, `got ${r.tarifBaie}`);
  close(r.price, 1198.931, "référence: prix unitaire");
  close(r.total, 1198.931, "référence: total");
  close(totals([r], remise).totalNetHT, 1198.931, "référence: total net HT");
}

// --- Arrondi Excel half-up + accrochage au pas (spec §6.1/§6.2) ---
{
  check("xlRound(4.5) = 5", xlRound(4.5) === 5);
  check("xlRound(-4.5) = -5", xlRound(-4.5) === -5);
  check("snap(1200) = 1250 (half-up)", snap(1200, 750, 100, 2700) === 1250, `got ${snap(1200, 750, 100, 2700)}`);
  check("snap clamp bas = width_first", snap(500, 800, 100, 3500) === 800);
  check("snap clamp haut = maxLimit", snap(9999, 800, 100, 3500) === 3500);
}

// --- Hors abaque : prix masqué, pas de message d'erreur (spec §8.2) ---
{
  const r = computeLine(line({ type: "Coulissant 2 vantaux 2 rails", L: 700, H: 1200 }), tables, remise);
  check("hors abaque: prix null", r.price === null);
  check("hors abaque: horsAbaque flag", r.horsAbaque === true);
  check("hors abaque: pas d'erreur texte", r.error === null);
}

// --- Option porte sur un type non-porte → message d'erreur (spec §4.5) ---
{
  const r = computeLine(
    line({ type: "Coulissant 2 vantaux 2 rails", L: 1800, H: 1200, optionPorte: "Poignée S Filante" }),
    tables,
    remise,
  );
  check("option non-porte: prix null", r.price === null);
  check("option non-porte: message", r.error?.includes("Porte Lourde") ?? false, r.error ?? "null");
}

// --- Traverse/meneau incompatible avec la gamme (spec §4.6) ---
{
  const r = computeLine(
    line({ type: "Coulissant 2 vantaux 2 rails", L: 1800, H: 1200, optTM1: "Traverse 70 mm" }),
    tables,
    remise,
  );
  check("T/M incompatible: prix null", r.price === null);
  check("T/M incompatible: message", r.error?.includes("incompatible") ?? false, r.error ?? "null");
}

// --- Dimension non disponible : cellule vide dans la matrice → V = -1 (spec §6.3) ---
{
  const r = computeLine(line({ type: "Fenêtre OF 1 vantail", L: 800, H: 550 }), tables, remise);
  check("dimension indispo: prix null", r.price === null);
  check("dimension indispo: message", r.error?.includes("Dimension non disponible") ?? false, r.error ?? "null");
}

// --- PV 4 points : hauteur accrochée ≥ 2320 → +4 % du tarif baie (spec §12) ---
{
  const ph = line({ type: "Coulissant 2 vantaux 2 rails", L: 1800, H: 2400 });
  const V = tarifBaie(ph, tables.routing, tables.grids).value; // 2867
  const r = computeLine(ph, tables, remise);
  close(r.price, V * 1.04 * (1 - remise), "PV 4 points: prix = V × 1.04 × (1−remise)");
}

// --- Option porte (mult vantail) ajoutée APRÈS remise, ×2 sur 2 vantaux (spec §4.5) ---
{
  const base = line({ type: "Porte Lourde 2 vantaux", L: 1200, H: 1950 });
  const without = computeLine(base, tables, remise);
  const withOpt = computeLine({ ...base, optionPorte: "Joint anti pince doigt (par vantail)" }, tables, remise);
  check("porte: prix de base numérique", typeof without.price === "number");
  const expectedAC = 477 * 0.75 * 2 * (1 - remise);
  close(
    (withOpt.price as number) - (without.price as number),
    expectedAC,
    "option porte: delta = prix × 0.75 × 2 vantaux × (1−remise)",
  );
}

// --- Forfait couleur : 1× par devis = MAX des forfaits, remisé (spec §3.3) ---
{
  const l1 = computeLine(line({ famille: "Famille 3 Monocolore" }), tables, remise); // forfait 99
  const l2 = computeLine(line({ famille: "Famille 5 Bicolore" }), tables, remise); // forfait 275
  const t = totals([l1, l2], remise);
  close(t.forfaitCouleur, 275 * (1 - remise), "forfait couleur = MAX(forfaits) × (1−remise)");
  close(t.totalNetHT, 275 * (1 - remise), "forfait couleur compté une seule fois");
}

// --- priceBreakdown : la somme du détail = prix unitaire (anti-divergence) ---
{
  const cases: DevisLine[] = [
    line({
      type: "Coulissant 2 vantaux 2 rails",
      L: 1800,
      H: 1200,
      ventilation: "OUI",
      habillage: "Cornière 60×30",
      bavette: "Bavette 74 mm (N99987)",
    }),
    line({ type: "Coulissant 2 vantaux 2 rails", L: 1800, H: 2400, famille: "Famille 3 Monocolore" }),
    line({
      type: "Porte Lourde 2 vantaux",
      L: 1200,
      H: 1950,
      optionPorte: "Joint anti pince doigt (par vantail)",
    }),
  ];
  for (const c of cases) {
    const expected = computeLine(c, tables, remise).price as number;
    const rows = priceBreakdown(c, tables, remise);
    check(`breakdown non null (${c.type})`, rows !== null);
    const sum = (rows ?? []).reduce((s, r) => s + r.amount, 0);
    close(sum, expected, `breakdown somme = prix unitaire (${c.type})`);
  }
  check("breakdown null si hors-abaque", priceBreakdown(line({ type: "Coulissant 2 vantaux 2 rails", L: 700, H: 1200 }), tables, remise) === null);
}

// --- compatibleProfiles : ne propose que les couples Type|Profilé valides ---
{
  const coul = compatibleProfiles("Coulissant 2 vantaux 2 rails", tables);
  check("coulissant: aucun profilé T/M compatible (hors Aucune)", coul.length === 1 && coul[0] === "Aucune");
  const pl2 = compatibleProfiles("Porte Lourde 2 vantaux", tables);
  check("porte 2v: profilés compatibles présents", pl2.includes("Traverse 70 mm") && pl2.includes("Meneau 100 mm"));
  check("porte 2v: profilé non prévu exclu", !pl2.includes("Traverse 100 mm"));
}

if (failures > 0) {
  console.error(`\nPricing tests: ${checks - failures}/${checks} OK, ${failures} échec(s)`);
  process.exit(1);
}

console.log(`Pricing tests OK — ${checks} assertions validées`);
