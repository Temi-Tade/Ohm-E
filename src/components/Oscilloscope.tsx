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
  Sliders,
  Sparkles,
  Crosshair,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { ScopeChannel, ScopeSample, CircuitComponent, Pin } from '../types/circuit';
import { formatVoltage } from './SchematicSymbols';

interface OscilloscopeProps {
  samples: ScopeSample[];
  channels: ScopeChannel[];
  components: CircuitComponent[];
  timebase: number; // seconds per division, e.g. 0.002 = 2ms/div
  onTimebaseChange: (val: number) => void;
  onUpdateChannel: (channelId: number, updates: Partial<ScopeChannel>) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onClearSamples: () => void;
  isSelectingProbeForChannel: number | null;
  onStartSelectProbe: (channelId: number) => void;
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
  samples,
  channels,
  components,
  timebase,
  onTimebaseChange,
  onUpdateChannel,
  isPaused,
  onTogglePause,
  onClearSamples,
  isSelectingProbeForChannel,
  onStartSelectProbe,
  onToggleSound,
  isMinimized = false,
  onToggleMinimize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'channels' | 'trigger' | 'cursors'>('channels');
  const [selectedChannelId, setSelectedChannelId] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<'screen' | 'knobs'>('screen');

  // Trigger settings
  const [triggerSource, setTriggerSource] = useState<number>(0);
  const [triggerLevel, setTriggerLevel] = useState<number>(0); // Volts
  const [triggerEdge, setTriggerEdge] = useState<'rising' | 'falling'>('rising');
  const [triggerMode, setTriggerMode] = useState<'auto' | 'norm'>('auto');

  // Cursors
  const [showCursors, setShowCursors] = useState<boolean>(false);
  const [cursorX1, setCursorX1] = useState<number>(0.25); // fraction of screen 0..1
  const [cursorX2, setCursorX2] = useState<number>(0.75);
  const [cursorY1, setCursorY1] = useState<number>(0.3);
  const [cursorY2, setCursorY2] = useState<number>(0.7);

  // Pin lookup for display
  const pinLookup = useMemo(() => {
    const map = new Map<string, { compName: string; pinName: string }>();
    for (const comp of components) {
      for (const pin of comp.pins) {
        map.set(pin.id, { compName: comp.name, pinName: pin.label || pin.name });
      }
    }
    return map;
  }, [components]);

