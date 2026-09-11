# Ai採点 総合得点シミュレーター PWA 仕様書
(Ai Score Calculator Progressive Web App Specification)

> **対象**: 本仕様書は、別の開発環境やAI（LLM）プログラミングアシスタントに本アプリ（PWA）を自動生成・実装させるための完全な実装仕様書（Prompt-ready Specification）です。

---

## 1. プロジェクト概要

### 1.1 目的
カラオケ精密採点Aiの「チャート5値（音程・安定性・表現力・リズム・ビブラート＆ロングトーン）」および拡張値「Hibiki（hbk: 響き）」「Overtone（ot: 倍音）」をもとに、実機のAi採点エンジン（scoring_dio）と完全互換の計算式で総合得点および各項目の加点ボーナス内訳をリアルタイムにシミュレーション・算出する **PWA（Progressive Web App）** を構築する。

### 1.2 コアバリュー
- **完全オフライン動作**: サーバーレス。全計算ロジック・アセット・QR解析をクライアントサイド（ブラウザ内）で完結。
- **2大エントリーモード**: 起動時に「**自分で入力する**」と「**QRを読み込む**」の直感的な分岐を提供。
- **QR連携**: `p93203s100000e99450r98780vl99000h67543ot1221` 形式の集約テキストをカメラまたは画像から瞬時にデコードし、各値へ反映。
- **デザイン準拠（Anti-AI Aesthetic）**: SBTool1のLinear/Vercel風ソリッドダークデザインを踏襲。過剰なグラデーションや安っぽい装飾を排し、プロ向け計器のような洗練されたUIを実現。

---

## 2. 画面設計 & ユーザーフロー

### 2.1 ユーザー遷移フロー
```
[ PWA 起動 (初期画面) ]
  ├── 選択A: 「自分で入力する」 ───────┐
  │                                    ▼
  └── 選択B: 「QRを読み込む」 ──(スキャン成功)──> [ シミュレーター画面 ]
                                                   ├─ 5値スライダー＋数値調整
                                                   ├─ Hibiki / Overtone 詳細設定
                                                   ├─ 5値レーダーチャート
                                                   ├─ 総合得点・素点・ボーナス内訳表示
                                                   └─ 現在値のQRコード再生成・共有
```

---

### 2.2 画面1: モード選択画面（Entry View）
起動時に最初に表示される洗練されたウェルカム／セレクター画面。

- **レイアウト**:
  - ヘッダーにミニマルなロゴ（`AI SCORE CALC`）とバージョン表示。
  - 画面中央に並ぶ2つの大型選択カード（PCでは横並び2カラム、スマホでは縦並び2カード）：
    1. **「自分で入力する」カード**:
       - アイコン: スライダー／エディット計器アイコン
       - タイトル: `自分で入力する`
       - 説明: `5値や響き・倍音を手動で調整し、総合得点をシミュレーションします`
       - アクション: シミュレーター画面（デフォルト値または前回保存値）へ遷移
    2. **「QRを読み込む」カード**:
       - アイコン: QRコードスキャン／カメラアイコン
       - タイトル: `QRを読み込む`
       - 説明: `採点データQR（p...s...e...）をカメラで読み取り、即座に計算します`
       - アクション: QRスキャナー画面を起動
  - 下部に「前回の続きから開く（キャッシュがある場合）」クイックリンク。

---

### 2.3 画面2: QRコード読み込み画面（QR Scanner View）
カメラを利用してパラメータQRコードを高速に認識する画面。

- **機能要件**:
  - **カメラビュー**:
    - HTML5 `navigator.mediaDevices.getUserMedia` + QRデコードライブラリ（`html5-qrcode` または `jsQR`）を利用。
    - 中央に読み取り枠（エイミングガイド枠、四隅にコーナーアクセント）。
    - 背面カメラ（環境カメラ: `facingMode: { ideal: "environment" }`）を優先起動。
  - **操作コントロール**:
    - **閉じる/戻るボタン**: モード選択画面またはシミュレーター画面へ戻る。
    - **カメラ切替ボタン**: 内外カメラ切替。
    - **ファイル選択/画像貼り付け**: 保存したQRコード画像（スクリーンショット）から認識。
    - **手動テキストペースト**: クリップボードからの直接テキストペースト入力欄（フォールバック用）。
  - **認識成功時の挙動**:
    - 認識成功時に短い振動（`navigator.vibrate(50)` ※対応端末のみ）と緑色枠アニメーション。
    - パース処理を実行し、成功したら直ちにシミュレーター画面へ遷移して数値をセット。
    - 不正なフォーマットの場合はトースト通知で「有効な採点QRコードではありません」と表示しスキャン継続。

