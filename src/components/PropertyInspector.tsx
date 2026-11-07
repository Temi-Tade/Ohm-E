/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  RotateCw,
  Trash2,
  Copy,
  Zap,
  Activity,
  Layers,
  Thermometer,
  ShieldAlert,
} from 'lucide-react';
import { CircuitComponent, Wire } from '../types/circuit';
import { formatVoltage, formatCurrent } from './SchematicSymbols';

interface PropertyInspectorProps {
  selectedComponent: CircuitComponent | null;
  selectedWire: Wire | null;
  onUpdateComponentParams: (id: string, params: Partial<CircuitComponent['params']>) => void;
  onRotateComponent: (id: string) => void;
  onDuplicateComponent: (comp: CircuitComponent) => void;
  onDeleteSelected: () => void;
  onClose: () => void;
  isMobileOpen?: boolean;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedComponent,
  selectedWire,
  onUpdateComponentParams,
  onRotateComponent,
  onDuplicateComponent,
  onDeleteSelected,
  onClose,
  isMobileOpen = false,
}) => {
  if (!selectedComponent && !selectedWire) return null;

  const bodyContent = (
    <div className="flex flex-col h-full bg-[#15171b] text-xs text-[#cfd3dd] select-none">
      {/* Mobile Grab Handle */}
      <div className="w-10 h-1 bg-[#323642] rounded-full mx-auto mt-2 mb-1 md:hidden" />

      {/* Header */}
      <div className="p-3 border-b border-[#252831] flex items-center justify-between bg-[#17191e]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[#22252e] border border-[#2d313b] text-[#cfd3dd]">
            {selectedComponent ? <Layers className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
          </div>
          <div>
            <div className="font-semibold text-[#f0f2f6]">
              {selectedComponent ? selectedComponent.name : 'Wire Segment'}
            </div>
            <div className="text-[10px] text-[#717684] font-mono">
              {selectedComponent ? selectedComponent.id : selectedWire?.id}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#717684] hover:text-white p-1 rounded-md hover:bg-[#252831] transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Component Live Telemetry Readings */}
        {selectedComponent && selectedComponent.state && (
          <div className="p-2.5 rounded-lg bg-[#1a1c22] border border-[#262832] space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#717684] block">
              Live Readings
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-[#121317] p-2 rounded-md border border-[#22242e]">
                <span className="text-[#717684] text-[10px] block">Voltage Drop</span>
                <span className="text-[#38bdf8] font-bold">
                  {formatVoltage(selectedComponent.state.voltageDrop ?? 0)}
                </span>
              </div>
              <div className="bg-[#121317] p-2 rounded-md border border-[#22242e]">
                <span className="text-[#717684] text-[10px] block">Current</span>
                <span className="text-[#34d399] font-bold">
                  {formatCurrent(selectedComponent.state.current ?? 0)}
                </span>
              </div>
              <div className="bg-[#121317] p-2 rounded-md border border-[#22242e] col-span-2 flex items-center justify-between">
                <span className="text-[#717684] text-[10px]">Power Dissipated:</span>
                <span className="text-[#fbbf24] font-bold">
                  {((selectedComponent.state.power ?? 0) * 1000).toFixed(2)} mW
                </span>
              </div>
            </div>

            {/* LED Status warnings */}
            {selectedComponent.type === 'led' && (
              <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Emission:</span>
                {selectedComponent.state.isBlown ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Overcurrent Blown
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    {Math.round((selectedComponent.state.brightness ?? 0) * 100)}% Glow
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Wire Live Telemetry */}
        {selectedWire && (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Node Measurements
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                <span className="text-slate-400 text-[10px] block">Potential (V)</span>
                <span className="text-sky-300 font-bold">
                  {formatVoltage(selectedWire.voltage ?? 0)}
                </span>
              </div>
              <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                <span className="text-slate-400 text-[10px] block">Branch Current</span>
                <span className="text-emerald-300 font-bold">
                  {formatCurrent(selectedWire.current ?? 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Editable Parameters */}
        {selectedComponent && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Properties
            </span>

            {/* Resistance Editor */}
            {selectedComponent.params.resistance !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Resistance:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedComponent.params.resistance >= 1e6
                      ? `${(selectedComponent.params.resistance / 1e6).toFixed(2)} MΩ`
                      : selectedComponent.params.resistance >= 1e3
                      ? `${(selectedComponent.params.resistance / 1e3).toFixed(2)} kΩ`
                      : `${selectedComponent.params.resistance} Ω`}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100000"
                  step="10"
                  value={selectedComponent.params.resistance}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      resistance: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-7"
                />
                {/* Quick Presets */}
                <div className="flex gap-1 pt-1 overflow-x-auto no-scrollbar">
                  {[100, 330, 1000, 4700, 10000, 100000].map((rVal) => (
                    <button
                      key={rVal}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, { resistance: rVal })
                      }
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 shrink-0"
                    >
                      {rVal >= 1000 ? `${rVal / 1000}k` : `${rVal}Ω`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Potentiometer Wiper */}
            {selectedComponent.type === 'potentiometer' && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Wiper Position:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {Math.round((selectedComponent.params.wiper ?? 0.5) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedComponent.params.wiper ?? 0.5}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      wiper: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-7"
                />
              </div>
            )}

            {/* Capacitance Editor */}
            {selectedComponent.params.capacitance !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Capacitance:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {selectedComponent.params.capacitance >= 1e-3
                      ? `${(selectedComponent.params.capacitance * 1e3).toFixed(1)} mF`
                      : selectedComponent.params.capacitance >= 1e-6
                      ? `${(selectedComponent.params.capacitance * 1e6).toFixed(1)} µF`
                      : `${(selectedComponent.params.capacitance * 1e9).toFixed(1)} nF`}
                  </span>
                </div>
                {/* Presets */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { label: '100nF', val: 1e-7 },
                    { label: '1µF', val: 1e-6 },
                    { label: '10µF', val: 1e-5 },
                    { label: '47µF', val: 4.7e-5 },
                    { label: '100µF', val: 1e-4 },
                    { label: '470µF', val: 4.7e-4 },
                    { label: '1mF', val: 1e-3 },
                    { label: '10mF', val: 1e-2 },
                  ].map((cPreset) => (
                    <button
                      key={cPreset.label}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, {
                          capacitance: cPreset.val,
                        })
                      }
                      className={`px-1.5 py-1.5 rounded text-[10px] font-mono border transition-colors ${
                        Math.abs((selectedComponent.params.capacitance || 0) - cPreset.val) < 1e-8
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {cPreset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inductance Editor */}
            {selectedComponent.params.inductance !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Inductance:</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {selectedComponent.params.inductance >= 1
                      ? `${selectedComponent.params.inductance} H`
                      : selectedComponent.params.inductance >= 1e-3
                      ? `${(selectedComponent.params.inductance * 1e3).toFixed(1)} mH`
                      : `${(selectedComponent.params.inductance * 1e6).toFixed(1)} µH`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { label: '100µH', val: 1e-4 },
                    { label: '1mH', val: 1e-3 },
                    { label: '10mH', val: 1e-2 },
                    { label: '100mH', val: 1e-1 },
                  ].map((lPreset) => (
                    <button
                      key={lPreset.label}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, {
                          inductance: lPreset.val,
                        })
                      }
                      className="px-1.5 py-1.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      {lPreset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DC Voltage Editor */}
            {selectedComponent.type === 'dc_source' && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">DC Voltage:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {selectedComponent.params.voltage ?? 9} V
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="48"
                  step="0.5"
                  value={selectedComponent.params.voltage ?? 9}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      voltage: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-7"
                />
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {[1.5, 3.3, 5, 9, 12, 24].map((vVal) => (
                    <button
                      key={vVal}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, { voltage: vVal })
                      }
                      className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 shrink-0 min-w-[36px]"
                    >
                      {vVal}V
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AC Voltage Editor */}
            {selectedComponent.type === 'ac_source' && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Peak Voltage:</span>
                  <span className="font-mono text-sky-400 font-bold">
                    {selectedComponent.params.voltage ?? 5} Vpk
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={selectedComponent.params.voltage ?? 5}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      voltage: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer h-7"
                />

                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Frequency:</span>
                  <span className="font-mono text-sky-400 font-bold">
                    {selectedComponent.params.frequency ?? 50} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="1"
                  value={selectedComponent.params.frequency ?? 50}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      frequency: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer h-7"
                />

                {/* Waveform Selector */}
                <div className="space-y-1 pt-1">
                  <span className="text-slate-400 text-[11px]">Waveform:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['sine', 'square', 'triangle'] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() =>
                          onUpdateComponentParams(selectedComponent.id, { waveform: w })
                        }
                        className={`py-1.5 rounded text-[10px] font-bold uppercase border transition-colors ${
                          (selectedComponent.params.waveform || 'sine') === w
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* LED Color Picker */}
            {selectedComponent.type === 'led' && (
              <div className="space-y-1.5">
                <span className="text-slate-400 text-[11px]">LED Color:</span>
                <div className="flex gap-3">
                  {[
                    { id: 'red', bg: '#ef4444', label: 'Red' },
                    { id: 'green', bg: '#22c55e', label: 'Green' },
                    { id: 'blue', bg: '#3b82f6', label: 'Blue' },
                    { id: 'yellow', bg: '#eab308', label: 'Yellow' },
                    { id: 'white', bg: '#f8fafc', label: 'White' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, {
                          ledColor: c.id as CircuitComponent['params']['ledColor'],
                          forwardVoltage: c.id === 'blue' || c.id === 'white' ? 2.8 : 2.0,
                        })
                      }
                      title={c.label}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        selectedComponent.params.ledColor === c.id
                          ? 'scale-125 border-white shadow-md'
                          : 'border-slate-700 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.bg }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* BJT Beta */}
            {(selectedComponent.type === 'npn' || selectedComponent.type === 'pnp') && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Current Gain (hFE / β):</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {selectedComponent.params.beta ?? 100}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="10"
                  value={selectedComponent.params.beta ?? 100}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      beta: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-blue-500 cursor-pointer h-7"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-800 space-y-2 pb-4">
          {selectedComponent && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onRotateComponent(selectedComponent.id)}
                className="py-2 px-2 bg-[#22252c] hover:bg-[#2b2e37] active:bg-[#1a1c22] rounded-lg text-[#cfd3dd] border border-[#2d313b] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Rotate [R]</span>
              </button>
              <button
                onClick={() => onDuplicateComponent(selectedComponent)}
                className="py-2 px-2 bg-[#22252c] hover:bg-[#2b2e37] active:bg-[#1a1c22] rounded-lg text-[#cfd3dd] border border-[#2d313b] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Duplicate</span>
              </button>
            </div>
          )}

          <button
            onClick={onDeleteSelected}
            className="w-full py-2 px-2 bg-[#2a1b1f] hover:bg-[#382025] active:bg-[#221517] text-[#f87171] rounded-lg border border-[#4a2228] flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Selected</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 border-l border-[#252831] bg-[#15171b] flex-col select-none shrink-0">
        {bodyContent}
      </aside>

      {/* Mobile Bottom Sheet Modal (Only opened on explicit request) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs animate-in fade-in"
            onClick={onClose}
          />
          <div className="relative w-full max-h-[80vh] bg-[#15171b] border-t border-[#2d313b] rounded-t-2xl shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 flex flex-col overflow-hidden pb-safe">
            {bodyContent}
          </div>
        </div>
      )}
    </>
  );
};
