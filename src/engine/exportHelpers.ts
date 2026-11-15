/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitComponent, Wire } from '../types/circuit';
import { getPinAbsolutePos } from './componentFactory';

export interface CircuitExportData {
  name: string;
  components: CircuitComponent[];
  wires: Wire[];
  timebase: number;
  voltsPerDiv: number;
}

export interface ChipPinMapping {
  pinNumber: number;
  label: string;
  netName: string;
  sourceComponent: string;
  sourcePin: string;
}

export interface ChipPackageSpec {
  format: 'ohm-e-ic-package';
  version: '1.0';
  chipName: string;
  partNumber: string;
  packageType: 'DIP-8' | 'DIP-16' | 'DIP-20';
  pinCount: number;
  pins: ChipPinMapping[];
  internalComponents: CircuitComponent[];
  internalWires: Wire[];
  createdAt: string;
}

export interface PcbPad {
  id: string;
  pinId: string;
  num: string;
  x: number; // mm relative to component center
  y: number; // mm relative to component center
  absX: number; // mm on board
  absY: number; // mm on board
  netId: number;
  netName: string;
  drill: number;
  size: number;
}

export interface PcbFootprint {
  ref: string;
  name: string;
  type: string;
  footprintName: string;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  pads: PcbPad[];
}

export interface PcbTrace {
  netId: number;
  netName: string;
  layer: 'F.Cu' | 'B.Cu';
  points: { x: number; y: number }[];
  width: number;
}

export interface PcbVia {
  x: number;
  y: number;
  netId: number;
}

export interface PcbLayout {
  boardName: string;
  widthMm: number;
  heightMm: number;
  footprints: PcbFootprint[];
  traces: PcbTrace[];
  vias: PcbVia[];
  nets: { id: number; name: string }[];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'ohm_e_circuit';
}

