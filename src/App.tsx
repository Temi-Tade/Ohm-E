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
import { ExportModal } from './components/ExportModal';
import { ToastContainer, ToastMessage, ToastVariant } from './components/ToastContainer';
import { evaluateTopologyFaults, evaluateRuntimeFaults } from './engine/faultDetection';

const CHANNEL_COLORS = ['#f97316', '#06b6d4', '#10b981']; // Ch0 Orange, Ch1 Cyan, Ch2 Emerald Green
const WORKSPACE_STORAGE_KEY = 'ohm_e_workspace_v1';

interface CircuitSnapshot {
  components: CircuitComponent[];
  wires: Wire[];
}

interface SavedWorkspace {
  version: 1;
  components: CircuitComponent[];
  wires: Wire[];
  isRunning: boolean;
  simSpeed: number;
  flowMode: 'conventional' | 'electron' | 'none';
  showVoltColors: boolean;
  soundEnabled: boolean;
  isScopeOpen: boolean;
  timebase: number;
  voltsPerDiv: number;
  coupling: 'dc' | 'ac';
  showVoltage: boolean;
  showCurrent: boolean;
  probes: ScopeProbe[];
  activeChannelIndex: number;
}

function createDefaultWorkspace(preset: CircuitPreset): SavedWorkspace {
  return {
    version: 1,
    components: preset.components,
    wires: preset.wires,
    isRunning: true,
    simSpeed: 1.0,
    flowMode: 'conventional',
    showVoltColors: true,
    soundEnabled: false,
    isScopeOpen: false,
    timebase: preset.defaultScope?.timebase ?? 0.002,
    voltsPerDiv: preset.defaultScope?.voltsPerDiv ?? 2.0,
    coupling: 'dc',
    showVoltage: true,
    showCurrent: false,
    probes: [],
    activeChannelIndex: 0,
  };
}

function loadSavedWorkspace(fallbackPreset: CircuitPreset): SavedWorkspace {
  const defaults = createDefaultWorkspace(fallbackPreset);
  if (typeof window === 'undefined') return defaults;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) {
      return defaults;
    }

    const validComponents: CircuitComponent[] = parsed.components
      .filter(
        (c: unknown): c is CircuitComponent =>
          Boolean(c) &&
          typeof c === 'object' &&
          typeof (c as CircuitComponent).id === 'string' &&
          typeof (c as CircuitComponent).type === 'string' &&
          typeof (c as CircuitComponent).x === 'number' &&
          typeof (c as CircuitComponent).y === 'number' &&
          Array.isArray((c as CircuitComponent).pins)
      )
      .map((c: CircuitComponent) => ({
        ...c,
        rotation: typeof c.rotation === 'number' ? c.rotation : 0,
        params: c.params && typeof c.params === 'object' ? c.params : {},
        state: undefined,
      }));

    const pinIds = new Set<string>();
    const compIds = new Set<string>();
    for (const c of validComponents) {
      compIds.add(c.id);
      for (const p of c.pins) pinIds.add(p.id);
    }

    const validWires: Wire[] = parsed.wires
      .filter(
        (w: unknown): w is Wire =>
          Boolean(w) &&
          typeof w === 'object' &&
          typeof (w as Wire).id === 'string' &&
          typeof (w as Wire).fromPinId === 'string' &&
          typeof (w as Wire).toPinId === 'string' &&
          pinIds.has((w as Wire).fromPinId) &&
          pinIds.has((w as Wire).toPinId)
      )
      .map((w: Wire) => ({
        id: w.id,
        fromPinId: w.fromPinId,
        toPinId: w.toPinId,
      }));

    const wireIds = new Set(validWires.map((w) => w.id));
    const validProbes: ScopeProbe[] = Array.isArray(parsed.probes)
      ? parsed.probes
          .filter(
            (p: unknown): p is ScopeProbe =>
              Boolean(p) &&
              typeof p === 'object' &&
              typeof (p as ScopeProbe).targetId === 'string' &&
              (((p as ScopeProbe).type === 'component' && compIds.has((p as ScopeProbe).targetId)) ||
                ((p as ScopeProbe).type === 'wire' && wireIds.has((p as ScopeProbe).targetId)))
          )
          .slice(0, 3)
          .map((p: ScopeProbe, idx: number) => ({
            ...p,
            channelIndex: idx,
            color: CHANNEL_COLORS[idx] || '#f97316',
          }))
      : [];

    const flowMode =
      parsed.flowMode === 'conventional' || parsed.flowMode === 'electron' || parsed.flowMode === 'none'
        ? parsed.flowMode
        : defaults.flowMode;

    return {
      version: 1,
      components: validComponents,
      wires: validWires,
      isRunning: typeof parsed.isRunning === 'boolean' ? parsed.isRunning : defaults.isRunning,
      simSpeed:
        typeof parsed.simSpeed === 'number' && parsed.simSpeed >= 0.25 && parsed.simSpeed <= 4
          ? parsed.simSpeed
          : defaults.simSpeed,
      flowMode,
      showVoltColors:
        typeof parsed.showVoltColors === 'boolean' ? parsed.showVoltColors : defaults.showVoltColors,
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaults.soundEnabled,
      isScopeOpen:
        typeof parsed.isScopeOpen === 'boolean' ? parsed.isScopeOpen : defaults.isScopeOpen,
      timebase:
        typeof parsed.timebase === 'number' && parsed.timebase > 0
          ? parsed.timebase
          : defaults.timebase,
      voltsPerDiv:
        typeof parsed.voltsPerDiv === 'number' && parsed.voltsPerDiv > 0
          ? parsed.voltsPerDiv
          : defaults.voltsPerDiv,
      coupling: parsed.coupling === 'ac' ? 'ac' : 'dc',
      showVoltage:
        typeof parsed.showVoltage === 'boolean' ? parsed.showVoltage : defaults.showVoltage,
      showCurrent:
        typeof parsed.showCurrent === 'boolean' ? parsed.showCurrent : defaults.showCurrent,
      probes: validProbes,
      activeChannelIndex:
        typeof parsed.activeChannelIndex === 'number' &&
        parsed.activeChannelIndex >= 0 &&
        parsed.activeChannelIndex < validProbes.length
          ? parsed.activeChannelIndex
          : 0,
    };
  } catch {
    return defaults;
  }
}

