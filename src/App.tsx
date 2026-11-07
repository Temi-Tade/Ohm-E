/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CircuitComponent, Wire, ScopeChannel, ScopeSample, ComponentType } from './types/circuit';
import { CircuitSimulator, SimulationResult } from './engine/circuitSolver';
import { getPresetCircuits, CircuitPreset } from './engine/presetCircuits';
import { createComponent, generateId } from './engine/componentFactory';
import { audioEngine } from './engine/audioEngine';
import { CircuitCanvas } from './components/CircuitCanvas';
import { ComponentPalette } from './components/ComponentPalette';
import { PropertyInspector } from './components/PropertyInspector';
import { Oscilloscope } from './components/Oscilloscope';
import { RotateCw, Copy, Trash2, X, Sliders } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { HelpModal } from './components/HelpModal';

interface CircuitSnapshot {
  components: CircuitComponent[];
  wires: Wire[];
}

export default function App() {
  const presets = useRef<CircuitPreset[]>(getPresetCircuits()).current;
  const initialPreset = presets[0]; // RC Low-pass filter

  // Circuit topology state
  const [components, setComponents] = useState<CircuitComponent[]>(initialPreset.components);
  const [wires, setWires] = useState<Wire[]>(initialPreset.wires);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<CircuitSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<CircuitSnapshot[]>([]);
  const preDragSnapshotRef = useRef<CircuitSnapshot | null>(null);

  // Selection
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

  // Simulation parameters
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [flowMode, setFlowMode] = useState<'conventional' | 'electron' | 'none'>('conventional');
  const [showVoltColors, setShowVoltColors] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Oscilloscope state
  const [timebase, setTimebase] = useState<number>(initialPreset.defaultScopeChannels?.timebase ?? 0.002);
  const [isScopePaused, setIsScopePaused] = useState<boolean>(false);
  const [isSelectingProbeForChannel, setIsSelectingProbeForChannel] = useState<number | null>(null);
  const [scopeSamples, setScopeSamples] = useState<ScopeSample[]>([]);
  const [isScopeMinimized, setIsScopeMinimized] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Mobile drawer & modal state
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState<boolean>(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState<boolean>(false);

  // 4 Oscilloscope channels (unattached by default)
  const [scopeChannels, setScopeChannels] = useState<ScopeChannel[]>([
    {
      id: 0,
      name: 'Channel 1',
      color: '#facc15', // Yellow Gold
      enabled: false,
      pinId: undefined,
      voltsPerDiv: 2.0,
      offsetY: 0,
      coupling: 'dc',
    },
    {
      id: 1,
      name: 'Channel 2',
      color: '#06b6d4', // Cyan
      enabled: false,
      pinId: undefined,
      voltsPerDiv: 2.0,
      offsetY: 0,
      coupling: 'dc',
    },
    {
      id: 2,
      name: 'Channel 3',
      color: '#ec4899', // Magenta
      enabled: false,
      voltsPerDiv: 2.0,
      offsetY: 0,
      coupling: 'dc',
    },
    {
      id: 3,
      name: 'Channel 4',
      color: '#84cc16', // Lime
      enabled: false,
      voltsPerDiv: 2.0,
      offsetY: 0,
      coupling: 'dc',
    },
  ]);

  // Help modal
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Hidden file input for JSON import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Simulator instance and time accumulator
  const simulatorRef = useRef<CircuitSimulator>(new CircuitSimulator());
  const simTimeRef = useRef<number>(0);
  const samplesBufferRef = useRef<ScopeSample[]>([]);

  // Snapshot recording for Undo/Redo
  const recordSnapshot = useCallback(() => {
    setUndoStack((prev) => {
      const snap: CircuitSnapshot = {
        components: JSON.parse(JSON.stringify(components)),
        wires: JSON.parse(JSON.stringify(wires)),
      };
      const next = [...prev, snap];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setRedoStack([]);
  }, [components, wires]);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      const newUndo = prevUndo.slice(0, prevUndo.length - 1);
      const currentSnap: CircuitSnapshot = {
        components: JSON.parse(JSON.stringify(components)),
        wires: JSON.parse(JSON.stringify(wires)),
      };
      setRedoStack((prevRedo) => [currentSnap, ...prevRedo]);
      setComponents(previous.components);
      setWires(previous.wires);
      setSelectedComponentId((curr) => (previous.components.some((c) => c.id === curr) ? curr : null));
      setSelectedWireId((curr) => (previous.wires.some((w) => w.id === curr) ? curr : null));
      return newUndo;
    });
  }, [components, wires]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[0];
      const newRedo = prevRedo.slice(1);
      const currentSnap: CircuitSnapshot = {
        components: JSON.parse(JSON.stringify(components)),
        wires: JSON.parse(JSON.stringify(wires)),
      };
      setUndoStack((prevUndo) => [...prevUndo, currentSnap]);
      setComponents(next.components);
      setWires(next.wires);
      setSelectedComponentId((curr) => (next.components.some((c) => c.id === curr) ? curr : null));
      setSelectedWireId((curr) => (next.wires.some((w) => w.id === curr) ? curr : null));
      return newRedo;
    });
  }, [components, wires]);

  // Drag tracking for Undo/Redo
  const handleDragStart = useCallback(() => {
    preDragSnapshotRef.current = {
      components: JSON.parse(JSON.stringify(components)),
      wires: JSON.parse(JSON.stringify(wires)),
    };
  }, [components, wires]);

  const handleDragEnd = useCallback(() => {
    if (preDragSnapshotRef.current) {
      const moved = components.some((c) => {
        const orig = preDragSnapshotRef.current?.components.find((o) => o.id === c.id);
        return orig && (orig.x !== c.x || orig.y !== c.y);
      });
      if (moved) {
        setUndoStack((prev) => {
          const next = [...prev, preDragSnapshotRef.current!];
          return next.length > 50 ? next.slice(next.length - 50) : next;
        });
        setRedoStack([]);
      }
      preDragSnapshotRef.current = null;
    }
  }, [components]);

  // Keyboard Shortcuts for Undo & Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Main Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const elapsedSec = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;

      if (isRunning) {
        const dt = 0.00005;
        const totalSimDelta = elapsedSec * simSpeed;
        const numSteps = Math.min(Math.max(Math.round(totalSimDelta / dt), 1), 60);

        let lastResult: SimulationResult | null = null;

        for (let step = 0; step < numSteps; step++) {
          simTimeRef.current += dt;
          lastResult = simulatorRef.current.step(
            components,
            wires,
            simTimeRef.current,
            dt
          );

          if (step % 2 === 0 && !isScopePaused) {
            const sample: ScopeSample = {
              time: simTimeRef.current,
            };

            scopeChannels.forEach((ch) => {
              if (ch.enabled && ch.pinId) {
                const v = lastResult?.pinVoltages.get(ch.pinId) ?? 0;
                sample[`v${ch.id}`] = v;
              }
            });

            samplesBufferRef.current.push(sample);
            if (samplesBufferRef.current.length > 1500) {
              samplesBufferRef.current.shift();
            }
          }
        }

        if (soundEnabled) {
          const buzzer = components.find((c) => c.type === 'buzzer');
          if (buzzer && buzzer.state) {
            audioEngine.updateBuzzer(
              buzzer.state.voltageDrop ?? 0,
              buzzer.params.frequency || 880
            );
          } else {
            audioEngine.stop();
          }
        } else {
          audioEngine.stop();
        }

        if (!isScopePaused && samplesBufferRef.current.length > 0) {
          setScopeSamples([...samplesBufferRef.current]);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      audioEngine.stop();
    };
  }, [isRunning, simSpeed, components, wires, scopeChannels, isScopePaused, soundEnabled]);

  const handleResetSim = () => {
    simulatorRef.current.reset();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
  };

  // Add component to canvas
  const handleAddComponent = (type: ComponentType) => {
    recordSnapshot();
    const x = 360 + Math.round((Math.random() - 0.5) * 80);
    const y = 260 + Math.round((Math.random() - 0.5) * 80);
    const newComp = createComponent(type, x, y);
    setComponents((prev) => [...prev, newComp]);
    setSelectedComponentId(newComp.id);
    setSelectedWireId(null);
  };

  // Add wire between two pins
  const handleAddWire = (fromPinId: string, toPinId: string) => {
    if (fromPinId === toPinId) return;

    const alreadyConnected = wires.some(
      (w) =>
        (w.fromPinId === fromPinId && w.toPinId === toPinId) ||
        (w.fromPinId === toPinId && w.toPinId === fromPinId)
    );
    if (alreadyConnected) return;

    recordSnapshot();
    const newWire: Wire = {
      id: generateId('wire'),
      fromPinId,
      toPinId,
    };
    setWires((prev) => [...prev, newWire]);
    setSelectedWireId(newWire.id);
    setSelectedComponentId(null);
  };

  // Component manipulation
  const handleUpdateComponentPosition = (id: string, x: number, y: number) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, x, y } : c))
    );
  };

  const handleRotateComponent = (id: string) => {
    recordSnapshot();
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextRot = ((c.rotation || 0) + 90) % 360;
          return { ...c, rotation: nextRot };
        }
        return c;
      })
    );
  };

  const handleDuplicateComponent = (comp: CircuitComponent) => {
    recordSnapshot();
    const newComp = createComponent(comp.type, comp.x + 40, comp.y + 40, {
      ...comp.params,
    });
    newComp.rotation = comp.rotation;
    setComponents((prev) => [...prev, newComp]);
    setSelectedComponentId(newComp.id);
  };

  const handleUpdateComponentParams = (
    id: string,
    params: Partial<CircuitComponent['params']>
  ) => {
    recordSnapshot();
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, params: { ...c.params, ...params } } : c
      )
    );
  };

  const handleToggleSwitch = (comp: CircuitComponent) => {
    recordSnapshot();
    setComponents((prev) =>
      prev.map((c) =>
        c.id === comp.id
          ? {
              ...c,
              params: { ...c.params, closed: !(c.params.closed ?? true) },
            }
          : c
      )
    );
  };

  const handleWiperChange = (comp: CircuitComponent, newWiper: number) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === comp.id
          ? { ...c, params: { ...c.params, wiper: newWiper } }
          : c
      )
    );
  };

  // Delete selected
  const handleDeleteSelected = () => {
    if (selectedComponentId) {
      const compToDelete = components.find((c) => c.id === selectedComponentId);
      recordSnapshot();
      if (compToDelete) {
        const pinIds = new Set(compToDelete.pins.map((p) => p.id));
        setWires((prev) =>
          prev.filter((w) => !pinIds.has(w.fromPinId) && !pinIds.has(w.toPinId))
        );
        setScopeChannels((prev) =>
          prev.map((ch) => (ch.pinId && pinIds.has(ch.pinId) ? { ...ch, pinId: undefined } : ch))
        );
      }
      setComponents((prev) => prev.filter((c) => c.id !== selectedComponentId));
      setSelectedComponentId(null);
    } else if (selectedWireId) {
      recordSnapshot();
      setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
      setSelectedWireId(null);
    }
  };

  // Oscilloscope probe selection
  const handleStartSelectProbe = (channelId: number) => {
    setIsSelectingProbeForChannel(channelId);
  };

  const handleSelectProbePin = (channelId: number, pinId: string) => {
    setScopeChannels((prev) =>
      prev.map((ch) =>
        ch.id === channelId ? { ...ch, pinId, enabled: true } : ch
      )
    );
    setIsSelectingProbeForChannel(null);
  };

  const handleUpdateChannel = (
    channelId: number,
    updates: Partial<ScopeChannel>
  ) => {
    setScopeChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, ...updates } : ch))
    );
  };

  // Load Preset
  const handleLoadPreset = (preset: CircuitPreset) => {
    recordSnapshot();
    simulatorRef.current.reset();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
    setComponents(preset.components);
    setWires(preset.wires);
    setSelectedComponentId(null);
    setSelectedWireId(null);

    if (preset.defaultScopeChannels?.timebase) {
      setTimebase(preset.defaultScopeChannels.timebase);
    }
    setScopeChannels((prev) => prev.map((ch) => ({ ...ch, pinId: undefined, enabled: false })));
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    recordSnapshot();
    simulatorRef.current.reset();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
    setComponents([]);
    setWires([]);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setScopeChannels((prev) => prev.map((ch) => ({ ...ch, pinId: undefined })));
  };

  // Export JSON
  const handleExportJson = () => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      components,
      wires,
      scopeChannels,
      timebase,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit_schematic_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.components && parsed.wires) {
          recordSnapshot();
          simulatorRef.current.reset();
          simTimeRef.current = 0;
          samplesBufferRef.current = [];
          setScopeSamples([]);
          setComponents(parsed.components);
          setWires(parsed.wires);
          if (parsed.timebase) setTimebase(parsed.timebase);
          if (parsed.scopeChannels) setScopeChannels(parsed.scopeChannels);
        }
      } catch (err) {
        // Ignore invalid file
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedComp = components.find((c) => c.id === selectedComponentId) || null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d16] text-zinc-100 font-sans">
      {/* Top Application Toolbar */}
      <Toolbar
        isRunning={isRunning}
        onToggleRun={() => setIsRunning(!isRunning)}
        onStepOnce={() => {
          simTimeRef.current += 0.0005;
          simulatorRef.current.step(components, wires, simTimeRef.current, 0.0005);
        }}
        onReset={handleResetSim}
        onClearCanvas={handleClearCanvas}
        simSpeed={simSpeed}
        onSpeedChange={setSimSpeed}
        flowMode={flowMode}
        onToggleFlowMode={() => {
          setFlowMode((m) =>
            m === 'conventional' ? 'electron' : m === 'electron' ? 'none' : 'conventional'
          );
        }}
        showVoltColors={showVoltColors}
        onToggleVoltColors={() => setShowVoltColors(!showVoltColors)}
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          audioEngine.setMuted(!next);
        }}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        presets={presets}
        onLoadPreset={handleLoadPreset}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onOpenHelp={() => setIsHelpOpen(true)}
        isScopeOpen={!isScopeMinimized}
        onToggleScope={() => setIsScopeMinimized(!isScopeMinimized)}
      />

      {/* Main Workspace: Palette on Left, Canvas in Center, Inspector on Right */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Component Palette Library (Desktop Sidebar & Mobile Slide-Over Drawer) */}
        <ComponentPalette
          onAddComponent={handleAddComponent}
          isOpenMobile={isMobilePaletteOpen}
          onCloseMobile={() => setIsMobilePaletteOpen(false)}
        />

        {/* Center Drag & Drop Schematic Canvas */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <CircuitCanvas
            components={components}
            wires={wires}
            selectedComponentId={selectedComponentId}
            selectedWireId={selectedWireId}
            onSelectComponent={(id) => {
              setSelectedComponentId(id);
              if (id) setSelectedWireId(null);
            }}
            onSelectWire={(id) => {
              setSelectedWireId(id);
              if (id) setSelectedComponentId(null);
            }}
            onUpdateComponentPosition={handleUpdateComponentPosition}
            onRotateComponent={handleRotateComponent}
            onDeleteSelected={handleDeleteSelected}
            onAddWire={handleAddWire}
            onToggleSwitch={handleToggleSwitch}
            onWiperChange={handleWiperChange}
            isSelectingProbeForChannel={isSelectingProbeForChannel}
            onSelectProbePin={handleSelectProbePin}
            scopeChannels={scopeChannels}
            flowMode={flowMode}
            showVoltColors={showVoltColors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />

          {/* Mobile Floating Action Toolbar for Selected Component */}
          {selectedComp && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 md:hidden flex items-center gap-1.5 bg-zinc-900 border border-zinc-750 p-1.5 px-2 rounded-lg shadow-xl text-xs text-zinc-200">
              <button
                onClick={() => handleRotateComponent(selectedComp.id)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 text-zinc-200 font-medium flex items-center gap-1 cursor-pointer"
                title="Rotate Component"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate</span>
              </button>
              <button
                onClick={() => setIsMobileInspectorOpen(true)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 text-zinc-200 font-medium flex items-center gap-1 cursor-pointer"
                title="Edit Component Parameters"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => handleDuplicateComponent(selectedComp)}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-650 text-zinc-200 cursor-pointer"
                title="Duplicate Component"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 active:bg-rose-800 text-rose-300 border border-rose-800/40 cursor-pointer"
                title="Delete Component"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setSelectedComponentId(null);
                  setIsMobileInspectorOpen(false);
                }}
                className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                title="Deselect"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mobile Floating Action Toolbar for Selected Wire */}
          {selectedWire && !selectedComp && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 md:hidden flex items-center gap-2 bg-zinc-900 border border-zinc-750 p-1.5 px-3 rounded-lg shadow-xl text-xs text-zinc-200">
              <span className="text-zinc-400 font-mono text-[11px]">Wire</span>
              <button
                onClick={() => setIsMobileInspectorOpen(true)}
                className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-750 flex items-center gap-1"
              >
                <Sliders className="w-3 h-3" />
                <span>Info</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                className="p-1 rounded bg-rose-950/60 text-rose-300 hover:bg-rose-900"
                title="Delete Wire"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setSelectedWireId(null);
                  setIsMobileInspectorOpen(false);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white"
                title="Deselect"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mobile Floating Add Button (when nothing selected and palette closed) */}
          {!selectedComp && !selectedWire && !isMobilePaletteOpen && (
            <button
              onClick={() => setIsMobilePaletteOpen(true)}
              className="md:hidden absolute bottom-12 right-4 z-30 w-11 h-11 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-750 active:scale-95 shadow-lg flex items-center justify-center font-bold text-2xl transition-all cursor-pointer"
              title="Add Component"
            >
              +
            </button>
          )}

          {/* Bottom Docked Digital Oscilloscope */}
          <Oscilloscope
            samples={scopeSamples}
            channels={scopeChannels}
            components={components}
            timebase={timebase}
            onTimebaseChange={setTimebase}
            onUpdateChannel={handleUpdateChannel}
            isPaused={isScopePaused}
            onTogglePause={() => setIsScopePaused(!isScopePaused)}
            onClearSamples={() => {
              samplesBufferRef.current = [];
              setScopeSamples([]);
            }}
            isSelectingProbeForChannel={isSelectingProbeForChannel}
            onStartSelectProbe={handleStartSelectProbe}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              audioEngine.setMuted(!next);
            }}
            isMinimized={isScopeMinimized}
            onToggleMinimize={() => setIsScopeMinimized(!isScopeMinimized)}
          />
        </div>

        {/* Right Property Inspector Panel (Sidebar on desktop, Bottom Sheet on mobile) */}
        {(selectedComp || selectedWire) && (
          <PropertyInspector
            selectedComponent={selectedComp}
            selectedWire={selectedWire}
            onUpdateComponentParams={handleUpdateComponentParams}
            onRotateComponent={handleRotateComponent}
            onDuplicateComponent={handleDuplicateComponent}
            onDeleteSelected={handleDeleteSelected}
            onClose={() => {
              setIsMobileInspectorOpen(false);
              setSelectedComponentId(null);
              setSelectedWireId(null);
            }}
            isMobileOpen={isMobileInspectorOpen}
          />
        )}
      </div>

      {/* Hidden file input for importing JSON */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Quick Guide & Shortcuts Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
