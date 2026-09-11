import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateIconSvg() {
  const width = 512;
  const height = 512;
  const slantDeg = 5;
  const rad = (slantDeg * Math.PI) / 180;
  const tan = Math.tan(rad);

  // Helper to skew x by y
  const sk = (px, py, h) => {
    const skewedX = px + (h - py) * tan;
    return `${skewedX.toFixed(2)},${py.toFixed(2)}`;
  };

  // Helper to format polygon
  const poly = (pts, h, isOn, colorOn, colorOff, filter = '') => {
    const pointsStr = pts.map(([px, py]) => sk(px, py, h)).join(' ');
    const fill = isOn ? colorOn : colorOff;
    const opacity = isOn ? '1' : '0.25';
    const filterAttr = isOn && filter ? `filter="${filter}"` : '';
    return `<polygon points="${pointsStr}" fill="${fill}" opacity="${opacity}" ${filterAttr} />`;
  };

  // 14-seg / 7-seg character drawer
  function drawChar(char, x, y, w, h, t, g, colorOn, colorOff) {
    const halfH = h / 2;
    const halfT = t / 2;
    const midX = w / 2;
    const elements = [];

    // Segments:
    // a: top
    const seg_a = [
      [t * 0.8 + g, 0],
      [w - t * 0.8 - g, 0],
      [w - t * 1.5 - g, t],
      [t * 1.5 + g, t],
    ].map(([px, py]) => [x + px, y + py]);

    // b: top right
    const seg_b = [
      [w, t * 0.8 + g],
      [w, halfH - g],
      [w - t, halfH - halfT - g],
      [w - t, t * 1.5 + g],
    ].map(([px, py]) => [x + px, y + py]);

    // c: bottom right
    const seg_c = [
      [w, halfH + g],
      [w, h - t * 0.8 - g],
      [w - t, h - t * 1.5 - g],
      [w - t, halfH + halfT + g],
    ].map(([px, py]) => [x + px, y + py]);

    // d: bottom
    const seg_d = [
      [t * 1.5 + g, h - t],
      [w - t * 1.5 - g, h - t],
      [w - t * 0.8 - g, h],
      [t * 0.8 + g, h],
    ].map(([px, py]) => [x + px, y + py]);

    // e: bottom left
    const seg_e = [
      [0, halfH + g],
      [t, halfH + halfT + g],
      [t, h - t * 1.5 - g],
      [0, h - t * 0.8 - g],
    ].map(([px, py]) => [x + px, y + py]);

    // f: top left
    const seg_f = [
      [0, t * 0.8 + g],
      [t, t * 1.5 + g],
      [t, halfH - halfT - g],
      [0, halfH - g],
    ].map(([px, py]) => [x + px, y + py]);

    // g: middle
    const seg_g = [
      [t * 0.8 + g, halfH],
      [t * 1.4 + g, halfH - halfT],
      [w - t * 1.4 - g, halfH - halfT],
      [w - t * 0.8 - g, halfH],
      [w - t * 1.4 - g, halfH + halfT],
      [t * 1.4 + g, halfH + halfT],
    ].map(([px, py]) => [x + px, y + py]);

    // Special middle vertical segments for "I"
    const seg_m_top = [
      [midX - halfT, t * 1.4 + g],
      [midX + halfT, t * 1.4 + g],
      [midX + halfT, halfH - g],
      [midX, halfH],
      [midX - halfT, halfH - g],
    ].map(([px, py]) => [x + px, y + py]);

    const seg_m_bot = [
      [midX, halfH],
      [midX + halfT, halfH + g],
      [midX + halfT, h - t * 1.4 - g],
      [midX - halfT, h - t * 1.4 - g],
      [midX - halfT, halfH + g],
    ].map(([px, py]) => [x + px, y + py]);

    if (char === 'I') {
      // For "I": top(a), bottom(d), middle vertical(m_top, m_bot)
      elements.push(poly(seg_a, h, true, colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_d, h, true, colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_m_top, h, true, colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_m_bot, h, true, colorOn, colorOff, 'url(#glow)'));
      // background faint inactive side verticals
      elements.push(poly(seg_b, h, false, colorOn, colorOff));
      elements.push(poly(seg_c, h, false, colorOn, colorOff));
      elements.push(poly(seg_e, h, false, colorOn, colorOff));
      elements.push(poly(seg_f, h, false, colorOn, colorOff));
    } else {
      const activeMap = {
        A: ['a', 'b', 'c', 'e', 'f', 'g'],
        C: ['a', 'd', 'e', 'f'],
        L: ['d', 'e', 'f'],
      };
      const active = activeMap[char] || [];
      elements.push(poly(seg_a, h, active.includes('a'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_b, h, active.includes('b'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_c, h, active.includes('c'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_d, h, active.includes('d'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_e, h, active.includes('e'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_f, h, active.includes('f'), colorOn, colorOff, 'url(#glow)'));
      elements.push(poly(seg_g, h, active.includes('g'), colorOn, colorOff, 'url(#glow)'));
    }

    return elements.join('\n    ');
  }

  const cyanOn = '#38bdf8';
  const amberOn = '#f59e0b';
  const offColor = '#1a202c';

  // Row 1: AI
  const r1H = 136;
  const r1T = 18;
  const r1G = 2.5;
  const wA = 90;
  const wI = 70;
  const gap1 = 30;
  const totalW1 = wA + gap1 + wI + r1H * tan;
  const r1X = (width - totalW1) / 2 - 6;
  const r1Y = 82;

  const charA = drawChar('A', r1X, r1Y, wA, r1H, r1T, r1G, cyanOn, offColor);
  const charI = drawChar('I', r1X + wA + gap1, r1Y, wI, r1H, r1T, r1G, cyanOn, offColor);

  // Row 2: CALC
  const r2H = 118;
  const r2T = 15;
  const r2G = 2;
  const wC = 66;
  const wA2 = 66;
  const wL = 56;
  const gap2 = 18;
  const totalW2 = wC + gap2 + wA2 + gap2 + wL + gap2 + wC + r2H * tan;
  const r2X = (width - totalW2) / 2 - 5;
  const r2Y = 282;

  const charC1 = drawChar('C', r2X, r2Y, wC, r2H, r2T, r2G, amberOn, offColor);
  const charA2 = drawChar('A', r2X + wC + gap2, r2Y, wA2, r2H, r2T, r2G, amberOn, offColor);
  const charL = drawChar('L', r2X + wC + gap2 + wA2 + gap2, r2Y, wL, r2H, r2T, r2G, amberOn, offColor);
  const charC2 = drawChar('C', r2X + wC + gap2 + wA2 + gap2 + wL + gap2, r2Y, wC, r2H, r2T, r2G, amberOn, offColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e1017"/>
      <stop offset="60%" stop-color="#08090d"/>
      <stop offset="100%" stop-color="#040406"/>
    </linearGradient>

    <!-- Bezel Gradient -->
    <linearGradient id="bezel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.18)"/>
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.04)"/>
    </linearGradient>

    <!-- Display Panel Gradient -->
    <linearGradient id="panel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#12151e"/>
      <stop offset="100%" stop-color="#090b10"/>
    </linearGradient>

    <!-- Subtle Glow Filter -->
    <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Subtle Mesh Pattern -->
    <pattern id="mesh" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.75" fill="rgba(255, 255, 255, 0.02)" />
    </pattern>
  </defs>

  <!-- iOS Squircle Shape (rx=108 for standard 512px) -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <rect x="2" y="2" width="508" height="508" rx="106" fill="none" stroke="url(#bezel)" stroke-width="2.5"/>

  <!-- Inner Recessed Display Frame -->
  <rect x="36" y="36" width="440" height="440" rx="36" fill="url(#panel)" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1.5"/>
  <rect x="36" y="36" width="440" height="440" rx="36" fill="url(#mesh)"/>

  <!-- Center Divider Line -->
  <line x1="64" y1="250" x2="448" y2="250" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1.5" stroke-dasharray="6 6" />

  <!-- Digits -->
  <g id="digits">
    <!-- Row 1: AI -->
    ${charA}
    ${charI}

    <!-- Row 2: CALC -->
    ${charC1}
    ${charA2}
    ${charL}
    ${charC2}
  </g>
</svg>`;
}

const svg = generateIconSvg();
fs.writeFileSync(path.join(__dirname, '../public/icon.svg'), svg, 'utf-8');
console.log('Updated public/icon.svg');