  // Real-time measurements calculation
  const measurements = useMemo(() => {
    const activeCh = channels[selectedChannelId];
    if (!activeCh || !activeCh.enabled || samples.length < 5) {
      return { vpp: 0, vrms: 0, vmax: 0, vmin: 0, freq: 0, vavg: 0 };
    }

    const key = `v${selectedChannelId}` as keyof ScopeSample;
    const values: number[] = [];
    let sumSq = 0;
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;

    // Use recent samples within viewport
    const count = Math.min(samples.length, 600);
    const startIdx = samples.length - count;

    for (let i = startIdx; i < samples.length; i++) {
      const v = (samples[i][key] as number) ?? 0;
      values.push(v);
      sum += v;
      sumSq += v * v;
      if (v > max) max = v;
      if (v < min) min = v;
    }

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
    const freq = crossings > 1 && vpp > 0.1 ? (crossings / 2) / tSpan : 0;

    return {
      vpp: isFinite(vpp) ? vpp : 0,
      vrms: isFinite(rms) ? rms : 0,
      vmax: isFinite(max) ? max : 0,
      vmin: isFinite(min) ? min : 0,
      vavg: isFinite(avg) ? avg : 0,
      freq: isFinite(freq) ? freq : 0,
    };
  }, [samples, channels, selectedChannelId]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      // Dark CRT background with slight green/blue tint
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

      // Trigger line indicator if active
      if (channels[triggerSource]?.enabled) {
        const trigCh = channels[triggerSource];
        const trigY = midY - ((triggerLevel / trigCh.voltsPerDiv) + trigCh.offsetY) * dy;
        if (trigY >= 0 && trigY <= height) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
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
      }

      // Find trigger sample index for stabilization
      let startSampleIdx = 0;
      const totalTimeSpan = timebase * numDivsX;

      if (samples.length > 20) {
        const trigKey = `v${triggerSource}` as keyof ScopeSample;
        // Search backwards for edge trigger
        const searchRange = Math.min(samples.length - 2, 400);
        let foundTrig = false;

        for (let i = samples.length - 2; i >= samples.length - searchRange; i--) {
          const vPrev = (samples[i][trigKey] as number) ?? 0;
          const vNext = (samples[i + 1][trigKey] as number) ?? 0;
          const isEdge =
            triggerEdge === 'rising'
              ? vPrev < triggerLevel && vNext >= triggerLevel
              : vPrev > triggerLevel && vNext <= triggerLevel;

          if (isEdge) {
            startSampleIdx = i;
            foundTrig = true;
            break;
          }
        }

        if (!foundTrig && triggerMode === 'auto') {
          // Fallback to latest window
          startSampleIdx = Math.max(0, samples.length - 500);
        }
      }

      // Render channel waveforms
      channels.forEach((ch) => {
        if (!ch.enabled || !ch.pinId || samples.length < 2) return;

        const key = `v${ch.id}` as keyof ScopeSample;
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = ch.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();

        let hasMoved = false;
        const triggerTime = samples[startSampleIdx]?.time ?? 0;

        for (let i = startSampleIdx; i < samples.length; i++) {
          const s = samples[i];
          const rawV = (s[key] as number) ?? 0;
          const v = ch.coupling === 'ac' ? rawV - measurements.vavg : rawV;

          const dt = s.time - triggerTime;
          const screenX = (dt / totalTimeSpan) * width;
          if (screenX > width) break;

          // Convert volts to canvas Y
          // screen center is 0V + ch.offsetY
          const voltsPerPixel = ch.voltsPerDiv / dy;
          const screenY = midY - (v / voltsPerPixel) - ch.offsetY * dy;

          if (!hasMoved) {
            ctx.moveTo(screenX, screenY);
            hasMoved = true;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow
      });

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
        const dtCursor = Math.abs(cursorX2 - cursorX1) * totalTimeSpan;
        const activeCh = channels[selectedChannelId];
        const dvCursor = Math.abs(cursorY2 - cursorY1) * numDivsY * activeCh.voltsPerDiv;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(8, height - 34, 260, 26);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(8, height - 34, 260, 26);
        ctx.fillStyle = '#f472b6';
        ctx.font = '10px monospace';
        ctx.fillText(`Δt: ${(dtCursor * 1000).toFixed(2)}ms (${dtCursor > 0 ? (1 / dtCursor).toFixed(1) : 0}Hz)`, 16, height - 18);
        ctx.fillStyle = '#34d399';
        ctx.fillText(`ΔV: ${formatVoltage(dvCursor)}`, 160, height - 18);
      }
    };

    render();
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    samples,
    channels,
    timebase,
    triggerSource,
    triggerLevel,
    triggerEdge,
    triggerMode,
    showCursors,
    cursorX1,
    cursorX2,
    cursorY1,
    cursorY2,
    selectedChannelId,
    measurements,
  ]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  const activeChannel = channels[selectedChannelId];

