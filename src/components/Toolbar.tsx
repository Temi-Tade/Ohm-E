/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Download,
  Upload,
  Trash2,
  BookOpen,
  Volume2,
  VolumeX,
  ChevronDown,
  MoreHorizontal,
  Undo2,
  Redo2,
} from 'lucide-react';
import { CircuitPreset } from '../engine/presetCircuits';

interface ToolbarProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStepOnce: () => void;
  onReset: () => void;
  onClearCanvas: () => void;
  simSpeed: number;
  onSpeedChange: (speed: number) => void;
  flowMode: 'conventional' | 'electron' | 'none';
  onToggleFlowMode: () => void;
  showVoltColors: boolean;
  onToggleVoltColors: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  presets: CircuitPreset[];
  onLoadPreset: (preset: CircuitPreset) => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onOpenHelp: () => void;
  onOpenMobilePalette?: () => void;
  isScopeOpen?: boolean;
  onToggleScope?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isRunning,
  onToggleRun,
  onStepOnce,
  onReset,
  onClearCanvas,
  simSpeed,
  onSpeedChange,
  flowMode,
  onToggleFlowMode,
  showVoltColors,
  onToggleVoltColors,
  soundEnabled,
  onToggleSound,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  presets,
  onLoadPreset,
  onExportJson,
  onImportJson,
  onOpenHelp,
}) => {
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  return (
    <header className="h-12 sm:h-13 bg-zinc-950 border-b border-zinc-800/80 px-2 sm:px-3 md:px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand & Wordmark */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          {/* Authentic Ohm (Ω) vector mark */}
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4.5a3.5 3.5 0 0 0 3-1.8 7 7 0 1 1 5 0 3.5 3.5 0 0 0 3 1.8H20" />
          </svg>
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="font-bold text-sm tracking-tight text-zinc-100">Ohm-E</span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">Circuit Workbench</span>
        </div>
      </div>

      {/* Center Controls (Desktop) */}
      <div className="hidden lg:flex items-center gap-1.5">
        {/* Play/Pause */}
        <button
          onClick={onToggleRun}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 font-medium text-xs transition-colors cursor-pointer border ${
            isRunning
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}
          title={isRunning ? 'Pause simulation' : 'Run simulation'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isRunning ? 'Pause' : 'Run'}</span>
        </button>

        {/* Step */}
        <button
          onClick={onStepOnce}
          disabled={isRunning}
          title="Single step forward"
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5" />
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          title="Reset circuit time and states"
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Speed Selector */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs">
          <span className="text-zinc-500 text-[10px]">Speed:</span>
          {[0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                Math.abs(simSpeed - s) < 0.05
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Current Flow mode */}
        <button
          onClick={onToggleFlowMode}
          title="Toggle current particles: Conventional / Electron / Off"
          className="px-2.5 py-1.5 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              flowMode === 'conventional'
                ? 'bg-amber-400'
                : flowMode === 'electron'
                ? 'bg-sky-400'
                : 'bg-zinc-600'
            }`}
          />
          <span className="text-[11px] capitalize">{flowMode} Flow</span>
        </button>

        {/* Volt Colors */}
        <button
          onClick={onToggleVoltColors}
          title="Color wires by electric potential (voltage)"
          className={`px-2.5 py-1.5 rounded border text-[11px] transition-colors cursor-pointer ${
            showVoltColors
              ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Volt Colors: {showVoltColors ? 'On' : 'Off'}
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Mobile Undo / Redo */}
        <div className="flex lg:hidden items-center gap-0.5 sm:gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-25 disabled:pointer-events-none active:bg-zinc-800 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-25 disabled:pointer-events-none active:bg-zinc-800 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Run/Pause */}
        <button
          onClick={onToggleRun}
          className={`lg:hidden px-2 py-1.5 sm:px-2.5 rounded flex items-center gap-1 text-xs font-medium border cursor-pointer ${
            isRunning
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          }`}
          title={isRunning ? 'Pause simulation' : 'Run simulation'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span className="hidden sm:inline">{isRunning ? 'Pause' : 'Run'}</span>
        </button>

        {/* Example Circuits Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsPresetsOpen(!isPresetsOpen);
              setIsMoreMenuOpen(false);
            }}
            className="px-2 py-1.5 sm:px-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-xs text-zinc-200 flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer"
            title="Load Example Circuit"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Circuits</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {isPresetsOpen && (
            <div className="absolute right-0 mt-1.5 w-64 bg-zinc-900 border border-zinc-800 rounded shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Preset Circuits
              </div>
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onLoadPreset(p);
                      setIsPresetsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-zinc-800 transition-colors group cursor-pointer"
                  >
                    <div className="font-medium text-xs text-zinc-200 group-hover:text-white">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 line-clamp-1">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Direct Utilities */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute buzzer audio' : 'Enable buzzer audio'}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Export / Import JSON */}
          <button
            onClick={onExportJson}
            title="Export Circuit File"
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onImportJson}
            title="Import Circuit File"
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {/* Clear Canvas */}
          <button
            onClick={onClearCanvas}
            title="Clear canvas"
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Help Modal Toggle */}
          <button
            onClick={onOpenHelp}
            className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 text-xs transition-colors cursor-pointer ml-1"
          >
            Help
          </button>
        </div>

        {/* Mobile More Actions Menu */}
        <div className="relative lg:hidden">
          <button
            onClick={() => {
              setIsMoreMenuOpen(!isMoreMenuOpen);
              setIsPresetsOpen(false);
            }}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 active:bg-zinc-850 cursor-pointer"
            title="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-zinc-900 border border-zinc-800 rounded shadow-xl p-2 z-50 space-y-2 text-xs text-zinc-300">
              {/* Simulation Speed */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Speed:</span>
                  <span className="font-mono text-zinc-200">{simSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex gap-1">
                  {[0.5, 1.0, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => onSpeedChange(s)}
                      className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                        Math.abs(simSpeed - s) < 0.05
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                          : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-1.5 border-t border-zinc-800 space-y-1">
                <button
                  onClick={onToggleFlowMode}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-zinc-800 text-left"
                >
                  <span className="text-[11px]">Current Flow:</span>
                  <span className="font-mono text-zinc-300 capitalize">{flowMode}</span>
                </button>
                <button
                  onClick={onToggleVoltColors}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-zinc-800 text-left"
                >
                  <span className="text-[11px]">Volt Colors:</span>
                  <span className="font-mono text-zinc-300">{showVoltColors ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  onClick={onToggleSound}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-zinc-800 text-left"
                >
                  <span className="text-[11px]">Audio Tone:</span>
                  <span className="font-mono text-zinc-300">{soundEnabled ? 'ON' : 'MUTED'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="pt-1.5 border-t border-zinc-800 grid grid-cols-2 gap-1">
                <button
                  onClick={() => {
                    onExportJson();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-zinc-800 text-[11px] flex items-center justify-center gap-1 text-zinc-200"
                >
                  <Download className="w-3 h-3" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => {
                    onImportJson();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-zinc-800 text-[11px] flex items-center justify-center gap-1 text-zinc-200"
                >
                  <Upload className="w-3 h-3" />
                  <span>Import</span>
                </button>
                <button
                  onClick={() => {
                    onOpenHelp();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-zinc-800 text-[11px] flex items-center justify-center gap-1 text-zinc-200"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Guide</span>
                </button>
                <button
                  onClick={() => {
                    onClearCanvas();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-rose-950/40 text-rose-300 text-[11px] flex items-center justify-center gap-1 border border-rose-900/40"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