---

### 2.4 画面3: シミュレーター画面（Calculator View）
メインとなるパラメータ入力・レーダーチャート・計算結果表示画面。

- **レイアウト構成**:
  - PC / タブレット: 左右 2カラム分割（左: 入力パネル、右: レーダーチャート & スコア表示カード）。
  - モバイル: 縦スクロール型（上部: スコアサマリー固定カードまたはレーダーチャート、下部: パラメータ調整）。

#### (1) パラメータ入力パネル
- **調整ステップ切替**:
  - `調整幅: [ 1 ] [ 0.1 ] [ 0.01 ] [ 0.001 ]` の切り替えボタングループ（デフォルト: `0.1`）。
- **基本5値入力フィールド**:
  - 各項目に「項目名」「スライダー（レンジバー）」「微調整 `−` / `＋` ボタン」「数値直接入力ボックス」を配置。
  - 項目一覧:
    1. **音程 (pitch)**: 範囲 `0.000` 〜 `100.000` 点
    2. **安定性 (stability)**: 範囲 `0.000` 〜 `100.000` 点
    3. **表現力 (expression)**: 範囲 `0.000` 〜 `100.000` 点
    4. **リズム (rhythm)**: 範囲 `0.000` 〜 `100.000` 点
    5. **ビブラート＆ロングトーン (vibrato_longtone)**: 範囲 `0.000` 〜 `100.000` 点
- **拡張項目アコーディオン（Hibiki / Overtone 設定）**:
  - トグルボタン: `▶ 詳細パラメータ (Hibiki / Overtone)` をクリックで展開。
  - 項目:
    - **Hibiki (hbk)**: 範囲 `0` 〜 `100000`（内部整数スケール。通常 `0` 〜 `100.000` 点相当、デフォルト: `42252`）
    - **Overtone (ot)**: 範囲 `0` 〜 `2500`（raw % スケール、デフォルト: `1500`）
- **アクションバー**:
  - `[ QRをスキャン ]`（QRスキャナーをモーダルまたは再起動）
  - `[ QRコードを生成 ]`（現在の入力値をQRコード化してモーダル表示。画像保存/コピー可能）
  - `[ リセット ]`（デフォルト値に戻す）

#### (2) レーダーチャート & 結果スコアパネル
- **5値レーダーチャート（SVG）**:
  - 正五角形の多重グリッド（20%, 40%, 60%, 80%, 100%）。
  - 各頂点に項目名と現在値（小数点以下3桁）を表示。
  - 内部ポリゴンは微細な透過シアン・ブランドカラー（`rgba(56, 189, 248, 0.25)`）と境界線。
  - インタラクティブ操作対応（各頂点をドラッグして直感的に数値を増減可能）。
- **総合得点ディスプレイカード**:
  - **タイトル**: `Ai 推定総合得点`
  - **スコア大文字表示**: `99.450` 点（DSEG7または等幅フォント、ゴールドまたはブランドシアン）。
  - **カンスト表示**: 100点到達時は `100.000 点 (カンスト)` バッジを表示。
  - **内訳ブレークダウン**:
    - **音程由来素点 (note_base)**: 例 `86.024 点`
    - **加点ボーナス合計 (bonus total)**: 例 `+13.976 点`
    - **各項目の加点詳細テーブル**:
      - リズム加点: `+2.536`
      - 表現力加点: `+6.142`
      - 安定性加点: `+2.690`
      - VL加点: `+2.512`
      - Hibiki加点: `+0.084`
      - Overtone加点: `+0.083`

---

## 3. QRコード データ仕様

### 3.1 フォーマット構文
総合得点計算に必要な7変数をプレフィックス付きで連結した単一の英数字文字列。

```text
p{pitch}s{stability}e{expression}r{rhythm}vl{vibrato_longtone}h{hibiki}ot{overtone}
```