// ============================================================================
// 1. JSON EXPORT
// ============================================================================
export function exportCircuitJson(data: CircuitExportData) {
  const payload = {
    version: '1.0',
    name: data.name,
    timestamp: Date.now(),
    components: data.components,
    wires: data.wires,
    timebase: data.timebase,
    voltsPerDiv: data.voltsPerDiv,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  triggerDownload(blob, `${sanitizeFilename(data.name)}.json`);
}

// ============================================================================
// 2. PNG EXPORT (Captures live #ohm-e-schematic-svg with inlined styles)
// ============================================================================
export async function exportCircuitPng(data: CircuitExportData): Promise<void> {
  const liveSvg = document.getElementById('ohm-e-schematic-svg') as SVGSVGElement | null;

  // Compute bounding box in world coordinates from components and pins
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const comp of data.components) {
    minX = Math.min(minX, comp.x - 65);
    maxX = Math.max(maxX, comp.x + 65);
    minY = Math.min(minY, comp.y - 65);
    maxY = Math.max(maxY, comp.y + 65);
    for (const pin of comp.pins) {
      const pos = getPinAbsolutePos(comp, pin);
      minX = Math.min(minX, pos.x - 30);
      maxX = Math.max(maxX, pos.x + 30);
      minY = Math.min(minY, pos.y - 30);
      maxY = Math.max(maxY, pos.y + 30);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 640;
    maxY = 400;
  }

  const padding = 40;
  const vbX = Math.floor(minX - padding);
  const vbY = Math.floor(minY - padding);
  const vbW = Math.max(360, Math.ceil(maxX - minX + padding * 2));
  const vbH = Math.max(240, Math.ceil(maxY - minY + padding * 2));

  const scale = 2;
  const outW = Math.min(3200, Math.round(vbW * scale));
  const outH = Math.min(2400, Math.round(vbH * scale));

  let svgMarkup = '';

  if (liveSvg) {
    const clone = liveSvg.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('id');
    clone.removeAttribute('style');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(outW));
    clone.setAttribute('height', String(outH));
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);

    // Inline computed Tailwind styles from live elements to cloned elements
    const liveEls = liveSvg.querySelectorAll('*');
    const cloneEls = clone.querySelectorAll('*');
    const styleProps = [
      'fill',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-opacity',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'opacity',
      'font-family',
      'font-size',
      'font-weight',
      'text-anchor',
      'dominant-baseline',
    ];

    for (let i = 0; i < liveEls.length && i < cloneEls.length; i++) {
      const src = liveEls[i];
      const dst = cloneEls[i] as SVGElement;
      if (
        dst.getAttribute('data-selection-box') === 'true' ||
        dst.classList.contains('animate-ping') ||
        dst.classList.contains('animate-pulse')
      ) {
        dst.setAttribute('display', 'none');
        continue;
      }
      const cs = window.getComputedStyle(src);
      let inlineStyle = dst.getAttribute('style') || '';
      for (const prop of styleProps) {
        const val = cs.getPropertyValue(prop);
        if (val && val !== 'none' && val !== 'normal') {
          if (prop === 'fill' && val === 'rgb(0, 0, 0)' && dst.getAttribute('fill') === 'none') {
            continue;
          }
          inlineStyle += `${prop}:${val};`;
        }
      }
      if (dst.getAttribute('fill') === 'none') {
        inlineStyle += 'fill:none;';
      }
      if (inlineStyle) {
        dst.setAttribute('style', inlineStyle);
      }
    }

    // Prepend dark schematic blueprint background + subtle grid
    const bgNs = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(bgNs, 'defs');
    const pattern = document.createElementNS(bgNs, 'pattern');
    pattern.setAttribute('id', 'export-grid');
    pattern.setAttribute('width', '20');
    pattern.setAttribute('height', '20');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const dot = document.createElementNS(bgNs, 'circle');
    dot.setAttribute('cx', '1');
    dot.setAttribute('cy', '1');
    dot.setAttribute('r', '0.8');
    dot.setAttribute('fill', '#22252e');
    pattern.appendChild(dot);
    defs.appendChild(pattern);

    const bgRect = document.createElementNS(bgNs, 'rect');
    bgRect.setAttribute('x', String(vbX));
    bgRect.setAttribute('y', String(vbY));
    bgRect.setAttribute('width', String(vbW));
    bgRect.setAttribute('height', String(vbH));
    bgRect.setAttribute('fill', '#0e1013');

    const gridRect = document.createElementNS(bgNs, 'rect');
    gridRect.setAttribute('x', String(vbX));
    gridRect.setAttribute('y', String(vbY));
    gridRect.setAttribute('width', String(vbW));
    gridRect.setAttribute('height', String(vbH));
    gridRect.setAttribute('fill', 'url(#export-grid)');

    const titleText = document.createElementNS(bgNs, 'text');
    titleText.setAttribute('x', String(vbX + 14));
    titleText.setAttribute('y', String(vbY + vbH - 14));
    titleText.setAttribute('fill', '#64748b');
    titleText.setAttribute('font-family', 'monospace');
    titleText.setAttribute('font-size', '11');
    titleText.textContent = `${data.name} · ${data.components.length} components · ${data.wires.length} wires`;

    clone.insertBefore(titleText, clone.firstChild);
    clone.insertBefore(gridRect, clone.firstChild);
    clone.insertBefore(bgRect, clone.firstChild);
    clone.insertBefore(defs, clone.firstChild);

    svgMarkup = new XMLSerializer().serializeToString(clone);
  } else {
    svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}"><rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#0e1013"/></svg>`;
  }

  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0e1013';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, 0, 0, outW, outH);
      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (pngBlob) {
        triggerDownload(pngBlob, `${sanitizeFilename(data.name)}.png`);
      }
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

// ============================================================================
// 3. VECTOR PDF EXPORT (Pure TypeScript PDF 1.4 Generator)
// ============================================================================
function pdfEsc(str: string): string {
  return str
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === 'Ω') return 'Ohm';
      if (ch === 'µ') return 'u';
      if (ch === '°') return ' deg';
      return '-';
    })
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function getComponentSummaryValue(c: CircuitComponent): string {
  if (c.params.resistance !== undefined) return `${c.params.resistance} Ohm`;
  if (c.params.capacitance !== undefined) return `${(c.params.capacitance * 1e6).toFixed(2)} uF`;
  if (c.params.inductance !== undefined) return `${(c.params.inductance * 1e3).toFixed(2)} mH`;
  if (c.params.voltage !== undefined && c.params.frequency !== undefined)
    return `${c.params.voltage}V @ ${c.params.frequency}Hz`;
  if (c.params.voltage !== undefined) return `${c.params.voltage}V`;
  if (c.params.turnsRatio !== undefined) return `Ratio ${c.params.turnsRatio}:1`;
  if (c.params.vref !== undefined) return `Vref=${c.params.vref}V`;
  return '-';
}

export function exportCircuitPdf(data: CircuitExportData) {
  // A4 Landscape: 842 x 595 pt
  const pageW = 842;
  const pageH = 595;
  const cmds: string[] = [];

  // Dark blueprint outer card / crisp engineering drawing on light technical paper
  // White architectural schematic sheet with clean dark ink lines
  cmds.push('1 1 1 rg');
  cmds.push(`0 0 ${pageW} ${pageH} re f`);

  // Sheet border
  cmds.push('0.15 0.18 0.24 RG 1.2 w');
  cmds.push('24 24 794 547 re S');
  cmds.push('0.78 0.82 0.88 RG 0.5 w');
  cmds.push('28 28 786 539 re S');

  // Title block bottom-right
  cmds.push('0.96 0.97 0.99 rg 560 28 254 68 re f');
  cmds.push('0.15 0.18 0.24 RG 0.8 w 560 28 254 68 re S');
  cmds.push('560 66 m 814 66 l S');
  cmds.push('0.08 0.10 0.14 rg');
  cmds.push('BT /F2 11 Tf 570 77 Td (' + pdfEsc(data.name.slice(0, 34)) + ') Tj ET');
  cmds.push('0.35 0.40 0.48 rg');
  cmds.push(
    `BT /F1 8 Tf 570 50 Td (Components: ${data.components.length}   Wires: ${data.wires.length}) Tj ET`
  );
  cmds.push(
    `BT /F1 8 Tf 570 37 Td (Generated: ${new Date().toISOString().slice(0, 10)}   Ohm-E Schematic) Tj ET`
  );

  // Compute world bounds for schematic area (top 115..555, left 36..806)
  const viewX = 40;
  const viewY = 120;
  const viewW = 762;
  const viewH = 430;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of data.components) {
    minX = Math.min(minX, c.x - 50);
    maxX = Math.max(maxX, c.x + 50);
    minY = Math.min(minY, c.y - 50);
    maxY = Math.max(maxY, c.y + 50);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 600;
    maxY = 400;
  }

  const worldW = Math.max(200, maxX - minX);
  const worldH = Math.max(150, maxY - minY);
  const s = Math.min(viewW / worldW, viewH / worldH, 1.4);
  const offsetX = viewX + (viewW - worldW * s) / 2 - minX * s;
  const offsetY = viewY + (viewH - worldH * s) / 2;

  const toPdf = (wx: number, wy: number) => ({
    x: offsetX + wx * s,
    // Flip SVG Y downwards to PDF Y upwards
    y: offsetY + (maxY - wy) * s,
  });

  // Pin lookup
  const pinMap = new Map<string, { x: number; y: number }>();
  for (const c of data.components) {
    for (const p of c.pins) {
      pinMap.set(p.id, getPinAbsolutePos(c, p));
    }
  }

  // Draw orthogonal wires
  cmds.push('0.05 0.45 0.65 RG 1.4 w');
  for (const w of data.wires) {
    const p1 = pinMap.get(w.fromPinId);
    const p2 = pinMap.get(w.toPinId);
    if (!p1 || !p2) continue;
    const a = toPdf(p1.x, p1.y);
    const b = toPdf(p2.x, p2.y);
    if (Math.abs(p1.y - p2.y) <= 4 || Math.abs(p1.x - p2.x) <= 4) {
      cmds.push(`${a.x.toFixed(1)} ${a.y.toFixed(1)} m ${b.x.toFixed(1)} ${b.y.toFixed(1)} l S`);
    } else {
      const corner = toPdf(p2.x, p1.y);
      cmds.push(
        `${a.x.toFixed(1)} ${a.y.toFixed(1)} m ${corner.x.toFixed(1)} ${corner.y.toFixed(1)} l ${b.x.toFixed(1)} ${b.y.toFixed(1)} l S`
      );
    }
  }

  // Draw components
  for (const c of data.components) {
    if (c.type === 'junction') {
      const pt = toPdf(c.x, c.y);
      cmds.push('0.05 0.45 0.65 rg');
      cmds.push(`${(pt.x - 2.5).toFixed(1)} ${(pt.y - 2.5).toFixed(1)} 5 5 re f`);
      continue;
    }

    const center = toPdf(c.x, c.y);
    const bw = Math.max(24, 48 * s);
    const bh = Math.max(18, (c.pins.length > 4 ? 76 : 36) * s);

    // Pin lead lines from component center/edge to pins
    cmds.push('0.25 0.30 0.38 RG 1.0 w');
    for (const pin of c.pins) {
      const wp = getPinAbsolutePos(c, pin);
      const pp = toPdf(wp.x, wp.y);
      cmds.push(
        `${center.x.toFixed(1)} ${center.y.toFixed(1)} m ${pp.x.toFixed(1)} ${pp.y.toFixed(1)} l S`
      );
      cmds.push('0.98 0.98 0.99 rg');
      cmds.push(`${(pp.x - 2.2).toFixed(1)} ${(pp.y - 2.2).toFixed(1)} 4.4 4.4 re f`);
      cmds.push('0.12 0.16 0.22 RG 0.8 w');
      cmds.push(`${(pp.x - 2.2).toFixed(1)} ${(pp.y - 2.2).toFixed(1)} 4.4 4.4 re S`);
    }

    // Component body box
    cmds.push('0.95 0.97 0.99 rg');
    cmds.push(
      `${(center.x - bw / 2).toFixed(1)} ${(center.y - bh / 2).toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)} re f`
    );
    cmds.push('0.12 0.16 0.22 RG 1.2 w');
    cmds.push(
      `${(center.x - bw / 2).toFixed(1)} ${(center.y - bh / 2).toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)} re S`
    );

    // Component label
    cmds.push('0.08 0.10 0.15 rg');
    cmds.push(
      `BT /F2 7 Tf ${(center.x - bw / 2 + 3).toFixed(1)} ${(center.y + bh / 2 + 4).toFixed(1)} Td (${pdfEsc(c.name)}) Tj ET`
    );
    const valStr = getComponentSummaryValue(c);
    if (valStr !== '-') {
      cmds.push('0.35 0.42 0.50 rg');
      cmds.push(
        `BT /F1 6.5 Tf ${(center.x - bw / 2 + 3).toFixed(1)} ${(center.y - 2).toFixed(1)} Td (${pdfEsc(valStr)}) Tj ET`
      );
    }
  }

  // Bill of Materials summary bottom-left
  cmds.push('0.96 0.97 0.99 rg 28 28 524 68 re f');
  cmds.push('0.15 0.18 0.24 RG 0.8 w 28 28 524 68 re S');
  cmds.push('0.08 0.10 0.14 rg');
  cmds.push('BT /F2 8 Tf 36 83 Td (BILL OF MATERIALS SUMMARY) Tj ET');
  const bomComps = data.components.filter((c) => c.type !== 'junction').slice(0, 8);
  bomComps.forEach((c, idx) => {
    const col = idx < 4 ? 36 : 295;
    const rowY = 70 - (idx % 4) * 11;
    const line = `${idx + 1}. ${c.name} (${getComponentSummaryValue(c)})`;
    cmds.push(`BT /F1 7.5 Tf ${col} ${rowY} Td (${pdfEsc(line)}) Tj ET`);
  });

  const streamContent = cmds.join('\n');

  // Assemble valid PDF 1.4 object table with exact byte offsets
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  triggerDownload(blob, `${sanitizeFilename(data.name)}.pdf`);
}

// ============================================================================
// 4. CHIP / IC PACKAGE GENERATOR & EXPORT
// ============================================================================
function buildNetGroups(components: CircuitComponent[], wires: Wire[]) {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (!p || p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const c of components) {
    for (const p of c.pins) {
      parent.set(p.id, p.id);
    }
  }
  for (const w of wires) {
    if (parent.has(w.fromPinId) && parent.has(w.toPinId)) {
      union(w.fromPinId, w.toPinId);
    }
  }

  // Merge all grounds into GND net
  const groundPins: string[] = [];
  for (const c of components) {
    if (c.type === 'ground' && c.pins[0]) {
      groundPins.push(c.pins[0].id);
    }
  }
  for (let i = 1; i < groundPins.length; i++) {
    union(groundPins[0], groundPins[i]);
  }

  return { find, groundRoot: groundPins[0] ? find(groundPins[0]) : null };
}

export function generateChipPackage(
  data: CircuitExportData,
  chipName: string,
  requestedPackage?: 'DIP-8' | 'DIP-16' | 'DIP-20'
): ChipPackageSpec {
  const { find, groundRoot } = buildNetGroups(data.components, data.wires);

  // Collect candidate I/O pins (sources, ground, outputs, meters, or unconnected edge pins)
  const wiredPinSet = new Set<string>();
  for (const w of data.wires) {
    wiredPinSet.add(w.fromPinId);
    wiredPinSet.add(w.toPinId);
  }

  const seenNets = new Set<string>();
  const rawMappings: Omit<ChipPinMapping, 'pinNumber'>[] = [];

  for (const comp of data.components) {
    if (comp.type === 'junction') continue;
    for (const pin of comp.pins) {
      const root = find(pin.id);
      const isPowerOrIO =
        comp.type === 'dc_source' ||
        comp.type === 'ac_source' ||
        comp.type === 'square_wave' ||
        comp.type === 'pulse_gen' ||
        comp.type === 'ground' ||
        comp.type === 'voltmeter' ||
        comp.type === 'ammeter' ||
        comp.type === 'ohmmeter' ||
        comp.type === 'led' ||
        comp.type === 'seven_segment' ||
        !wiredPinSet.has(pin.id);

      if (isPowerOrIO && !seenNets.has(root)) {
        seenNets.add(root);
        const netLabel =
          root === groundRoot
            ? 'GND'
            : comp.type === 'dc_source' && pin.name === '+'
            ? 'VCC'
            : (pin.label || pin.name || `IO${rawMappings.length + 1}`).toUpperCase().slice(0, 6);
        rawMappings.push({
          label: netLabel,
          netName: `NET_${root.slice(-4).toUpperCase()}`,
          sourceComponent: comp.name,
          sourcePin: pin.name,
        });
      }
    }
  }

  // Fallback if circuit has no external/source pins yet: expose component pins directly
  if (rawMappings.length === 0) {
    for (const comp of data.components) {
      if (comp.type === 'junction') continue;
      for (const pin of comp.pins) {
        const root = find(pin.id);
        if (!seenNets.has(root)) {
          seenNets.add(root);
          rawMappings.push({
            label: (pin.label || pin.name || 'IO').toUpperCase().slice(0, 6),
            netName: `NET_${root.slice(-4).toUpperCase()}`,
            sourceComponent: comp.name,
            sourcePin: pin.name,
          });
        }
      }
    }
  }

  const autoPkg: 'DIP-8' | 'DIP-16' | 'DIP-20' =
    rawMappings.length <= 8 ? 'DIP-8' : rawMappings.length <= 16 ? 'DIP-16' : 'DIP-20';
  const packageType = requestedPackage || autoPkg;
  const pinCount = packageType === 'DIP-8' ? 8 : packageType === 'DIP-16' ? 16 : 20;

  const pins: ChipPinMapping[] = Array.from({ length: pinCount }, (_, idx) => {
    const m = rawMappings[idx];
    return {
      pinNumber: idx + 1,
      label: m ? m.label : 'NC',
      netName: m ? m.netName : 'NC',
      sourceComponent: m ? m.sourceComponent : 'Unconnected',
      sourcePin: m ? m.sourcePin : '-',
    };
  });

  const partNumber = sanitizeFilename(chipName).toUpperCase().slice(0, 14) || 'OHME_IC1';

  return {
    format: 'ohm-e-ic-package',
    version: '1.0',
    chipName,
    partNumber,
    packageType,
    pinCount,
    pins,
    internalComponents: data.components,
    internalWires: data.wires,
    createdAt: new Date().toISOString(),
  };
}

export function renderChipSvgMarkup(spec: ChipPackageSpec): string {
  const half = spec.pinCount / 2;
  const pinSpacing = 26;
  const bodyH = half * pinSpacing + 28;
  const bodyW = 136;
  const svgW = 360;
  const svgH = bodyH + 40;
  const bx = (svgW - bodyW) / 2;
  const by = 20;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`
  );
  lines.push(`<rect width="${svgW}" height="${svgH}" rx="8" fill="#0d0f13"/>`);

  // IC Epoxy Body
  lines.push(
    `<rect x="${bx}" y="${by}" width="${bodyW}" height="${bodyH}" rx="6" fill="#181b22" stroke="#3b4252" stroke-width="2"/>`
  );
  // Pin-1 Orientation Notch
  lines.push(
    `<path d="M ${svgW / 2 - 14} ${by} A 14 14 0 0 0 ${svgW / 2 + 14} ${by}" fill="#0d0f13" stroke="#3b4252" stroke-width="1.5"/>`
  );
  // Pin-1 Dot
  lines.push(`<circle cx="${bx + 14}" cy="${by + 16}" r="3.5" fill="#64748b"/>`);

  // Laser-etched IC Part Number
  lines.push(
    `<text x="${svgW / 2}" y="${by + bodyH / 2 - 6}" text-anchor="middle" fill="#e2e8f0" font-family="monospace" font-size="13" font-weight="bold">${spec.partNumber}</text>`
  );
  lines.push(
    `<text x="${svgW / 2}" y="${by + bodyH / 2 + 12}" text-anchor="middle" fill="#64748b" font-family="monospace" font-size="10">${spec.packageType} · OHM-E</text>`
  );

  // Left Pins (1..half top-to-bottom) & Right Pins (pinCount..half+1 top-to-bottom)
  for (let i = 0; i < half; i++) {
    const py = by + 26 + i * pinSpacing;
    const leftPin = spec.pins[i];
    const rightPin = spec.pins[spec.pinCount - 1 - i];

    // Left pin metallic lead
    lines.push(
      `<rect x="${bx - 16}" y="${py - 5}" width="16" height="10" rx="1.5" fill="#94a3b8"/>`
    );
    lines.push(
      `<text x="${bx + 8}" y="${py + 3.5}" fill="#64748b" font-family="monospace" font-size="10">${leftPin.pinNumber}</text>`
    );
    lines.push(
      `<text x="${bx - 22}" y="${py + 3.5}" text-anchor="end" fill="${
        leftPin.label === 'NC' ? '#475569' : '#38bdf8'
      }" font-family="monospace" font-size="11" font-weight="bold">${leftPin.label}</text>`
    );

    // Right pin metallic lead
    lines.push(
      `<rect x="${bx + bodyW}" y="${py - 5}" width="16" height="10" rx="1.5" fill="#94a3b8"/>`
    );
    lines.push(
      `<text x="${bx + bodyW - 8}" y="${py + 3.5}" text-anchor="end" fill="#64748b" font-family="monospace" font-size="10">${rightPin.pinNumber}</text>`
    );
    lines.push(
      `<text x="${bx + bodyW + 22}" y="${py + 3.5}" text-anchor="start" fill="${
        rightPin.label === 'NC' ? '#475569' : '#34d399'
      }" font-family="monospace" font-size="11" font-weight="bold">${rightPin.label}</text>`
    );
  }

  lines.push('</svg>');
  return lines.join('');
}