  // If minimized on mobile or desktop, render sleek bottom status bar
  if (isMinimized) {
    return (
      <div
        onClick={onToggleMinimize}
        className="h-10 px-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 cursor-pointer hover:bg-slate-900 transition-colors select-none z-20 shrink-0"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Activity className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold text-slate-200 text-xs shrink-0">OSCILLOSCOPE</span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {channels.filter((c) => c.enabled && c.pinId).map((c) => (
              <span
                key={c.id}
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0"
                style={{ color: c.color }}
              >
                {c.name}: {formatVoltage(measurements.vpp)}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize?.();
          }}
          className="flex items-center gap-1 text-[11px] text-sky-400 font-bold bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded border border-sky-500/30 shrink-0"
        >
          <span>Open</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-slate-800 bg-slate-950/95 backdrop-blur-md flex flex-col transition-all duration-200 select-none z-20 shrink-0 ${
        isExpanded ? 'h-[380px] md:h-[440px]' : 'h-[240px] md:h-[260px]'
      }`}
    >
      {/* Top Header Controls Bar */}
      <div className="h-10 px-2 md:px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Minimize button */}
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              title="Minimize Oscilloscope"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1 font-bold text-sky-400">
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">OSCILLOSCOPE</span>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Run/Pause Button */}
          <button
            onClick={onTogglePause}
            className={`px-2 py-0.5 rounded flex items-center gap-1 font-semibold text-[11px] transition-colors cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'HOLD' : 'RUN'}</span>
          </button>

          <button
            onClick={onClearSamples}
            title="Clear buffer"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile View Toggle (Screen vs Knobs) */}
        <div className="flex md:hidden bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setMobileTab('screen')}
            className={`px-2 py-0.5 rounded font-bold transition-colors ${
              mobileTab === 'screen' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setMobileTab('knobs')}
            className={`px-2 py-0.5 rounded font-bold transition-colors ${
              mobileTab === 'knobs' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'
            }`}
          >
            Controls
          </button>
        </div>

        {/* Channel Quick Selector Badges (Desktop or larger mobile) */}
        <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar">
          {channels.map((ch) => {
            const probeInfo = ch.pinId ? pinLookup.get(ch.pinId) : null;
            const isSelected = selectedChannelId === ch.id;

            return (
              <div
                key={ch.id}
                onClick={() => setSelectedChannelId(ch.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer border text-[10px] transition-all shrink-0 ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/10 shadow-xs'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ch.enabled ? ch.color : '#475569' }}
                />
                <span className="font-bold" style={{ color: ch.enabled ? ch.color : '#94a3b8' }}>
                  {ch.name}
                </span>
                <span className="text-[9px] text-slate-400 max-w-[60px] truncate hidden md:inline">
                  {probeInfo ? `${probeInfo.compName}.${probeInfo.pinName}` : 'Unattached'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cursors toggle */}
          <button
            onClick={() => setShowCursors(!showCursors)}
            className={`px-1.5 py-0.5 rounded flex items-center gap-1 font-mono text-[10px] border transition-colors cursor-pointer ${
              showCursors
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/50'
                : 'border-slate-800 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">CURSORS</span>
          </button>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Scope Body: Canvas on Left, Instrument Knobs & Telemetry on Right */}
      <div className="flex-1 flex overflow-hidden">
        {/* CRT Display Area */}
        <div
          className={`${
            mobileTab === 'screen' ? 'flex' : 'hidden md:flex'
          } flex-1 relative bg-slate-950 p-1.5 md:p-2 flex-col overflow-hidden`}
        >
          <div className="flex-1 relative rounded border border-slate-800 overflow-hidden shadow-inner">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Probe Placement Prompt Overlay */}
            {isSelectingProbeForChannel !== null && (
              <div className="absolute inset-0 bg-sky-950/80 backdrop-blur-xs flex items-center justify-center p-2 pointer-events-none">
                <div className="bg-slate-900 border border-sky-400 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2.5 max-w-full">
                  <div
                    className="w-2.5 h-2.5 rounded-full animate-ping shrink-0"
                    style={{ backgroundColor: channels[isSelectingProbeForChannel].color }}
                  />
                  <div className="text-xs font-semibold text-sky-200 truncate">
                    Tap any pin or wire to attach {channels[isSelectingProbeForChannel].name}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Digital Telemetry HUD Bar under canvas */}
          <div className="h-6 mt-1 flex items-center justify-between px-2 text-[10px] sm:text-[11px] font-mono bg-slate-900/80 rounded border border-slate-800/80 text-slate-300 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-slate-400">
                CH{selectedChannelId + 1} Vpp: <strong className="text-white">{formatVoltage(measurements.vpp)}</strong>
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
          } w-full md:w-80 border-l border-slate-800 bg-slate-900/90 flex-col text-xs text-slate-300 overflow-hidden shrink-0`}
        >
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60">
            <button
              onClick={() => setActiveTab('channels')}
              className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'channels'
                  ? 'border-sky-500 text-sky-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              CHANNEL
            </button>
            <button
              onClick={() => setActiveTab('trigger')}
              className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'trigger'
                  ? 'border-amber-500 text-amber-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              TRIGGER
            </button>
            <button
              onClick={() => setActiveTab('cursors')}
              className={`flex-1 py-2 font-semibold text-center border-b-2 transition-colors ${
                activeTab === 'cursors'
                  ? 'border-pink-500 text-pink-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              TIMEBASE
            </button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            {activeTab === 'channels' && activeChannel && (
              <div className="space-y-3">
                {/* Channel Enable and Color Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: activeChannel.color }}
                    />
                    <span className="font-bold text-sm" style={{ color: activeChannel.color }}>
                      {activeChannel.name}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-slate-400">Active</span>
                    <input
                      type="checkbox"
                      checked={activeChannel.enabled}
                      onChange={(e) => onUpdateChannel(activeChannel.id, { enabled: e.target.checked })}
                      className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </label>
                </div>

                {/* Probe Attachment Button */}
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Probe Point:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onStartSelectProbe(activeChannel.id)}
                      className={`flex-1 py-1.5 px-2.5 rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border ${
                        isSelectingProbeForChannel === activeChannel.id
                          ? 'bg-sky-500 text-white border-sky-400 animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{isSelectingProbeForChannel === activeChannel.id ? 'Click Pin on Canvas...' : 'Attach Probe'}</span>
                    </button>
                    {activeChannel.pinId && (
                      <button
                        onClick={() => onUpdateChannel(activeChannel.id, { pinId: undefined })}
                        className="px-2 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 rounded border border-slate-700 text-xs"
                      >
                        Detach
                      </button>
                    )}
                  </div>
                </div>

                {/* Volts / Div Knob Selector */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Scale (Volts/Div):</span>
                    <span className="font-mono text-sky-400 font-bold">
                      {activeChannel.voltsPerDiv >= 1
                        ? `${activeChannel.voltsPerDiv}V`
                        : `${activeChannel.voltsPerDiv * 1000}mV`}
                      /div
                    </span>
                  </div>
                  <select
                    value={activeChannel.voltsPerDiv}
                    onChange={(e) => onUpdateChannel(activeChannel.id, { voltsPerDiv: parseFloat(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
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
                    <span className="text-slate-400">Position Offset (Div):</span>
                    <span className="font-mono text-slate-200">{activeChannel.offsetY.toFixed(1)} div</span>
                  </div>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.2"
                    value={activeChannel.offsetY}
                    onChange={(e) => onUpdateChannel(activeChannel.id, { offsetY: parseFloat(e.target.value) })}
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
                        onClick={() => onUpdateChannel(activeChannel.id, { coupling: coup })}
                        className={`py-1 rounded font-mono font-bold text-xs uppercase border transition-colors ${
                          activeChannel.coupling === coup
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

            {activeTab === 'trigger' && (
              <div className="space-y-3">
                <span className="font-bold text-amber-400 text-xs block">EDGE TRIGGERING</span>

                {/* Trigger Source */}
                <div className="space-y-1">
                  <span className="text-slate-400 text-[11px] block">Source:</span>
                  <div className="grid grid-cols-4 gap-1">
                    {channels.map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => setTriggerSource(ch.id)}
                        className={`py-1 rounded font-bold text-xs border transition-colors ${
                          triggerSource === ch.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                            : 'border-slate-800 bg-slate-800/60 text-slate-400'
                        }`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                </div>

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

            {activeTab === 'cursors' && (
              <div className="space-y-3">
                <span className="font-bold text-pink-400 text-xs block">HORIZONTAL TIMEBASE</span>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Time / Division:</span>
                    <span className="font-mono text-pink-400 font-bold">
                      {timebase >= 1 ? `${timebase} s` : timebase >= 0.001 ? `${timebase * 1000} ms` : `${timebase * 1e6} µs`}/div
                    </span>
                  </div>
                  <select
                    value={timebase}
                    onChange={(e) => onTimebaseChange(parseFloat(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
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
          </div>
        </div>
      </div>
    </div>
  );
};