### 3.2 パラメータ定義表
| キー | パラメータ | 単位・形式 | QR格納例 | 内部値 (0..100k) | 表示点数 (0..100) |
|---|---|---|---|---|---|
| `p` | 音程 (pitch) | 整数 (点数 × 1000) | `93203` | `93203` | `93.203` 点 |
| `s` | 安定性 (stability) | 整数 (点数 × 1000) | `100000` | `100000` | `100.000` 点 |
| `e` | 表現力 (expression) | 整数 (点数 × 1000) | `99450` | `99450` | `99.450` 点 |
| `r` | リズム (rhythm) | 整数 (点数 × 1000) | `98780` | `98780` | `98.780` 点 |
| `vl` | VL (vibrato_longtone) | 整数 (点数 × 1000) | `99000` | `99000` | `99.000` 点 |
| `h` | 響き (hibiki) | 整数 (raw / 点数×1000) | `67543` | `67543` | `67.543` |
| `ot` | 倍音 (overtone) | 整数 (raw % スケール) | `1221` | `1221` | `1221` |

#### 例:
`p93203s100000e99450r98780vl99000h67543ot1221`

### 3.3 パース処理（正規表現 & JavaScript実装）
```typescript
interface ParsedScoreData {
  pitch: number;            // 表示スケール (0..100)
  stability: number;        // 表示スケール (0..100)
  expression: number;       // 表示スケール (0..100)
  rhythm: number;           // 表示スケール (0..100)
  vibrato_longtone: number; // 表示スケール (0..100)
  hibiki: number;           // 内部スケール (0..100000)
  overtone: number;         // raw % スケール (0..2500)
  rawText: string;
}

const QR_SCORE_REGEX = /^p(\d+)s(\d+)e(\d+)r(\d+)vl(\d+)h(\d+)ot(\d+)$/i;

function parseScoreQR(text: string): ParsedScoreData | null {
  const trimmed = text.trim();
  const match = trimmed.match(QR_SCORE_REGEX);
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
    rawText: trimmed,
  };
}

// 現在の入力値からQR用文字列を生成する関数
function formatScoreQR(data: {
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
```

### 3.1 URLクエリパラメータ仕様（ディープリンク & 共有）
アプリはURLクエリ文字列による直接読み込みと共有に対応しています。

- **パラメータ名**: `chart`
- **URL形式**: `https://zawasow30.github.io/SBScoreCalc/?chart=p93203s100000e99450r98780vl99000h67543ot1221`
- **動作**:
  1. **ディープリンク起動**: 上記のクエリが付与されたURLへアクセスすると、エントリー画面をスキップして直接計算画面（`view-calculator`）が開き、各パラメータが即時反映されます。
  2. **URLリアルタイム同期**: 計算機で各パラメータを変更すると、`history.replaceState` によりブラウザのアドレスバーの `chart` パラメータがリアルタイムに更新されます。
  3. **共有URL生成 & QRコード**: QRモーダルで「集約テキスト」と「共有URL（?chart=...）」を切り替えてQRコード表示・画像保存・URLコピーが可能です。
  4. **柔軟なパース**: `parseScoreQR` は生テキストだけでなく、URLやクエリ文字列全体が貼り付けられた場合でも、正規表現により安全に集約テキストを抽出して復元します。

---

## 4. 採点計算アルゴリズム仕様（完全ポータブル実装）

実機Ai採点（scoring_dio）の完全一致計算ロジックです。外部APIは一切不要で、以下のコードをそのままTypeScript/JavaScriptとして組み込めます。

### 4.1 補間プリミティブ（線形補間・量子化）
> **超重要ルール**: `getScore1D` は内側で `Math.floor`、`getScore2D` は外側で `Math.ceil` を行います。この「内floor・外ceil」の二重量子化が実機と完全一致する鍵です。

```javascript
function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function bracket(axis, v) {
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

function getScore1D(axis, table, v) {
  const [lo, hi, lv, hv] = bracket(axis, v);
  if (hv === lv) return table[lo];
  const num = table[hi] * (v - lv) + table[lo] * (hv - v);
  return Math.floor(num / (hv - lv));
}

function getScore2D(axisRow, axisCol, table, vRow, vCol) {
  const [lo, hi, lv, hv] = bracket(axisRow, vRow);
  const a = getScore1D(axisCol, table[lo], vCol);
  const b = getScore1D(axisCol, table[hi], vCol);
  if (hv === lv) return Math.ceil(a);
  const num = b * (vRow - lv) + a * (hv - vRow);
  return Math.ceil(num / (hv - lv));
}
```

### 4.2 採点テーブル（Ai_TABLES 定数群）
```javascript
const AX_PURITY_ROW = [0, 50000, 80000, 90000, 95000, 100000];
const AX_ITEM_COL = [0, 50000, 70000, 80000, 90000, 100000];
const AX_PITCH = [0, 80000, 85000, 90000, 95000, 100000];

const MAP_PURITY_NOTE_SCORE = [0, 80000, 85000, 90000, 95000, 100000];
const MAP_NOTE_SCORE_AI = [0, 78000, 82000, 85000, 86600, 86900];
const SCORE_CLAMP_MAX = 100000;

const AI_TABLES = {
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
```