export function exportChipPackageJson(spec: ChipPackageSpec) {
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${sanitizeFilename(spec.chipName)}.chip.json`);
}

export function exportChipPinoutSvg(spec: ChipPackageSpec) {
  const svg = renderChipSvgMarkup(spec);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(spec.chipName)}_pinout.svg`);
}

// ============================================================================
// 5. PCB LAYOUT GENERATOR & KICAD (.kicad_pcb) / SVG EXPORT
// ============================================================================
function getRefPrefix(type: string): string {
  if (type === 'resistor' || type === 'potentiometer' || type === 'photoresistor' || type === 'thermistor') return 'R';
  if (type === 'capacitor') return 'C';
  if (type === 'inductor') return 'L';
  if (type === 'transformer') return 'T';
  if (type === 'diode' || type === 'zener_diode' || type === 'led') return 'D';
  if (type === 'npn' || type === 'pnp' || type === 'n_mosfet' || type === 'p_mosfet') return 'Q';
  if (type === 'opamp' || type === 'timer_555' || type === 'adc' || type === 'dac' || type.startsWith('gate_')) return 'U';
  if (type === 'switch' || type === 'push_button') return 'SW';
  if (type === 'relay') return 'K';
  if (type === 'incandescent_bulb' || type === 'seven_segment') return 'DS';
  if (type === 'dc_motor' || type === 'ac_motor') return 'M';
  return 'J';
}

