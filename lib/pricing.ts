import type { BreakdownRow, DevisLine, LineResult, PriceGrid, Routing, Tables } from "@/lib/types";

export function xlRound(x: number) {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}

export function snap(value: number, first: number, step: number, maxLimit: number) {
  const snapped = first + xlRound((value - first) / step) * step;
  return Math.max(first, Math.min(maxLimit, snapped));
}

export function matchExactOrApprox(value: number, values: number[]) {
  const exact = values.indexOf(value);
  if (exact !== -1) return exact;

  let best = -1;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] <= value) best = index;
    else break;
  }
  return best;
}

export function emptyLine(): DevisLine {
  return {
    localisation: "",
    type: "",
    famille: "Famille 1 Monocolore",
    vitrage: "4 /20/ 4 (Fe Argon WE) Clair",
    dormant: "Standard (sans doublage)",
    L: "",
    H: "",
    qte: 1,
    observations: "",
    ventilation: "NON",
    optTM1: "Aucune",
    optTM2: "Aucune",
    optTM3: "Aucune",
    habillage: "Aucun",
    bavette: "Aucune",
    optionPorte: "Aucune option",
  };
}

export function tarifBaie(line: DevisLine, routing: Record<string, Routing>, grids: Record<string, PriceGrid>) {
  if (!line.type || line.L === "" || line.H === "") {
    return { value: 0, snappedW: null, snappedH: null };
  }

  const route = routing[line.type];
  if (!route) return { value: 0, snappedW: null, snappedH: null };

  const grid = grids[route.onglet];
  if (!grid) return { value: 0, snappedW: null, snappedH: null };

  const snappedW = snap(line.L, route.width_first, route.width_step, route.L_max);
  const snappedH = snap(line.H, route.height_first, route.height_step, route.H_max);
  const widthIndex = matchExactOrApprox(snappedW, grid.widths);
  const heightIndex = matchExactOrApprox(snappedH, grid.heights);

  if (widthIndex < 0 || heightIndex < 0) {
    return { value: -1, snappedW, snappedH };
  }

  const price = grid.prices[heightIndex]?.[widthIndex];
  return { value: price == null ? -1 : price, snappedW, snappedH };
}

export function isPorteLourde(type: string) {
  return type === "Porte Lourde 1 vantail" || type === "Porte Lourde 2 vantaux";
}

export function isHorsAbaque(line: DevisLine, tables: Tables) {
  if (!line.type) return false;
  const abaque = tables.abaques[line.type];
  if (!abaque) return false;

  return (
    (line.L !== "" && (line.L < abaque.L_min || line.L > abaque.L_max)) ||
    (line.H !== "" && (line.H < abaque.H_min || line.H > abaque.H_max))
  );
}

type LineComponents = {
  route: Routing | undefined;
  V: number;
  W: number;
  X: number;
  Y: number;
  Z: number;
  AA: number;
  AB: number;
  AC: number;
  AD: number;
  AE: number;
  snappedW: number | null;
  snappedH: number | null;
  porte: boolean;
  abaqueError: boolean;
};

/**
 * Calcule toutes les plus-values intermédiaires d'une ligne (colonnes V→AE du
 * classeur Excel). Source unique partagée par computeLine (prix final + erreurs)
 * et priceBreakdown (détail en cascade) afin d'éviter toute divergence.
 */
