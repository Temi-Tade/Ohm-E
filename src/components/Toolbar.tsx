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
  Undo2,
  Redo2,
  Activity,
  Zap,
  Waves,
  Palette,
  HelpCircle,
  MoreHorizontal,
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
  selectedComponentName?: string | null;
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
  isScopeOpen,
  onToggleScope,
  selectedComponentName,
}) => {
  const [isPresetsOpen, setIsPresetsOpen] = useState<boolean>(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  const cycleSpeed = () => {
    if (simSpeed <= 0.6) onSpeedChange(1.0);
    else if (simSpeed <= 1.2) onSpeedChange(2.0);
    else onSpeedChange(0.5);
  };

  return (
    <header className="h-12 bg-[#15171b] border-b border-[#252831] px-2 sm:px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand Icon & Wordmark */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#1d1f25] border border-[#2d313b] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-[#10b981]" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4.5a3.5 3.5 0 0 0 3-1.8 7 7 0 1 1 5 0 3.5 3.5 0 0 0 3 1.8H20" />
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-tight text-[#f0f2f6] hidden xs:inline">Ohm-E</span>
      </div>

      {/* Center Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
        {/* Play/Pause */}
        <button
          onClick={onToggleRun}
          className={`px-2.5 py-1.5 sm:px-3 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer border shrink-0 text-xs font-medium ${
            isRunning
              ? 'bg-[#241f17] hover:bg-[#2c2419] text-[#fbbf24] border-[#d97706]/40'
              : 'bg-[#17231c] hover:bg-[#1d2d23] text-[#34d399] border-[#059669]/40'
          }`}
          title={isRunning ? 'Pause simulation (Space)' : 'Run simulation (Space)'}
          aria-label={isRunning ? 'Pause simulation' : 'Run simulation'}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isRunning ? 'Pause' : 'Run'}</span>
        </button>

        {/* Step Forward */}
        <button
          onClick={onStepOnce}
          disabled={isRunning}
          title="Single step forward"
          aria-label="Single step forward"
          className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#cfd3dd] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
        >
          <FastForward className="w-3.5 h-3.5" />
        </button>

        {/* Restart / Reset Simulation */}
        <button
          onClick={onReset}
          title="Restart simulation from t=0"
          aria-label="Restart simulation"
          className="px-2 sm:px-2.5 py-1.5 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] active:bg-[#181a20] text-[#38bdf8] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Restart</span>
        </button>

        {/* Oscilloscope Graph Button - Appears only when a component is selected */}
        {selectedComponentName && (
          <button
            onClick={onToggleScope}
            title={`Oscilloscope: Inspect waveform across terminals of ${selectedComponentName}`}
            aria-label={`Oscilloscope for ${selectedComponentName}`}
            className={`px-2 sm:px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              isScopeOpen
                ? 'bg-[#1a2536] border-[#38bdf8] text-[#38bdf8] shadow-sm'
                : 'bg-[#18202d] border-[#25364e] hover:bg-[#1f2b3e] text-[#38bdf8]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#38bdf8] animate-pulse" />
            <span className="hidden md:inline">Scope</span>
          </button>
        )}

        <div className="h-4 w-px bg-[#262832] mx-0.5 shrink-0" />

        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#cfd3dd] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#cfd3dd] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-[#262832] mx-0.5 shrink-0 hidden md:block" />

        {/* Simulation Speed Cycle Button (Desktop) */}
        <button
          onClick={cycleSpeed}
          title={`Simulation Speed: ${simSpeed.toFixed(1)}x (Click to cycle 0.5x, 1x, 2x)`}
          aria-label={`Simulation Speed: ${simSpeed.toFixed(1)}x`}
          className="hidden md:flex px-2 py-1.5 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#cfd3dd] items-center gap-1 text-[11px] font-mono cursor-pointer shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>{simSpeed.toFixed(1)}x</span>
        </button>

        {/* Current Flow Mode Button (Desktop) */}
        <button
          onClick={onToggleFlowMode}
          title={`Current flow particles: ${flowMode} (Click to toggle)`}
          aria-label={`Current flow mode: ${flowMode}`}
          className="hidden md:flex px-2.5 py-1.5 rounded-md border border-[#282b34] bg-[#1e2026] hover:bg-[#272a33] text-xs text-[#cfd3dd] items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Waves
            className={`w-3.5 h-3.5 ${
              flowMode === 'conventional'
                ? 'text-amber-400'
                : flowMode === 'electron'
                ? 'text-sky-400'
                : 'text-slate-600'
            }`}
          />
          <span className="capitalize">{flowMode} Flow</span>
        </button>

        {/* Wire Voltage Colors Button (Desktop) */}
        <button
          onClick={onToggleVoltColors}
          title={`Color wires by voltage: ${showVoltColors ? 'Enabled' : 'Disabled'} (Click to toggle)`}
          aria-label={`Voltage colors: ${showVoltColors ? 'On' : 'Off'}`}
          className={`hidden md:flex px-2.5 py-1.5 rounded-md border text-xs items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
            showVoltColors
              ? 'bg-[#242730] border-[#363a47] text-cyan-400'
              : 'bg-[#1e2026] border-[#282b34] text-slate-500 hover:text-[#cfd3dd]'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Volt Colors: {showVoltColors ? 'On' : 'Off'}</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Preset Circuits Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsPresetsOpen(!isPresetsOpen);
              setIsMoreMenuOpen(false);
            }}
            className="px-2.5 py-1.5 bg-[#1e2026] hover:bg-[#272a33] border border-[#2b2e37] rounded-md text-[#cfd3dd] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Load Example Circuit Presets"
            aria-label="Preset Circuits"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#cfd3dd]" />
            <span className="hidden sm:inline">Circuits</span>
          </button>

          {isPresetsOpen && (
            <div className="absolute right-0 mt-1.5 w-64 bg-[#181a20] border border-[#2b2e38] rounded-lg shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-[#717684] uppercase tracking-wider">
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
                    className="w-full text-left p-2 rounded-md hover:bg-[#22252e] transition-colors group cursor-pointer"
                  >
                    <div className="font-medium text-xs text-[#cfd3dd] group-hover:text-white">
                      {p.name}
                    </div>
                    <div className="text-[10px] text-[#717684] line-clamp-1">{p.description}</div>
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
            aria-label={soundEnabled ? 'Mute buzzer audio' : 'Enable buzzer audio'}
            className={`p-1.5 sm:p-2 rounded-md border transition-colors cursor-pointer shrink-0 ${
              soundEnabled
                ? 'bg-[#242730] border-[#363a47] text-[#f0f2f6]'
                : 'bg-[#1e2026] border-[#282b34] text-slate-500 hover:text-[#cfd3dd]'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Export / Import JSON */}
          <button
            onClick={onExportJson}
            title="Export Circuit File (.json)"
            aria-label="Export Circuit File"
            className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#8b909f] hover:text-[#cfd3dd] transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onImportJson}
            title="Import Circuit File (.json)"
            aria-label="Import Circuit File"
            className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#8b909f] hover:text-[#cfd3dd] transition-colors cursor-pointer shrink-0"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Clear Canvas */}
          <button
            onClick={onClearCanvas}
            title="Clear canvas"
            aria-label="Clear canvas"
            className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#2d1b1f] text-[#8b909f] hover:text-[#f87171] transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Help Modal Toggle */}
          <button
            onClick={onOpenHelp}
            title="Help, User Guide & Keyboard Shortcuts"
            aria-label="Help & Guide"
            className="px-2.5 py-1.5 rounded-md bg-[#1e2026] border border-[#2b2e37] hover:bg-[#272a33] text-[#cfd3dd] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>

        {/* Mobile/Tablet More Actions Menu */}
        <div className="relative lg:hidden">
          <button
            onClick={() => {
              setIsMoreMenuOpen(!isMoreMenuOpen);
              setIsPresetsOpen(false);
            }}
            className="p-1.5 sm:p-2 rounded-md bg-[#1e2026] border border-[#2b2e37] text-[#cfd3dd] active:bg-[#272a33] cursor-pointer shrink-0"
            title="More Options"
            aria-label="More Options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-[#181a20] border border-[#2b2e38] rounded-lg shadow-2xl p-2 z-50 space-y-2 text-xs text-[#cfd3dd]">
              {/* Simulation Speed */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#8b909f]">
                  <span>Speed:</span>
                  <span className="font-mono text-[#f0f2f6]">{simSpeed.toFixed(1)}x</span>
                </div>
                <div className="flex gap-1">
                  {[0.5, 1.0, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => onSpeedChange(s)}
                      className={`flex-1 py-1 rounded text-[10px] font-mono border ${
                        Math.abs(simSpeed - s) < 0.05
                          ? 'bg-[#2b2e38] border-[#3b3f4d] text-white'
                          : 'bg-[#15171b] border-[#252830] text-[#8b909f]'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-1.5 border-t border-[#252831] space-y-1">
                <button
                  onClick={onToggleFlowMode}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#22252e] text-left"
                >
                  <span className="text-[11px]">Current Flow:</span>
                  <span className="font-mono text-[#dce0e8] capitalize">{flowMode}</span>
                </button>
                <button
                  onClick={onToggleVoltColors}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#22252e] text-left"
                >
                  <span className="text-[11px]">Volt Colors:</span>
                  <span className="font-mono text-[#dce0e8]">{showVoltColors ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  onClick={onToggleSound}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#22252e] text-left"
                >
                  <span className="text-[11px]">Audio Tone:</span>
                  <span className="font-mono text-[#dce0e8]">{soundEnabled ? 'ON' : 'MUTED'}</span>
                </button>
              </div>

              {/* Actions */}
              <div className="pt-1.5 border-t border-[#252831] grid grid-cols-2 gap-1">
                <button
                  onClick={() => {
                    onExportJson();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-[#20232a] text-[11px] flex items-center justify-center gap-1 text-[#dce0e8] hover:bg-[#282c35]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => {
                    onImportJson();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-[#20232a] text-[11px] flex items-center justify-center gap-1 text-[#dce0e8] hover:bg-[#282c35]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
                <button
                  onClick={() => {
                    onOpenHelp();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-[#20232a] text-[11px] flex items-center justify-center gap-1 text-[#dce0e8] hover:bg-[#282c35]"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Guide</span>
                </button>
                <button
                  onClick={() => {
                    onClearCanvas();
                    setIsMoreMenuOpen(false);
                  }}
                  className="p-1.5 rounded bg-[#2a1b1f] text-[#f87171] text-[11px] flex items-center justify-center gap-1 border border-[#4a2228] hover:bg-[#382025]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
