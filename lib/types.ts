export type DevisLine = {
  localisation: string;
  type: string;
  famille: string;
  vitrage: string;
  dormant: string;
  L: number | "";
  H: number | "";
  qte: number | "";
  observations: string;
  ventilation: "OUI" | "NON";
  optTM1: string;
  optTM2: string;
  optTM3: string;
  habillage: string;
  bavette: string;
  optionPorte: string;
};

export type Routing = {
  label: string;
  onglet: string;
  L_min: number;
  L_max: number;
  H_min: number;
  H_max: number;
  H_1pt: number;
  H_2pt: number;
  H_3pt: number;
  H_4pt: number;
  PV4pts_pct: number;
  EUR_first_row: number;
  EUR_first_col: number;
  n_widths: number;
  n_heights: number;
  width_first: number;
  width_step: number;
  height_first: number;
  height_step: number;
};

export type PriceGrid = {
  widths: number[];
  heights: number[];
  prices: Array<Array<number | null>>;
};

export type Tables = {
  remiseDefault: number;
  routing: Record<string, Routing>;
  famille: Record<string, { pct: number; forfait: number }>;
  dormant: Record<string, { eurml: number; pct: number }>;
  vitrage: Record<string, number>;
  option: Record<string, { prix: number; mult: number }>;
  tm: Record<string, number>;
  systems: Record<string, string>;
  poigneesFermetures: Record<string, { poignee: string; fermeture: string }>;
  abaques: Record<string, { L_min: number; L_max: number; H_min: number; H_max: number }>;
  habillage: Record<string, number>;
  bavette: Record<string, number>;
  grids: Record<string, PriceGrid>;
  vitrageList: Array<{ code: string; pv: number; category: string }>;
  lists: {
    types: string[];
    familles: string[];
    vitrages: string[];
    dormants: string[];
    doorOptions: string[];
    tm: string[];
    habillages: string[];
    bavettes: string[];
  };
};

export type BreakdownRow = {
  label: string;
  amount: number;
};

export type LineResult = {
  price: number | null;
  total: number;
  forfait: number;
  tarifBaie: number;
  snappedW: number | null;
  snappedH: number | null;
  horsAbaque: boolean;
  error: string | null;
};