function lineComponents(line: DevisLine, tables: Tables, remise: number): LineComponents {
  const route = line.type ? tables.routing[line.type] : undefined;
  const abaqueError = isHorsAbaque(line, tables);
  const baie = tarifBaie(line, tables.routing, tables.grids);
  const V = baie.value;
  const snappedH = route && line.H !== "" ? snap(line.H, route.height_first, route.height_step, route.H_max) : 0;
  const porte = isPorteLourde(line.type);

  const W = V === 0 || !route ? 0 : snappedH >= route.H_4pt ? V * route.PV4pts_pct : 0;
  const fam = tables.famille[line.famille] ?? { pct: 0, forfait: 0 };
  const X = !line.famille || V === 0 ? 0 : V * fam.pct;
  const Y = !line.famille ? 0 : fam.forfait;
  const Z = !line.vitrage ? 0 : tables.vitrage[line.vitrage] ?? 0;
  const dormant = tables.dormant[line.dormant] ?? { eurml: 0, pct: 0 };
  const AA = !line.dormant || line.L === "" || line.H === "" ? 0 : dormant.eurml * (2 * (line.L + line.H)) / 1000;
  const AB = !line.dormant || V === 0 ? 0 : V * dormant.pct;

  let AC = 0;
  if (line.optionPorte && line.optionPorte !== "Aucune option" && porte) {
    const option = tables.option[line.optionPorte];
    if (option) {
      const vantaux = option.mult === 1 ? (line.type === "Porte Lourde 2 vantaux" ? 2 : 1) : 1;
      AC = option.prix * 0.75 * vantaux * (1 - remise);
    }
  }

  let AD = 0;
  let AE = 0;
  for (const profile of [line.optTM1, line.optTM2, line.optTM3]) {
    if (!profile || profile === "Aucune") continue;
    const price = tables.tm[`${line.type}|${profile}`];
    if (price === undefined) {
      AE += 1;
      continue;
    }
    const length = profile.startsWith("Traverse") ? line.L : line.H;
    if (length !== "") AD += (price * length) / 1000;
  }

  return {
    route,
    V,
    W,
    X,
    Y,
    Z,
    AA,
    AB,
    AC,
    AD,
    AE,
    snappedW: baie.snappedW,
    snappedH: baie.snappedH,
    porte,
    abaqueError,
  };
}

export function computeLine(line: DevisLine, tables: Tables, remise: number): LineResult {
  const { V, W, X, Y, Z, AA, AB, AC, AD, AE, porte, abaqueError, snappedW, snappedH } = lineComponents(
    line,
    tables,
    remise,
  );

  if (abaqueError) {
    return result(null, 0, Y, V, snappedW, snappedH, true, null);
  }

  if (line.optionPorte && line.optionPorte !== "Aucune option" && !porte) {
    return result(null, 0, Y, V, snappedW, snappedH, false, "Option valable uniquement pour Porte Lourde");
  }

  if (AE > 0) {
    return result(null, 0, Y, V, snappedW, snappedH, false, "Option T/M incompatible avec la gamme");
  }

  if (V === 0) {
    return result(AC > 0 ? AC : null, line.qte || 0, Y, V, snappedW, snappedH, false, null);
  }

  if (V === -1) {
    return result(null, 0, Y, V, snappedW, snappedH, false, "Dimension non disponible");
  }

  let price = (V + W + X + Z + AA + AB + AD) * (1 - remise) + AC;
  if (line.ventilation === "OUI") price += 25;
  if (line.L !== "" && line.H !== "") {
    price += (tables.habillage[line.habillage] ?? 0) * (line.L + 2 * line.H) / 1000;
    price += (tables.bavette[line.bavette] ?? 0) * line.L / 1000;
  }

  return result(price, line.qte || 0, Y, V, snappedW, snappedH, false, null);
}

/**
 * Détail du prix unitaire sous forme de cascade (waterfall), pour l'affichage
 * « pourquoi ce prix ». Renvoie null si la ligne n'a pas de prix numérique
 * (incomplète, hors-abaque ou en erreur). La somme des montants = prix unitaire.
 */
export function priceBreakdown(line: DevisLine, tables: Tables, remise: number): BreakdownRow[] | null {
  const computed = computeLine(line, tables, remise);
  if (typeof computed.price !== "number") return null;

  const c = lineComponents(line, tables, remise);
  const rows: BreakdownRow[] = [];

  if (c.V > 0) {
    rows.push({ label: `Tarif baie (${c.snappedW} × ${c.snappedH} mm)`, amount: c.V });
    if (c.W) rows.push({ label: "PV 4 points de fermeture", amount: c.W });
    if (c.X) rows.push({ label: "PV famille couleur", amount: c.X });
    if (c.Z) rows.push({ label: "PV vitrage", amount: c.Z });
    if (c.AA) rows.push({ label: "PV dormant (€/ml)", amount: c.AA });
    if (c.AB) rows.push({ label: "PV dormant (% baie)", amount: c.AB });
    if (c.AD) rows.push({ label: "PV traverses / meneaux", amount: c.AD });
    const subtotal = c.V + c.W + c.X + c.Z + c.AA + c.AB + c.AD;
    rows.push({ label: `Remise ${formatPercent(remise)}`, amount: subtotal * (1 - remise) - subtotal });
  }

  if (c.AC) rows.push({ label: "Option porte", amount: c.AC });
  if (line.ventilation === "OUI") rows.push({ label: "Grille de ventilation", amount: 25 });
  if (line.L !== "" && line.H !== "") {
    const habillage = (tables.habillage[line.habillage] ?? 0) * (line.L + 2 * line.H) / 1000;
    const bavette = (tables.bavette[line.bavette] ?? 0) * line.L / 1000;
    if (habillage) rows.push({ label: `Habillage : ${line.habillage}`, amount: habillage });
    if (bavette) rows.push({ label: `Bavette : ${line.bavette}`, amount: bavette });
  }

  return rows;
}

