/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Cpu,
  CircuitBoard,
  Upload,
  Check,
} from 'lucide-react';
import { CircuitComponent, Wire } from '../types/circuit';
import {
  exportCircuitJson,
  exportCircuitPng,
  exportCircuitPdf,
  generateChipPackage,
  exportChipPackageJson,
  exportChipPinoutSvg,
  generatePcbLayout,
  exportKicadPcb,
  exportPcbArtworkSvg,
} from '../engine/exportHelpers';
import { ToastVariant } from './ToastContainer';

export type ExportFormat = 'json' | 'pdf' | 'png' | 'chip' | 'pcb';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: CircuitComponent[];
  wires: Wire[];
  timebase: number;
  voltsPerDiv: number;
  onNotify?: (variant: ToastVariant, title: string, description?: string) => void;
}

const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  ext: string;
  summary: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'json',
    label: 'JSON',
    ext: '.json',
    summary: 'Full schematic topology, component values, and oscilloscope settings.',
    icon: <FileCode2 className="w-4 h-4" />,
  },
  {
    id: 'pdf',
    label: 'PDF',
    ext: '.pdf',
    summary: 'Vector A4 schematic drawing with title block and bill of materials.',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'png',
    label: 'PNG',
    ext: '.png',
    summary: 'High-resolution raster snapshot of the live schematic canvas.',
    icon: <ImageIcon className="w-4 h-4" />,
  },
  {
    id: 'chip',
    label: 'Chip',
    ext: '.chip.json',
    summary: 'Encapsulate circuit nets into a reusable DIP IC pinout package.',
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: 'pcb',
    label: 'PCB',
    ext: '.kicad_pcb',
    summary: 'Two-layer FR4 footprint placement and Manhattan copper trace layout.',
    icon: <CircuitBoard className="w-4 h-4" />,
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  components,
  wires,
  timebase,
  voltsPerDiv,
  onNotify,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [projectName, setProjectName] = useState<string>('ohm_e_schematic');
  const [chipPackageType, setChipPackageType] = useState<'DIP-8' | 'DIP-16' | 'DIP-20'>('DIP-8');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const exportData = useMemo(
    () => ({
      name: projectName.trim() || 'ohm_e_schematic',
      components,
      wires,
      timebase,
      voltsPerDiv,
    }),
    [projectName, components, wires, timebase, voltsPerDiv]
  );

  const chipSpec = useMemo(
    () => generateChipPackage(exportData, exportData.name, chipPackageType),
    [exportData, chipPackageType]
  );

  const pcbLayout = useMemo(() => generatePcbLayout(exportData), [exportData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeOption = FORMAT_OPTIONS.find((f) => f.id === selectedFormat)!;
  const nonJunctionCount = components.filter((c) => c.type !== 'junction').length;

  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2600);
  };

  const handlePrimaryExport = async () => {
    setIsExporting(true);
    try {
      const safeName = exportData.name;
      if (selectedFormat === 'json') {
        exportCircuitJson(exportData);
        flashStatus('Exported schematic JSON');
        onNotify?.('success', 'Circuit exported (JSON)', `${safeName}.json downloaded.`);
      } else if (selectedFormat === 'pdf') {
        exportCircuitPdf(exportData);
        flashStatus('Exported vector PDF sheet');
        onNotify?.('success', 'Circuit exported (PDF)', `${safeName}.pdf schematic sheet downloaded.`);
      } else if (selectedFormat === 'png') {
        await exportCircuitPng(exportData);
        flashStatus('Exported 2x PNG image');
        onNotify?.('success', 'Circuit exported (PNG)', `${safeName}.png snapshot downloaded.`);
      } else if (selectedFormat === 'chip') {
        exportChipPackageJson(chipSpec);
        flashStatus(`Exported ${chipSpec.packageType} chip package`);
        onNotify?.(
          'success',
          `Exported ${chipSpec.packageType} chip`,
          `${safeName}.chip.json package downloaded.`
        );
      } else if (selectedFormat === 'pcb') {
        exportKicadPcb(pcbLayout);
        flashStatus('Exported KiCad .kicad_pcb board');
        onNotify?.('success', 'Exported KiCad PCB', `${safeName}.kicad_pcb layout downloaded.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate export file.';
      onNotify?.('error', 'Export failed', message);
    } finally {
      setIsExporting(false);
    }
  };

  // Render DIP chip preview dimensions
  const chipHalf = chipSpec.pinCount / 2;
  const chipPinSpacing = 24;
  const chipBodyH = chipHalf * chipPinSpacing + 24;
  const chipSvgH = chipBodyH + 28;

  // Render PCB preview dimensions
  const pcbScale = 4.5;
  const pcbPad = 14;
  const pcbSvgW = pcbLayout.widthMm * pcbScale + pcbPad * 2;
  const pcbSvgH = pcbLayout.heightMm * pcbScale + pcbPad * 2;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#15171b] border border-[#2b2e38] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#cfd3dd] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#252831] flex items-center justify-between bg-[#17191e] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1f222a] border border-[#2e323d] text-[#38bdf8] flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[#f0f2f6]">Export Circuit</h2>
              <p className="text-[11px] font-mono text-[#717684] tabular-nums">
                {nonJunctionCount} components · {wires.length} wires
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1 rounded-md text-[#8b909f] hover:text-white hover:bg-[#252831] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* File / Design Name Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#8b909f] block">
              Design / File Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ohm_e_schematic"
                className="flex-1 bg-[#111317] border border-[#2d313b] focus:border-[#38bdf8] rounded-md px-3 py-1.5 text-xs font-mono text-[#f0f2f6] outline-none"
              />
              <span className="text-xs font-mono text-[#717684] shrink-0">{activeOption.ext}</span>
            </div>
          </div>

          {/* 5 Export Format Selector Cards */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b909f] block">
              Output Format
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const active = opt.id === selectedFormat;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedFormat(opt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col gap-1.5 ${
                      active
                        ? 'bg-[#1a2332] border-[#38bdf8] text-[#f0f2f6]'
                        : 'bg-[#181a20] border-[#262933] text-[#9ca3af] hover:bg-[#1f222b] hover:text-[#e2e8f0]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={active ? 'text-[#38bdf8]' : 'text-[#8b909f]'}>{opt.icon}</span>
                      <span className="text-[10px] font-mono text-[#64748b]">{opt.ext}</span>
                    </div>
                    <div className="font-semibold text-xs">{opt.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format Details & Live Previews */}
          <div className="p-3.5 rounded-lg bg-[#111317] border border-[#252831] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-[#f0f2f6]">
                  {activeOption.label} Export
                </div>
                <div className="text-[11px] text-[#8b909f]">{activeOption.summary}</div>
              </div>
              {statusMessage && (
                <span className="text-[11px] font-mono text-[#34d399] flex items-center gap-1 shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  {statusMessage}
                </span>
              )}
            </div>

            {/* JSON Preview */}
            {selectedFormat === 'json' && (
              <div className="bg-[#0b0d11] border border-[#22252e] rounded-md p-2.5 text-[11px] font-mono text-[#94a3b8] space-y-1">
                <div>Format: Ohm-E Circuit JSON v1.0</div>
                <div>
                  Payload: {nonJunctionCount} components · {wires.length} net segments · Timebase{' '}
                  {(timebase * 1000).toFixed(2)} ms/div · {voltsPerDiv} V/div
                </div>
              </div>
            )}

            {/* PDF Preview */}
            {selectedFormat === 'pdf' && (
              <div className="bg-[#0b0d11] border border-[#22252e] rounded-md p-2.5 text-[11px] font-mono text-[#94a3b8] space-y-1">
                <div>Sheet: A4 Landscape Vector Blueprint (842 x 595 pt)</div>
                <div>
                  Includes: Scaled orthogonal wires, labeled component blocks, title stamp, and BOM
                  table ({Math.min(8, nonJunctionCount)} indexed items).
                </div>
              </div>
            )}

            {/* PNG Preview */}
            {selectedFormat === 'png' && (
              <div className="bg-[#0b0d11] border border-[#22252e] rounded-md p-2.5 text-[11px] font-mono text-[#94a3b8] space-y-1">
                <div>Resolution: 2x Retina PNG raster from active schematic SVG</div>
                <div>
                  Framing: Auto-cropped to circuit bounds with blueprint grid background and title
                  footer.
                </div>
              </div>
            )}

            {/* Chip Package Configuration + Live DIP Pinout SVG */}
            {selectedFormat === 'chip' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-[#8b909f]">IC Package Footprint:</span>
                  <div className="flex items-center gap-1.5">
                    {(['DIP-8', 'DIP-16', 'DIP-20'] as const).map((pkg) => (
                      <button
                        key={pkg}
                        onClick={() => setChipPackageType(pkg)}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono border cursor-pointer transition-colors ${
                          chipPackageType === pkg
                            ? 'bg-[#1a2332] border-[#38bdf8] text-[#38bdf8]'
                            : 'bg-[#181a20] border-[#262933] text-[#8b909f] hover:text-white'
                        }`}
                      >
                        {pkg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0b0d11] border border-[#22252e] rounded-md p-3 flex flex-col sm:flex-row items-center gap-4">
                  <svg
                    viewBox={`0 0 320 ${chipSvgH}`}
                    className="w-full max-w-[260px] h-auto shrink-0"
                  >
                    <rect width="320" height={chipSvgH} rx="6" fill="#0d0f13" />
                    <rect
                      x="96"
                      y="14"
                      width="128"
                      height={chipBodyH}
                      rx="5"
                      fill="#181b22"
                      stroke="#3b4252"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M 148 14 A 12 12 0 0 0 172 14"
                      fill="#0d0f13"
                      stroke="#3b4252"
                      strokeWidth="1.5"
                    />
                    <circle cx="109" cy="28" r="3" fill="#64748b" />
                    <text
                      x="160"
                      y={14 + chipBodyH / 2 - 4}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontFamily="monospace"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {chipSpec.partNumber}
                    </text>
                    <text
                      x="160"
                      y={14 + chipBodyH / 2 + 12}
                      textAnchor="middle"
                      fill="#64748b"
                      fontFamily="monospace"
                      fontSize="9"
                    >
                      {chipSpec.packageType}
                    </text>
                    {Array.from({ length: chipHalf }, (_, i) => {
                      const py = 36 + i * chipPinSpacing;
                      const leftPin = chipSpec.pins[i];
                      const rightPin = chipSpec.pins[chipSpec.pinCount - 1 - i];
                      return (
                        <g key={i}>
                          <rect x="82" y={py - 4} width="14" height="8" rx="1" fill="#94a3b8" />
                          <text
                            x="104"
                            y={py + 3}
                            fill="#64748b"
                            fontFamily="monospace"
                            fontSize="9"
                          >
                            {leftPin.pinNumber}
                          </text>
                          <text
                            x="76"
                            y={py + 3}
                            textAnchor="end"
                            fill={leftPin.label === 'NC' ? '#475569' : '#38bdf8'}
                            fontFamily="monospace"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            {leftPin.label}
                          </text>

                          <rect x="224" y={py - 4} width="14" height="8" rx="1" fill="#94a3b8" />
                          <text
                            x="216"
                            y={py + 3}
                            textAnchor="end"
                            fill="#64748b"
                            fontFamily="monospace"
                            fontSize="9"
                          >
                            {rightPin.pinNumber}
                          </text>
                          <text
                            x="244"
                            y={py + 3}
                            textAnchor="start"
                            fill={rightPin.label === 'NC' ? '#475569' : '#34d399'}
                            fontFamily="monospace"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            {rightPin.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className="flex-1 text-[11px] font-mono text-[#94a3b8] space-y-1.5 w-full">
                    <div className="text-[#e2e8f0] font-semibold">Mapped External Pins</div>
                    <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1">
                      {chipSpec.pins
                        .filter((p) => p.label !== 'NC')
                        .map((p) => (
                          <div
                            key={p.pinNumber}
                            className="flex items-center justify-between text-[10px] border-b border-[#1c2028] py-0.5"
                          >
                            <span className="text-[#38bdf8]">
                              P{p.pinNumber} {p.label}
                            </span>
                            <span className="text-[#64748b] truncate max-w-[140px]">
                              {p.sourceComponent} ({p.sourcePin})
                            </span>
                          </div>
                        ))}
                    </div>
                    <button
                      onClick={() => {
                        try {
                          exportChipPinoutSvg(chipSpec);
                          flashStatus('Downloaded DIP pinout SVG');
                          onNotify?.(
                            'success',
                            'Exported chip pinout SVG',
                            `${chipSpec.packageType} diagram downloaded.`
                          );
                        } catch {
                          onNotify?.('error', 'Export failed', 'Unable to export chip pinout SVG.');
                        }
                      }}
                      className="mt-1 px-2.5 py-1 rounded bg-[#1a1d24] hover:bg-[#232730] border border-[#2d313b] text-[#cfd3dd] text-[10px] cursor-pointer"
                    >
                      Download Pinout Diagram (.svg)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PCB Layout Live Preview */}
            {selectedFormat === 'pcb' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#94a3b8]">
                  <span>
                    Board: {pcbLayout.widthMm} x {pcbLayout.heightMm} mm · 2-Layer FR4
                  </span>
                  <span>
                    {pcbLayout.footprints.length} footprints · {pcbLayout.traces.length} traces ·{' '}
                    {pcbLayout.vias.length} vias
                  </span>
                </div>

                <div className="bg-[#0b0d11] border border-[#22252e] rounded-md p-2 flex items-center justify-center overflow-auto max-h-56">
                  <svg
                    viewBox={`0 0 ${pcbSvgW} ${pcbSvgH}`}
                    className="w-full max-h-48 h-auto"
                  >
                    <rect width={pcbSvgW} height={pcbSvgH} fill="#0b0d11" />
                    <rect
                      x={pcbPad}
                      y={pcbPad}
                      width={pcbLayout.widthMm * pcbScale}
                      height={pcbLayout.heightMm * pcbScale}
                      rx="6"
                      fill="#0d291f"
                      stroke="#eab308"
                      strokeWidth="1.4"
                    />
                    {/* Mounting Holes */}
                    {[
                      [5, 5],
                      [pcbLayout.widthMm - 5, 5],
                      [5, pcbLayout.heightMm - 5],
                      [pcbLayout.widthMm - 5, pcbLayout.heightMm - 5],
                    ].map(([hx, hy], idx) => (
                      <g key={idx}>
                        <circle
                          cx={pcbPad + hx * pcbScale}
                          cy={pcbPad + hy * pcbScale}
                          r="7"
                          fill="#d97706"
                        />
                        <circle
                          cx={pcbPad + hx * pcbScale}
                          cy={pcbPad + hy * pcbScale}
                          r="4"
                          fill="#0b0d11"
                        />
                      </g>
                    ))}

                    {/* B.Cu Blue Traces */}
                    {pcbLayout.traces
                      .filter((t) => t.layer === 'B.Cu')
                      .map((tr, i) => (
                        <polyline
                          key={`b_${i}`}
                          points={tr.points
                            .map(
                              (p) =>
                                `${(pcbPad + p.x * pcbScale).toFixed(1)},${(
                                  pcbPad +
                                  p.y * pcbScale
                                ).toFixed(1)}`
                            )
                            .join(' ')}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.8"
                        />
                      ))}

                    {/* F.Cu Orange Traces */}
                    {pcbLayout.traces
                      .filter((t) => t.layer === 'F.Cu')
                      .map((tr, i) => (
                        <polyline
                          key={`f_${i}`}
                          points={tr.points
                            .map(
                              (p) =>
                                `${(pcbPad + p.x * pcbScale).toFixed(1)},${(
                                  pcbPad +
                                  p.y * pcbScale
                                ).toFixed(1)}`
                            )
                            .join(' ')}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                      ))}

                    {/* Vias */}
                    {pcbLayout.vias.map((v, i) => (
                      <g key={`v_${i}`}>
                        <circle
                          cx={pcbPad + v.x * pcbScale}
                          cy={pcbPad + v.y * pcbScale}
                          r="2.8"
                          fill="#facc15"
                        />
                        <circle
                          cx={pcbPad + v.x * pcbScale}
                          cy={pcbPad + v.y * pcbScale}
                          r="1.2"
                          fill="#0b0d11"
                        />
                      </g>
                    ))}

                    {/* Silkscreen & Pads */}
                    {pcbLayout.footprints.map((fp) => {
                      const fx = pcbPad + (fp.x - fp.width / 2) * pcbScale;
                      const fy = pcbPad + (fp.y - fp.height / 2) * pcbScale;
                      return (
                        <g key={fp.ref}>
                          <rect
                            x={fx}
                            y={fy}
                            width={fp.width * pcbScale}
                            height={fp.height * pcbScale}
                            rx="2"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            opacity="0.85"
                          />
                          <text
                            x={pcbPad + fp.x * pcbScale}
                            y={fy - 3}
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontFamily="monospace"
                            fontSize="8"
                            fontWeight="bold"
                          >
                            {fp.ref}
                          </text>
                          {fp.pads.map((p) => (
                            <g key={p.id}>
                              <circle
                                cx={pcbPad + p.absX * pcbScale}
                                cy={pcbPad + p.absY * pcbScale}
                                r={(p.size / 2) * pcbScale}
                                fill="#fbbf24"
                              />
                              <circle
                                cx={pcbPad + p.absX * pcbScale}
                                cy={pcbPad + p.absY * pcbScale}
                                r={(p.drill / 2) * pcbScale}
                                fill="#0b0d11"
                              />
                            </g>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#717684]">
                  <span>Layers: Orange = F.Cu · Cyan = B.Cu · Gold = ENIG Pads</span>
                  <button
                    onClick={() => {
                      try {
                        exportPcbArtworkSvg(pcbLayout);
                        flashStatus('Downloaded PCB artwork SVG');
                        onNotify?.('success', 'Exported PCB artwork SVG', `${exportData.name}_pcb.svg downloaded.`);
                      } catch {
                        onNotify?.('error', 'Export failed', 'Unable to export PCB artwork SVG.');
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-[#1a1d24] hover:bg-[#232730] border border-[#2d313b] text-[#cfd3dd] cursor-pointer"
                  >
                    Download PCB SVG
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#252831] bg-[#17191e] flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-[#20232a] hover:bg-[#282c35] border border-[#2d313b] text-[#cfd3dd] text-xs font-medium cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrimaryExport}
            disabled={isExporting}
            className="px-4 py-1.5 rounded-md bg-[#1a2b3c] hover:bg-[#22384f] active:bg-[#142230] border border-[#2b4c6f] text-[#38bdf8] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {isExporting ? 'Generating...' : `Export ${activeOption.label} (${activeOption.ext})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
