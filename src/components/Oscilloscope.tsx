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
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { ScopeSample, CircuitComponent, Wire } from '../types/circuit';
import { formatVoltage } from './SchematicSymbols';

interface OscilloscopeProps {
  isOpen?: boolean;
  onClose?: () => void;
  samples: ScopeSample[];
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

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  isOpen = true,
  onClose,
  samples,
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
  isMinimized = false,
  onToggleMinimize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'signal' | 'timebase' | 'trigger'>('signal');
  const [mobileTab, setMobileTab] = useState<'screen' | 'knobs'>('screen');

  // Trigger settings
  const [triggerLevel, setTriggerLevel] = useState<number>(0); // Volts
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling'>('rising');
  const [triggerMode, setTriggerMode] = useState<'auto' | 'norm'>('auto');

  // Cursors
  const [showCursors, setShowCursors] = useState<boolean>(false);
  const [cursorX1, setCursorX1] = useState<number>(0.25); // fraction of screen 0..1
  const [cursorX2, setCursorX2] = useState<number>(0.75);
  const [cursorY1, setCursorY1] = useState<number>(0.3);
  const [cursorY2, setCursorY2] = useState<number>(0.7);

  // Real-time measurements calculation from sample history
  const measurements = useMemo(() => {
    if (samples.length < 5) {
      return { vpp: 0, vrms: 0, vmax: 0, vmin: 0, freq: 0, vavg: 0, latest: 0 };
    }

    const values: number[] = [];
    let sumSq = 0;
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;

    // Use recent samples within viewport
    const count = Math.min(samples.length, 600);
    const startIdx = samples.length - count;

    for (let i = startIdx; i < samples.length; i++) {
      const v = (samples[i].v as number) ?? (samples[i].v0 as number) ?? 0;
      values.push(v);
      sum += v;
      sumSq += v * v;
      if (v > max) max = v;
      if (v < min) min = v;
    }

    const latest = values[values.length - 1] ?? 0;
    const avg = sum / values.length;
    const rms = Math.sqrt(sumSq / values.length);
    const vpp = max - min;

    // Frequency estimate via zero/mid crossings
    let crossings = 0;
    const mid = (max + min) / 2;
    for (let i = 1; i < values.length; i++) {
      if ((values[i - 1] < mid && values[i] >= mid) || (values[i - 1] > mid && values[i] <= mid)) {
        crossings++;
      }
    }
    const tSpan = (samples[samples.length - 1].time - samples[startIdx].time) || 0.001;
    const freq = crossings > 1 && vpp > 0.05 ? (crossings / 2) / tSpan : 0;

    return {
      vpp: isFinite(vpp) ? vpp : 0,
      vrms: isFinite(rms) ? rms : 0,
      vmax: isFinite(max) ? max : 0,
      vmin: isFinite(min) ? min : 0,
      vavg: isFinite(avg) ? avg : 0,
      freq: isFinite(freq) ? freq : 0,
      latest: isFinite(latest) ? latest : 0,
    };
  }, [samples]);

  // Auto-setup function (AUTOSET)
  const handleAutoSet = () => {
    if (samples.length < 5) return;

    if (measurements.vpp > 0.05) {
      // Scale voltsPerDiv such that waveform occupies ~4 vertical divisions
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
      // Display ~2 periods across 10 divisions
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

  // Main Canvas Rendering Loop
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

      // Dark CRT background with slight green/blue phosphor tint
      ctx.fillStyle = '#050b14';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid (10 horizontal divisions, 8 vertical divisions)
      const numDivsX = 10;
      const numDivsY = 8;
      const dx = width / numDivsX;
      const dy = height / numDivsY;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(30, 58, 95, 0.45)';

      ctx.beginPath();
      for (let i = 0; i <= numDivsX; i++) {
        const x = i * dx;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let j = 0; j <= numDivsY; j++) {
        const y = j * dy;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Major axes with tick marks
      const midX = width / 2;
      const midY = height / 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, height);
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Sub-divisions ticks along center axes
      const subTicks = 5;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.beginPath();
      for (let i = 0; i < numDivsX; i++) {
        for (let s = 1; s < subTicks; s++) {
          const x = i * dx + (s * dx) / subTicks;
          ctx.moveTo(x, midY - 3);
          ctx.lineTo(x, midY + 3);
        }
      }
      for (let j = 0; j < numDivsY; j++) {
        for (let s = 1; s < subTicks; s++) {
          const y = j * dy + (s * dy) / subTicks;
          ctx.moveTo(midX - 3, y);
          ctx.lineTo(midX + 3, y);
        }
      }
      ctx.stroke();

      // Trigger line indicator
      const trigY = midY - ((triggerLevel / voltsPerDiv) + offsetY) * dy;
      if (trigY >= 0 && trigY <= height) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, trigY);
        ctx.lineTo(width, trigY);
        ctx.stroke();
        ctx.setLineDash([]);
        // Trigger arrow icon
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(width - 12, trigY);
        ctx.lineTo(width, trigY - 5);
        ctx.lineTo(width, trigY + 5);
        ctx.fill();
      }