/**
 * Profilés traverses/meneaux compatibles avec un type de menuiserie
 * (« Aucune » + ceux dont le couple Type|Profilé existe dans la table de PV).
 */
export function compatibleProfiles(type: string, tables: Tables): string[] {
  if (!type) return tables.lists.tm;
  return tables.lists.tm.filter(
    (profile) => profile === "Aucune" || tables.tm[`${type}|${profile}`] !== undefined,
  );
}

function result(
  price: number | null,
  qte: number,
  forfait: number,
  tarif: number,
  snappedW: number | null,
  snappedH: number | null,
  horsAbaque: boolean,
  error: string | null,
): LineResult {
  return {
    price,
    total: typeof price === "number" ? price * qte : 0,
    forfait,
    tarifBaie: tarif,
    snappedW,
    snappedH,
    horsAbaque,
    error,
  };
}

export function totals(results: LineResult[], remise: number) {
  const totalLignes = results.reduce((sum, item) => sum + item.total, 0);
  const forfaitCouleur = Math.max(0, ...results.map((item) => item.forfait)) * (1 - remise);
  return {
    totalLignes,
    forfaitCouleur,
    totalNetHT: totalLignes + forfaitCouleur,
    remise,
  };
}

export function buildComment(line: DevisLine, tables: Tables) {
  if (!line.type) return "";

  const fragments: string[] = [`${line.type} aluminium`];
  if (line.L !== "" && line.H !== "") fragments[0] += `, ${line.L} x ${line.H} mm`;

  const abaque = tables.abaques[line.type];
  if (abaque && isHorsAbaque(line, tables)) {
    fragments.push(`Attention hors abaque (L ${abaque.L_min}-${abaque.L_max} / H ${abaque.H_min}-${abaque.H_max} mm)`);
  }

  const system = tables.systems[line.type];
  if (system) fragments.push(`Système : ${system}`);
  if (line.famille) fragments.push(`Traitement surface : ${line.famille}`);
  if (line.vitrage) fragments.push(`Vitrage : ${line.vitrage}`);
  if (line.dormant) fragments.push(`Cadre : ${line.dormant}`);

  const pf = tables.poigneesFermetures[line.type];
  const optionLower = line.optionPorte.toLowerCase();
  const hideDoorHardware = isPorteLourde(line.type) && (optionLower.includes("ventouse") || optionLower.includes("antipanique"));
  if (pf && !hideDoorHardware) {
    if (pf.poignee) fragments.push(`Poignée : ${pf.poignee}`);
    if (pf.fermeture) fragments.push(`Fermeture : ${pf.fermeture}`);
  }

  const selectedProfiles = [line.optTM1, line.optTM2, line.optTM3].filter((profile) => profile && profile !== "Aucune");
  const traverses = selectedProfiles.filter((profile) => profile.startsWith("Traverse"));
  const meneaux = selectedProfiles.filter((profile) => profile.startsWith("Meneau"));
  if (traverses.length > 0) fragments.push(`Traverses : ${traverses.join(", ")}`);
  if (meneaux.length > 0) fragments.push(`Meneaux : ${meneaux.join(", ")}`);
  if (line.optionPorte && line.optionPorte !== "Aucune option") fragments.push(`Option : ${line.optionPorte}`);
  if (line.ventilation === "OUI") fragments.push("Grille de ventilation");
  if (line.habillage && line.habillage !== "Aucun") fragments.push(`Habillage extérieur : ${line.habillage}`);
  if (line.bavette && line.bavette !== "Aucune") fragments.push(`Bavette : ${line.bavette}`);

  return fragments.join("\n");
}

export function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 2 }).format(value);
}
