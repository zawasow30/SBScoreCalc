import './style.css';
import { calculateAiTotal, type ScoreParams, type ScoreResult } from './logic/scoring.ts';
import { parseScoreQR, formatScoreQR, buildScoreUrl } from './logic/qr.ts';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

// ============================================================================
// State & Defaults
// ============================================================================

const DEFAULT_PARAMS: ScoreParams = {
  pitch: 94.0,
  stability: 99.0,
  expression: 99.0,
  rhythm: 99.0,
  vibrato_longtone: 99.0,
  hibiki: 60000,
  overtone: 1200,
};

const STORAGE_KEY = 'sb_score_calc_state_v3';

interface AppState {
  params: ScoreParams;
  step: number;
  view: 'entry' | 'scanner' | 'calculator';
  facingMode: 'environment' | 'user';
}

function loadSavedState(): ScoreParams | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.pitch === 'number' && typeof data.stability === 'number') {
      return data as ScoreParams;
    }
  } catch {
    // Ignore storage parse error
  }
  return null;
}

function saveState(params: ScoreParams) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore storage write error
  }
}

const state: AppState = {
  params: { ...DEFAULT_PARAMS },
  step: 0.1,
  view: 'entry',
  facingMode: 'environment',
};

// ============================================================================
// DOM References
// ============================================================================

const views = {
  entry: document.getElementById('view-entry') as HTMLElement,
  scanner: document.getElementById('view-scanner') as HTMLElement,
  calculator: document.getElementById('view-calculator') as HTMLElement,
};

const btnHeaderHome = document.getElementById('btn-header-home') as HTMLButtonElement;
const btnEntryManual = document.getElementById('btn-entry-manual') as HTMLElement;
const btnEntryScan = document.getElementById('btn-entry-scan') as HTMLElement;
const entryRecentContainer = document.getElementById('entry-recent-container') as HTMLElement;
const btnEntryResume = document.getElementById('btn-entry-resume') as HTMLButtonElement;
const recentScoreText = document.getElementById('recent-score-text') as HTMLElement;

// Scanner elements
const btnScannerBack = document.getElementById('btn-scanner-back') as HTMLButtonElement;
const btnCameraFlip = document.getElementById('btn-camera-flip') as HTMLButtonElement;
const scannerVideo = document.getElementById('scanner-video') as HTMLVideoElement;
const aimingBox = document.getElementById('aiming-box') as HTMLElement;
const scannerFileInput = document.getElementById('scanner-file-input') as HTMLInputElement;
const btnScannerFile = document.getElementById('btn-scanner-file') as HTMLButtonElement;
const btnPasteClipboard = document.getElementById('btn-paste-clipboard') as HTMLButtonElement;
const manualQrInput = document.getElementById('manual-qr-input') as HTMLInputElement;
const btnManualQrApply = document.getElementById('btn-manual-qr-apply') as HTMLButtonElement;

// Calculator elements
const stepTabs = document.querySelectorAll<HTMLButtonElement>('.step-tab');
const btnActionScan = document.getElementById('btn-action-scan') as HTMLButtonElement;
const btnActionGenerate = document.getElementById('btn-action-generate') as HTMLButtonElement;
const btnActionCopyUrl = document.getElementById('btn-action-copy-url') as HTMLButtonElement;
const btnActionReset = document.getElementById('btn-action-reset') as HTMLButtonElement;

// Score Displays
const scoreTotal = document.getElementById('score-total') as HTMLElement;
const badgeClamped = document.getElementById('badge-clamped') as HTMLElement;
const scoreBase = document.getElementById('score-base') as HTMLElement;
const scoreBonusTotal = document.getElementById('score-bonus-total') as HTMLElement;
const bonusRhythm = document.getElementById('bonus-rhythm') as HTMLElement;
const bonusExpression = document.getElementById('bonus-expression') as HTMLElement;
const bonusStability = document.getElementById('bonus-stability') as HTMLElement;
const bonusVl = document.getElementById('bonus-vibrato_longtone') as HTMLElement;
const bonusHibiki = document.getElementById('bonus-hibiki') as HTMLElement;
const bonusOvertone = document.getElementById('bonus-overtone') as HTMLElement;
const scoreRawTotal = document.getElementById('score-raw-total') as HTMLElement;