### 4.3 総合得点計算関数
```javascript
function composeTotal(purity, itemInputs) {
  const base = getScore1D(AX_PITCH, MAP_PURITY_NOTE_SCORE, purity);
  const noteBase = getScore1D(AX_PITCH, MAP_NOTE_SCORE_AI, base);
  const bonus = {};

  const totalItems = ["rhythm", "expression", "stability", "vibrato_longtone", "hibiki", "overtone"];
  for (const item of totalItems) {
    const spec = AI_TABLES[item];
    if (!spec) continue;
    const rowAxis = spec.row || AX_PURITY_ROW;
    bonus[item] = getScore2D(rowAxis, spec.col, spec.map, base, Number(itemInputs[item] || 0));
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

// ユーザー向けメインAPI（表示スケール 0..100点 で授受）
function calculateAiTotal(params) {
  const purity = Number(params.pitch || 0) * 1000.0;
  const itemInputs = {
    rhythm: Number(params.rhythm || 0) * 1000.0,
    expression: Number(params.expression || 0) * 1000.0,
    stability: Number(params.stability || 0) * 1000.0,
    vibrato_longtone: Number(params.vibrato_longtone || 0) * 1000.0,
    hibiki: Number(params.hibiki || 0) > 100.0 ? Number(params.hibiki) : Number(params.hibiki) * 1000.0,
    overtone: Number(params.overtone || 0), // raw %
  };

  const comp = composeTotal(purity, itemInputs);

  const bonusPoints = {};
  for (const [k, v] of Object.entries(comp.bonus)) {
    bonusPoints[k] = v / 1000.0;
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
```

### 4.4 ゴールデン・テストケース（実装確認用）
本仕様書の実装が正しいか確認するためのリファレンス値です。
- **テストケース 1 (QR例):**
  - 入力:
    - `pitch = 93.203`
    - `stability = 100.000`
    - `expression = 99.450`
    - `rhythm = 98.780`
    - `vibrato_longtone = 99.000`
    - `hibiki = 67543`
    - `overtone = 1221`
  - 期待出力:
    - `noteBase`: `86.024` 点
    - `bonus.rhythm`: `+2.536` 点
    - `bonus.expression`: `+6.142` 点
    - `bonus.stability`: `+2.690` 点
    - `bonus.vibrato_longtone`: `+2.512` 点
    - `bonus.hibiki`: `+0.084` 点
    - `bonus.overtone`: `+0.083` 点
    - `totalRaw`: `100.071` 点
    - `total`: `100.000` 点 (`clamped: true`)

- **テストケース 2 (非カンスト標準域):**
  - 入力:
    - `pitch = 88.500`, `stability = 85.000`, `expression = 90.000`, `rhythm = 92.000`, `vibrato_longtone = 88.000`, `hibiki = 50000`, `overtone = 1500`
  - 期待出力:
    - `noteBase`: `84.100` 点
    - `bonus`: `rhythm: 2.441`, `expression: 5.265`, `stability: 1.455`, `vibrato_longtone: 1.707`, `hibiki: 0.009`, `overtone: 0.069`
    - `totalRaw`: `95.046` 点
    - `total`: `95.046` 点 (`clamped: false`)

---

## 5. デザインシステム仕様（SBTool1準拠）

`DESIGN_GUIDELINE.md`（Anti-AI-Template Aesthetic）に厳格に準拠します。

### 5.1 スタイル思想
- **「引き算」の原則**: 意味のないネオングロー、過剰なグラデーション、派手なシャドウを一切排除。
- **ソリッド＆リニア感**: Linear, Vercel, Raycast のような、精緻で工芸品のようなダークテーマ。
- **1pxボーダーによる階層表現**: 背景色と微細な境界線の明度差だけで奥行きを表現。