export function generatePcbLayout(data: CircuitExportData): PcbLayout {
  const realComps = data.components.filter((c) => c.type !== 'junction');
  const { find } = buildNetGroups(data.components, data.wires);

  // Assign sequential net IDs
  const rootToNet = new Map<string, { id: number; name: string }>();
  let nextNetId = 1;
  const getNet = (pinId: string) => {
    const r = find(pinId);
    let existing = rootToNet.get(r);
    if (!existing) {
      existing = { id: nextNetId, name: `N${nextNetId}` };
      nextNetId++;
      rootToNet.set(r, existing);
    }
    return existing;
  };

  // Scale schematic px to PCB mm (~ 20px = 2.54mm * 2 => 0.25mm/px, min grid 2.54mm)
  const scaleMm = 0.25;
  const snapGridMm = (v: number) => Math.round(v / 2.54) * 2.54;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of realComps) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 140;
  }

  const marginMm = 14;
  const refCounters: Record<string, number> = {};
  const footprints: PcbFootprint[] = [];
  const padLookup = new Map<string, PcbPad>();

  for (const c of realComps) {
    const prefix = getRefPrefix(c.type);
    refCounters[prefix] = (refCounters[prefix] || 0) + 1;
    const ref = `${prefix}${refCounters[prefix]}`;

    const cx = marginMm + snapGridMm((c.x - minX) * scaleMm) + 10;
    const cy = marginMm + snapGridMm((c.y - minY) * scaleMm) + 10;

    const isIc = c.pins.length >= 6;
    const width = isIc ? 10.16 : c.pins.length >= 3 ? 10.16 : 12.7;
    const height = isIc ? Math.max(12.7, Math.ceil(c.pins.length / 2) * 2.54 + 2.54) : c.pins.length >= 3 ? 10.16 : 5.08;
    const footprintName = isIc
      ? `Package_DIP:DIP-${c.pins.length}_W7.62mm`
      : c.pins.length === 3
      ? 'Package_TO_SOT_THT:TO-220-3_Vertical'
      : c.type === 'capacitor'
      ? 'Capacitor_THT:CP_Radial_D6.3mm_P2.50mm'
      : c.type === 'resistor'
      ? 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal'
      : `Connector_PinHeader_2.54mm:PinHeader_1x0${Math.max(1, c.pins.length)}_P2.54mm_Vertical`;

    const pads: PcbPad[] = [];
    if (isIc) {
      const half = Math.ceil(c.pins.length / 2);
      c.pins.forEach((pin, idx) => {
        const isRight = idx >= half;
        const row = isRight ? idx - half : idx;
        const px = isRight ? 3.81 : -3.81;
        const py = (row - (half - 1) / 2) * 2.54;
        const net = getNet(pin.id);
        const pad: PcbPad = {
          id: `${ref}_${idx + 1}`,
          pinId: pin.id,
          num: String(idx + 1),
          x: px,
          y: py,
          absX: cx + px,
          absY: cy + py,
          netId: net.id,
          netName: net.name,
          drill: 0.8,
          size: 1.6,
        };
        pads.push(pad);
        padLookup.set(pin.id, pad);
      });
    } else if (c.pins.length === 1) {
      const pin = c.pins[0];
      const net = getNet(pin.id);
      const pad: PcbPad = {
        id: `${ref}_1`,
        pinId: pin.id,
        num: '1',
        x: 0,
        y: 0,
        absX: cx,
        absY: cy,
        netId: net.id,
        netName: net.name,
        drill: 1.0,
        size: 1.9,
      };
      pads.push(pad);
      padLookup.set(pin.id, pad);
    } else {
      c.pins.forEach((pin, idx) => {
        const px = c.pins.length === 2 ? (idx === 0 ? -5.08 : 5.08) : (idx - (c.pins.length - 1) / 2) * 2.54;
        const py = 0;
        const net = getNet(pin.id);
        const pad: PcbPad = {
          id: `${ref}_${idx + 1}`,
          pinId: pin.id,
          num: String(idx + 1),
          x: px,
          y: py,
          absX: cx + px,
          absY: cy + py,
          netId: net.id,
          netName: net.name,
          drill: 0.9,
          size: 1.7,
        };
        pads.push(pad);
        padLookup.set(pin.id, pad);
      });
    }

    footprints.push({
      ref,
      name: c.name,
      type: c.type,
      footprintName,
      x: cx,
      y: cy,
      width,
      height,
      pads,
    });
  }

  let boardW = 80;
  let boardH = 60;
  for (const fp of footprints) {
    boardW = Math.max(boardW, fp.x + fp.width / 2 + marginMm);
    boardH = Math.max(boardH, fp.y + fp.height / 2 + marginMm);
  }
  boardW = Math.ceil(boardW / 5) * 5;
  boardH = Math.ceil(boardH / 5) * 5;

  // Route Manhattan F.Cu / B.Cu traces from wires
  const traces: PcbTrace[] = [];
  const vias: PcbVia[] = [];

  for (const w of data.wires) {
    const p1 = padLookup.get(w.fromPinId);
    const p2 = padLookup.get(w.toPinId);
    if (!p1 || !p2) continue;

    if (Math.abs(p1.absX - p2.absX) < 0.05 || Math.abs(p1.absY - p2.absY) < 0.05) {
      traces.push({
        netId: p1.netId,
        netName: p1.netName,
        layer: Math.abs(p1.absY - p2.absY) < 0.05 ? 'F.Cu' : 'B.Cu',
        points: [
          { x: p1.absX, y: p1.absY },
          { x: p2.absX, y: p2.absY },
        ],
        width: 0.4,
      });
    } else {
      const corner = { x: p2.absX, y: p1.absY };
      traces.push({
        netId: p1.netId,
        netName: p1.netName,
        layer: 'F.Cu',
        points: [{ x: p1.absX, y: p1.absY }, corner],
        width: 0.4,
      });
      traces.push({
        netId: p1.netId,
        netName: p1.netName,
        layer: 'B.Cu',
        points: [corner, { x: p2.absX, y: p2.absY }],
        width: 0.4,
      });
      vias.push({ x: corner.x, y: corner.y, netId: p1.netId });
    }
  }

  return {
    boardName: data.name,
    widthMm: boardW,
    heightMm: boardH,
    footprints,
    traces,
    vias,
    nets: Array.from(rootToNet.values()),
  };
}

