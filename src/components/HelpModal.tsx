/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  Zap,
  RotateCw,
  GitCommit,
  Sliders,
  ToggleLeft,
  X,
  Volume2,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#15171b] border border-[#2b2e38] w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#cfd3dd]">
        {/* Header */}
        <div className="p-4 border-b border-[#252831] flex items-center justify-between bg-[#17191e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#1f222a] border border-[#2e323d] text-[#10b981] flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-[#f0f2f6]">Ohm-E User Guide & Shortcuts</h2>
              <p className="text-[11px] text-[#717684]">Interactive Electronics Simulator Quick Start</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#8b909f] hover:text-white hover:bg-[#252831] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#1a1c22] border border-[#262832] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-[#38bdf8]">
                <GitCommit className="w-4 h-4" />
                <span>Drag-and-Drop Wiring</span>
              </div>
              <p className="text-[#8b909f] text-[11px] leading-relaxed">
                Hover over any component pin (terminal ring) and click or drag to start a wire.
                Click another pin to complete the connection with automatic orthogonal Manhattan routing.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#1a1c22] border border-[#262832] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-[#fbbf24]">
                <Activity className="w-4 h-4" />
                <span>Multi-Channel Oscilloscope</span>
              </div>
              <p className="text-[#8b909f] text-[11px] leading-relaxed">
                Open the Oscilloscope drawer at the bottom anytime you want to measure and plot voltage waveforms across your circuit in real time.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#1a1c22] border border-[#262832] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-[#34d399]">
                <ToggleLeft className="w-4 h-4" />
                <span>Interactive Elements</span>
              </div>
              <p className="text-[#8b909f] text-[11px] leading-relaxed">
                Click switches to open/close them instantly. Drag potentiometer sliders directly on the symbol to vary resistance. LEDs glow and can burn out if overdriven!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#1a1c22] border border-[#262832] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-[#a78bfa]">
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">Shortcuts & Navigation</span>
                <span className="sm:hidden">Touch Gestures & Controls</span>
              </div>
              <p className="text-[#8b909f] text-[11px] leading-relaxed hidden sm:block">
                Press <kbd className="px-1 py-0.5 rounded bg-[#252831] border border-[#3b3f4d] font-mono text-white">R</kbd> to rotate, <kbd className="px-1 py-0.5 rounded bg-[#252831] border border-[#3b3f4d] font-mono text-white">Del</kbd> to remove, and <kbd className="px-1 py-0.5 rounded bg-[#252831] border border-[#3b3f4d] font-mono text-white">Ctrl+Z</kbd> / <kbd className="px-1 py-0.5 rounded bg-[#252831] border border-[#3b3f4d] font-mono text-white">Ctrl+Y</kbd> to undo/redo.
              </p>
              <p className="text-[#8b909f] text-[11px] leading-relaxed sm:hidden">
                Tap a component to select it and use the action buttons to rotate, edit, or delete. Tap terminals to connect wires. Pinch to zoom and drag with two fingers to pan.
              </p>
            </div>
          </div>

          {/* Solver Explanation */}
          <div className="p-3.5 rounded-lg bg-[#16202c] border border-[#24354a] text-[11px] text-[#cfe3f8] leading-relaxed space-y-1">
            <span className="font-semibold text-[#38bdf8] block">⚡ Real-Time Physics Engine:</span>
            Ohm-E runs an in-browser Modified Nodal Analysis (MNA) matrix solver with Newton-Raphson non-linear iteration and backward Euler numerical integration for capacitors and inductors at sub-millisecond precision.
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#252831] bg-[#17191e] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#22252c] hover:bg-[#2b2e37] active:bg-[#1a1c22] border border-[#2d313b] text-[#f0f2f6] font-medium text-xs transition-colors cursor-pointer"
          >
            Got it, Let&apos;s Build
          </button>
        </div>
      </div>
    </div>
  );
};