// Radar Chart
const radarSvg = document.getElementById('radar-svg') as unknown as SVGSVGElement;

// Modal elements
const modalQr = document.getElementById('modal-qr') as HTMLElement;
const btnModalClose = document.getElementById('btn-modal-close') as HTMLButtonElement;
const btnQrModeText = document.getElementById('btn-qr-mode-text') as HTMLButtonElement;
const btnQrModeUrl = document.getElementById('btn-qr-mode-url') as HTMLButtonElement;
const qrCanvas = document.getElementById('qr-output-canvas') as HTMLCanvasElement;
const qrStringPreview = document.getElementById('qr-string-preview') as HTMLElement;
const btnQrCopyText = document.getElementById('btn-qr-copy-text') as HTMLButtonElement;
const btnQrCopyUrl = document.getElementById('btn-qr-copy-url') as HTMLButtonElement;
const btnQrDownload = document.getElementById('btn-qr-download') as HTMLButtonElement;

// Toast
const toastEl = document.getElementById('toast') as HTMLElement;

// ============================================================================
// Toast Notification
// ============================================================================

let toastTimeout: number | undefined;
function showToast(message: string, type: 'info' | 'error' | 'success' = 'info') {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className = `toast toast-${type}`;
  toastEl.classList.remove('hidden');

  toastTimeout = window.setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

// ============================================================================
// URL Query String Sync & Deep Linking
// ============================================================================

function syncUrlQuery() {
  if (typeof window === 'undefined' || state.view !== 'calculator') return;
  try {
    const qrStr = formatScoreQR(state.params);
    const url = new URL(window.location.href);
    if (url.searchParams.get('chart') !== qrStr) {
      url.searchParams.set('chart', qrStr);
      // 旧パラメータ名があればクリーンアップ
      url.searchParams.delete('score');
      window.history.replaceState(null, '', url.toString());
    }
  } catch {
    // Ignore URL manipulation errors
  }
}

function clearUrlQuery() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('chart') || url.searchParams.has('score') || url.searchParams.has('q')) {
      url.searchParams.delete('chart');
      url.searchParams.delete('score');
      url.searchParams.delete('q');
      window.history.replaceState(null, '', url.pathname + (url.hash || ''));
    }
  } catch {
    // Ignore URL manipulation errors
  }
}

function checkUrlQueryParams(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const search = window.location.search;
    if (!search) return false;

    const parsed = parseScoreQR(search);
    if (parsed) {
      state.params = {
        pitch: parsed.pitch,
        stability: parsed.stability,
        expression: parsed.expression,
        rhythm: parsed.rhythm,
        vibrato_longtone: parsed.vibrato_longtone,
        hibiki: parsed.hibiki,
        overtone: parsed.overtone,
      };
      saveState(state.params);
      switchView('calculator');
      showToast('URLからパラメータを読み込みました', 'success');
      return true;
    }
  } catch (err) {
    console.warn('Failed to parse URL query params:', err);
  }
  return false;
}

// ============================================================================
// View Routing
// ============================================================================

function switchView(target: 'entry' | 'scanner' | 'calculator') {
  state.view = target;
  views.entry.classList.add('hidden');
  views.scanner.classList.add('hidden');
  views.calculator.classList.add('hidden');

  if (target === 'entry') {
    views.entry.classList.remove('hidden');
    btnHeaderHome.classList.add('hidden');
    stopCamera();
    clearUrlQuery();
    checkSavedStateOnEntry();
  } else if (target === 'scanner') {
    views.scanner.classList.remove('hidden');
    btnHeaderHome.classList.remove('hidden');
    startCamera();
  } else if (target === 'calculator') {
    views.calculator.classList.remove('hidden');
    btnHeaderHome.classList.remove('hidden');
    stopCamera();
    updateCalculatorUI();
  }
}

