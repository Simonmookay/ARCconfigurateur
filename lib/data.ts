import rawData from "@/arc_data.json";
import type { PriceGrid, Routing, Tables } from "@/lib/types";

type RawData = {
  remise_default: number;
  routing: Routing[];
  color_families: Array<[string, number, number]>;
  dormants: Array<[string, number, number]>;
  vitrages: Array<[string, number, string]>;
  door_options: Array<[string, number, number]>;
  tm_prices: Array<[string, number]>;
  tm_list: string[];
  systems: Array<[string, string]>;
  poignees_fermetures: Array<[string, string, string]>;
  abaques: Array<[string, number, number, number, number]>;
  habillage_exterieur: Array<[string, number]>;
  bavette: Array<[string, number]>;
  price_grids: Record<string, PriceGrid>;
};

const data = rawData as unknown as RawData;

function fromEntries<T>(entries: Array<[string, T]>): Record<string, T> {
  return Object.fromEntries(entries);
}

export const tables: Tables = {
  remiseDefault: data.remise_default,
  routing: fromEntries(data.routing.map((row) => [row.label, row])),
  famille: fromEntries(data.color_families.map(([label, pct, forfait]) => [label, { pct, forfait }])),
  dormant: fromEntries(data.dormants.map(([label, eurml, pct]) => [label, { eurml, pct }])),
  vitrage: fromEntries(data.vitrages.map(([code, pv]) => [code, pv])),
  option: fromEntries(data.door_options.map(([label, prix, mult]) => [label, { prix, mult }])),
  tm: fromEntries(data.tm_prices),
  systems: fromEntries(data.systems),
  poigneesFermetures: fromEntries(
    data.poignees_fermetures.map(([type, poignee, fermeture]) => [type, { poignee, fermeture }]),
  ),
  abaques: fromEntries(
    data.abaques.map(([type, L_min, L_max, H_min, H_max]) => [type, { L_min, L_max, H_min, H_max }]),
  ),
  habillage: fromEntries(data.habillage_exterieur),
  bavette: fromEntries(data.bavette),
  grids: data.price_grids,
  vitrageList: data.vitrages.map(([code, pv, category]) => ({ code, pv, category })),
  lists: {
    types: data.routing.map((row) => row.label),
    familles: data.color_families.map(([label]) => label),
    vitrages: data.vitrages.map(([code]) => code),
    dormants: data.dormants.map(([label]) => label),
    doorOptions: data.door_options.map(([label]) => label),
    tm: data.tm_list,
    habillages: data.habillage_exterieur.map(([label]) => label),
    bavettes: data.bavette.map(([label]) => label),
  },
};
