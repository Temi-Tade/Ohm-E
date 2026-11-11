/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  CircuitComponent,
  Wire,
  Pin,
} from '../types/circuit';
import { getPinAbsolutePos, rotatePoint } from '../engine/componentFactory';
import { SchematicSymbol, formatVoltage, formatCurrent } from './SchematicSymbols';

interface CircuitCanvasProps {
  components: CircuitComponent[];
  wires: Wire[];
  selectedComponentId: string | null;
  selectedWireId: string | null;
  onSelectComponent: (id: string | null) => void;
  onSelectWire: (id: string | null) => void;
  onUpdateComponentPosition: (id: string, x: number, y: number) => void;
  onRotateComponent: (id: string) => void;
  onDeleteSelected: () => void;
  onAddWire: (fromPinId: string, toPinId: string) => void;
  onToggleSwitch: (component: CircuitComponent) => void;
  onWiperChange: (component: CircuitComponent, newWiper: number) => void;
  onTogglePushButton?: (component: CircuitComponent) => void;
  onPressPushButton?: (component: CircuitComponent, pressed: boolean) => void;
  onConnectWireToWire?: (fromPinId: string, targetWireId: string, midPoint: { x: number; y: number }) => void;
  onUpdateComponentParams?: (id: string, params: Partial<CircuitComponent['params']>) => void;
  flowMode: 'conventional' | 'electron' | 'none';
  showVoltColors: boolean;
  isRunning?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  components,
  wires,
  selectedComponentId,
  selectedWireId,
  isRunning = true,
  onSelectComponent,
  onSelectWire,
  onUpdateComponentPosition,
  onRotateComponent,
  onDeleteSelected,
  onAddWire,
  onToggleSwitch,
  onWiperChange,
  onTogglePushButton,
  onPressPushButton,
  onConnectWireToWire,
  onUpdateComponentParams,
  flowMode,
  showVoltColors,
  onDragStart,
  onDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan & Zoom state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging component state
  const [draggingCompId, setDraggingCompId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Wiring state
  const [wiringFromPinId, setWiringFromPinId] = useState<string | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  // Tooltip
  const [hoverTooltip, setHoverTooltip] = useState<{
    text: string;
    subtext?: string;
    x: number;
    y: number;
  } | null>(null);

  // Grid snap size
  const GRID_SIZE = 20;
  const snapToGrid = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

  // Pin position lookup
  const pinPosMap = useMemoPinPositions(components);

  // Screen coordinate to Canvas world coordinate
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Handle Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.4), 2.5);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom centered on cursor
    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'r' || e.key === 'R') {
        if (selectedComponentId) {
          e.preventDefault();
          onRotateComponent(selectedComponentId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteSelected();
      } else if (e.key === 'Escape') {
        setWiringFromPinId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, selectedWireId, onRotateComponent, onDeleteSelected]);

  // Particle Current Flow Animation Loop
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas || flowMode === 'none') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const renderParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isRunning) {
        // Paused: do not advance particles or draw current flow
        return;
      }

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      t += 0.04;

      wires.forEach((wire) => {
        const fromPos = pinPosMap.get(wire.fromPinId);
        const toPos = pinPosMap.get(wire.toPinId);
        if (!fromPos || !toPos) return;

        const current = wire.current ?? 0;
        if (Math.abs(current) < 1e-6) return;

        // Direction based on flowMode and current sign
        const speedMultiplier = flowMode === 'electron' ? -1 : 1;
        const currentSign = current >= 0 ? 1 : -1;
        const speed = Math.min(Math.max(Math.abs(current) * 800, 0.4), 6) * speedMultiplier * currentSign;

        // Path geometry (Manhattan orthogonal route, bypassing components)
        const waypoints = getOrthogonalRoute(fromPos, toPos, components);
        const totalLen = getPathLength(waypoints);
        if (totalLen <= 0) return;

        // Particles along the wire
        const spacing = 28;
        const numParticles = Math.floor(totalLen / spacing);
        const dotColor = flowMode === 'electron' ? '#60a5fa' : '#fbbf24';

        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor;
        ctx.shadowBlur = 4;

        for (let i = 0; i < numParticles; i++) {
          const rawDist = (i * spacing + (t * speed * 15)) % totalLen;
          const dist = rawDist < 0 ? rawDist + totalLen : rawDist;
          const pt = getPointAlongPath(waypoints, dist);

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(renderParticles);
    };

    renderParticles();
    return () => cancelAnimationFrame(animId);
  }, [wires, pinPosMap, components, pan, zoom, flowMode, isRunning]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = particleCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch gesture state
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);
  const [touchStartZoom, setTouchStartZoom] = useState<number>(1.0);
  const [touchPanStart, setTouchPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mouse Handlers on Container
  const handleMouseDown = (e: React.MouseEvent) => {
    // If middle click or space pressed or clicked blank canvas, start pan
    if (e.button === 1 || e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectComponent(null);
      onSelectWire(null);
      if (wiringFromPinId) {
        setWiringFromPinId(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setMouseCanvasPos(worldPos);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingCompId) {
      const snappedX = snapToGrid(worldPos.x - dragOffset.x);
      const snappedY = snapToGrid(worldPos.y - dragOffset.y);
      onUpdateComponentPosition(draggingCompId, snappedX, snappedY);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggingCompId) {
      setDraggingCompId(null);
      onDragEnd?.();
    }
  };

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two-finger pinch to zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      setTouchPinchDist(dist);
      setTouchStartZoom(zoom);
      setIsPanning(false);
      setDraggingCompId(null);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const worldPos = screenToWorld(t.clientX, t.clientY);
      setMouseCanvasPos(worldPos);

      // If touched canvas background or svg, start pan
      if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
        setIsPanning(true);
        setTouchPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
        onSelectComponent(null);
        onSelectWire(null);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchPinchDist !== null) {
      // Two-finger pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleFactor = currentDist / touchPinchDist;
      const newZoom = Math.min(Math.max(touchStartZoom * scaleFactor, 0.4), 2.5);

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        setPan({
          x: midX - (midX - pan.x) * (newZoom / zoom),
          y: midY - (midY - pan.y) * (newZoom / zoom),
        });
      }
      setZoom(newZoom);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const worldPos = screenToWorld(t.clientX, t.clientY);
      setMouseCanvasPos(worldPos);

      if (isPanning) {
        setPan({
          x: t.clientX - touchPanStart.x,
          y: t.clientY - touchPanStart.y,
        });
      } else if (draggingCompId) {
        const snappedX = snapToGrid(worldPos.x - dragOffset.x);
        const snappedY = snapToGrid(worldPos.y - dragOffset.y);
        onUpdateComponentPosition(draggingCompId, snappedX, snappedY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setTouchPinchDist(null);
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
      if (draggingCompId) {
        setDraggingCompId(null);
        onDragEnd?.();
      }
    }
  };

  // Wire routing color based on voltage
  const getWireStrokeColor = (wire: Wire) => {
    if (wire.id === selectedWireId) return '#38bdf8'; // Selected cyan
    if (!showVoltColors) return '#64748b'; // Default sleek slate

    const v = wire.voltage ?? 0;
    if (Math.abs(v) < 0.1) return '#10b981'; // 0V Ground is calm Emerald
    if (v > 0) {
      // Positive voltage: Green -> Yellow -> Orange -> Red
      if (v > 9) return '#ef4444';
      if (v > 4.5) return '#f97316';
      if (v > 1.5) return '#eab308';
      return '#84cc16';
    } else {
      // Negative voltage: Cyan -> Blue -> Purple
      if (v < -5) return '#a855f7';
      return '#06b6d4';
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: 'none' }}
      className="relative flex-1 min-h-0 w-full bg-[#0e1013] overflow-hidden cursor-crosshair select-none"
    >
      {/* Background Blueprint Grid pattern */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60">
        <defs>
          <pattern
            id="grid-pattern-small"
            width={GRID_SIZE * zoom}
            height={GRID_SIZE * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x}, ${pan.y})`}
          >
            <circle cx="1" cy="1" r="0.75" fill="#22252e" />
          </pattern>
          <pattern
            id="grid-pattern-major"
            width={GRID_SIZE * 5 * zoom}
            height={GRID_SIZE * 5 * zoom}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${pan.x}, ${pan.y})`}
          >
            <rect width={GRID_SIZE * 5 * zoom} height={GRID_SIZE * 5 * zoom} fill="none" stroke="#16181f" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-small)" />
        <rect width="100%" height="100%" fill="url(#grid-pattern-major)" />
      </svg>

      {/* HTML5 Canvas overlay for Animated Current Particles */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Main SVG Schematic Layer */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Render Wires */}
        <g className="wires-layer">
          {wires.map((wire) => {
            const fromPos = pinPosMap.get(wire.fromPinId);
            const toPos = pinPosMap.get(wire.toPinId);
            if (!fromPos || !toPos) return null;

            const pathD = buildOrthogonalPathD(fromPos, toPos, components);
            const isSelected = wire.id === selectedWireId;
            const strokeColor = getWireStrokeColor(wire);
            const midPoint = getWireMidPoint(fromPos, toPos, components);

            return (
              <g
                key={wire.id}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  if (wiringFromPinId) {
                    onConnectWireToWire?.(wiringFromPinId, wire.id, midPoint);
                    setWiringFromPinId(null);
                  } else {
                    onSelectWire(wire.id);
                    onSelectComponent(null);
                  }
                }}
                onMouseEnter={(e) => {
                  setHoverTooltip({
                    text: `Wire: ${formatVoltage(wire.voltage ?? 0)}`,
                    subtext: `Current: ${formatCurrent(wire.current ?? 0)}`,
                    x: e.clientX,
                    y: e.clientY - 40,
                  });
                }}
                onMouseLeave={() => setHoverTooltip(null)}
              >
                {/* Thick invisible stroke for easy clicking & hovering */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  strokeLinecap="round"
                />
                {/* Glow underlay if selected */}
                {isSelected && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={6}
                    opacity={0.35}
                    strokeLinecap="round"
                  />
                )}
                {/* Real wire line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-colors group-hover:brightness-125"
                />

                {/* Wire Midpoint Target: prominent node marker when wiring mode is active */}
                {wiringFromPinId && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectWireToWire?.(wiringFromPinId, wire.id, midPoint);
                      setWiringFromPinId(null);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onConnectWireToWire?.(wiringFromPinId, wire.id, midPoint);
                      setWiringFromPinId(null);
                    }}
                  >
                    <circle
                      cx={midPoint.x}
                      cy={midPoint.y}
                      r="14"
                      fill="#38bdf8"
                      opacity="0.35"
                      className="animate-ping pointer-events-none"
                    />
                    <circle
                      cx={midPoint.x}
                      cy={midPoint.y}
                      r="18"
                      fill="#000000"
                      fillOpacity="0.0001"
                      pointerEvents="all"
                    />
                    <circle
                      cx={midPoint.x}
                      cy={midPoint.y}
                      r="5"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="2"
                      className="hover:scale-125 transition-transform"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Dynamic Wire Drawing Line Preview */}
        {wiringFromPinId && (
          <g className="pointer-events-none">
            {(() => {
              const startPos = pinPosMap.get(wiringFromPinId);
              if (!startPos) return null;
              const targetPos = hoveredPinId ? pinPosMap.get(hoveredPinId) || mouseCanvasPos : mouseCanvasPos;
              const pathD = buildOrthogonalPathD(startPos, targetPos, components);
              return (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  className="animate-pulse"
                />
              );
            })()}
          </g>
        )}

        {/* Junction Dots where wires intersect */}
        <g className="junctions-layer pointer-events-none">
          {computeJunctions(wires, pinPosMap).map((j, idx) => (
            <circle
              key={idx}
              cx={j.x}
              cy={j.y}
              r={3.5}
              fill="#e2e8f0"
              stroke="#0f172a"
              strokeWidth={1.5}
            />
          ))}
        </g>

        {/* Render Components */}
        <g className="components-layer">
          {components.map((comp) => {
            const isSelected = comp.id === selectedComponentId;

            return (
              <g
                key={comp.id}
                transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`}
                className="cursor-move"
                onClick={(e) => {
                  e.stopPropagation();
                  if (wiringFromPinId) {
                    const isStartComp = comp.pins.some((p) => p.id === wiringFromPinId);
                    if (isStartComp) {
                      setWiringFromPinId(null);
                      onSelectComponent(comp.id);
                      onSelectWire(null);
                    } else {
                      const clickPos = screenToWorld(e.clientX, e.clientY);
                      let closestPin = comp.pins[0];
                      let minDist = Infinity;
                      for (const pin of comp.pins) {
                        const pinPos = pinPosMap.get(pin.id);
                        if (pinPos) {
                          const d = Math.hypot(pinPos.x - clickPos.x, pinPos.y - clickPos.y);
                          if (d < minDist) {
                            minDist = d;
                            closestPin = pin;
                          }
                        }
                      }
                      onAddWire(wiringFromPinId, closestPin.id);
                      setWiringFromPinId(null);
                    }
                    return;
                  }
                  onSelectComponent(comp.id);
                  onSelectWire(null);
                }}
                onTouchStart={(e) => {
                  if (e.touches.length > 1) return;
                  e.stopPropagation();
                  if (wiringFromPinId) {
                    const isStartComp = comp.pins.some((p) => p.id === wiringFromPinId);
                    if (isStartComp) {
                      setWiringFromPinId(null);
                      onSelectComponent(comp.id);
                      onSelectWire(null);
                    } else if (e.touches.length === 1) {
                      const t = e.touches[0];
                      const clickPos = screenToWorld(t.clientX, t.clientY);
                      let closestPin = comp.pins[0];
                      let minDist = Infinity;
                      for (const pin of comp.pins) {
                        const pinPos = pinPosMap.get(pin.id);
                        if (pinPos) {
                          const d = Math.hypot(pinPos.x - clickPos.x, pinPos.y - clickPos.y);
                          if (d < minDist) {
                            minDist = d;
                            closestPin = pin;
                          }
                        }
                      }
                      onAddWire(wiringFromPinId, closestPin.id);
                      setWiringFromPinId(null);
                    }
                    return;
                  }
                  onSelectComponent(comp.id);
                  onSelectWire(null);
                  if (e.touches.length === 1) {
                    const t = e.touches[0];
                    const worldPos = screenToWorld(t.clientX, t.clientY);
                    setDraggingCompId(comp.id);
                    onDragStart?.();
                    setDragOffset({
                      x: worldPos.x - comp.x,
                      y: worldPos.y - comp.y,
                    });
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (wiringFromPinId) {
                    const isStartComp = comp.pins.some((p) => p.id === wiringFromPinId);
                    if (isStartComp) {
                      setWiringFromPinId(null);
                      onSelectComponent(comp.id);
                      onSelectWire(null);
                    } else {
                      const clickPos = screenToWorld(e.clientX, e.clientY);
                      let closestPin = comp.pins[0];
                      let minDist = Infinity;
                      for (const pin of comp.pins) {
                        const pinPos = pinPosMap.get(pin.id);
                        if (pinPos) {
                          const d = Math.hypot(pinPos.x - clickPos.x, pinPos.y - clickPos.y);
                          if (d < minDist) {
                            minDist = d;
                            closestPin = pin;
                          }
                        }
                      }
                      onAddWire(wiringFromPinId, closestPin.id);
                      setWiringFromPinId(null);
                    }
                    return;
                  }
                  onSelectComponent(comp.id);
                  onSelectWire(null);
                  const worldPos = screenToWorld(e.clientX, e.clientY);
                  setDraggingCompId(comp.id);
                  onDragStart?.();
                  setDragOffset({
                    x: worldPos.x - comp.x,
                    y: worldPos.y - comp.y,
                  });
                }}
                onMouseEnter={(e) => {
                  const state = comp.state;
                  setHoverTooltip({
                    text: `${comp.name}: ${formatVoltage(state?.voltageDrop ?? 0)} drop`,
                    subtext: `I: ${formatCurrent(state?.current ?? 0)} | P: ${((state?.power ?? 0) * 1000).toFixed(1)}mW`,
                    x: e.clientX,
                    y: e.clientY - 40,
                  });
                }}
                onMouseLeave={() => setHoverTooltip(null)}
              >
                {/* Invisible Solid Hit Plate: Guarantees 100% reliable tap, click, and drag selection across entire component */}
                <rect
                  x="-46"
                  y="-46"
                  width="92"
                  height="92"
                  rx="10"
                  fill="#000000"
                  fillOpacity="0.0001"
                  pointerEvents="all"
                  className="cursor-move"
                />

                {/* Selection Highlight Bounding Box with soft cyan glow */}
                {isSelected && (
                  <rect
                    x="-48"
                    y="-48"
                    width="96"
                    height="96"
                    rx="10"
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    className="pointer-events-none"
                  />
                )}

                {/* Component Schematic Symbol */}
                <SchematicSymbol
                  component={comp}
                  isSelected={isSelected}
                  isRunning={isRunning}
                  onToggleSwitch={onToggleSwitch}
                  onWiperChange={onWiperChange}
                  onTogglePushButton={onTogglePushButton}
                  onPressPushButton={onPressPushButton}
                />

                {/* Terminals / Pins */}
                {comp.pins.map((pin) => {
                  const isHovered = hoveredPinId === pin.id;
                  const isWiringStart = wiringFromPinId === pin.id;
                  const isEligibleTarget = wiringFromPinId !== null && !isWiringStart;

                  const handlePinInteract = (e: React.SyntheticEvent) => {
                    e.stopPropagation();

                    if (!wiringFromPinId) {
                      // Always select the component and start wire
                      onSelectComponent(comp.id);
                      onSelectWire(null);
                      setWiringFromPinId(pin.id);
                    } else if (wiringFromPinId === pin.id) {
                      // Tapped same pin again: cancel wire mode
                      setWiringFromPinId(null);
                    } else {
                      // Complete wire connection
                      onAddWire(wiringFromPinId, pin.id);
                      setWiringFromPinId(null);
                    }
                  };

                  return (
                    <g
                      key={pin.id}
                      transform={`translate(${pin.x}, ${pin.y})`}
                      className="cursor-pointer group/pin"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        setHoveredPinId(pin.id);
                      }}
                      onMouseLeave={() => setHoveredPinId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length > 1) return;
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        handlePinInteract(e);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePinInteract(e);
                      }}
                    >
                      {/* Generous touch/click hit area: focused on pin ring when idle, expanded magnetic target when wiring */}
                      <circle
                        cx="0"
                        cy="0"
                        r={isEligibleTarget ? 22 : 13}
                        fill="#000000"
                        fillOpacity="0.0001"
                        pointerEvents="all"
                        className="cursor-pointer"
                      />

                      {/* Wiring Target Beacon: Glow and pulse on all eligible targets when wiring is in progress */}
                      {isEligibleTarget && (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r="14"
                            fill="#38bdf8"
                            opacity="0.3"
                            className="animate-ping pointer-events-none"
                          />
                          <circle
                            cx="0"
                            cy="0"
                            r="8"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeDasharray="2,2"
                            className="pointer-events-none"
                          />
                        </>
                      )}

                      {/* Start Pin Beacon */}
                      {isWiringStart && (
                        <circle
                          cx="0"
                          cy="0"
                          r="14"
                          fill="#38bdf8"
                          opacity="0.4"
                          className="animate-pulse pointer-events-none"
                        />
                      )}

                      {/* Pin Terminal Visual Ring */}
                      <circle
                        cx="0"
                        cy="0"
                        r={isHovered || isWiringStart ? 6 : isEligibleTarget ? 5 : 3.5}
                        fill={isWiringStart ? '#38bdf8' : isEligibleTarget && isHovered ? '#38bdf8' : '#0f172a'}
                        stroke={isHovered || isWiringStart || isEligibleTarget ? '#38bdf8' : '#94a3b8'}
                        strokeWidth={isHovered || isWiringStart ? '2.5' : '1.8'}
                        className="transition-transform group-hover/pin:scale-125"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Mobile & Desktop Wiring Guidance Banner */}
      {wiringFromPinId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-[#141820] border border-[#2c3d52] text-[#d6e4f8] px-3.5 py-1.5 rounded-lg shadow-2xl text-xs font-medium flex items-center gap-2.5 max-w-[92vw]">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse shrink-0" />
          <span className="truncate">Wiring Mode: Click or tap another terminal to connect</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setWiringFromPinId(null);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWiringFromPinId(null);
            }}
            className="px-2.5 py-1 rounded-md bg-[#1f2734] hover:bg-[#283242] active:bg-[#181f2a] text-[#d6e4f8] text-xs font-medium border border-[#32455e] shrink-0 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Floating Hover Measurement Tooltip */}
      {hoverTooltip && (
        <div
          className="fixed pointer-events-none z-50 bg-[#16181d] border border-[#2b2e38] px-2.5 py-1.5 rounded-md shadow-2xl text-xs font-mono"
          style={{ left: hoverTooltip.x + 12, top: hoverTooltip.y }}
        >
          <div className="font-semibold text-[#f0f2f6]">{hoverTooltip.text}</div>
          {hoverTooltip.subtext && (
            <div className="text-[11px] text-[#8b909f]">{hoverTooltip.subtext}</div>
          )}
        </div>
      )}

      {/* Floating On-Canvas Interactive Slider for Potentiometer and Sensors */}
      {(() => {
        const selectedComp = components.find(c => c.id === selectedComponentId);
        if (!selectedComp) return null;
        const isAdjustable =
          selectedComp.type === 'potentiometer' ||
          selectedComp.type === 'photoresistor' ||
          selectedComp.type === 'thermistor' ||
          selectedComp.type === 'temp_sensor' ||
          selectedComp.type === 'sound_sensor';

        if (!isAdjustable) return null;

        const screenX = selectedComp.x * zoom + pan.x;
        const screenY = selectedComp.y * zoom + pan.y + 60 * zoom;

        return (
          <div
            className="absolute z-40 bg-[#141720]/95 backdrop-blur-md border border-[#2e3748] rounded-xl p-3 shadow-2xl flex flex-col gap-2 min-w-[210px] -translate-x-1/2 pointer-events-auto"
            style={{
              left: Math.max(120, Math.min(window.innerWidth - 120, screenX)),
              top: Math.max(65, screenY),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {selectedComp.type === 'potentiometer' && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <span>🎛️</span> Wiper
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {Math.round((selectedComp.params.wiper ?? 0.5) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedComp.params.wiper ?? 0.5}
                  onChange={(e) => onWiperChange?.(selectedComp, parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-5"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </>
            )}

            {selectedComp.type === 'photoresistor' && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <span>☀️</span> Light Level
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {selectedComp.params.lux ?? 250} Lux
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={selectedComp.params.lux ?? 250}
                  onChange={(e) => onUpdateComponentParams?.(selectedComp.id, { lux: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 cursor-pointer h-5"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
                  <span>Dark (0 lx)</span>
                  <span>500 lx</span>
                  <span>Bright (1k lx)</span>
                </div>
              </>
            )}

            {selectedComp.type === 'thermistor' && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <span>🌡️</span> Thermistor Temp
                  </span>
                  <span className="font-mono text-rose-400 font-bold">
                    {selectedComp.params.temperature ?? 25} °C
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="120"
                  step="1"
                  value={selectedComp.params.temperature ?? 25}
                  onChange={(e) => onUpdateComponentParams?.(selectedComp.id, { temperature: parseInt(e.target.value, 10) })}
                  className="w-full accent-rose-500 cursor-pointer h-5"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
                  <span>-20°C</span>
                  <span>25°C</span>
                  <span>120°C</span>
                </div>
              </>
            )}

            {selectedComp.type === 'temp_sensor' && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <span>🌡️</span> LM35 Temp
                  </span>
                  <span className="font-mono text-rose-400 font-bold">
                    {selectedComp.params.temperature ?? 25} °C
                  </span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="125"
                  step="1"
                  value={selectedComp.params.temperature ?? 25}
                  onChange={(e) => onUpdateComponentParams?.(selectedComp.id, { temperature: parseInt(e.target.value, 10) })}
                  className="w-full accent-rose-500 cursor-pointer h-5"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
                  <span>-40°C</span>
                  <span>25°C</span>
                  <span>125°C</span>
                </div>
              </>
            )}

            {selectedComp.type === 'sound_sensor' && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#94a3b8] font-medium flex items-center gap-1.5">
                    <span>🎙️</span> Sound Level
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {selectedComp.params.soundLevel ?? 40} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="110"
                  step="2"
                  value={selectedComp.params.soundLevel ?? 40}
                  onChange={(e) => onUpdateComponentParams?.(selectedComp.id, { soundLevel: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-500 cursor-pointer h-5"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748b]">
                  <span>20 dB</span>
                  <span>60 dB</span>
                  <span>110 dB</span>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Canvas Controls Overlay (Bottom-Right of Canvas, desktop only as mobile pinches to zoom) */}
      <div className="hidden md:flex absolute bottom-3 right-3 items-center gap-1.5 bg-[#15171b] border border-[#252831] p-1 rounded-md shadow-2xl text-[#cfd3dd] text-xs">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.2, 2.5))}
          title="Zoom In"
          className="w-7 h-7 flex items-center justify-center hover:bg-[#22252e] hover:text-white rounded-md transition-colors font-bold cursor-pointer"
        >
          +
        </button>
        <span className="font-mono text-[11px] px-1 text-[#8b909f]">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(z / 1.2, 0.4))}
          title="Zoom Out"
          className="w-7 h-7 flex items-center justify-center hover:bg-[#22252e] hover:text-white rounded-md transition-colors font-bold cursor-pointer"
        >
          −
        </button>
        <div className="h-4 w-px bg-[#262832] mx-0.5" />
        <button
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1.0);
          }}
          title="Reset View"
          className="px-2 h-7 flex items-center justify-center hover:bg-[#22252e] hover:text-white rounded-md transition-colors text-[11px] cursor-pointer"
        >
          Reset View
        </button>
      </div>

      {/* Keyboard Shortcuts Hint Bar (Desktop only, completely hidden on mobile) */}
      <div className="hidden md:flex absolute bottom-3 left-3 items-center gap-2 text-[10px] text-zinc-500 font-mono pointer-events-none select-none">
        <span>[R] Rotate</span>
        <span>•</span>
        <span>[Del] Delete</span>
        <span>•</span>
        <span>[Ctrl+Z] Undo</span>
        <span>•</span>
        <span>[Ctrl+Y] Redo</span>
      </div>
    </div>
  );
};

// Helper hook to track absolute pin coordinates
function useMemoPinPositions(components: CircuitComponent[]) {
  return React.useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const comp of components) {
      for (const pin of comp.pins) {
        map.set(pin.id, getPinAbsolutePos(comp, pin));
      }
    }
    return map;
  }, [components]);
}

// Check whether a component should be considered an obstacle between two wire endpoints
function isCompObstacle(
  comp: CircuitComponent,
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  if (comp.type === 'junction') return false;

  // If from or to is one of this component's pins, this is the component being connected
  for (const pin of comp.pins) {
    const pinPos = getPinAbsolutePos(comp, pin);
    if (
      Math.hypot(pinPos.x - from.x, pinPos.y - from.y) < 6 ||
      Math.hypot(pinPos.x - to.x, pinPos.y - to.y) < 6
    ) {
      return false;
    }
  }

  // Also skip if component center is too close to either endpoint (connected component)
  if (
    Math.hypot(comp.x - from.x, comp.y - from.y) < 32 ||
    Math.hypot(comp.x - to.x, comp.y - to.y) < 32
  ) {
    return false;
  }

  return true;
}

// Check whether a straight segment between p1 and p2 intersects any obstacle component
function isSegmentBlocked(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  components: CircuitComponent[],
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const isHorizontal = Math.abs(p1.y - p2.y) <= 4;
  const isVertical = Math.abs(p1.x - p2.x) <= 4;

  for (const comp of components) {
    if (!isCompObstacle(comp, from, to)) continue;

    const halfW = comp.rotation % 180 !== 0 ? 24 : 28;
    const halfH = comp.rotation % 180 !== 0 ? 28 : 24;

    if (isHorizontal) {
      const y = (p1.y + p2.y) / 2;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);

      if (
        Math.abs(comp.y - y) < halfH + 4 &&
        maxX > comp.x - halfW + 6 &&
        minX < comp.x + halfW - 6
      ) {
        return true;
      }
    } else if (isVertical) {
      const x = (p1.x + p2.x) / 2;
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      if (
        Math.abs(comp.x - x) < halfW + 4 &&
        maxY > comp.y - halfH + 6 &&
        minY < comp.y + halfH - 6
      ) {
        return true;
      }
    }
  }
  return false;
}

// Generate clean, direct orthogonal Manhattan path (straight whenever possible, 1-bend L-shape if unaligned, bypassing obstacles only when necessary)
function getOrthogonalRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
  components: CircuitComponent[] = []
): { x: number; y: number }[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Case 1: Horizontally aligned terminals (same horizontal line)
  if (Math.abs(dy) <= 4) {
    const alignedTo = { x: to.x, y: from.y };
    const blocked = isSegmentBlocked(from, alignedTo, components, from, to);
    if (!blocked) {
      return [from, alignedTo];
    }
    // Blocked by an obstacle component directly in the middle: route around it
    const yAbove = from.y - 45;
    const yBelow = from.y + 45;
    const blockedAbove = isSegmentBlocked(
      { x: from.x, y: yAbove },
      { x: to.x, y: yAbove },
      components,
      from,
      to
    );
    const bypassY = blockedAbove ? yBelow : yAbove;
    return [
      from,
      { x: from.x, y: bypassY },
      { x: to.x, y: bypassY },
      alignedTo,
    ];
  }

  // Case 2: Vertically aligned terminals (same vertical line)
  if (Math.abs(dx) <= 4) {
    const alignedTo = { x: from.x, y: to.y };
    const blocked = isSegmentBlocked(from, alignedTo, components, from, to);
    if (!blocked) {
      return [from, alignedTo];
    }
    // Blocked by an obstacle component directly in the middle: route around it
    const xLeft = from.x - 45;
    const xRight = from.x + 45;
    const blockedLeft = isSegmentBlocked(
      { x: xLeft, y: from.y },
      { x: xLeft, y: to.y },
      components,
      from,
      to
    );
    const bypassX = blockedLeft ? xRight : xLeft;
    return [
      from,
      { x: bypassX, y: from.y },
      { x: bypassX, y: to.y },
      alignedTo,
    ];
  }

  // Case 3: Unaligned terminals: use a clean single 90-degree L-route
  // Option 1: Horizontal then Vertical (corner at { x: to.x, y: from.y })
  const corner1 = { x: to.x, y: from.y };
  const blockedH1 = isSegmentBlocked(from, corner1, components, from, to);
  const blockedV1 = isSegmentBlocked(corner1, to, components, from, to);
  const opt1Clear = !blockedH1 && !blockedV1;

  // Option 2: Vertical then Horizontal (corner at { x: from.x, y: to.y })
  const corner2 = { x: from.x, y: to.y };
  const blockedV2 = isSegmentBlocked(from, corner2, components, from, to);
  const blockedH2 = isSegmentBlocked(corner2, to, components, from, to);
  const opt2Clear = !blockedV2 && !blockedH2;

  if (opt1Clear) {
    return [from, corner1, to];
  }
  if (opt2Clear) {
    return [from, corner2, to];
  }

  // If both direct L-routes have an obstacle, use a stepped bypass
  const midX = from.x + dx / 2;
  return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
}

// Compute collinear midpoint strictly on the wire path so splitting at midpoint keeps both segments 100% straight
function getWireMidPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  components: CircuitComponent[] = []
): { x: number; y: number } {
  const waypoints = getOrthogonalRoute(from, to, components);
  if (waypoints.length === 2) {
    const p1 = waypoints[0];
    const p2 = waypoints[1];
    if (Math.abs(p1.y - p2.y) <= 4) {
      // Strictly preserve horizontal line y
      return {
        x: Math.round(((p1.x + p2.x) / 2) / 10) * 10,
        y: p1.y,
      };
    }
    if (Math.abs(p1.x - p2.x) <= 4) {
      // Strictly preserve vertical line x
      return {
        x: p1.x,
        y: Math.round(((p1.y + p2.y) / 2) / 10) * 10,
      };
    }
  }

  const totalLen = getPathLength(waypoints);
  const targetDist = totalLen / 2;
  let accumulated = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    if (accumulated + segLen >= targetDist || i === waypoints.length - 2) {
      const remaining = targetDist - accumulated;
      const ratio = segLen > 0 ? Math.max(0.15, Math.min(0.85, remaining / segLen)) : 0.5;

      if (Math.abs(p1.y - p2.y) <= 4) {
        return {
          x: Math.round((p1.x + (p2.x - p1.x) * ratio) / 10) * 10,
          y: p1.y,
        };
      }
      if (Math.abs(p1.x - p2.x) <= 4) {
        return {
          x: p1.x,
          y: Math.round((p1.y + (p2.y - p1.y) * ratio) / 10) * 10,
        };
      }
      return {
        x: p1.x + (p2.x - p1.x) * ratio,
        y: p1.y + (p2.y - p1.y) * ratio,
      };
    }
    accumulated += segLen;
  }

  return {
    x: Math.round((from.x + to.x) / 2),
    y: Math.round((from.y + to.y) / 2),
  };
}

function buildOrthogonalPathD(
  from: { x: number; y: number },
  to: { x: number; y: number },
  components: CircuitComponent[] = []
): string {
  const pts = getOrthogonalRoute(from, to, components);
  return pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function getPathLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function getPointAlongPath(
  points: { x: number; y: number }[],
  distance: number
): { x: number; y: number } {
  let remaining = distance;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const segDx = p2.x - p1.x;
    const segDy = p2.y - p1.y;
    const segLen = Math.sqrt(segDx * segDx + segDy * segDy);

    if (remaining <= segLen) {
      const ratio = segLen > 0 ? remaining / segLen : 0;
      return {
        x: p1.x + segDx * ratio,
        y: p1.y + segDy * ratio,
      };
    }
    remaining -= segLen;
  }
  return points[points.length - 1];
}

// Find points where 3 or more wire ends or pins connect to draw junction solder dots
function computeJunctions(
  wires: Wire[],
  pinPosMap: Map<string, { x: number; y: number }>
): { x: number; y: number }[] {
  const counts = new Map<string, { count: number; x: number; y: number }>();

  for (const wire of wires) {
    const f = pinPosMap.get(wire.fromPinId);
    const t = pinPosMap.get(wire.toPinId);
    if (f) {
      const keyF = `${Math.round(f.x)},${Math.round(f.y)}`;
      const entry = counts.get(keyF) || { count: 0, x: f.x, y: f.y };
      entry.count++;
      counts.set(keyF, entry);
    }
    if (t) {
      const keyT = `${Math.round(t.x)},${Math.round(t.y)}`;
      const entry = counts.get(keyT) || { count: 0, x: t.x, y: t.y };
      entry.count++;
      counts.set(keyT, entry);
    }
  }

  const junctions: { x: number; y: number }[] = [];
  counts.forEach((val) => {
    if (val.count >= 3) {
      junctions.push({ x: val.x, y: val.y });
    }
  });

  return junctions;
}