function checkSavedStateOnEntry() {
  const saved = loadSavedState();
  if (saved) {
    const res = calculateAiTotal(saved);
    recentScoreText.textContent = `${res.totalRaw.toFixed(3)} 点`;
    entryRecentContainer.classList.remove('hidden');
  } else {
    entryRecentContainer.classList.add('hidden');
  }
}

// ============================================================================
// QR Scanner (Camera & jsQR)
// ============================================================================

let videoStream: MediaStream | null = null;
let scannerLoopId: number | null = null;
const scanCanvas = document.createElement('canvas');
const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

async function startCamera() {
  stopCamera();
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    scannerVideo.srcObject = videoStream;
    await scannerVideo.play();
    scannerLoopId = requestAnimationFrame(scanFrame);
  } catch (err) {
    console.warn('Camera access failed:', err);
    showToast('カメラの起動に失敗しました。画像貼付または手動入力をお試しください。', 'error');
  }
}

function stopCamera() {
  if (scannerLoopId) {
    cancelAnimationFrame(scannerLoopId);
    scannerLoopId = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }
  scannerVideo.srcObject = null;
  aimingBox.classList.remove('success');
}

function scanFrame() {
  if (state.view !== 'scanner' || !scannerVideo.videoWidth) {
    scannerLoopId = requestAnimationFrame(scanFrame);
    return;
  }

  if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
    scanCanvas.width = scannerVideo.videoWidth;
    scanCanvas.height = scannerVideo.videoHeight;
    if (scanCtx) {
      scanCtx.drawImage(scannerVideo, 0, 0, scanCanvas.width, scanCanvas.height);
      const imgData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const success = handleScannedText(code.data);
        if (success) {
          return; // Stop scan loop on success
        }
      }
    }
  }

  scannerLoopId = requestAnimationFrame(scanFrame);
}

function handleScannedText(text: string): boolean {
  const parsed = parseScoreQR(text);
  if (!parsed) {
    showToast('有効な採点QRコードではありません', 'error');
    return false;
  }

  // Trigger feedback
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(50);
    } catch {
      // Ignore vibration error
    }
  }
  aimingBox.classList.add('success');
  showToast('QRコードを認識しました', 'success');

  state.params = {
    pitch: parsed.pitch,
    stability: parsed.stability,
    expression: parsed.expression,
    rhythm: parsed.rhythm,
    vibrato_longtone: parsed.vibrato_longtone,
    hibiki: parsed.hibiki,
    overtone: parsed.overtone,
  };
  saveState(state.params);

  setTimeout(() => {
    switchView('calculator');
  }, 400);

  return true;
}

// ============================================================================
// Calculator & Parameter Handling
// ============================================================================

const CORE_KEYS: (keyof ScoreParams)[] = [
  'pitch',
  'stability',
  'expression',
  'rhythm',
  'vibrato_longtone',
];