### 5.2 カラーパレット (CSS変数)
```css
:root {
  /* 背景 (Zinc系ソリッドベース) */
  --bg-app: #09090b;             /* Zinc-950: アプリ背景 */
  --bg-panel: #121215;           /* カード・パネル背景 */
  --bg-panel-subtle: #18181b;    /* Zinc-900: インプット・サブ領域 */
  --bg-panel-hover: #222226;
  --bg-panel-active: #27272a;    /* Zinc-800 */

  /* 境界線 (微細な透過ボーダー) */
  --border-color: rgba(255, 255, 255, 0.08);
  --border-color-subtle: rgba(255, 255, 255, 0.04);
  --border-color-focus: rgba(56, 189, 248, 0.4);

  /* タイポグラフィ (純白を排除) */
  --text-primary: #f4f4f5;       /* Zinc-100: 主要文字 */
  --text-secondary: #a1a1aa;     /* Zinc-400: ラベル・補助文字 */
  --text-muted: #71717a;         /* Zinc-500: キャプション・単位 */

  /* アクセント (限定された差し色) */
  --color-brand: #38bdf8;        /* Sky-400: 主要アクセント・スライダー */
  --color-gold: #f59e0b;         /* Amber-500: 総合スコア・ハイライト */
  --color-gold-bright: #fbbf24;  /* 100点カンスト時 */
  --color-success: #10b981;      /* Emerald-500: QR認識成功・加点 */
  --color-danger: #ef4444;       /* 減点・エラー */

  /* フォント指定 */
  --font-main: 'Outfit', 'Inter', 'Noto Sans JP', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* 角丸 & トランジション */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --transition: 150ms ease-out;
}
```

### 5.3 主要UIコンポーネント仕様
1. **カード (`.panel-card`)**:
   - `background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: var(--radius-md);`
   - ボックスシャドウは最小限（`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);`）。
2. **スライダー & ステッパー (`.calc-field-row`)**:
   - 左側にラベル＋現在値、中央にスライダー、右側に `[−]` `[数値]` `[＋]` の微調整ボタン。
   - スライダーの accent-color は `var(--color-brand)`。
3. **エントリ選択ボタン (`.entry-card`)**:
   - ホバー時にボーダーが `var(--color-brand)` へ微かに変化、微細な `translateY(-2px)`。
4. **スコアディスプレイ (`.score-display`)**:
   - スコア数値は大きく、数字幅が揃う `font-variant-numeric: tabular-nums` かつ `font-family: var(--font-mono)`。

---

## 6. PWA & オフライン技術要件

### 6.1 PWAマニフェスト (`manifest.json` または `manifest.webmanifest`)
```json
{
  "name": "Ai Score Calculator",
  "short_name": "AiCalc",
  "description": "カラオケ精密採点Ai 総合得点計算シミュレーター & QRリーダー",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 6.2 サービスワーカー (Service Worker)
- Vite PWA プラグイン（`vite-plugin-pwa`）または標準 Service Worker。
- キャッシュ戦略: **CacheFirst**（HTML / JS / CSS / Webフォント / 音声・画像）。
- 一度アクセスすれば、飛行機内やカラオケ防音室の圏外環境でも100%完全動作することを保証。

### 6.3 推奨ライブラリ選定
- **フレームワーク**:
  - `Vite` + `Svelte`（最推奨：SBTool1と同系統で最軽量・超高速リアクティビティ）
  - または `Vite` + `React` / `Vue` / `Vanilla TypeScript`
- **QRコード認識**:
  - `html5-qrcode`（扱いやすくカメラ権限・エラーハンドリングが堅牢）または `jsQR`（超軽量）
- **QRコード生成**:
  - `qrcode`（ブラウザCanvas/SVGレンダリング用）

---

## 7. AI実装者向けプロンプト（指示文テンプレート）

別のAIツール（Claude, ChatGPT, Cursor, Gemini等）に作成を依頼する際は、以下のプロンプトを先頭に付与して本仕様書全体を貼り付けてください。

```markdown
以下の「Ai採点 総合得点シミュレーター PWA 仕様書」に従って、完全動作するPWAアプリケーションの全コードを生成してください。

【厳守事項】
1. デザインは仕様書の「Anti-AI-Template Aesthetic（Linear/Vercel風ソリッドダーク）」を忠実に再現し、派手なグラデーションや安っぽいアニメーションを避けてください。
2. アプリ起動時はまず「自分で入力する」と「QRを読み込む」の2大選択肢を提示してください。
3. QRコード仕様（p...s...e...r...vl...h...ot...）のパースおよび再生成機能を完全に実装してください。
4. Ai総合得点計算ロジック（getScore1Dのfloor, getScore2Dのceil, AI_TABLES）は仕様書のアルゴリズムを忠実に移植し、テストケースの期待値と100%一致することを確認してください。
5. 外部サーバー通信なしで、完全オフラインで動作するPWA構成（Service Worker, Web Manifest）を含めてください。
```