      // Calculate time window for rendering
      const totalTimeSpan = timebase * numDivsX;
      const N = samples.length;

      if (N >= 2) {
        const tLatest = samples[N - 1].time;
        let tStart = Math.max(0, tLatest - totalTimeSpan);

        // Edge triggering search to freeze repetitive waveform
        if (N > 15) {
          let foundTrigTime: number | null = null;
          const minTime = Math.max(0, tLatest - 2.5 * totalTimeSpan);
          const maxTime = tLatest - 0.2 * totalTimeSpan;

          let endSearchIdx = N - 2;
          while (endSearchIdx > 0 && samples[endSearchIdx].time > maxTime) {
            endSearchIdx--;
          }

          for (let i = endSearchIdx; i >= 1; i--) {
            if (samples[i].time < minTime) break;
            const vPrev = (samples[i - 1].v as number) ?? (samples[i - 1].v0 as number) ?? 0;
            const vCurr = (samples[i].v as number) ?? (samples[i].v0 as number) ?? 0;

            const isEdge =
              triggerEdge === 'rising'
                ? vPrev < triggerLevel && vCurr >= triggerLevel
                : vPrev > triggerLevel && vCurr <= triggerLevel;

            if (isEdge) {
              foundTrigTime = samples[i].time;
              break;
            }
          }

          if (foundTrigTime !== null) {
            tStart = foundTrigTime;
          }
        }

        // Render terminal voltage waveform (glowing cyan phosphor)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 5;
        ctx.beginPath();

        let hasMoved = false;
        const voltsPerPixel = voltsPerDiv / dy;

        for (let i = 0; i < N; i++) {
          const s = samples[i];
          if (s.time < tStart - timebase * 0.2) continue;

          const rawV = (s.v as number) ?? (s.v0 as number) ?? 0;
          const v = coupling === 'ac' ? rawV - (measurements.vavg || 0) : rawV;

          const dt = s.time - tStart;
          const screenX = (dt / totalTimeSpan) * width;
          if (screenX > width + 10) break;

          const screenY = midY - (v / voltsPerPixel) - offsetY * dy;
          const clampedY = Math.max(-10, Math.min(height + 10, screenY));

          if (!hasMoved) {
            ctx.moveTo(screenX, clampedY);
            hasMoved = true;
          } else {
            ctx.lineTo(screenX, clampedY);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset glow
      } else {
        // Helpful prompt if no samples yet
        ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Measuring Terminal Voltage', midX, midY - 8);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.font = '11px sans-serif';
        ctx.fillText('Select any component on the schematic to inspect its waveform', midX, midY + 12);
      }

      // Render Cursors if active
      if (showCursors) {
        // Vertical Time Cursors
        const x1 = cursorX1 * width;
        const x2 = cursorX2 * width;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.moveTo(x2, 0);
        ctx.lineTo(x2, height);
        ctx.stroke();

        // Horizontal Voltage Cursors
        const y1 = cursorY1 * height;
        const y2 = cursorY2 * height;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(width, y1);
        ctx.moveTo(0, y2);
        ctx.lineTo(width, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cursor readouts badge
        const totalTimeSpan = timebase * numDivsX;
        const dtCursor = Math.abs(cursorX2 - cursorX1) * totalTimeSpan;
        const dvCursor = Math.abs(cursorY2 - cursorY1) * numDivsY * voltsPerDiv;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(8, height - 34, 260, 26);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(8, height - 34, 260, 26);
        ctx.fillStyle = '#f472b6';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Δt: ${(dtCursor * 1000).toFixed(2)}ms (${dtCursor > 0 ? (1 / dtCursor).toFixed(1) : 0}Hz)`, 16, height - 18);
        ctx.fillStyle = '#34d399';
        ctx.fillText(`ΔV: ${formatVoltage(dvCursor)}`, 160, height - 18);
      }

      ctx.restore();
    };

    render();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    samples,
    timebase,
    voltsPerDiv,
    offsetY,
    coupling,
    triggerLevel,
    triggerEdge,
    triggerMode,
    showCursors,
    cursorX1,
    cursorX2,
    cursorY1,
    cursorY2,
    measurements,
    mobileTab,
    isExpanded,
  ]);

  // Target item title
  const targetLabel = selectedComponent
    ? selectedComponent.name
    : selectedWire
    ? 'Selected Wire'
    : 'Terminal Voltage';

  // Completely hide oscilloscope panel unless opened
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`border-t border-[#252831] bg-[#131519] flex flex-col transition-all duration-200 select-none z-20 shrink-0 ${
        isExpanded ? 'h-[380px] md:h-[440px]' : 'h-[240px] md:h-[260px]'
      }`}
    >
      {/* Top Header Controls Bar */}
      <div className="h-9 px-2 md:px-3 bg-[#16181d] border-b border-[#252831] flex items-center justify-between text-xs text-[#cfd3dd] shrink-0 gap-1.5 overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 shrink">
          <div className="flex items-center gap-1 font-semibold text-[#38bdf8] shrink min-w-0">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[#f0f2f6] font-mono text-[11px] truncate max-w-[110px] sm:max-w-[180px]">
              {targetLabel}
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#262832] mx-0.5 shrink-0" />

          {/* Run/Pause Button */}
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
            className="p-1 rounded hover:bg-[#22252e] text-[#8b909f] hover:text-[#dce0e8] transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Auto Setup Button */}
          <button
            onClick={handleAutoSet}
            title="Auto-scale volts and timebase to center waveform"
            className="px-2 py-0.5 rounded bg-[#1a2230] hover:bg-[#222e42] text-[#38bdf8] border border-[#26354a] text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Sparkles className="w-3 h-3" />
            <span>AUTO</span>
          </button>
        </div>

        {/* Mobile View Toggle (Screen vs Knobs) */}
        <div className="flex md:hidden bg-[#121317] p-0.5 rounded border border-[#252831] text-[10px] shrink-0">
          <button
            onClick={() => setMobileTab('screen')}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              mobileTab === 'screen' ? 'bg-[#242730] text-white border border-[#363a46]' : 'text-[#8b909f]'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setMobileTab('knobs')}
            className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
              mobileTab === 'knobs' ? 'bg-[#242730] text-white border border-[#363a46]' : 'text-[#8b909f]'
            }`}
          >
            Controls
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Cursors toggle */}
          <button
            onClick={() => setShowCursors(!showCursors)}
            title="Measurement Cursors"
            className={`p-1 rounded flex items-center justify-center font-mono text-[10px] border transition-colors cursor-pointer ${
              showCursors
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/50'
                : 'border-slate-800 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
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

      {/* Main Scope Body: Canvas on Left, Controls on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* CRT Display Area */}
        <div
          className={`${
            mobileTab === 'screen' ? 'flex' : 'hidden md:flex'
          } flex-1 relative bg-slate-950 p-1.5 md:p-2 flex-col overflow-hidden`}
        >
          <div ref={canvasContainerRef} className="flex-1 relative rounded border border-slate-800 overflow-hidden shadow-inner">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>

          {/* Live Digital Telemetry HUD Bar */}
          <div className="h-6 mt-1 flex items-center justify-between px-2 text-[10px] sm:text-[11px] font-mono bg-slate-900/80 rounded border border-slate-800/80 text-slate-300 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-slate-400">
                V: <strong className="text-[#38bdf8]">{formatVoltage(measurements.latest)}</strong>
              </span>
              <span className="text-slate-400">
                Vpp: <strong className="text-white">{formatVoltage(measurements.vpp)}</strong>
              </span>
              <span className="text-slate-400">
                Vrms: <strong className="text-white">{formatVoltage(measurements.vrms)}</strong>
              </span>
              <span className="text-slate-400 hidden sm:inline">
                Max: <strong className="text-emerald-400">{formatVoltage(measurements.vmax)}</strong>
              </span>
              <span className="text-slate-400">
                Freq: <strong className="text-sky-300">{measurements.freq > 0 ? `${measurements.freq.toFixed(1)}Hz` : '--'}</strong>
              </span>
            </div>
            <div className="text-slate-400 shrink-0 ml-2">
              TB: <span className="text-amber-400 font-bold">{timebase >= 1 ? `${timebase}s` : timebase >= 0.001 ? `${timebase * 1000}ms` : `${timebase * 1e6}µs`}/div</span>
            </div>
          </div>
        </div>

        {/* Instrument Control Panel */}
        <div
          className={`${
            mobileTab === 'knobs' ? 'flex' : 'hidden md:flex'
          } w-full md:w-72 lg:w-80 border-l border-slate-800 bg-slate-900/90 flex-col text-xs text-slate-300 overflow-hidden shrink-0`}
        >
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 shrink-0">
            <button
              onClick={() => setActiveTab('signal')}
              className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'signal'
                  ? 'border-sky-500 text-sky-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              VOLTS
            </button>
            <button
              onClick={() => setActiveTab('timebase')}
              className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'timebase'
                  ? 'border-pink-500 text-pink-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              TIME
            </button>
            <button
              onClick={() => setActiveTab('trigger')}
              className={`flex-1 py-1.5 text-[11px] font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                activeTab === 'trigger'
                  ? 'border-amber-500 text-amber-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              TRIG
            </button>
          </div>

          <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
            {activeTab === 'signal' && (
              <div className="space-y-2.5">
                {/* Target Information */}
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-1 overflow-hidden">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                    Target Component
                  </span>
                  <div className="font-semibold text-xs text-[#38bdf8] truncate">
                    {targetLabel}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Voltage:</span>
                    <span className="text-white font-bold">{formatVoltage(measurements.latest)}</span>
                  </div>
                </div>

                {/* Volts / Div Scale Selector */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] min-w-0">
                    <span className="text-slate-400 truncate">Scale:</span>
                    <span className="font-mono text-sky-400 font-bold shrink-0 ml-1">
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

                {/* Vertical Position Offset */}
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

                {/* Coupling (DC / AC) */}
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
                <span className="font-bold text-pink-400 text-[11px] block tracking-wide">TIMEBASE (X-AXIS)</span>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] min-w-0">
                    <span className="text-slate-400 truncate">Time / Div:</span>
                    <span className="font-mono text-pink-400 font-bold shrink-0 ml-1">
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

                {showCursors && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-pink-300">CURSOR POSITIONS</span>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Time X1 / X2:</span>
                        <span>
                          {(cursorX1 * 100).toFixed(0)}% / {(cursorX2 * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={cursorX1}
                        onChange={(e) => setCursorX1(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={cursorX2}
                        onChange={(e) => setCursorX2(parseFloat(e.target.value))}
                        className="w-full accent-pink-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trigger' && (
              <div className="space-y-3">
                <span className="font-bold text-amber-400 text-xs block">EDGE TRIGGERING</span>

                {/* Trigger Edge */}
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

                {/* Trigger Level */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Trigger Level:</span>
                    <span className="font-mono text-amber-400 font-bold">{triggerLevel.toFixed(2)} V</span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={triggerLevel}
                    onChange={(e) => setTriggerLevel(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Trigger Mode */}
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Mode:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTriggerMode('auto')}
                      className={`py-1 rounded font-bold text-xs border ${
                        triggerMode === 'auto'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'border-slate-800 bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      AUTO
                    </button>
                    <button
                      onClick={() => setTriggerMode('norm')}
                      className={`py-1 rounded font-bold text-xs border ${
                        triggerMode === 'norm'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'border-slate-800 bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      NORMAL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
