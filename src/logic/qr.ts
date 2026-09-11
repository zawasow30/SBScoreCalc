export interface ParsedScoreData {
  pitch: number;            // 表示スケール (0..100)
  stability: number;        // 表示スケール (0..100)
  expression: number;       // 表示スケール (0..100)
  rhythm: number;           // 表示スケール (0..100)
  vibrato_longtone: number; // 表示スケール (0..100)
  hibiki: number;           // 内部スケール (0..100000)
  overtone: number;         // raw % スケール (0..2500)
  rawText: string;
}

export const QR_SCORE_REGEX = /^p(\d+)s(\d+)e(\d+)r(\d+)vl(\d+)h(\d+)ot(\d+)$/i;
export const EMBEDDED_SCORE_REGEX = /p(\d+)s(\d+)e(\d+)r(\d+)vl(\d+)h(\d+)ot(\d+)/i;

/**
 * 生テキスト、クエリ文字列、または完全なURLから集約テキスト部分（p...s...e...r...vl...h...ot...）を抽出する
 */
export function extractScoreText(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(EMBEDDED_SCORE_REGEX);
  return match ? match[0] : null;
}

/**
 * 集約テキスト（またはそれを含むURL/クエリ文字列）をパースして各採点パラメータを復元する
 */
export function parseScoreQR(text: string): ParsedScoreData | null {
  if (!text) return null;
  const scoreText = extractScoreText(text);
  if (!scoreText) return null;

  const match = scoreText.match(QR_SCORE_REGEX);
  if (!match) return null;

  const [, p, s, e, r, vl, h, ot] = match;

  return {
    pitch: Math.min(100, Math.max(0, parseInt(p, 10) / 1000)),
    stability: Math.min(100, Math.max(0, parseInt(s, 10) / 1000)),
    expression: Math.min(100, Math.max(0, parseInt(e, 10) / 1000)),
    rhythm: Math.min(100, Math.max(0, parseInt(r, 10) / 1000)),
    vibrato_longtone: Math.min(100, Math.max(0, parseInt(vl, 10) / 1000)),
    hibiki: Math.min(100000, Math.max(0, parseInt(h, 10))),
    overtone: Math.min(2500, Math.max(0, parseInt(ot, 10))),
    rawText: scoreText,
  };
}

/**
 * 各パラメータから集約テキスト（p...s...e...r...vl...h...ot...）を生成する
 */
export function formatScoreQR(data: {
  pitch: number;
  stability: number;
  expression: number;
  rhythm: number;
  vibrato_longtone: number;
  hibiki: number;
  overtone: number;
}): string {
  const toInt = (val: number, mul = 1000) => Math.round(val * mul);
  const p = toInt(data.pitch);
  const s = toInt(data.stability);
  const e = toInt(data.expression);
  const r = toInt(data.rhythm);
  const vl = toInt(data.vibrato_longtone);
  const h = Math.round(data.hibiki);
  const ot = Math.round(data.overtone);
  return `p${p}s${s}e${e}r${r}vl${vl}h${h}ot${ot}`;
}

/**
 * 集約テキストを指定されたベースURLのクエリパラメータ（?chart=...）として組み込んだ完全なURLを生成する
 */
export function buildScoreUrl(scoreStr: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.href : 'https://zawasow30.github.io/SBScoreCalc/');
  const url = new URL(base);
  url.searchParams.set('chart', scoreStr);
  return url.toString();
}