function updateCalculatorUI() {
  // 1. Update Core Fields
  for (const key of CORE_KEYS) {
    const val = state.params[key];
    const valText = document.getElementById(`val-display-${key}`);
    const slider = document.getElementById(`slider-${key}`) as HTMLInputElement;
    const numInput = document.getElementById(`num-${key}`) as HTMLInputElement;

    if (valText) valText.textContent = val.toFixed(3);
    if (slider && Number(slider.value) !== val) slider.value = val.toString();
    if (numInput && Number(numInput.value) !== val) numInput.value = val.toFixed(3);
  }

  // 2. Update Extended Fields (Hibiki / Overtone)
  const hbkVal = Math.round(state.params.hibiki);
  const otVal = Math.round(state.params.overtone);

  const valHbk = document.getElementById('val-display-hibiki');
  const sliderHbk = document.getElementById('slider-hibiki') as HTMLInputElement;
  const numHbk = document.getElementById('num-hibiki') as HTMLInputElement;
  if (valHbk) valHbk.textContent = hbkVal.toString();
  if (sliderHbk && Number(sliderHbk.value) !== hbkVal) sliderHbk.value = hbkVal.toString();
  if (numHbk && Number(numHbk.value) !== hbkVal) numHbk.value = hbkVal.toString();

  const valOt = document.getElementById('val-display-overtone');
  const sliderOt = document.getElementById('slider-overtone') as HTMLInputElement;
  const numOt = document.getElementById('num-overtone') as HTMLInputElement;
  if (valOt) valOt.textContent = otVal.toString();
  if (sliderOt && Number(sliderOt.value) !== otVal) sliderOt.value = otVal.toString();
  if (numOt && Number(numOt.value) !== otVal) numOt.value = otVal.toString();

  // 3. Calculate Score
  const res: ScoreResult = calculateAiTotal(state.params);

  // 4. Update Score Displays (点数だけの表示)
  if (scoreTotal) {
    scoreTotal.textContent = res.totalRaw.toFixed(3);
    if (res.totalRaw >= 100.0) {
      scoreTotal.parentElement?.classList.add('is-clamped');
    } else {
      scoreTotal.parentElement?.classList.remove('is-clamped');
    }
  }

  if (badgeClamped) {
    if (res.totalRaw >= 100.0) {
      badgeClamped.innerHTML = `カンスト <span class="num">${res.totalRaw > 100.0005 ? '突破 ' : ''}${res.totalRaw.toFixed(3)}</span>`;
      badgeClamped.classList.remove('hidden');
    } else {
      badgeClamped.classList.add('hidden');
    }
  }

  if (scoreBase) scoreBase.textContent = res.noteBase.toFixed(3);
  if (scoreBonusTotal) {
    const bonusSign = res.bonusTotal >= 0 ? '+' : '';
    scoreBonusTotal.textContent = `${bonusSign}${res.bonusTotal.toFixed(3)}`;
  }

  const formatBonusTableItem = (el: HTMLElement | null, val: number) => {
    if (!el) return;
    const isPos = val >= 0;
    const sign = isPos ? '+' : '';
    el.textContent = `${sign}${val.toFixed(3)}`;
    el.className = `bonus-val num ${isPos ? 'positive' : 'negative'}`;
  };

  formatBonusTableItem(bonusRhythm, res.bonus.rhythm);
  formatBonusTableItem(bonusExpression, res.bonus.expression);
  formatBonusTableItem(bonusStability, res.bonus.stability);
  formatBonusTableItem(bonusVl, res.bonus.vibrato_longtone);
  formatBonusTableItem(bonusHibiki, res.bonus.hibiki);
  formatBonusTableItem(bonusOvertone, res.bonus.overtone);
  if (scoreRawTotal) scoreRawTotal.textContent = res.totalRaw.toFixed(3);

  // Update sub-bonus labels for each param (green if >= 0, red if < 0)
  const setSubBonus = (id: string, val: number, isBase = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    const isPos = val >= 0;
    const sign = isBase ? '' : isPos ? '+' : '';
    el.textContent = `${sign}${val.toFixed(3)}`;
    el.className = `field-bonus-sub num ${isPos ? 'positive' : 'negative'}`;
  };

  setSubBonus('sub-bonus-pitch', res.noteBase, true);
  setSubBonus('sub-bonus-stability', res.bonus.stability);
  setSubBonus('sub-bonus-expression', res.bonus.expression);
  setSubBonus('sub-bonus-rhythm', res.bonus.rhythm);
  setSubBonus('sub-bonus-vibrato_longtone', res.bonus.vibrato_longtone);
  setSubBonus('sub-bonus-hibiki', res.bonus.hibiki);
  setSubBonus('sub-bonus-overtone', res.bonus.overtone);

  // 5. Update Radar sub-metrics (Hibiki & Overtone under pentagon)
  const radarValHbk = document.getElementById('radar-val-hibiki');
  const radarBonusHbk = document.getElementById('radar-bonus-hibiki');
  const radarBarHbk = document.getElementById('radar-bar-hibiki');

  if (radarValHbk) radarValHbk.textContent = hbkVal.toString();
  if (radarBonusHbk) {
    const isPos = res.bonus.hibiki >= 0;
    const sign = isPos ? '+' : '';
    radarBonusHbk.textContent = `${sign}${res.bonus.hibiki.toFixed(3)}`;
    radarBonusHbk.className = `metric-bonus num ${isPos ? 'positive' : 'negative'}`;
  }
  if (radarBarHbk) {
    const pct = Math.min(100, Math.max(0, (hbkVal / 100000) * 100));
    radarBarHbk.style.width = `${pct.toFixed(1)}%`;
  }

  const radarValOt = document.getElementById('radar-val-overtone');
  const radarBonusOt = document.getElementById('radar-bonus-overtone');
  const radarBarOt = document.getElementById('radar-bar-overtone');

  if (radarValOt) radarValOt.textContent = otVal.toString();
  if (radarBonusOt) {
    const isPos = res.bonus.overtone >= 0;
    const sign = isPos ? '+' : '';
    radarBonusOt.textContent = `${sign}${res.bonus.overtone.toFixed(3)}`;
    radarBonusOt.className = `metric-bonus num ${isPos ? 'positive' : 'negative'}`;
  }
  if (radarBarOt) {
    const pct = Math.min(100, Math.max(0, (otVal / 2500) * 100));
    radarBarOt.style.width = `${pct.toFixed(1)}%`;
  }

  // 6. Redraw Radar Chart
  drawRadarChart(res);

  // 7. Persist
  saveState(state.params);

  // 8. Sync URL Query String
  syncUrlQuery();
}