export function renderPcbSvgMarkup(layout: PcbLayout): string {
  const pxPerMm = 5;
  const pad = 16;
  const w = layout.widthMm * pxPerMm + pad * 2;
  const h = layout.heightMm * pxPerMm + pad * 2;
  const sx = (mm: number) => pad + mm * pxPerMm;
  const sy = (mm: number) => pad + mm * pxPerMm;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  );
  lines.push(`<rect width="${w}" height="${h}" fill="#0b0d11"/>`);

  // Solder mask green-emerald FR4 board substrate
  lines.push(
    `<rect x="${pad}" y="${pad}" width="${layout.widthMm * pxPerMm}" height="${layout.heightMm * pxPerMm}" rx="8" fill="#0d291f" stroke="#eab308" stroke-width="1.5"/>`
  );

  // Corner M3 mounting holes
  const holeOffset = 5;
  [
    [holeOffset, holeOffset],
    [layout.widthMm - holeOffset, holeOffset],
    [holeOffset, layout.heightMm - holeOffset],
    [layout.widthMm - holeOffset, layout.heightMm - holeOffset],
  ].forEach(([hx, hy]) => {
    lines.push(`<circle cx="${sx(hx)}" cy="${sy(hy)}" r="9" fill="#d97706" opacity="0.85"/>`);
    lines.push(`<circle cx="${sx(hx)}" cy="${sy(hy)}" r="5" fill="#0b0d11"/>`);
  });

  // Back Copper Traces (B.Cu - Blue)
  for (const tr of layout.traces.filter((t) => t.layer === 'B.Cu')) {
    const pts = tr.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.78"/>`
    );
  }

  // Front Copper Traces (F.Cu - Red/Copper)
  for (const tr of layout.traces.filter((t) => t.layer === 'F.Cu')) {
    const pts = tr.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    lines.push(
      `<polyline points="${pts}" fill="none" stroke="#f97316" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`
    );
  }

  // Vias
  for (const v of layout.vias) {
    lines.push(`<circle cx="${sx(v.x).toFixed(1)}" cy="${sy(v.y).toFixed(1)}" r="3.2" fill="#facc15"/>`);
    lines.push(`<circle cx="${sx(v.x).toFixed(1)}" cy="${sy(v.y).toFixed(1)}" r="1.4" fill="#0b0d11"/>`);
  }

  // Silkscreen Outlines & ENIG Gold Pads
  for (const fp of layout.footprints) {
    const fx = sx(fp.x - fp.width / 2);
    const fy = sy(fp.y - fp.height / 2);
    lines.push(
      `<rect x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="${(fp.width * pxPerMm).toFixed(1)}" height="${(fp.height * pxPerMm).toFixed(1)}" rx="2" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.85"/>`
    );
    lines.push(
      `<text x="${sx(fp.x).toFixed(1)}" y="${(fy - 4).toFixed(1)}" text-anchor="middle" fill="#f8fafc" font-family="monospace" font-size="9" font-weight="bold">${fp.ref}</text>`
    );

    for (const p of fp.pads) {
      lines.push(
        `<circle cx="${sx(p.absX).toFixed(1)}" cy="${sy(p.absY).toFixed(1)}" r="${((p.size / 2) * pxPerMm).toFixed(1)}" fill="#fbbf24" stroke="#b45309" stroke-width="0.6"/>`
      );
      lines.push(
        `<circle cx="${sx(p.absX).toFixed(1)}" cy="${sy(p.absY).toFixed(1)}" r="${((p.drill / 2) * pxPerMm).toFixed(1)}" fill="#0b0d11"/>`
      );
    }
  }

  // Board Silkscreen Title
  lines.push(
    `<text x="${pad + 14}" y="${h - pad - 8}" fill="#e2e8f0" font-family="monospace" font-size="9">${layout.boardName} · ${layout.widthMm}x${layout.heightMm}mm · 2-Layer</text>`
  );
  lines.push('</svg>');
  return lines.join('');
}

