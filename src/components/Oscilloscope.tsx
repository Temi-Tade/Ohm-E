/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Crosshair,
  Sliders,
  X,
  Plus,
} from 'lucide-react';
import { ScopeSample, ScopeProbe, CircuitComponent, Wire } from '../types/circuit';
import { formatVoltage, formatCurrent } from './SchematicSymbols';

interface OscilloscopeProps {
  isOpen?: boolean;
  onClose?: () => void;
  samples: ScopeSample[];
  probes: ScopeProbe[];
  activeChannelIndex: number;
  onSelectChannel: (idx: number) => void;
  onRemoveProbe: (idx: number) => void;
  onAddCurrentSelectedProbe?: () => void;
  selectedComponent: CircuitComponent | null;
  selectedWire: Wire | null;
  timebase: number; // seconds per division, e.g. 0.002 = 2ms/div
  onTimebaseChange: (val: number) => void;
  voltsPerDiv: number;
  onVoltsPerDivChange: (val: number) => void;
  offsetY: number;
  onOffsetYChange: (val: number) => void;
  coupling: 'dc' | 'ac';
  onCouplingChange: (val: 'dc' | 'ac') => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onClearSamples: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showVoltage: boolean;
  showCurrent: boolean;
  onToggleVoltage: () => void;
  onToggleCurrent: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const TIMEBASE_OPTIONS = [
  { label: '50 µs', val: 0.00005 },
  { label: '100 µs', val: 0.0001 },
  { label: '500 µs', val: 0.0005 },
  { label: '1 ms', val: 0.001 },
  { label: '2 ms', val: 0.002 },
  { label: '5 ms', val: 0.005 },
  { label: '10 ms', val: 0.01 },
  { label: '20 ms', val: 0.02 },
  { label: '50 ms', val: 0.05 },
  { label: '100 ms', val: 0.1 },
  { label: '500 ms', val: 0.5 },
  { label: '1 s', val: 1.0 },
];

const VOLTS_PER_DIV_OPTIONS = [
  { label: '10 mV', val: 0.01 },
  { label: '50 mV', val: 0.05 },
  { label: '100 mV', val: 0.1 },
  { label: '500 mV', val: 0.5 },
  { label: '1 V', val: 1.0 },
  { label: '2 V', val: 2.0 },
  { label: '5 V', val: 5.0 },
  { label: '10 V', val: 10.0 },
  { label: '20 V', val: 20.0 },
];

const CHANNEL_DEFAULT_COLORS = ['#f97316', '#06b6d4', '#10b981']; // VoltSim Orange, Cyan, Green

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  isOpen = true,
  onClose,
  samples,
  probes = [],
  activeChannelIndex = 0,
  onSelectChannel,
  onRemoveProbe,
  onAddCurrentSelectedProbe,
  selectedComponent,
  selectedWire,
  timebase,
  onTimebaseChange,
  voltsPerDiv,
  onVoltsPerDivChange,
  offsetY,
  onOffsetYChange,
  coupling,
  onCouplingChange,
  isPaused,
  onTogglePause,
  onClearSamples,
  showVoltage = true,
  showCurrent = false,
  onToggleVoltage,
  onToggleCurrent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showControlsDrawer, setShowControlsDrawer] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'signal' | 'timebase' | 'trigger'>('signal');
  const [mobileTab, setMobileTab] = useState<'screen' | 'knobs'>('screen');

  // Trigger settings
  const [triggerLevel, setTriggerLevel] = useState<number>(0);
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling'>('rising');

  // Cursors
  const [showCursors, setShowCursors] = useState<boolean>(false);
  const [cursorX1, setCursorX1] = useState<number>(0.25);
  const [cursorX2, setCursorX2] = useState<number>(0.75);
  const [cursorY1, setCursorY1] = useState<number>(0.3);
  const [cursorY2, setCursorY2] = useState<number>(0.7);

  // Active channel probe
  const activeProbe = probes[activeChannelIndex] ?? probes[0] ?? null;
  const activeColor = activeProbe?.color || CHANNEL_DEFAULT_COLORS[activeChannelIndex] || '#f97316';

  // Measurements for active channel
  const measurements = useMemo(() => {
    if (samples.length < 5) {
      return { vpp: 0, vrms: 0, vmax: 0, vmin: 0, freq: 0, vavg: 0, latest: 0, imax: 0, imin: 0, irms: 0, ilatest: 0 };
    }

    const vKey = `v${activeChannelIndex}` as keyof ScopeSample;
    const iKey = `i${activeChannelIndex}` as keyof ScopeSample;

    const vValues: number[] = [];
    const iValues: number[] = [];
    let sumSqV = 0;
    let sumV = 0;
    let maxV = -Infinity;
    let minV = Infinity;

    let sumSqI = 0;
    let maxI = -Infinity;
    let minI = Infinity;

    const count = Math.min(samples.length, 600);
    const startIdx = samples.length - count;

    for (let i = startIdx; i < samples.length; i++) {
      const s = samples[i];
      const v = (s[vKey] as number) ?? (s.v0 as number) ?? (s.v as number) ?? 0;
      const iVal = (s[iKey] as number) ?? (s.i0 as number) ?? 0;

      vValues.push(v);
      sumV += v;
      sumSqV += v * v;
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;

      iValues.push(iVal);
      sumSqI += iVal * iVal;
      if (iVal > maxI) maxI = iVal;
      if (iVal < minI) minI = iVal;
    }

    const latestV = vValues[vValues.length - 1] ?? 0;
    const latestI = iValues[iValues.length - 1] ?? 0;
    const avgV = sumV / vValues.length;
    const rmsV = Math.sqrt(sumSqV / vValues.length);
    const rmsI = Math.sqrt(sumSqI / iValues.length);
    const vpp = maxV - minV;

    // Intelligent frequency estimation using midpoint crossing
    let crossings = 0;
    const mid = (maxV + minV) / 2;
    for (let i = 1; i < vValues.length; i++) {
      if ((vValues[i - 1] < mid && vValues[i] >= mid) || (vValues[i - 1] > mid && vValues[i] <= mid)) {
        crossings++;
      }
    }
    const tSpan = (samples[samples.length - 1].time - samples[startIdx].time) || 0.001;
    const freq = crossings > 1 && vpp > 0.05 ? (crossings / 2) / tSpan : 0;

    return {
      vpp: isFinite(vpp) ? vpp : 0,
      vrms: isFinite(rmsV) ? rmsV : 0,
      vmax: isFinite(maxV) ? maxV : 0,
      vmin: isFinite(minV) ? minV : 0,
      vavg: isFinite(avgV) ? avgV : 0,
      freq: isFinite(freq) ? freq : 0,
      latest: isFinite(latestV) ? latestV : 0,
      imax: isFinite(maxI) ? maxI : 0,
      imin: isFinite(minI) ? minI : 0,
      irms: isFinite(rmsI) ? rmsI : 0,
      ilatest: isFinite(latestI) ? latestI : 0,
    };
  }, [samples, activeChannelIndex]);

  // Auto-setup function (AUTOSET)
  const handleAutoSet = () => {
    if (samples.length < 5) return;

    if (measurements.vpp > 0.05) {
      const targetVdiv = measurements.vpp / 4;
      let bestVdiv = VOLTS_PER_DIV_OPTIONS[0].val;
      let minDiff = Math.abs(bestVdiv - targetVdiv);
      for (const opt of VOLTS_PER_DIV_OPTIONS) {
        const diff = Math.abs(opt.val - targetVdiv);
        if (diff < minDiff) {
          minDiff = diff;
          bestVdiv = opt.val;
        }
      }
      onVoltsPerDivChange(bestVdiv);
      onOffsetYChange(0);
    }

    if (measurements.freq > 0.1) {
      const period = 1 / measurements.freq;
      const targetTimebase = (period * 2) / 10;
      let bestTb = TIMEBASE_OPTIONS[0].val;
      let minDiff = Math.abs(bestTb - targetTimebase);
      for (const opt of TIMEBASE_OPTIONS) {
        const diff = Math.abs(opt.val - targetTimebase);
        if (diff < minDiff) {
          minDiff = diff;
          bestTb = opt.val;
        }
      }
      onTimebaseChange(bestTb);
    }
  };

  // Main Canvas Rendering Loop (VoltSim Aesthetics)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const container = canvasContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width <= 0 || height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Dark oscilloscope CRT background
      ctx.fillStyle = '#060a10';
      ctx.fillRect(0, 0, width, height);

      // Left gutter for scale values
      const leftMargin = 38;
      const gridWidth = width - leftMargin;

      // Draw Grid (10 horizontal divisions, 8 vertical divisions)
      const numDivsX = 10;
      const numDivsY = 8;
      const dx = gridWidth / numDivsX;
      const dy = height / numDivsY;

      // Subtle grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(26, 46, 74, 0.45)';

      ctx.beginPath();
      for (let i = 0; i <= numDivsX; i++) {
        const x = leftMargin + i * dx;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let j = 0; j <= numDivsY; j++) {
        const y = j * dy;
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Major axes with tick marks
      const midX = leftMargin + gridWidth / 2;
      const midY = height / 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, height);
      ctx.moveTo(leftMargin, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Sub-division ticks along center axes
      const subTicks = 5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      for (let i = 0; i < numDivsX; i++) {
        for (let s = 1; s < subTicks; s++) {
          const x = leftMargin + i * dx + (s * dx) / subTicks;
          ctx.moveTo(x, midY - 2.5);
          ctx.lineTo(x, midY + 2.5);
        }
      }
      for (let j = 0; j < numDivsY; j++) {
        for (let s = 1; s < subTicks; s++) {
          const y = j * dy + (s * dy) / subTicks;
          ctx.moveTo(midX - 2.5, y);
          ctx.lineTo(midX + 2.5, y);
        }
      }
      ctx.stroke();

      // VoltSim-Style Left Scale Numbers
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let j = 0; j <= numDivsY; j++) {
        const y = j * dy;
        const divOffsetFromCenter = (numDivsY / 2 - j);
        const vVal = divOffsetFromCenter * voltsPerDiv;
        ctx.fillStyle = j === numDivsY / 2 ? '#94a3b8' : '#475569';
        const label = vVal === 0 ? '0' : formatVoltage(vVal);
        ctx.fillText(label, leftMargin - 4, y);
      }

      // Calculate time window for rendering
      const totalTimeSpan = timebase * numDivsX;
      const N = samples.length;

      if (N >= 2) {
        const tLatest = samples[N - 1].time;
        let tStart = Math.max(0, tLatest - totalTimeSpan);

        // Intelligent Edge Triggering:
        // Automatically calculate midpoint of the active channel to lock both AC and DC-offset signals (e.g. rectifier ripple)
        if (N > 15) {
          const effectiveTrigLevel =
            Math.abs(triggerLevel) > 0.05
              ? triggerLevel
              : (measurements.vmax + measurements.vmin) / 2;

          let foundTrigTime: number | null = null;
          const minTime = Math.max(0, tLatest - 2.5 * totalTimeSpan);
          const maxTime = tLatest - 0.2 * totalTimeSpan;

          let endSearchIdx = N - 2;
          while (endSearchIdx > 0 && samples[endSearchIdx].time > maxTime) {
            endSearchIdx--;
          }

          const activeVKey = `v${activeChannelIndex}` as keyof ScopeSample;
          for (let i = endSearchIdx; i >= 1; i--) {
            if (samples[i].time < minTime) break;
            const vPrev = (samples[i - 1][activeVKey] as number) ?? (samples[i - 1].v0 as number) ?? 0;
            const vCurr = (samples[i][activeVKey] as number) ?? (samples[i].v0 as number) ?? 0;

            const isEdge =
              triggerEdge === 'rising'
                ? vPrev < effectiveTrigLevel && vCurr >= effectiveTrigLevel
                : vPrev > effectiveTrigLevel && vCurr <= effectiveTrigLevel;

            if (isEdge) {
              foundTrigTime = samples[i].time;
              break;
            }
          }

          if (foundTrigTime !== null) {
            tStart = foundTrigTime;
          }
        }

        const voltsPerPixel = voltsPerDiv / dy;
        const currentScalePerPixel = (voltsPerDiv * 0.01) / dy; // 10mA equivalent per Volt div

        // Render each active probed channel (up to 3)
        const channelsToRender =
          probes.length > 0
            ? probes
            : [
                {
                  id: 'default',
                  targetId: 'default',
                  type: 'component' as const,
                  name: 'Signal',
                  color: CHANNEL_DEFAULT_COLORS[0],
                  channelIndex: 0,
                },
              ];

        const isMultiProbe = channelsToRender.length > 1;

        channelsToRender.forEach((probe, pIdx) => {
          const chIdx = probe.channelIndex ?? pIdx;
          const color =
            probe.color || CHANNEL_DEFAULT_COLORS[chIdx % CHANNEL_DEFAULT_COLORS.length];
          const vKey = `v${chIdx}` as keyof ScopeSample;
          const iKey = `i${chIdx}` as keyof ScopeSample;

          let lastX = 0;
          let lastY = 0;

          // 1. Render Voltage Trace
          if (showVoltage) {
            ctx.strokeStyle = color;
            ctx.lineWidth = chIdx === activeChannelIndex ? 2.4 : 1.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = color;
            ctx.shadowBlur = chIdx === activeChannelIndex ? 6 : 3;
            ctx.setLineDash([]);
            ctx.beginPath();

            let hasMoved = false;
            for (let i = 0; i < N; i++) {
              const s = samples[i];
              if (s.time < tStart - timebase * 0.1) continue;

              const rawV = (s[vKey] as number) ?? (chIdx === 0 ? s.v0 ?? s.v ?? 0 : 0);
              const v = coupling === 'ac' ? rawV - (measurements.vavg || 0) : rawV;

              const dt = s.time - tStart;
              const screenX = leftMargin + (dt / totalTimeSpan) * gridWidth;
              if (screenX > width + 10) break;

              const screenY = midY - (v / voltsPerPixel) - offsetY * dy;
              const clampedY = Math.max(2, Math.min(height - 2, screenY));

              if (!hasMoved) {
                ctx.moveTo(screenX, clampedY);
                hasMoved = true;
              } else {
                ctx.lineTo(screenX, clampedY);
              }
              lastX = screenX;
              lastY = clampedY;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Terminal cursor point on right edge (VoltSim style)
            if (hasMoved && lastX >= leftMargin) {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(Math.min(width - 4, lastX), lastY, 3.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 2. Render Current Trace
          if (showCurrent) {
            const isBothSingle = !isMultiProbe && showVoltage;
            const currentColor = isBothSingle ? '#fbbf24' : color;

            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = currentColor;
            ctx.shadowBlur = 4;
            if (isBothSingle) {
              ctx.setLineDash([4, 3]); // Dashed line for current when showing both
            } else {
              ctx.setLineDash([]);
            }
            ctx.beginPath();

            let hasMoved = false;
            let lastIX = 0;
            let lastIY = 0;

            for (let i = 0; i < N; i++) {
              const s = samples[i];
              if (s.time < tStart - timebase * 0.1) continue;

              const rawI = (s[iKey] as number) ?? 0;
              const dt = s.time - tStart;
              const screenX = leftMargin + (dt / totalTimeSpan) * gridWidth;
              if (screenX > width + 10) break;

              const screenY = midY - (rawI / currentScalePerPixel) - offsetY * dy;
              const clampedY = Math.max(2, Math.min(height - 2, screenY));

              if (!hasMoved) {
                ctx.moveTo(screenX, clampedY);
                hasMoved = true;
              } else {
                ctx.lineTo(screenX, clampedY);
              }
              lastIX = screenX;
              lastIY = clampedY;
            }
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;

            if (hasMoved && lastIX >= leftMargin) {
              ctx.fillStyle = currentColor;
              ctx.beginPath();
              ctx.arc(Math.min(width - 4, lastIX), lastIY, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      } else {
        // Prompt if no samples
        ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Oscilloscope Measuring Signal', midX, midY - 8);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.font = '11px sans-serif';
        ctx.fillText('Select any component or wire to inspect its voltage & current', midX, midY + 12);
      }

      // VoltSim bottom-right timebase badge: e.g. "2 ms/div"
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      const tbText = `${timebase >= 1 ? `${timebase}s` : timebase >= 0.001 ? `${timebase * 1000} ms` : `${timebase * 1e6} µs`}/div`;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      const textMetrics = ctx.measureText(tbText);
      const badgeW = textMetrics.width + 12;
      const badgeH = 18;
      const badgeX = width - badgeW - 6;
      const badgeY = height - badgeH - 6;

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(tbText, width - 12, height - 13);

      // Render Cursors if active
      if (showCursors) {
        const x1 = leftMargin + cursorX1 * gridWidth;
        const x2 = leftMargin + cursorX2 * gridWidth;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.moveTo(x2, 0);
        ctx.lineTo(x2, height);
        ctx.stroke();

        const y1 = cursorY1 * height;
        const y2 = cursorY2 * height;
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
        ctx.beginPath();
        ctx.moveTo(leftMargin, y1);
        ctx.lineTo(width, y1);
        ctx.moveTo(leftMargin, y2);
        ctx.lineTo(width, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    };

    render();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    samples,
    probes,
    activeChannelIndex,
    showVoltage,
    showCurrent,
    timebase,
    voltsPerDiv,
    offsetY,
    coupling,
    triggerLevel,
    triggerEdge,
    showCursors,
    cursorX1,
    cursorX2,
    cursorY1,
    cursorY2,
    measurements,
  ]);

  if (!isOpen) {
    return null;
  }

  const selectedName = selectedComponent?.name || (selectedWire ? 'Selected Wire' : null);
  const isSelectedAlreadyProbed = selectedComponent
    ? probes.some((p) => p.id === selectedComponent.id)
    : selectedWire
    ? probes.some((p) => p.id === selectedWire.id)
    : false;

  return (
    <div
      className={`border-t border-[#252831] bg-[#121418] flex flex-col transition-all duration-200 select-none z-30 shrink-0 ${
        isExpanded ? 'h-[400px] md:h-[460px]' : 'h-[285px] md:h-[310px]'
      }`}
    >
      {/* Top Header Controls Bar */}
      <div className="h-9 px-2 md:px-3 bg-[#15171c] border-b border-[#252831] flex items-center justify-between text-xs text-[#cfd3dd] shrink-0 gap-1.5 overflow-hidden">
        {/* Left: Scope title and V / I toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 font-semibold text-[#f97316]">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[#94a3b8] text-[11px] font-mono uppercase tracking-wider hidden sm:inline">
              Scope
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#262832] mx-0.5" />

          {/* Clean V and I Toggles */}
          <div className="flex items-center bg-[#181a20] p-0.5 rounded-lg border border-[#2a2e38] text-[11px] font-mono font-bold shrink-0">
            <button
              onClick={onToggleVoltage}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                showVoltage
                  ? 'bg-[#293242] text-[#38bdf8] border border-[#38bdf8]/40 shadow-sm'
                  : 'text-[#8b909f] hover:text-white'
              }`}
              title={probes.length > 1 ? 'Show Voltage across all probed channels' : 'Toggle Voltage (V)'}
            >
              V
            </button>
            <button
              onClick={onToggleCurrent}
              className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${
                showCurrent
                  ? 'bg-[#3b2b1b] text-[#fbbf24] border border-[#f59e0b]/40 shadow-sm'
                  : 'text-[#8b909f] hover:text-white'
              }`}
              title={probes.length > 1 ? 'Show Current across all probed channels' : 'Toggle Current (I)'}
            >
              I
            </button>
          </div>
        </div>

        {/* Right Header Utility Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Pause / Run */}
          <button
            onClick={onTogglePause}
            className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium text-[10px] transition-colors cursor-pointer border shrink-0 ${
              isPaused
                ? 'bg-[#241f17] text-[#fbbf24] border-[#d97706]/40 hover:bg-[#2c2419]'
                : 'bg-[#17231c] text-[#34d399] border-[#059669]/40 hover:bg-[#1d2d23]'
            }`}
            title={isPaused ? 'Resume trace' : 'Hold trace'}
          >
            {isPaused ? <Play className="w-2.5 h-2.5" /> : <Pause className="w-2.5 h-2.5" />}
            <span>{isPaused ? 'HOLD' : 'RUN'}</span>
          </button>

          <button
            onClick={onClearSamples}
            title="Clear waveform buffer"
            className="p-1 rounded hover:bg-[#22252e] text-[#8b909f] hover:text-[#dce0e8] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Auto Setup Button */}
          <button
            onClick={handleAutoSet}
            title="Auto-scale volts and timebase to center waveform"
            className="px-2 py-0.5 rounded bg-[#1a2230] hover:bg-[#222e42] text-[#38bdf8] border border-[#26354a] text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>AUTO</span>
          </button>

          {/* Controls Settings Toggle */}
          <button
            onClick={() => setShowControlsDrawer(!showControlsDrawer)}
            title="Adjust Timebase & Scale"
            className={`p-1 rounded flex items-center justify-center border transition-colors cursor-pointer ${
              showControlsDrawer
                ? 'bg-[#293242] text-[#38bdf8] border-[#38bdf8]/40'
                : 'border-[#2a2e38] hover:bg-[#22252e] text-[#8b909f]'
            }`}
          >
            <Sliders className="w-3 h-3" />
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse size' : 'Expand size'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Panel Button */}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Oscilloscope"
              className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Channel Probes Bar (Second Row: Completely visible on next line) */}
      <div className="h-7.5 px-2 md:px-3 bg-[#111317] border-b border-[#21242c] flex items-center justify-between text-xs text-[#cfd3dd] shrink-0 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] uppercase font-mono text-[#64748b] tracking-wider shrink-0 font-semibold">
            Channels ({probes.length}/3):
          </span>
          {probes.map((probe, idx) => {
            const isActive = idx === activeChannelIndex;
            return (
              <div
                key={probe.id + idx}
                onClick={() => onSelectChannel(idx)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1b222d] text-white shadow-sm ring-1 ring-sky-500/20'
                    : 'bg-[#15171e] text-[#8b909f] hover:text-[#dce0e8] hover:bg-[#1a1e27]'
                }`}
                style={{
                  borderColor: isActive ? probe.color : '#252932',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: probe.color, boxShadow: `0 0 6px ${probe.color}` }}
                />
                <span className="font-semibold text-[10px] text-slate-400">CH{idx + 1}:</span>
                <span className="truncate max-w-[100px] sm:max-w-[160px] font-medium text-[#f1f5f9]">
                  {probe.name}
                </span>
                {probes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveProbe(idx);
                    }}
                    title={`Remove ${probe.name} from Scope`}
                    className="hover:text-rose-400 p-0.5 rounded text-[#64748b] transition-colors ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <span className="text-[10px] text-[#64748b] hidden md:inline shrink-0 font-mono">
          Click any canvas component to probe (max 3)
        </span>
      </div>

      {/* Main Scope Body: Canvas + Live VoltSim HUD Bar */}
      <div className="flex-1 flex overflow-hidden">
        {/* CRT Display Area */}
        <div className="flex-1 relative bg-slate-950 p-1 md:p-1.5 flex flex-col overflow-hidden">
          <div
            ref={canvasContainerRef}
            className="flex-1 relative rounded border border-slate-800/80 overflow-hidden shadow-inner"
          >
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>

          {/* VoltSim-Style Measurement Bar (Clean Pills) */}
          <div className="h-8 mt-1 flex items-center justify-between px-2 text-[10px] sm:text-[11px] font-mono bg-[#14161b] rounded-lg border border-[#242832] text-slate-300 overflow-x-auto no-scrollbar shrink-0 gap-2">
            <div className="flex items-center gap-2 shrink-0">
              {/* Channel badge pill */}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded border font-semibold text-[10px]"
                style={{
                  backgroundColor: `${activeColor}15`,
                  borderColor: `${activeColor}40`,
                  color: activeColor,
                }}
              >
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: activeColor }} />
                <span>{activeProbe?.name || 'Channel 1'}</span>
              </div>

              {/* VoltSim Max Pill */}
              <div className="flex items-center gap-1 bg-[#1a1d24] px-2 py-0.5 rounded border border-[#282c36]">
                <span className="text-[#8b909f] font-sans text-[10px]">Max</span>
                <span className="font-bold text-[#e2e8f0]">
                  {showCurrent && !showVoltage
                    ? formatCurrent(measurements.imax)
                    : formatVoltage(measurements.vmax)}
                </span>
              </div>

              {/* VoltSim Min Pill */}
              <div className="flex items-center gap-1 bg-[#1a1d24] px-2 py-0.5 rounded border border-[#282c36]">
                <span className="text-[#8b909f] font-sans text-[10px]">Min</span>
                <span className="font-bold text-[#e2e8f0]">
                  {showCurrent && !showVoltage
                    ? formatCurrent(measurements.imin)
                    : formatVoltage(measurements.vmin)}
                </span>
              </div>

              {/* VoltSim Freq Pill */}
              <div className="flex items-center gap-1 bg-[#1a1d24] px-2 py-0.5 rounded border border-[#282c36]">
                <span className="text-[#8b909f] font-sans text-[10px]">Freq</span>
                <span className="font-bold text-sky-400">
                  {measurements.freq > 0 ? `${measurements.freq.toFixed(1)} Hz` : '--'}
                </span>
              </div>

              {/* VoltSim RMS Pill */}
              <div className="flex items-center gap-1 bg-[#1a1d24] px-2 py-0.5 rounded border border-[#282c36]">
                <span className="text-[#8b909f] font-sans text-[10px]">RMS</span>
                <span className="font-bold text-amber-400">
                  {showCurrent && !showVoltage
                    ? formatCurrent(measurements.irms)
                    : formatVoltage(measurements.vrms)}
                </span>
              </div>
            </div>

            {/* Quick Timebase / Volts indicator */}
            <div className="text-[10px] text-[#8b909f] shrink-0 font-medium">
              <span>{voltsPerDiv >= 1 ? `${voltsPerDiv}V` : `${voltsPerDiv * 1000}mV`}/div</span>
              <span className="mx-1">•</span>
              <span>{timebase >= 1 ? `${timebase}s` : timebase >= 0.001 ? `${timebase * 1000}ms` : `${timebase * 1e6}µs`}/div</span>
            </div>
          </div>
        </div>

        {/* Slide-out Instrument Controls Drawer */}
        {showControlsDrawer && (
          <div className="w-64 md:w-72 border-l border-slate-800 bg-[#14171d] flex flex-col text-xs text-slate-300 overflow-hidden shrink-0">
            {/* Control Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/80 shrink-0">
              <button
                onClick={() => setActiveTab('signal')}
                className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'signal'
                    ? 'border-sky-500 text-sky-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                VOLTS
              </button>
              <button
                onClick={() => setActiveTab('timebase')}
                className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'timebase'
                    ? 'border-pink-500 text-pink-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                TIME
              </button>
              <button
                onClick={() => setActiveTab('trigger')}
                className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'trigger'
                    ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                TRIG
              </button>
            </div>

            <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
              {activeTab === 'signal' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Volts / Div:</span>
                      <span className="font-mono text-sky-400 font-bold">
                        {voltsPerDiv >= 1 ? `${voltsPerDiv}V` : `${voltsPerDiv * 1000}mV`} / div
                      </span>
                    </div>
                    <select
                      value={voltsPerDiv}
                      onChange={(e) => onVoltsPerDivChange(parseFloat(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    >
                      {VOLTS_PER_DIV_OPTIONS.map((opt) => (
                        <option key={opt.val} value={opt.val}>
                          {opt.label} / div
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Vertical Offset:</span>
                      <span className="font-mono text-slate-200">{offsetY.toFixed(1)} div</span>
                    </div>
                    <input
                      type="range"
                      min="-4"
                      max="4"
                      step="0.2"
                      value={offsetY}
                      onChange={(e) => onOffsetYChange(parseFloat(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">Coupling:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(['dc', 'ac'] as const).map((coup) => (
                        <button
                          key={coup}
                          onClick={() => onCouplingChange(coup)}
                          className={`py-1 rounded font-mono font-bold text-xs uppercase border transition-colors ${
                            coupling === coup
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                              : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {coup}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timebase' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Time / Div:</span>
                      <span className="font-mono text-pink-400 font-bold">
                        {timebase >= 1 ? `${timebase}s` : timebase >= 0.001 ? `${timebase * 1000}ms` : `${timebase * 1e6}µs`}/div
                      </span>
                    </div>
                    <select
                      value={timebase}
                      onChange={(e) => onTimebaseChange(parseFloat(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                    >
                      {TIMEBASE_OPTIONS.map((opt) => (
                        <option key={opt.val} value={opt.val}>
                          {opt.label} / div
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'trigger' && (
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px] block">Slope Edge:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTriggerEdge('rising')}
                        className={`py-1 rounded font-bold text-xs border ${
                          triggerEdge === 'rising'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400'
                        }`}
                      >
                        ▲ Rising
                      </button>
                      <button
                        onClick={() => setTriggerEdge('falling')}
                        className={`py-1 rounded font-bold text-xs border ${
                          triggerEdge === 'falling'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400'
                        }`}
                      >
                        ▼ Falling
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