function setParamValue(key: keyof ScoreParams, rawVal: number) {
  let val = rawVal;
  if (key === 'hibiki') {
    val = Math.max(0, Math.min(100000, Math.round(val)));
  } else if (key === 'overtone') {
    val = Math.max(0, Math.min(2500, Math.round(val)));
  } else {
    val = Math.max(0, Math.min(100, Math.round(val * 1000) / 1000));
  }
  state.params[key] = val;
  updateCalculatorUI();
}

function stepParam(key: keyof ScoreParams, dir: number) {
  const step = key === 'hibiki' || key === 'overtone' ? Math.max(1, Math.round(state.step * 100)) : state.step;
  const current = state.params[key];
  setParamValue(key, current + dir * step);
}

// ============================================================================
// Radar Chart (SVG & Drag Interaction)
// ============================================================================

interface RadarAxis {
  key: keyof ScoreParams;
  label: string;
  angle: number; // in radians
}

// 5 vertices order (clockwise):
// Top: pitch (-pi/2)
// Top-right: stability (-pi/2 + 2pi/5)
// Bottom-right: expression (-pi/2 + 4pi/5)
// Bottom-left: rhythm (-pi/2 + 6pi/5)
// Top-left: vibrato_longtone (-pi/2 + 8pi/5)
const RADAR_AXES: RadarAxis[] = [
  { key: 'pitch', label: '音程', angle: -Math.PI / 2 },
  { key: 'stability', label: '安定性', angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
  { key: 'expression', label: '表現力', angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
  { key: 'rhythm', label: 'リズム', angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
  { key: 'vibrato_longtone', label: 'VL', angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
];

const CHART_CX = 200;
const CHART_CY = 205;
const CHART_RADIUS = 110;

let activeDragAxisIndex: number | null = null;

function drawRadarChart(res: ScoreResult) {
  while (radarSvg.firstChild) {
    radarSvg.removeChild(radarSvg.firstChild);
  }

  radarSvg.setAttribute('viewBox', '0 0 400 410');

  // 1. Pentagon grid rings (20%, 40%, 60%, 80%, 100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  gridLevels.forEach((level) => {
    const pts = RADAR_AXES.map((axis) => {
      const r = CHART_RADIUS * level;
      const x = CHART_CX + r * Math.cos(axis.angle);
      const y = CHART_CY + r * Math.sin(axis.angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('class', 'radar-grid-polygon');
    radarSvg.appendChild(poly);
  });

  // 2. Axis lines
  RADAR_AXES.forEach((axis) => {
    const x = CHART_CX + CHART_RADIUS * Math.cos(axis.angle);
    const y = CHART_CY + CHART_RADIUS * Math.sin(axis.angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', CHART_CX.toString());
    line.setAttribute('y1', CHART_CY.toString());
    line.setAttribute('x2', x.toFixed(1));
    line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('class', 'radar-axis-line');
    radarSvg.appendChild(line);
  });

  // 3. Active data polygon
  const activePts = RADAR_AXES.map((axis) => {
    const scoreVal = state.params[axis.key];
    const r = CHART_RADIUS * (scoreVal / 100.0);
    const x = CHART_CX + r * Math.cos(axis.angle);
    const y = CHART_CY + r * Math.sin(axis.angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const activePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  activePoly.setAttribute('points', activePts);
  activePoly.setAttribute('class', 'radar-active-polygon');
  radarSvg.appendChild(activePoly);

  // 4. Labels & Handles
  RADAR_AXES.forEach((axis, idx) => {
    const scoreVal = state.params[axis.key];
    const r = CHART_RADIUS * (scoreVal / 100.0);
    const x = CHART_CX + r * Math.cos(axis.angle);
    const y = CHART_CY + r * Math.sin(axis.angle);

    // Label position (outside outer circle)
    const isTop = axis.angle === -Math.PI / 2;
    const labelR = CHART_RADIUS + (isTop ? 34 : 36);
    const lx = CHART_CX + labelR * Math.cos(axis.angle);
    const ly = CHART_CY + labelR * Math.sin(axis.angle);

    // 1行目: 項目ラベル
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', lx.toFixed(1));
    labelText.setAttribute('y', (ly - 11).toFixed(1));
    labelText.setAttribute('class', 'radar-vertex-label');
    labelText.textContent = axis.label;
    radarSvg.appendChild(labelText);

    // 2行目: 現在値
    const scoreText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    scoreText.setAttribute('x', lx.toFixed(1));
    scoreText.setAttribute('y', (ly + 3).toFixed(1));
    scoreText.setAttribute('class', 'radar-vertex-score');
    scoreText.textContent = scoreVal.toFixed(1);
    radarSvg.appendChild(scoreText);

    // 3行目: 音程基礎点または加点（0以上なら緑、0未満なら赤）
    let subVal = 0;
    let subStr = '';
    if (axis.key === 'pitch') {
      subVal = res.noteBase;
      subStr = res.noteBase.toFixed(3);
    } else {
      subVal = res.bonus[axis.key as keyof typeof res.bonus] ?? 0;
      const sign = subVal >= 0 ? '+' : '';
      subStr = `${sign}${subVal.toFixed(3)}`;
    }

    const isPositive = subVal >= 0;
    const bonusText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    bonusText.setAttribute('x', lx.toFixed(1));
    bonusText.setAttribute('y', (ly + 16).toFixed(1));
    bonusText.setAttribute('class', `radar-vertex-bonus num ${isPositive ? 'positive' : 'negative'}`);
    bonusText.setAttribute('fill', isPositive ? '#10b981' : '#ef4444');
    bonusText.textContent = subStr;
    radarSvg.appendChild(bonusText);

    // Draggable vertex handle
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('cx', x.toFixed(1));
    handle.setAttribute('cy', y.toFixed(1));
    handle.setAttribute('r', '6');
    handle.setAttribute('class', 'radar-vertex-handle');
    handle.setAttribute('data-axis-index', idx.toString());

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activeDragAxisIndex = idx;
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (activeDragAxisIndex !== idx) return;
      handlePointerDrag(e, idx);
    });

    const stopDrag = (e: PointerEvent) => {
      if (activeDragAxisIndex === idx) {
        activeDragAxisIndex = null;
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore pointer capture release error
        }
      }
    };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    radarSvg.appendChild(handle);
  });
}

function handlePointerDrag(e: PointerEvent, axisIdx: number) {
  const rect = radarSvg.getBoundingClientRect();
  const scaleX = 400 / rect.width;
  const scaleY = 410 / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const dx = mouseX - CHART_CX;
  const dy = mouseY - CHART_CY;
  const axis = RADAR_AXES[axisIdx];

  // Project point onto axis vector
  const axisX = Math.cos(axis.angle);
  const axisY = Math.sin(axis.angle);
  const projDist = dx * axisX + dy * axisY;

  const normalized = Math.max(0, Math.min(100, (projDist / CHART_RADIUS) * 100));
  setParamValue(axis.key, Math.round(normalized * 10) / 10);
}

// ============================================================================
// QR Generator Modal
// ============================================================================

let currentQrMode: 'text' | 'url' = 'text';

async function updateQrModalDisplay() {
  const scoreStr = formatScoreQR(state.params);
  const targetStr = currentQrMode === 'url' ? buildScoreUrl(scoreStr) : scoreStr;

  qrStringPreview.textContent = targetStr;

  try {
    await QRCode.toCanvas(qrCanvas, targetStr, {
      width: 220,
      margin: 2,
      color: {
        dark: '#09090b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('QR generation error:', err);
    showToast('QRコードの生成に失敗しました', 'error');
  }
}

async function openQrModal() {
  btnQrModeText.classList.toggle('active', currentQrMode === 'text');
  btnQrModeUrl.classList.toggle('active', currentQrMode === 'url');
  await updateQrModalDisplay();
  modalQr.classList.remove('hidden');
}

function closeQrModal() {
  modalQr.classList.add('hidden');
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function initEventListeners() {
  // Navigation
  btnHeaderHome.addEventListener('click', () => switchView('entry'));
  btnEntryManual.addEventListener('click', () => switchView('calculator'));
  btnEntryScan.addEventListener('click', () => switchView('scanner'));
  btnEntryResume.addEventListener('click', () => {
    const saved = loadSavedState();
    if (saved) {
      state.params = { ...saved };
    }
    switchView('calculator');
  });

  // Scanner controls
  btnScannerBack.addEventListener('click', () => switchView('entry'));
  btnCameraFlip.addEventListener('click', () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    startCamera();
  });

  btnScannerFile.addEventListener('click', () => scannerFileInput.click());
  scannerFileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(data.data, data.width, data.height);
        if (code && code.data) {
          handleScannedText(code.data);
        } else {
          showToast('画像からQRコードを検出できませんでした', 'error');
        }
      }
      URL.revokeObjectURL(img.src);
    };
    scannerFileInput.value = '';
  });

  btnPasteClipboard.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        manualQrInput.value = text.trim();
        handleScannedText(text);
      } else {
        showToast('クリップボードにテキストがありません', 'error');
      }
    } catch {
      showToast('クリップボードの読み取り権限がありません。手動でペーストしてください。', 'error');
      manualQrInput.focus();
    }
  });

  btnManualQrApply.addEventListener('click', () => {
    const val = manualQrInput.value.trim();
    if (val) {
      handleScannedText(val);
    } else {
      showToast('QRコード文字列を入力してください', 'error');
    }
  });

  manualQrInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnManualQrApply.click();
    }
  });

  // Calculator Actions
  btnActionScan.addEventListener('click', () => switchView('scanner'));
  btnActionGenerate.addEventListener('click', openQrModal);
  btnActionCopyUrl.addEventListener('click', async () => {
    const scoreStr = formatScoreQR(state.params);
    const fullUrl = buildScoreUrl(scoreStr);
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('共有URLをコピーしました', 'success');
    } catch {
      showToast('URLのコピーに失敗しました', 'error');
    }
  });
  btnActionReset.addEventListener('click', () => {
    state.params = { ...DEFAULT_PARAMS };
    updateCalculatorUI();
    showToast('パラメータを初期値にリセットしました', 'info');
  });

  // Step selector
  stepTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      stepTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.step = parseFloat(tab.dataset.step || '0.1');
    });
  });

  // Sliders, Steppers, Number inputs
  const allParamKeys: (keyof ScoreParams)[] = [
    'pitch',
    'stability',
    'expression',
    'rhythm',
    'vibrato_longtone',
    'hibiki',
    'overtone',
  ];

  allParamKeys.forEach((key) => {
    const slider = document.getElementById(`slider-${key}`) as HTMLInputElement | null;
    const numInput = document.getElementById(`num-${key}`) as HTMLInputElement | null;

    slider?.addEventListener('input', () => {
      setParamValue(key, parseFloat(slider.value));
    });

    numInput?.addEventListener('change', () => {
      setParamValue(key, parseFloat(numInput.value));
    });

    numInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        setParamValue(key, parseFloat(numInput.value));
        numInput.blur();
      }
    });
  });

  // Stepper buttons
  document.querySelectorAll<HTMLButtonElement>('.btn-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.stepperTarget as keyof ScoreParams;
      const dir = parseInt(btn.dataset.dir || '1', 10);
      if (target) {
        stepParam(target, dir);
      }
    });
  });

  // Modal Actions
  btnModalClose.addEventListener('click', closeQrModal);
  modalQr.addEventListener('click', (e) => {
    if (e.target === modalQr) closeQrModal();
  });

  btnQrModeText.addEventListener('click', async () => {
    if (currentQrMode === 'text') return;
    currentQrMode = 'text';
    btnQrModeText.classList.add('active');
    btnQrModeUrl.classList.remove('active');
    await updateQrModalDisplay();
  });

  btnQrModeUrl.addEventListener('click', async () => {
    if (currentQrMode === 'url') return;
    currentQrMode = 'url';
    btnQrModeUrl.classList.add('active');
    btnQrModeText.classList.remove('active');
    await updateQrModalDisplay();
  });

  btnQrCopyText.addEventListener('click', async () => {
    const scoreStr = formatScoreQR(state.params);
    try {
      await navigator.clipboard.writeText(scoreStr);
      showToast('集約テキストをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  });

  btnQrCopyUrl.addEventListener('click', async () => {
    const scoreStr = formatScoreQR(state.params);
    const fullUrl = buildScoreUrl(scoreStr);
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('共有URLをコピーしました', 'success');
    } catch {
      showToast('コピーに失敗しました', 'error');
    }
  });

  btnQrDownload.addEventListener('click', () => {
    const scoreStr = formatScoreQR(state.params);
    const link = document.createElement('a');
    link.download = currentQrMode === 'url' ? `aiscore_url_${scoreStr}.png` : `aiscore_${scoreStr}.png`;
    link.href = qrCanvas.toDataURL('image/png');
    link.click();
    showToast('QR画像をダウンロードしました', 'success');
  });

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
        .catch((err) => console.warn('SW registration failed:', err));
    });
  }
}

// ============================================================================
// App Boot
// ============================================================================

function init() {
  initEventListeners();
  const loadedFromUrl = checkUrlQueryParams();
  if (!loadedFromUrl) {
    switchView('entry');
  }
}

init();