export function exportKicadPcb(layout: PcbLayout) {
  const lines: string[] = [];
  lines.push('(kicad_pcb (version 20221018) (generator ohm_e_pcb_exporter)');
  lines.push('  (general (thickness 1.6))');
  lines.push('  (paper "A4")');
  lines.push('  (layers');
  lines.push('    (0 "F.Cu" signal)');
  lines.push('    (31 "B.Cu" signal)');
  lines.push('    (36 "B.SilkS" user "B.Silkscreen")');
  lines.push('    (37 "F.SilkS" user "F.Silkscreen")');
  lines.push('    (44 "Edge.Cuts" user)');
  lines.push('  )');
  lines.push('  (net 0 "")');
  for (const n of layout.nets) {
    lines.push(`  (net ${n.id} "${n.name}")`);
  }
  lines.push(
    `  (gr_rect (start 0 0) (end ${layout.widthMm.toFixed(2)} ${layout.heightMm.toFixed(2)}) (layer "Edge.Cuts") (width 0.15))`
  );

  for (const fp of layout.footprints) {
    lines.push(`  (footprint "${fp.footprintName}" (layer "F.Cu")`);
    lines.push(`    (at ${fp.x.toFixed(2)} ${fp.y.toFixed(2)})`);
    lines.push(`    (fp_text reference "${fp.ref}" (at 0 ${(-fp.height / 2 - 1.5).toFixed(2)}) (layer "F.SilkS"))`);
    lines.push(`    (fp_text value "${fp.name}" (at 0 ${(fp.height / 2 + 1.5).toFixed(2)}) (layer "F.SilkS"))`);
    for (const p of fp.pads) {
      lines.push(
        `    (pad "${p.num}" thru_hole circle (at ${p.x.toFixed(2)} ${p.y.toFixed(2)}) (size ${p.size.toFixed(2)} ${p.size.toFixed(2)}) (drill ${p.drill.toFixed(2)}) (layers *.Cu *.Mask) (net ${p.netId} "${p.netName}"))`
      );
    }
    lines.push('  )');
  }

  for (const tr of layout.traces) {
    for (let i = 0; i < tr.points.length - 1; i++) {
      const a = tr.points[i];
      const b = tr.points[i + 1];
      lines.push(
        `  (segment (start ${a.x.toFixed(2)} ${a.y.toFixed(2)}) (end ${b.x.toFixed(2)} ${b.y.toFixed(2)}) (width ${tr.width.toFixed(2)}) (layer "${tr.layer}") (net ${tr.netId}))`
      );
    }
  }

  for (const v of layout.vias) {
    lines.push(
      `  (via (at ${v.x.toFixed(2)} ${v.y.toFixed(2)}) (size 0.8) (drill 0.4) (layers "F.Cu" "B.Cu") (net ${v.netId}))`
    );
  }

  lines.push(')');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(layout.boardName)}.kicad_pcb`);
}

export function exportPcbArtworkSvg(layout: PcbLayout) {
  const svg = renderPcbSvgMarkup(layout);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${sanitizeFilename(layout.boardName)}_pcb.svg`);
}
