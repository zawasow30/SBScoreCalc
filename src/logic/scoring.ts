export interface ScoreParams {
  pitch: number;            // 0..100
  stability: number;        // 0..100
  expression: number;       // 0..100
  rhythm: number;           // 0..100
  vibrato_longtone: number; // 0..100
  hibiki: number;           // 0..100000 (または 0..100)
  overtone: number;         // 0..2500 (raw %)
}

export interface BonusBreakdown {
  rhythm: number;
  expression: number;
  stability: number;
  vibrato_longtone: number;
  hibiki: number;
  overtone: number;
}

export interface ScoreResult {
  total: number;             // 総合得点 (0..100.000)
  noteBase: number;          // 素点 (0..100.000)
  bonus: BonusBreakdown;     // 各加点項目 (点数)
  bonusTotal: number;        // 加点ボーナス合計
  totalRaw: number;          // カンスト前の理論総合得点
  clamped: boolean;          // 100点カンスト制限がかかったかどうか
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function bracket(axis: number[], v: number): [number, number, number, number] {
  const n = axis.length;
  if (v <= axis[0]) return [0, 0, axis[0], axis[0]];
  if (v >= axis[n - 1]) return [n - 1, n - 1, axis[n - 1], axis[n - 1]];
  for (let i = 0; i < n - 1; i++) {
    if (axis[i] <= v && v <= axis[i + 1]) {
      return [i, i + 1, axis[i], axis[i + 1]];
    }
  }
  return [n - 1, n - 1, axis[n - 1], axis[n - 1]];
}

export function getScore1D(axis: number[], table: number[], v: number): number {
  const [lo, hi, lv, hv] = bracket(axis, v);
  if (hv === lv) return table[lo];
  const num = table[hi] * (v - lv) + table[lo] * (hv - v);
  return Math.floor(num / (hv - lv));
}

export function getScore2D(
  axisRow: number[],
  axisCol: number[],
  table: number[][],
  vRow: number,
  vCol: number
): number {
  const [lo, hi, lv, hv] = bracket(axisRow, vRow);
  const a = getScore1D(axisCol, table[lo], vCol);
  const b = getScore1D(axisCol, table[hi], vCol);
  if (hv === lv) return Math.ceil(a);
  const num = b * (vRow - lv) + a * (hv - vRow);
  return Math.ceil(num / (hv - lv));
}

export const AX_PURITY_ROW = [0, 50000, 80000, 90000, 95000, 100000];
export const AX_ITEM_COL = [0, 50000, 70000, 80000, 90000, 100000];
export const AX_PITCH = [0, 80000, 85000, 90000, 95000, 100000];

export const MAP_PURITY_NOTE_SCORE = [0, 80000, 85000, 90000, 95000, 100000];
export const MAP_NOTE_SCORE_AI = [0, 78000, 82000, 85000, 86600, 86900];
export const SCORE_CLAMP_MAX = 100000;

export interface TableSpec {
  col: number[];
  row: number[];
  map: number[][];
}

export const AI_TABLES: Record<keyof BonusBreakdown, TableSpec> = {
  stability: {
    col: AX_ITEM_COL,
    row: AX_PURITY_ROW,
    map: [
      [    0,  3000, 4500, 5000, 6200, 6500],
      [ -125,  1200, 2800, 3500, 5200, 6000],
      [ -500,   400, 1000, 1200, 2900, 3500],
      [ -750,  -250,   40,  500, 2200, 2850],
      [ -900,  -400,   10,  120, 1900, 2600],
      [-1000,  -600, -120,    0, 1600, 2500],
    ],
  },
  rhythm: {
    col: AX_ITEM_COL,
    row: AX_PURITY_ROW,
    map: [
      [    0,  2200,  3600, 4000, 4800, 5500],
      [ -500,  1800,  2200, 2500, 3500, 5000],
      [-1500,  -500,   500,  700, 2800, 3000],
      [-2200, -1800, -1000,  160, 2300, 2650],
      [-2750, -2300, -1800,   80, 2100, 2550],
      [-3000, -2500, -2000,    0, 2000, 2500],
    ],
  },
  vibrato_longtone: {
    col: AX_ITEM_COL,
    row: AX_PURITY_ROW,
    map: [
      [    0,  2600, 3400, 4000, 5100, 5500],
      [ -125,  1600, 2200, 2500, 4100, 5000],
      [ -500,   500,  620,  700, 2200, 3000],
      [ -750,  -240,  -80,  160, 2050, 2650],
      [ -900,  -330, -120,   80, 1720, 2550],
      [-1000,  -600, -200,    0, 1200, 2500],
    ],
  },
  expression: {
    col: [0, 50000, 70000, 80000, 90000, 100000],
    row: AX_PURITY_ROW,
    map: [
      [ 1800,  4100, 5000, 6000, 7000, 8000],
      [ 1000,  4000, 4700, 6000, 6800, 7980],
      [    0,  1200, 3800, 5000, 6200, 7500],
      [ -500,   500, 3100, 4200, 5100, 6600],
      [ -800,  -500, 2300, 3500, 4750, 6000],
      [-1200, -1000, 1800, 3400, 4600, 5700],
    ],
  },
  hibiki: {
    col: [0, 50000, 60000, 70000, 80000, 90000],
    row: AX_PURITY_ROW,
    map: [
      [   0, 200, 245, 280, 310, 320],
      [ -60, 100, 180, 240, 285, 300],
      [-100,  10,  85, 120, 145, 150],
      [-280,   8,  70, 100, 115, 120],
      [-450,   2,  60,  85, 100, 110],
      [-500,   0,  45,  70,  85, 100],
    ],
  },
  overtone: {
    col: [400, 1000, 1200, 1500, 2000, 2500],
    row: [60000, 70000, 80000, 85000, 95000, 100000],
    map: [
      [2100, 1900, 1600, 800,  100,    0],
      [1600, 1350,  900, 500,   80,    0],
      [1100,  900,  600, 300,   60,    0],
      [ 700,  500,  350, 100,    0, -200],
      [  80,   60,   30,  10,    0, -250],
      [  20,   15,   10,   0, -150, -300],
    ],
  },
};

export interface InternalComposeResult {
  base: number;
  noteBase: number;
  bonus: Record<keyof BonusBreakdown, number>;
  totalRaw: number;
  totalCore: number;
  clamped: boolean;
}

export function composeTotal(
  purity: number,
  itemInputs: Record<keyof BonusBreakdown, number>
): InternalComposeResult {
  const base = getScore1D(AX_PITCH, MAP_PURITY_NOTE_SCORE, purity);
  const noteBase = getScore1D(AX_PITCH, MAP_NOTE_SCORE_AI, base);
  const bonus = {} as Record<keyof BonusBreakdown, number>;

  const totalItems: (keyof BonusBreakdown)[] = [
    "rhythm",
    "expression",
    "stability",
    "vibrato_longtone",
    "hibiki",
    "overtone",
  ];

  for (const item of totalItems) {
    const spec = AI_TABLES[item];
    if (!spec) continue;
    const rowAxis = spec.row || AX_PURITY_ROW;
    bonus[item] = getScore2D(
      rowAxis,
      spec.col,
      spec.map,
      base,
      Number(itemInputs[item] || 0)
    );
  }

  const bonusSum = Object.values(bonus).reduce((acc, cur) => acc + cur, 0);
  const totalRaw = noteBase + bonusSum;
  const totalCore = clamp(totalRaw, 0, SCORE_CLAMP_MAX);

  return {
    base,
    noteBase,
    bonus,
    totalRaw,
    totalCore,
    clamped: totalCore !== totalRaw,
  };
}

export function calculateAiTotal(params: Partial<ScoreParams>): ScoreResult {
  const purity = Number(params.pitch ?? 0) * 1000.0;
  const rawHibiki = Number(params.hibiki ?? 0);
  const itemInputs: Record<keyof BonusBreakdown, number> = {
    rhythm: Number(params.rhythm ?? 0) * 1000.0,
    expression: Number(params.expression ?? 0) * 1000.0,
    stability: Number(params.stability ?? 0) * 1000.0,
    vibrato_longtone: Number(params.vibrato_longtone ?? 0) * 1000.0,
    hibiki: rawHibiki > 100.0 ? rawHibiki : rawHibiki * 1000.0,
    overtone: Number(params.overtone ?? 0), // raw %
  };

  const comp = composeTotal(purity, itemInputs);

  const bonusPoints = {} as BonusBreakdown;
  for (const [k, v] of Object.entries(comp.bonus)) {
    bonusPoints[k as keyof BonusBreakdown] = v / 1000.0;
  }

  return {
    total: comp.totalCore / 1000.0,      // 総合得点 (0..100.000)
    noteBase: comp.noteBase / 1000.0,    // 素点 (0..100.000)
    bonus: bonusPoints,                  // 各加点 (点数)
    bonusTotal: (comp.totalRaw - comp.noteBase) / 1000.0,
    totalRaw: comp.totalRaw / 1000.0,
    clamped: comp.clamped,
  };
}
