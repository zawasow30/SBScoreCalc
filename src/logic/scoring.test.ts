import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAiTotal } from './scoring.ts';
import { parseScoreQR, formatScoreQR } from './qr.ts';

test('Golden Test Case 1: QR sample case (clamped to 100.000)', () => {
  const input = {
    pitch: 93.203,
    stability: 100.0,
    expression: 99.45,
    rhythm: 98.78,
    vibrato_longtone: 99.0,
    hibiki: 67543,
    overtone: 1221,
  };

  const res = calculateAiTotal(input);

  assert.strictEqual(res.noteBase.toFixed(3), '86.024');
  assert.strictEqual(res.bonus.rhythm.toFixed(3), '2.536');
  assert.strictEqual(res.bonus.expression.toFixed(3), '6.142');
  assert.strictEqual(res.bonus.stability.toFixed(3), '2.690');
  assert.strictEqual(res.bonus.vibrato_longtone.toFixed(3), '2.512');
  assert.strictEqual(res.bonus.hibiki.toFixed(3), '0.084');
  assert.strictEqual(res.bonus.overtone.toFixed(3), '0.083');
  assert.strictEqual(res.totalRaw.toFixed(3), '100.071');
  assert.strictEqual(res.total.toFixed(3), '100.000');
  assert.strictEqual(res.clamped, true);
});

test('Golden Test Case 2: Non-clamped standard case', () => {
  const input = {
    pitch: 88.5,
    stability: 85.0,
    expression: 90.0,
    rhythm: 92.0,
    vibrato_longtone: 88.0,
    hibiki: 50000,
    overtone: 1500,
  };

  const res = calculateAiTotal(input);

  assert.strictEqual(res.noteBase.toFixed(3), '84.100');
  assert.strictEqual(res.bonus.rhythm.toFixed(3), '2.441');
  assert.strictEqual(res.bonus.expression.toFixed(3), '5.265');
  assert.strictEqual(res.bonus.stability.toFixed(3), '1.455');
  assert.strictEqual(res.bonus.vibrato_longtone.toFixed(3), '1.707');
  assert.strictEqual(res.bonus.hibiki.toFixed(3), '0.009');
  assert.strictEqual(res.bonus.overtone.toFixed(3), '0.069');
  assert.strictEqual(res.totalRaw.toFixed(3), '95.046');
  assert.strictEqual(res.total.toFixed(3), '95.046');
  assert.strictEqual(res.clamped, false);
});

test('QR Code Parsing & Formatting Round-trip', () => {
  const qrStr = 'p93203s100000e99450r98780vl99000h67543ot1221';
  const parsed = parseScoreQR(qrStr);
  assert.ok(parsed !== null);
  assert.strictEqual(parsed.pitch, 93.203);
  assert.strictEqual(parsed.stability, 100);
  assert.strictEqual(parsed.expression, 99.45);
  assert.strictEqual(parsed.rhythm, 98.78);
  assert.strictEqual(parsed.vibrato_longtone, 99);
  assert.strictEqual(parsed.hibiki, 67543);
  assert.strictEqual(parsed.overtone, 1221);

  const formatted = formatScoreQR(parsed);
  assert.strictEqual(formatted, qrStr);
});
