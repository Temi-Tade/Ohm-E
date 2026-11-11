/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CircuitComponent, Wire, ScopeSample, ScopeProbe, ComponentType } from './types/circuit';
import { CircuitSimulator, SimulationResult } from './engine/circuitSolver';
import { getPresetCircuits, CircuitPreset } from './engine/presetCircuits';
import { createComponent, generateId } from './engine/componentFactory';
import { audioEngine } from './engine/audioEngine';
import { CircuitCanvas } from './components/CircuitCanvas';
import { ComponentPalette } from './components/ComponentPalette';
import { PropertyInspector } from './components/PropertyInspector';
import { Oscilloscope } from './components/Oscilloscope';
import { RotateCw, Copy, Trash2, X, Sliders, Activity } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { HelpModal } from './components/HelpModal';

const CHANNEL_COLORS = ['#f97316', '#06b6d4', '#10b981']; // Ch0 Orange, Ch1 Cyan, Ch2 Emerald Green

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

  // Selection
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

  // Simulation parameters
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [flowMode, setFlowMode] = useState<'conventional' | 'electron' | 'none'>('conventional');
  const [showVoltColors, setShowVoltColors] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  // Oscilloscope state (multi-channel probes, V / I / Both modes)
  const [timebase, setTimebase] = useState<number>(initialPreset.defaultScope?.timebase ?? 0.002);
  const [voltsPerDiv, setVoltsPerDiv] = useState<number>(initialPreset.defaultScope?.voltsPerDiv ?? 2.0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [coupling, setCoupling] = useState<'dc' | 'ac'>('dc');
  const [isScopePaused, setIsScopePaused] = useState<boolean>(false);
  const [scopeSamples, setScopeSamples] = useState<ScopeSample[]>([]);
  const [isScopeOpen, setIsScopeOpen] = useState<boolean>(false);
  const [showVoltage, setShowVoltage] = useState<boolean>(true);
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [activeChannelIndex, setActiveChannelIndex] = useState<number>(0);

  // Multi-channel probe configuration (up to 3 channels)
  const [probes, setProbes] = useState<ScopeProbe[]>([
    {
      id: 'ch0',
      type: 'component',
      targetId: initialPreset.components[0]?.id ?? '',
      name: initialPreset.components[0]?.name ?? 'CH 1',
      color: '#f97316',
      channelIndex: 0,
    },
    {
      id: 'ch1',
      type: 'component',
      targetId: initialPreset.components[2]?.id ?? '',
      name: initialPreset.components[2]?.name ?? 'CH 2',
      color: '#06b6d4',
      channelIndex: 1,
    },
  ]);
  const probesRef = useRef<ScopeProbe[]>(probes);
  useEffect(() => {
    probesRef.current = probes;
  }, [probes]);

  const lastProbedCompRef = useRef<CircuitComponent | null>(initialPreset.components[0] ?? null);

  // Mobile drawer & modal state
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState<boolean>(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState<boolean>(false);

  // Help modal
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Hidden file input for JSON import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Simulator instance and time accumulator
  const simulatorRef = useRef<CircuitSimulator>(new CircuitSimulator());
  const simTimeRef = useRef<number>(0);
  const samplesBufferRef = useRef<ScopeSample[]>([]);
  const lastScopeSampleTimeRef = useRef<number>(0);
  const lastScopeUpdateRef = useRef<number>(0);

  // Synchronous refs to guarantee accurate state snapshots without stale closures
  const componentsRef = useRef<CircuitComponent[]>(components);
  const wiresRef = useRef<Wire[]>(wires);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);
  useEffect(() => {
    wiresRef.current = wires;
  }, [wires]);

  // Track the most recently selected component for the oscilloscope probe
  useEffect(() => {
    if (selectedComponentId) {
      const found = components.find((c) => c.id === selectedComponentId);
      if (found) {
        lastProbedCompRef.current = found;
      }
    }
  }, [selectedComponentId, components]);

  // Snapshot recording for Undo/Redo
  const recordSnapshot = useCallback(() => {
    const snap: CircuitSnapshot = {
      components: JSON.parse(JSON.stringify(componentsRef.current)),
      wires: JSON.parse(JSON.stringify(wiresRef.current)),
    };
    setUndoStack((prev) => [...prev.slice(-40), snap]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      const newUndo = prevUndo.slice(0, prevUndo.length - 1);

      const currentSnap: CircuitSnapshot = {
        components: JSON.parse(JSON.stringify(componentsRef.current)),
        wires: JSON.parse(JSON.stringify(wiresRef.current)),
      };
      setRedoStack((prevRedo) => [currentSnap, ...prevRedo.slice(0, 40)]);

      setTimeout(() => {
        setComponents(previous.components);
        setWires(previous.wires);
        setSelectedComponentId(null);
        setSelectedWireId(null);
      }, 0);

      return newUndo;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[0];
      const newRedo = prevRedo.slice(1);

      const currentSnap: CircuitSnapshot = {
        components: JSON.parse(JSON.stringify(componentsRef.current)),
        wires: JSON.parse(JSON.stringify(wiresRef.current)),
      };
      setUndoStack((prevUndo) => [...prevUndo.slice(-40), currentSnap]);

      setTimeout(() => {
        setComponents(next.components);
        setWires(next.wires);
        setSelectedComponentId(null);
        setSelectedWireId(null);
      }, 0);

      return newRedo;
    });
  }, []);

  // Drag tracking: recording snapshot at drag start guarantees any move can be cleanly undone
  const handleDragStart = useCallback(() => {
    recordSnapshot();
  }, [recordSnapshot]);

  const handleDragEnd = useCallback(() => {
    // Snapshotted at drag start
  }, []);

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
        // dt = 0.0001 (100 us) allows smooth numerical integration up to 160 steps/frame (full real-time speed)
        const dt = 0.0001;
        const totalSimDelta = elapsedSec * simSpeed;
        const numSteps = Math.min(Math.max(Math.round(totalSimDelta / dt), 1), 160);

        let lastResult: SimulationResult | null = null;

        for (let step = 0; step < numSteps; step++) {
          simTimeRef.current += dt;
          lastResult = simulatorRef.current.step(
            components,
            wires,
            simTimeRef.current,
            dt
          );

          const targetSampleDt = Math.max(0.00005, (timebase * 10) / 1000);
          if (
            !isScopePaused &&
            (simTimeRef.current - lastScopeSampleTimeRef.current >= targetSampleDt ||
              samplesBufferRef.current.length === 0)
          ) {
            lastScopeSampleTimeRef.current = simTimeRef.current;

            const currentProbes = probesRef.current;
            const currentComps = componentsRef.current;
            const currentWires = wiresRef.current;

            const measureTarget = (targetId: string, type: 'component' | 'wire') => {
              let v = 0;
              let i = 0;
              if (type === 'component') {
                const comp = currentComps.find((c) => c.id === targetId);
                if (comp) {
                  if (comp.pins.length >= 2) {
                    const vp0 = lastResult?.pinVoltages.get(comp.pins[0].id) ?? 0;
                    const vp1 = lastResult?.pinVoltages.get(comp.pins[1].id) ?? 0;
                    v = vp0 - vp1;
                  } else if (comp.pins.length === 1) {
                    v = lastResult?.pinVoltages.get(comp.pins[0].id) ?? 0;
                  }
                  i = lastResult?.componentCurrents.get(comp.id) ?? comp.state?.current ?? 0;
                }
              } else {
                const wire = currentWires.find((w) => w.id === targetId);
                if (wire) {
                  v = wire.voltage ?? (lastResult?.pinVoltages.get(wire.fromPinId) ?? 0);
                  i = wire.current ?? (lastResult?.wireCurrents.get(wire.id) ?? 0);
                }
              }
              return { v, i };
            };

            const sample: ScopeSample = {
              time: simTimeRef.current,
              v: 0,
              i: 0,
            };

            if (currentProbes[0]) {
              const m0 = measureTarget(currentProbes[0].targetId, currentProbes[0].type);
              sample.v0 = m0.v;
              sample.i0 = m0.i;
              sample.v = m0.v;
              sample.i = m0.i;
            }
            if (currentProbes[1]) {
              const m1 = measureTarget(currentProbes[1].targetId, currentProbes[1].type);
              sample.v1 = m1.v;
              sample.i1 = m1.i;
            }
            if (currentProbes[2]) {
              const m2 = measureTarget(currentProbes[2].targetId, currentProbes[2].type);
              sample.v2 = m2.v;
              sample.i2 = m2.i;
            }

            samplesBufferRef.current.push(sample);
            if (samplesBufferRef.current.length > 2500) {
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

        const now = performance.now();
        if (
          !isScopePaused &&
          samplesBufferRef.current.length > 0 &&
          now - lastScopeUpdateRef.current >= 30
        ) {
          lastScopeUpdateRef.current = now;
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
  }, [isRunning, simSpeed, components, wires, isScopePaused, soundEnabled, timebase, selectedComponentId, selectedWireId]);

  const handleResetSim = () => {
    simulatorRef.current.reset();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
    // Reset all live component states and un-blow blown LEDs
    setComponents((prev) =>
      prev.map((c) => ({
        ...c,
        state: undefined,
      }))
    );
    setIsRunning(true);
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

  const handleConnectWireToWire = (
    fromPinId: string,
    targetWireId: string,
    midPoint: { x: number; y: number }
  ) => {
    recordSnapshot();
    const targetWire = wires.find((w) => w.id === targetWireId);
    if (!targetWire) return;

    // Create a junction component at the wire's midpoint
    const junctionComp = createComponent('junction', midPoint.x, midPoint.y);
    const junctionPinId = junctionComp.pins[0].id;

    // Split targetWire into two segments connected through the junction
    const wireA: Wire = {
      id: generateId('wire'),
      fromPinId: targetWire.fromPinId,
      toPinId: junctionPinId,
    };
    const wireB: Wire = {
      id: generateId('wire'),
      fromPinId: junctionPinId,
      toPinId: targetWire.toPinId,
    };
    // Connect new wire from the source pin to the junction
    const wireC: Wire = {
      id: generateId('wire'),
      fromPinId,
      toPinId: junctionPinId,
    };

    setComponents((prev) => [...prev, junctionComp]);
    setWires((prev) => [
      ...prev.filter((w) => w.id !== targetWireId),
      wireA,
      wireB,
      wireC,
    ]);
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

  const handleTogglePushButton = (comp: CircuitComponent) => {
    recordSnapshot();
    setComponents((prev) =>
      prev.map((c) =>
        c.id === comp.id
          ? {
              ...c,
              params: { ...c.params, pressed: !(c.params.pressed ?? false) },
            }
          : c
      )
    );
  };

  const handlePressPushButton = (comp: CircuitComponent, pressed: boolean) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.id === comp.id
          ? {
              ...c,
              params: { ...c.params, pressed },
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
        if (lastProbedCompRef.current?.id === selectedComponentId) {
          lastProbedCompRef.current = null;
        }
      }
      setComponents((prev) => prev.filter((c) => c.id !== selectedComponentId));
      setSelectedComponentId(null);
    } else if (selectedWireId) {
      recordSnapshot();
      setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
      setSelectedWireId(null);
    }
  };

  // Probe management for Oscilloscope (up to 3 simultaneous channels)
  const handleAutoProbeOnSelect = useCallback(
    (id: string, type: 'component' | 'wire') => {
      let name = 'Probe';
      if (type === 'component') {
        const c = componentsRef.current.find((comp) => comp.id === id);
        if (!c) return;
        name = c.name;
      } else {
        const w = wiresRef.current.find((wire) => wire.id === id);
        if (!w) return;
        name = `Wire (${id.slice(-4)})`;
      }

      setProbes((prev) => {
        const existingIdx = prev.findIndex((p) => p.targetId === id);
        if (existingIdx !== -1) {
          setActiveChannelIndex(existingIdx);
          return prev;
        }

        if (prev.length < 3) {
          const nextIdx = prev.length;
          const newProbe: ScopeProbe = {
            id: `ch_${Date.now()}_${nextIdx}`,
            type,
            targetId: id,
            name,
            color: CHANNEL_COLORS[nextIdx],
            channelIndex: nextIdx,
          };
          setActiveChannelIndex(nextIdx);
          return [...prev, newProbe];
        }

        const updated = [...prev];
        updated[activeChannelIndex] = {
          id: `ch_${Date.now()}_${activeChannelIndex}`,
          type,
          targetId: id,
          name,
          color: CHANNEL_COLORS[activeChannelIndex],
          channelIndex: activeChannelIndex,
        };
        return updated;
      });
    },
    [activeChannelIndex]
  );

  const handleToggleScopeForTarget = useCallback(
    (comp: CircuitComponent | null, wire: Wire | null) => {
      if (!isScopeOpen) {
        const targetId = comp?.id ?? wire?.id;
        const targetType = comp ? 'component' : 'wire';
        if (targetId) {
          handleAutoProbeOnSelect(targetId, targetType);
        }
        setIsScopeOpen(true);
      } else {
        setIsScopeOpen(false);
      }
    },
    [isScopeOpen, handleAutoProbeOnSelect]
  );

  const handleRemoveProbe = useCallback((channelIdx: number) => {
    setProbes((prev) => {
      if (prev.length <= 1) return prev; // Retain at least 1 probe
      const filtered = prev.filter((_, idx) => idx !== channelIdx);
      return filtered.map((p, idx) => ({
        ...p,
        channelIndex: idx,
        color: CHANNEL_COLORS[idx] || '#f97316',
      }));
    });
    setActiveChannelIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // V and I toggles:
  // For multiple components (> 1), only show ONE parameter: voltage or current
  // For single component (= 1), current and voltage can be shown depending on what user selects, voltage by default
  const handleToggleVoltage = useCallback(() => {
    if (probes.length > 1) {
      setShowVoltage(true);
      setShowCurrent(false);
    } else {
      setShowVoltage((prevV) => {
        if (prevV && !showCurrent) return prevV;
        return !prevV;
      });
    }
  }, [probes.length, showCurrent]);

  const handleToggleCurrent = useCallback(() => {
    if (probes.length > 1) {
      setShowVoltage(false);
      setShowCurrent(true);
    } else {
      setShowCurrent((prevI) => {
        if (prevI && !showVoltage) return prevI;
        return !prevI;
      });
    }
  }, [probes.length, showVoltage]);

  // When more than 1 component is on the scope, enforce single parameter display
  useEffect(() => {
    if (probes.length > 1 && showVoltage && showCurrent) {
      setShowCurrent(false);
    }
  }, [probes.length, showVoltage, showCurrent]);

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
    lastProbedCompRef.current = preset.components[0] ?? null;

    if (preset.defaultScope?.timebase) {
      setTimebase(preset.defaultScope.timebase);
    }
    if (preset.defaultScope?.voltsPerDiv) {
      setVoltsPerDiv(preset.defaultScope.voltsPerDiv);
    }

    // Configure multi-channel oscilloscope traces matching preset
    if (preset.id === 'bridge_rectifier') {
      const ac = preset.components.find((c) => c.type === 'ac_source');
      const cap = preset.components.find((c) => c.type === 'capacitor');
      const led = preset.components.find((c) => c.type === 'led');
      const presetProbes: ScopeProbe[] = [];
      if (ac) {
        presetProbes.push({
          id: 'ch0',
          type: 'component',
          targetId: ac.id,
          name: 'AC 100Hz',
          color: '#f97316',
          channelIndex: 0,
        });
      }
      if (cap) {
        presetProbes.push({
          id: 'ch1',
          type: 'component',
          targetId: cap.id,
          name: '10 µF Cap',
          color: '#06b6d4',
          channelIndex: 1,
        });
      }
      if (led) {
        presetProbes.push({
          id: 'ch2',
          type: 'component',
          targetId: led.id,
          name: 'Red LED',
          color: '#10b981',
          channelIndex: 2,
        });
      }
      setProbes(presetProbes);
      setActiveChannelIndex(0);
      setIsScopeOpen(true);
    } else if (preset.id === 'rc_filter') {
      const src = preset.components.find((c) => c.type === 'ac_source');
      const cap = preset.components.find((c) => c.type === 'capacitor');
      const presetProbes: ScopeProbe[] = [];
      if (src) {
        presetProbes.push({
          id: 'ch0',
          type: 'component',
          targetId: src.id,
          name: 'AC Input',
          color: '#f97316',
          channelIndex: 0,
        });
      }
      if (cap) {
        presetProbes.push({
          id: 'ch1',
          type: 'component',
          targetId: cap.id,
          name: 'V_out (Cap)',
          color: '#06b6d4',
          channelIndex: 1,
        });
      }
      setProbes(presetProbes);
      setActiveChannelIndex(0);
    } else {
      const p0 = preset.components[0];
      const p1 = preset.components[2] ?? preset.components[1];
      const presetProbes: ScopeProbe[] = [];
      if (p0) {
        presetProbes.push({
          id: 'ch0',
          type: 'component',
          targetId: p0.id,
          name: p0.name,
          color: '#f97316',
          channelIndex: 0,
        });
      }
      if (p1 && preset.components.length > 2) {
        presetProbes.push({
          id: 'ch1',
          type: 'component',
          targetId: p1.id,
          name: p1.name,
          color: '#06b6d4',
          channelIndex: 1,
        });
      }
      setProbes(
        presetProbes.length > 0
          ? presetProbes
          : [
              {
                id: 'ch0',
                type: 'component',
                targetId: '',
                name: 'CH 1',
                color: '#f97316',
                channelIndex: 0,
              },
            ]
      );
      setActiveChannelIndex(0);
    }
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
    lastProbedCompRef.current = null;
  };

  // Export JSON
  const handleExportJson = () => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      components,
      wires,
      timebase,
      voltsPerDiv,
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
          if (parsed.voltsPerDiv) setVoltsPerDiv(parsed.voltsPerDiv);
          lastProbedCompRef.current = parsed.components[0] ?? null;
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
    <div className="flex flex-col h-screen h-[100dvh] w-screen overflow-hidden bg-[#101114] text-[#eceff4] font-sans">
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
        onOpenMobilePalette={() => setIsMobilePaletteOpen(true)}
        isScopeOpen={isScopeOpen}
        onToggleScope={() => setIsScopeOpen(!isScopeOpen)}
        selectedComponentName={selectedComp ? selectedComp.name : null}
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
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <CircuitCanvas
            components={components}
            wires={wires}
            selectedComponentId={selectedComponentId}
            selectedWireId={selectedWireId}
            onSelectComponent={(id) => {
              setSelectedComponentId(id);
              if (id) {
                setSelectedWireId(null);
                if (isScopeOpen) {
                  handleAutoProbeOnSelect(id, 'component');
                }
              }
            }}
            onSelectWire={(id) => {
              setSelectedWireId(id);
              if (id) {
                setSelectedComponentId(null);
                if (isScopeOpen) {
                  handleAutoProbeOnSelect(id, 'wire');
                }
              }
            }}
            onUpdateComponentPosition={handleUpdateComponentPosition}
            onRotateComponent={handleRotateComponent}
            onDeleteSelected={handleDeleteSelected}
            onAddWire={handleAddWire}
            onToggleSwitch={handleToggleSwitch}
            onTogglePushButton={handleTogglePushButton}
            onPressPushButton={handlePressPushButton}
            onWiperChange={handleWiperChange}
            onConnectWireToWire={handleConnectWireToWire}
            onUpdateComponentParams={handleUpdateComponentParams}
            isRunning={isRunning}
            flowMode={flowMode}
            showVoltColors={showVoltColors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />

          {/* Floating Action Toolbar for Selected Component (Icon-only to prevent overflow) */}
          {selectedComp && (
            <div className={`absolute ${isScopeOpen ? 'bottom-[295px]' : 'bottom-[max(1.75rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] sm:bottom-6'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#15171c]/95 backdrop-blur-md border border-[#2b2f3a] p-1 px-1.5 rounded-xl shadow-2xl text-xs text-[#e4e7ee] max-w-[95vw]`}>
              {/* Scope Graph Button */}
              <button
                onClick={() => handleToggleScopeForTarget(selectedComp, null)}
                className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                  isScopeOpen
                    ? 'bg-[#1a2536] border-[#38bdf8] text-[#38bdf8]'
                    : 'bg-[#1a2332] hover:bg-[#223045] active:bg-[#151c27] border-[#2b4162] text-[#38bdf8]'
                }`}
                title="View on Multi-Channel Oscilloscope"
                aria-label="Oscilloscope waveform"
              >
                <Activity className="w-4 h-4 text-[#38bdf8]" />
              </button>

              {/* Rotate Button */}
              <button
                onClick={() => handleRotateComponent(selectedComp.id)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] active:bg-[#181a20] border border-[#2d313c] text-[#e4e7ee] flex items-center justify-center cursor-pointer transition-colors"
                title="Rotate Component (R)"
                aria-label="Rotate Component"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Edit / Inspect Parameters Button */}
              <button
                onClick={() => setIsMobileInspectorOpen(true)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] active:bg-[#181a20] border border-[#2d313c] text-[#e4e7ee] flex items-center justify-center cursor-pointer transition-colors"
                title="Edit Component Parameters"
                aria-label="Edit Parameters"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Duplicate Button */}
              <button
                onClick={() => handleDuplicateComponent(selectedComp)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] active:bg-[#181a20] border border-[#2d313c] text-[#e4e7ee] flex items-center justify-center cursor-pointer transition-colors"
                title="Duplicate Component"
                aria-label="Duplicate Component"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Delete Button */}
              <button
                onClick={handleDeleteSelected}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#2a1b1f] hover:bg-[#382025] active:bg-[#221517] text-[#f87171] border border-[#4a242a] flex items-center justify-center cursor-pointer transition-colors"
                title="Delete Component (Del)"
                aria-label="Delete Component"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-[#2d313c] mx-0.5" />

              {/* Deselect Button */}
              <button
                onClick={() => {
                  setSelectedComponentId(null);
                  setIsMobileInspectorOpen(false);
                }}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] text-[#9ca3af] hover:text-white border border-[#2d313c] flex items-center justify-center cursor-pointer transition-colors"
                title="Deselect (Esc)"
                aria-label="Deselect"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Floating Action Toolbar for Selected Wire (Icon-only to prevent overflow) */}
          {selectedWire && !selectedComp && (
            <div className={`absolute ${isScopeOpen ? 'bottom-[295px]' : 'bottom-[max(1.75rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))] sm:bottom-6'} left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#15171c]/95 backdrop-blur-md border border-[#2b2f3a] p-1 px-1.5 rounded-xl shadow-2xl text-xs text-[#e4e7ee] max-w-[95vw]`}>
              <button
                onClick={() => handleToggleScopeForTarget(null, selectedWire)}
                className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                  isScopeOpen
                    ? 'bg-[#1a2536] border-[#38bdf8] text-[#38bdf8]'
                    : 'bg-[#1a2332] text-[#38bdf8] hover:bg-[#223045] border-[#2b4162]'
                }`}
                title="View Wire Voltage on Oscilloscope"
                aria-label="Oscilloscope waveform"
              >
                <Activity className="w-4 h-4 text-[#38bdf8]" />
              </button>
              <button
                onClick={() => setIsMobileInspectorOpen(true)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] text-[#e4e7ee] hover:bg-[#292d36] border border-[#2d313c] flex items-center justify-center cursor-pointer transition-colors"
                title="Wire Info"
                aria-label="Wire Info"
              >
                <Sliders className="w-4 h-4" />
              </button>
              <button
                onClick={handleDeleteSelected}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#2a1b1f] text-[#f87171] hover:bg-[#382025] border border-[#4a242a] flex items-center justify-center cursor-pointer transition-colors"
                title="Delete Wire (Del)"
                aria-label="Delete Wire"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedWireId(null);
                  setIsMobileInspectorOpen(false);
                }}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] text-[#9ca3af] hover:text-white border border-[#2d313c] flex items-center justify-center cursor-pointer transition-colors"
                title="Deselect (Esc)"
                aria-label="Deselect"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Floating Add Button (Always accessible when palette drawer is closed) */}
          {!isMobilePaletteOpen && (
            <button
              onClick={() => setIsMobilePaletteOpen(true)}
              className={`md:hidden absolute ${isScopeOpen ? 'bottom-[295px]' : 'bottom-[max(1.75rem,calc(env(safe-area-inset-bottom,0px)+1.5rem))]'} right-4 z-40 w-12 h-12 rounded-xl bg-[#1c2432] hover:bg-[#253246] active:bg-[#161c28] border border-[#2e405a] text-[#38bdf8] active:scale-95 shadow-2xl flex items-center justify-center font-bold text-2xl transition-all cursor-pointer`}
              title="Add Component"
              aria-label="Add Component"
            >
              +
            </button>
          )}

          {/* Bottom Docked Multi-Channel Digital Oscilloscope */}
          <Oscilloscope
            isOpen={isScopeOpen}
            onClose={() => setIsScopeOpen(false)}
            samples={scopeSamples}
            probes={probes}
            activeChannelIndex={activeChannelIndex}
            onSelectChannel={setActiveChannelIndex}
            onRemoveProbe={handleRemoveProbe}
            onAddCurrentSelectedProbe={() =>
              handleAutoProbeOnSelect(
                selectedComp?.id || selectedWire?.id || '',
                selectedComp ? 'component' : 'wire'
              )
            }
            selectedComponent={selectedComp ?? lastProbedCompRef.current}
            selectedWire={selectedWire}
            timebase={timebase}
            onTimebaseChange={setTimebase}
            voltsPerDiv={voltsPerDiv}
            onVoltsPerDivChange={setVoltsPerDiv}
            offsetY={offsetY}
            onOffsetYChange={setOffsetY}
            coupling={coupling}
            onCouplingChange={setCoupling}
            isPaused={isScopePaused}
            onTogglePause={() => setIsScopePaused(!isScopePaused)}
            onClearSamples={() => {
              samplesBufferRef.current = [];
              setScopeSamples([]);
            }}
            soundEnabled={soundEnabled}
            onToggleSound={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              audioEngine.setMuted(!next);
            }}
            showVoltage={showVoltage}
            showCurrent={showCurrent}
            onToggleVoltage={handleToggleVoltage}
            onToggleCurrent={handleToggleCurrent}
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
            onOpenScope={() => handleToggleScopeForTarget(selectedComp, selectedWire)}
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