export default function App() {
  const presets = useRef<CircuitPreset[]>(getPresetCircuits()).current;
  const initialWorkspace = useRef<SavedWorkspace | null>(null);
  if (!initialWorkspace.current) {
    initialWorkspace.current = loadSavedWorkspace(presets[0]);
  }
  const initWs = initialWorkspace.current;

  // Circuit topology state
  const [components, setComponents] = useState<CircuitComponent[]>(initWs.components);
  const [wires, setWires] = useState<Wire[]>(initWs.wires);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState<CircuitSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<CircuitSnapshot[]>([]);

  // Selection
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);

  // Simulation parameters
  const [isRunning, setIsRunning] = useState<boolean>(initWs.isRunning);
  const [simSpeed, setSimSpeed] = useState<number>(initWs.simSpeed);
  const [flowMode, setFlowMode] = useState<'conventional' | 'electron' | 'none'>(initWs.flowMode);
  const [showVoltColors, setShowVoltColors] = useState<boolean>(initWs.showVoltColors);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initWs.soundEnabled);

  // Oscilloscope state (multi-channel probes, V / I / Both modes)
  const [timebase, setTimebase] = useState<number>(initWs.timebase);
  const [voltsPerDiv, setVoltsPerDiv] = useState<number>(initWs.voltsPerDiv);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [coupling, setCoupling] = useState<'dc' | 'ac'>(initWs.coupling);
  const [isScopePaused, setIsScopePaused] = useState<boolean>(false);
  const [scopeSamples, setScopeSamples] = useState<ScopeSample[]>([]);
  const [isScopeOpen, setIsScopeOpen] = useState<boolean>(initWs.isScopeOpen);
  const [showVoltage, setShowVoltage] = useState<boolean>(initWs.showVoltage);
  const [showCurrent, setShowCurrent] = useState<boolean>(initWs.showCurrent);
  const [activeChannelIndex, setActiveChannelIndex] = useState<number>(initWs.activeChannelIndex);

  // Multi-channel probe configuration (up to 3 simultaneous channels, empty until user selects)
  const [probes, setProbes] = useState<ScopeProbe[]>(initWs.probes);
  const probesRef = useRef<ScopeProbe[]>(probes);
  useEffect(() => {
    probesRef.current = probes;
  }, [probes]);

  // Mobile drawer & modal state
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState<boolean>(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState<boolean>(false);

  // Help & Export modals
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

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

  // Toast notifications & edge-triggered electrical fault tracking
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const activeTopologyFaultsRef = useRef<Set<string>>(new Set());
  const activeRuntimeFaultsRef = useRef<Set<string>>(new Set());
  const storageWarnedRef = useRef<boolean>(false);

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (variant: ToastVariant, title: string, description?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const duration = variant === 'error' || variant === 'warning' ? 5000 : 3200;

      setToasts((prev) => {
        const filtered = prev.filter(
          (t) => !(t.title === title && t.description === description)
        );
        return [...filtered.slice(-2), { id, variant, title, description }];
      });

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, duration);
      toastTimersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const syncRuntimeFaults = useCallback(
    (comps: CircuitComponent[], result: SimulationResult | null) => {
      const faults = evaluateRuntimeFaults(comps, result);
      const nextKeys = new Set(faults.map((f) => f.key));
      for (const f of faults) {
        if (!activeRuntimeFaultsRef.current.has(f.key)) {
          addToast(f.variant, f.title, f.description);
        }
      }
      activeRuntimeFaultsRef.current = nextKeys;
    },
    [addToast]
  );

  // Sync mute state with saved audio setting
  useEffect(() => {
    audioEngine.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Detect topological short circuits immediately on wiring changes (even when paused)
  useEffect(() => {
    const faults = evaluateTopologyFaults(components, wires);
    const nextKeys = new Set(faults.map((f) => f.key));
    for (const f of faults) {
      if (!activeTopologyFaultsRef.current.has(f.key)) {
        addToast(f.variant, f.title, f.description);
      }
    }
    activeTopologyFaultsRef.current = nextKeys;
  }, [components, wires, addToast]);

  // LocalStorage persistence (debounced during edits + synchronous flush on page leave)
  const latestPersistableRef = useRef<SavedWorkspace>(initWs);
  latestPersistableRef.current = {
    version: 1,
    components: components.map(({ state: _state, ...rest }) => rest),
    wires: wires.map(({ id, fromPinId, toPinId }) => ({ id, fromPinId, toPinId })),
    isRunning,
    simSpeed,
    flowMode,
    showVoltColors,
    soundEnabled,
    isScopeOpen,
    timebase,
    voltsPerDiv,
    coupling,
    showVoltage,
    showCurrent,
    probes,
    activeChannelIndex,
  };

  const flushWorkspaceToStorage = useCallback(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify(latestPersistableRef.current)
      );
      storageWarnedRef.current = false;
    } catch {
      if (!storageWarnedRef.current) {
        storageWarnedRef.current = true;
        addToast('warning', 'Auto-save unavailable', 'Browser storage is full or disabled.');
      }
    }
  }, [addToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      flushWorkspaceToStorage();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    components,
    wires,
    isRunning,
    simSpeed,
    flowMode,
    showVoltColors,
    soundEnabled,
    isScopeOpen,
    timebase,
    voltsPerDiv,
    coupling,
    showVoltage,
    showCurrent,
    probes,
    activeChannelIndex,
    flushWorkspaceToStorage,
  ]);

  useEffect(() => {
    window.addEventListener('beforeunload', flushWorkspaceToStorage);
    window.addEventListener('pagehide', flushWorkspaceToStorage);
    return () => {
      window.removeEventListener('beforeunload', flushWorkspaceToStorage);
      window.removeEventListener('pagehide', flushWorkspaceToStorage);
    };
  }, [flushWorkspaceToStorage]);

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

  // Keyboard Shortcuts for Undo, Redo, and Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!isHelpOpen && !isExportOpen) {
          e.preventDefault();
          setIsRunning((prev) => !prev);
        }
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
  }, [handleUndo, handleRedo, isHelpOpen, isExportOpen]);

  // Main Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const elapsedSec = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;

      if (isRunning) {
        // dt = 0.00005 (50 us) gives high-density smooth waveforms and accurate transient integration
        const dt = 0.00005;
        const totalSimDelta = elapsedSec * simSpeed * 0.35;
        const numSteps = Math.min(Math.max(Math.round(totalSimDelta / dt), 1), 120);

        let lastResult: SimulationResult | null = null;

        for (let step = 0; step < numSteps; step++) {
          simTimeRef.current += dt;
          lastResult = simulatorRef.current.step(
            components,
            wires,
            simTimeRef.current,
            dt
          );

          const targetSampleDt = Math.max(0.00005, (timebase * 10) / 800);
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

        if (lastResult) {
          syncRuntimeFaults(componentsRef.current, lastResult);
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
  }, [isRunning, simSpeed, components, wires, isScopePaused, soundEnabled, timebase, selectedComponentId, selectedWireId, syncRuntimeFaults]);

  const handleResetSim = () => {
    simulatorRef.current.reset();
    activeRuntimeFaultsRef.current.clear();
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
    addToast('info', 'Simulation restarted', 'Circuit time and component states reset.');
  };

  // Add component to canvas snapped to the 20px grid
  const handleAddComponent = (type: ComponentType) => {
    recordSnapshot();
    const x = Math.round((360 + (Math.random() - 0.5) * 80) / 20) * 20;
    const y = Math.round((260 + (Math.random() - 0.5) * 80) / 20) * 20;
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
    if (alreadyConnected) {
      addToast('info', 'Already connected', 'A wire already connects these terminals.');
      return;
    }

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
    addToast('info', `Duplicated ${comp.name}`);
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
        const deletedWireIds = new Set(
          wires.filter((w) => pinIds.has(w.fromPinId) || pinIds.has(w.toPinId)).map((w) => w.id)
        );
        setWires((prev) =>
          prev.filter((w) => !pinIds.has(w.fromPinId) && !pinIds.has(w.toPinId))
        );
        setProbes((prev) =>
          prev
            .filter((p) => p.targetId !== selectedComponentId && !deletedWireIds.has(p.targetId))
            .map((p, idx) => ({
              ...p,
              channelIndex: idx,
              color: CHANNEL_COLORS[idx] || '#f97316',
            }))
        );
      }
      setComponents((prev) => prev.filter((c) => c.id !== selectedComponentId));
      setSelectedComponentId(null);
    } else if (selectedWireId) {
      recordSnapshot();
      setWires((prev) => prev.filter((w) => w.id !== selectedWireId));
      setProbes((prev) =>
        prev
          .filter((p) => p.targetId !== selectedWireId)
          .map((p, idx) => ({
            ...p,
            channelIndex: idx,
            color: CHANNEL_COLORS[idx] || '#f97316',
          }))
      );
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

      const prevProbes = probesRef.current;
      if (prevProbes.length >= 3 && !prevProbes.some((p) => p.targetId === id)) {
        addToast('info', `Scope CH${activeChannelIndex + 1} updated`, `Now probing ${name}.`);
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
    [activeChannelIndex, addToast]
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
    activeTopologyFaultsRef.current.clear();
    activeRuntimeFaultsRef.current.clear();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
    setComponents(preset.components);
    setWires(preset.wires);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setFitTrigger((n) => n + 1);

    if (preset.defaultScope?.timebase) {
      setTimebase(preset.defaultScope.timebase);
    }
    if (preset.defaultScope?.voltsPerDiv) {
      setVoltsPerDiv(preset.defaultScope.voltsPerDiv);
    }

    // Do not preselect components on the oscilloscope; only show user-selected components
    setProbes([]);
    setActiveChannelIndex(0);
    const count = preset.components.filter((c) => c.type !== 'junction').length;
    addToast('success', `Loaded ${preset.name}`, `${count} components, ${preset.wires.length} wires.`);
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    const hadItems = components.length > 0 || wires.length > 0;
    recordSnapshot();
    simulatorRef.current.reset();
    activeTopologyFaultsRef.current.clear();
    activeRuntimeFaultsRef.current.clear();
    simTimeRef.current = 0;
    samplesBufferRef.current = [];
    setScopeSamples([]);
    setComponents([]);
    setWires([]);
    setProbes([]);
    setActiveChannelIndex(0);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    if (hadItems) {
      addToast('info', 'Canvas cleared', 'Removed all components and wires.');
    }
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
        const importedComponents = parsed.components ?? parsed.internalComponents;
        const importedWires = parsed.wires ?? parsed.internalWires;
        if (Array.isArray(importedComponents) && Array.isArray(importedWires)) {
          recordSnapshot();
          simulatorRef.current.reset();
          activeTopologyFaultsRef.current.clear();
          activeRuntimeFaultsRef.current.clear();
          simTimeRef.current = 0;
          samplesBufferRef.current = [];
          setScopeSamples([]);
          setComponents(importedComponents);
          setWires(importedWires);
          setSelectedComponentId(null);
          setSelectedWireId(null);
          setProbes([]);
          setActiveChannelIndex(0);
          setFitTrigger((n) => n + 1);
          if (parsed.timebase) setTimebase(parsed.timebase);
          if (parsed.voltsPerDiv) setVoltsPerDiv(parsed.voltsPerDiv);
          const importedCount = importedComponents.filter(
            (c: CircuitComponent) => c.type !== 'junction'
          ).length;
          addToast(
            'success',
            'Circuit imported',
            `${file.name} (${importedCount} components, ${importedWires.length} wires)`
          );
        } else {
          addToast(
            'error',
            'Import failed',
            'File does not contain valid components and wires.'
          );
        }
      } catch {
        addToast('error', 'Import failed', 'Selected file is not valid schematic JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedComp = components.find((c) => c.id === selectedComponentId) || null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) || null;

  return (
    <div className="fixed inset-0 flex flex-col w-full overflow-hidden bg-[#101114] text-[#eceff4] font-sans">
      {/* Top Application Toolbar */}
      <Toolbar
        isRunning={isRunning}
        onToggleRun={() => setIsRunning(!isRunning)}
        onStepOnce={() => {
          simTimeRef.current += 0.0005;
          const stepRes = simulatorRef.current.step(
            components,
            wires,
            simTimeRef.current,
            0.0005
          );
          syncRuntimeFaults(componentsRef.current, stepRes);
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
        onExportJson={() => setIsExportOpen(true)}
        onImportJson={handleImportJson}
        onOpenHelp={() => setIsHelpOpen(true)}
        isScopeOpen={isScopeOpen}
        onToggleScope={() => setIsScopeOpen(!isScopeOpen)}
      />

      {/* Main Workspace: Palette on Left, Canvas in Center, Inspector on Right */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Component Palette Library (Desktop Sidebar & Mobile Slide-Over Drawer) */}
        <ComponentPalette
          onAddComponent={handleAddComponent}
          isOpenMobile={isMobilePaletteOpen}
          onCloseMobile={() => setIsMobilePaletteOpen(false)}
        />

        {/* Center Drag & Drop Schematic Canvas + Bottom Docked Oscilloscope */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* Canvas Viewport Wrapper: floating buttons are anchored relative to THIS box (above Oscilloscope & never clipped by 100vh) */}
          <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
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
              fitTrigger={fitTrigger}
            />

            {/* Floating Action Toolbar for Selected Component */}
            {selectedComp && (
              <div
                className={`absolute ${
                  isScopeOpen
                    ? 'bottom-3'
                    : 'bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] sm:bottom-6'
                } left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#15171c]/95 backdrop-blur-md border border-[#2b2f3a] p-1 px-1.5 rounded-xl shadow-2xl text-xs text-[#e4e7ee] max-w-[95vw]`}
              >
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

                {/* Edit / Inspect Parameters Button (Mobile only since Desktop sidebar is always visible) */}
                <button
                  onClick={() => setIsMobileInspectorOpen(true)}
                  className="md:hidden w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] hover:bg-[#292d36] active:bg-[#181a20] border border-[#2d313c] text-[#e4e7ee] flex items-center justify-center cursor-pointer transition-colors"
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

            {/* Floating Action Toolbar for Selected Wire */}
            {selectedWire && !selectedComp && (
              <div
                className={`absolute ${
                  isScopeOpen
                    ? 'bottom-3'
                    : 'bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] sm:bottom-6'
                } left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#15171c]/95 backdrop-blur-md border border-[#2b2f3a] p-1 px-1.5 rounded-xl shadow-2xl text-xs text-[#e4e7ee] max-w-[95vw]`}
              >
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
                  className="md:hidden w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg bg-[#20232a] text-[#e4e7ee] hover:bg-[#292d36] border border-[#2d313c] flex items-center justify-center cursor-pointer transition-colors"
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

            {/* Mobile Floating Add Button (shifts cleanly above selection toolbar if one is visible so neither overlaps or clips) */}
            {!isMobilePaletteOpen && (
              <button
                onClick={() => setIsMobilePaletteOpen(true)}
                className={`md:hidden absolute ${
                  selectedComp || selectedWire
                    ? isScopeOpen
                      ? 'bottom-16'
                      : 'bottom-[max(4.5rem,calc(env(safe-area-inset-bottom,0px)+4.25rem))]'
                    : isScopeOpen
                    ? 'bottom-3'
                    : 'bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))]'
                } right-3 z-40 w-12 h-12 rounded-xl bg-[#1c2432] hover:bg-[#253246] active:bg-[#161c28] border border-[#2e405a] text-[#38bdf8] active:scale-95 shadow-2xl flex items-center justify-center font-bold text-2xl transition-all cursor-pointer`}
                title="Add Component"
                aria-label="Add Component"
              >
                +
              </button>
            )}
          </div>

          {/* Bottom Docked Multi-Channel Digital Oscilloscope */}
          <Oscilloscope
            isOpen={isScopeOpen}
            onClose={() => setIsScopeOpen(false)}
            samples={scopeSamples}
            probes={probes}
            activeChannelIndex={activeChannelIndex}
            onSelectChannel={setActiveChannelIndex}
            onRemoveProbe={handleRemoveProbe}
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

      {/* Multi-Format Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        components={components}
        wires={wires}
        timebase={timebase}
        voltsPerDiv={voltsPerDiv}
        onNotify={addToast}
      />

      {/* Toast Notification Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
