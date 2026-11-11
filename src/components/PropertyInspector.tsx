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
  onOpenScope?: () => void;
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
  onOpenScope,
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

        {/* Oscilloscope Waveform Button */}
        {onOpenScope && (
          <div className="p-2.5 rounded-lg bg-[#1a1c22] border border-[#262832]">
            <button
              onClick={onOpenScope}
              className="w-full py-2 px-3 rounded-md bg-[#1a2332] hover:bg-[#223045] active:bg-[#151c27] border border-[#2b4162] text-[#38bdf8] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              title="Open Oscilloscope to view waveform across this component's terminals"
            >
              <Activity className="w-4 h-4 text-[#38bdf8]" />
              <span>Inspect Terminal Waveform</span>
            </button>
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
              <div className="space-y-1.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Resistance:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedComponent.params.resistance >= 1e6
                      ? `${(selectedComponent.params.resistance / 1e6).toFixed(2)} MΩ`
                      : selectedComponent.params.resistance >= 1e3
                      ? `${(selectedComponent.params.resistance / 1e3).toFixed(2)} kΩ`
                      : `${selectedComponent.params.resistance} Ω`}
                  </span>
                </div>
                {/* Numeric Input Field for Rating */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={selectedComponent.params.resistance}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { resistance: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-amber-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                      placeholder="e.g. 1000"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Ω</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100000"
                  step="10"
                  value={Math.min(selectedComponent.params.resistance, 100000)}
                  onChange={(e) =>
                    onUpdateComponentParams(selectedComponent.id, {
                      resistance: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-5"
                />
                {/* Quick Presets */}
                <div className="flex gap-1 pt-0.5 overflow-x-auto no-scrollbar">
                  {[100, 330, 1000, 4700, 10000, 100000].map((rVal) => (
                    <button
                      key={rVal}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, { resistance: rVal })
                      }
                      className="px-2 py-0.5 rounded bg-[#20232a] hover:bg-[#282c35] text-[10px] font-mono text-[#cfd3dd] border border-[#2d313b] shrink-0 cursor-pointer"
                    >
                      {rVal >= 1000 ? `${rVal / 1000}k` : `${rVal}Ω`}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {/* Capacitance Editor */}
            {selectedComponent.params.capacitance !== undefined && (
              <div className="space-y-1.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Capacitance:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {selectedComponent.params.capacitance >= 1e-3
                      ? `${(selectedComponent.params.capacitance * 1e3).toFixed(1)} mF`
                      : selectedComponent.params.capacitance >= 1e-6
                      ? `${(selectedComponent.params.capacitance * 1e6).toFixed(1)} µF`
                      : `${(selectedComponent.params.capacitance * 1e9).toFixed(1)} nF`}
                  </span>
                </div>
                {/* Direct Numeric Input in µF */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={((selectedComponent.params.capacitance ?? 1e-5) * 1e6).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { capacitance: val * 1e-6 });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-cyan-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">µF</span>
                  </div>
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
                      className={`px-1 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                        Math.abs((selectedComponent.params.capacitance || 0) - cPreset.val) < 1e-8
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                          : 'bg-[#15171b] hover:bg-[#20232a] text-[#8b909f] border-[#252830]'
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
              <div className="space-y-1.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Inductance:</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {selectedComponent.params.inductance >= 1
                      ? `${selectedComponent.params.inductance} H`
                      : selectedComponent.params.inductance >= 1e-3
                      ? `${(selectedComponent.params.inductance * 1e3).toFixed(1)} mH`
                      : `${(selectedComponent.params.inductance * 1e6).toFixed(1)} µH`}
                  </span>
                </div>
                {/* Direct numeric input in mH */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={((selectedComponent.params.inductance ?? 1e-2) * 1e3).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { inductance: val * 1e-3 });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-blue-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">mH</span>
                  </div>
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
                      className="px-1 py-1 rounded text-[10px] font-mono bg-[#15171b] hover:bg-[#20232a] text-[#8b909f] border border-[#252830] cursor-pointer"
                    >
                      {lPreset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DC Voltage Editor */}
            {selectedComponent.type === 'dc_source' && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">DC Voltage:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {selectedComponent.params.voltage ?? 9} V
                  </span>
                </div>
                {/* Direct numeric input */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      value={selectedComponent.params.voltage ?? 9}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateComponentParams(selectedComponent.id, { voltage: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-emerald-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">V</span>
                  </div>
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
                  className="w-full accent-emerald-500 cursor-pointer h-5"
                />
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                  {[1.5, 3.3, 5, 9, 12, 24].map((vVal) => (
                    <button
                      key={vVal}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.id, { voltage: vVal })
                      }
                      className="flex-1 py-1 rounded bg-[#20232a] hover:bg-[#282c35] text-[10px] font-mono text-[#cfd3dd] border border-[#2d313b] shrink-0 cursor-pointer"
                    >
                      {vVal}V
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AC Generator Editor */}
            {selectedComponent.type === 'ac_source' && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Peak Voltage & Frequency:</span>
                  <span className="font-mono text-sky-400 font-bold">
                    {selectedComponent.params.voltage ?? 5} Vpk @ {selectedComponent.params.frequency ?? 50} Hz
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={selectedComponent.params.voltage ?? 5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { voltage: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-sky-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Vpk</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={selectedComponent.params.frequency ?? 50}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { frequency: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-sky-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Hz</span>
                  </div>
                </div>

                {/* Waveform Selector */}
                <div className="space-y-1 pt-1">
                  <span className="text-[#8b909f] text-[11px]">Waveform:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['sine', 'square', 'triangle'] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() =>
                          onUpdateComponentParams(selectedComponent.id, { waveform: w })
                        }
                        className={`py-1 rounded text-[10px] font-bold uppercase border transition-colors cursor-pointer ${
                          (selectedComponent.params.waveform || 'sine') === w
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500'
                            : 'bg-[#15171b] text-[#8b909f] border-[#252830]'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pulse Clock Editor */}
            {selectedComponent.type === 'clock_source' && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Pulse Clock:</span>
                  <span className="font-mono text-purple-400 font-bold">
                    {selectedComponent.params.voltage ?? 5}V @ {selectedComponent.params.frequency ?? 10}Hz
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={selectedComponent.params.voltage ?? 5}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { voltage: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-purple-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">V</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={selectedComponent.params.frequency ?? 10}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { frequency: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-purple-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Hz</span>
                  </div>
                </div>
              </div>
            )}

            {/* Diode / Zener / LED Ratings */}
            {(selectedComponent.type === 'diode' || selectedComponent.type === 'zener_diode') && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Forward Voltage Drop (Vf):</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedComponent.params.forwardVoltage ?? 0.7} V
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="5.0"
                    value={selectedComponent.params.forwardVoltage ?? 0.7}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        onUpdateComponentParams(selectedComponent.id, { forwardVoltage: val });
                      }
                    }}
                    className="w-full bg-[#121317] border border-[#2d313b] focus:border-amber-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                  />
                  <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">V</span>
                </div>
                {selectedComponent.type === 'zener_diode' && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[#8b909f] text-[11px]">Zener Breakdown (Vz):</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="50"
                        value={selectedComponent.params.zenerVoltage ?? 5.1}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            onUpdateComponentParams(selectedComponent.id, { zenerVoltage: val });
                          }
                        }}
                        className="w-full bg-[#121317] border border-[#2d313b] focus:border-amber-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                      />
                      <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">V</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LED Rating & Color */}
            {selectedComponent.type === 'led' && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Max Current Rating:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round((selectedComponent.params.maxCurrent ?? 0.035) * 1000)} mA
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="5"
                      max="1000"
                      value={Math.round((selectedComponent.params.maxCurrent ?? 0.035) * 1000)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { maxCurrent: val / 1000 });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-emerald-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">mA</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="4.0"
                      value={selectedComponent.params.forwardVoltage ?? 2.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { forwardVoltage: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-emerald-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Vf</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[#8b909f] text-[11px]">LED Color:</span>
                  <div className="flex gap-2.5">
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
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          selectedComponent.params.ledColor === c.id
                            ? 'scale-110 border-white shadow-md'
                            : 'border-[#2d313b] hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.bg }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* BJT Ratings */}
            {(selectedComponent.type === 'npn' || selectedComponent.type === 'pnp') && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Current Gain (hFE / β):</span>
                  <span className="font-mono text-blue-400 font-bold">
                    {selectedComponent.params.beta ?? 100}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="5"
                    min="10"
                    max="1000"
                    value={selectedComponent.params.beta ?? 100}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        onUpdateComponentParams(selectedComponent.id, { beta: val });
                      }
                    }}
                    className="w-full bg-[#121317] border border-[#2d313b] focus:border-blue-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                  />
                  <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">β</span>
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
                  className="w-full accent-blue-500 cursor-pointer h-5"
                />
              </div>
            )}

            {/* MOSFET Ratings */}
            {(selectedComponent.type === 'n_mosfet' || selectedComponent.type === 'p_mosfet') && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Threshold Voltage (Vth):</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {selectedComponent.params.vth ?? (selectedComponent.type === 'n_mosfet' ? 2.0 : -2.0)} V
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={selectedComponent.params.vth ?? (selectedComponent.type === 'n_mosfet' ? 2.0 : -2.0)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onUpdateComponentParams(selectedComponent.id, { vth: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-cyan-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Vth</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="1000"
                      value={Math.round((selectedComponent.params.transconductance ?? 0.05) * 1000)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { transconductance: val / 1000 });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-cyan-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">mA/V²</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] text-[#8b909f]">
                    <span>Rds(on) Saturation:</span>
                    <span className="font-mono text-[#cfd3dd]">{selectedComponent.params.rdsOn ?? 0.2} Ω</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      value={selectedComponent.params.rdsOn ?? 0.2}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          onUpdateComponentParams(selectedComponent.id, { rdsOn: val });
                        }
                      }}
                      className="w-full bg-[#121317] border border-[#2d313b] focus:border-cyan-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                    />
                    <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Ω</span>
                  </div>
                </div>
              </div>
            )}

            {/* Piezo Buzzer Ratings */}
            {selectedComponent.type === 'buzzer' && (
              <div className="space-y-2 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Resonance Frequency:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedComponent.params.frequency ?? 880} Hz
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="10"
                    min="100"
                    max="10000"
                    value={selectedComponent.params.frequency ?? 880}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        onUpdateComponentParams(selectedComponent.id, { frequency: val });
                      }
                    }}
                    className="w-full bg-[#121317] border border-[#2d313b] focus:border-amber-500 rounded px-2 py-1 text-xs font-mono text-[#f0f2f6] outline-none"
                  />
                  <span className="absolute right-2 top-1 text-[10px] text-[#717684] font-mono">Hz</span>
                </div>
              </div>
            )}


            {/* PIR Motion Sensor Controls */}
            {selectedComponent.type === 'pir_sensor' && (
              <div className="space-y-2.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Motion State:</span>
                  <span className={`font-mono font-bold ${selectedComponent.params.motionDetected ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {selectedComponent.params.motionDetected ? 'DETECTED' : 'IDLE'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateComponentParams(selectedComponent.id, {
                      motionDetected: !selectedComponent.params.motionDetected,
                    })
                  }
                  className={`w-full py-2 px-3 rounded-lg font-medium text-xs border transition-colors cursor-pointer ${
                    selectedComponent.params.motionDetected
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-[#20232a] hover:bg-[#282c35] border-[#2e323e] text-[#cfd3dd]'
                  }`}
                >
                  {selectedComponent.params.motionDetected ? 'Active (Click to Reset)' : 'Trigger Motion Pulse'}
                </button>
              </div>
            )}

            {/* Push Button & Switch State */}
            {selectedComponent.type === 'push_button' && (
              <div className="space-y-2.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Button State:</span>
                  <span className={`font-mono font-bold ${selectedComponent.params.pressed ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {selectedComponent.params.pressed ? 'PRESSED (CLOSED)' : 'RELEASED (OPEN)'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateComponentParams(selectedComponent.id, {
                      pressed: !selectedComponent.params.pressed,
                    })
                  }
                  className={`w-full py-2 px-3 rounded-lg font-medium text-xs border transition-colors cursor-pointer ${
                    selectedComponent.params.pressed
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-[#20232a] hover:bg-[#282c35] border-[#2e323e] text-[#cfd3dd]'
                  }`}
                >
                  {selectedComponent.params.pressed ? 'Release Button (Open)' : 'Push Button (Close)'}
                </button>
              </div>
            )}

            {selectedComponent.type === 'switch' && (
              <div className="space-y-2.5 p-2 rounded-lg bg-[#181a20] border border-[#252831]">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#8b909f]">Toggle Switch:</span>
                  <span className={`font-mono font-bold ${selectedComponent.params.closed ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {selectedComponent.params.closed ? 'CLOSED (ON)' : 'OPEN (OFF)'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateComponentParams(selectedComponent.id, {
                      closed: !selectedComponent.params.closed,
                    })
                  }
                  className={`w-full py-2 px-3 rounded-lg font-medium text-xs border transition-colors cursor-pointer ${
                    selectedComponent.params.closed
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                      : 'bg-[#20232a] hover:bg-[#282c35] border-[#2e323e] text-[#cfd3dd]'
                  }`}
                >
                  {selectedComponent.params.closed ? 'Open Switch' : 'Close Switch'}
                </button>
              </div>
            )}

          </div>
        )}
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
