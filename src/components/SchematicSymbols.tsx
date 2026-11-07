/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CircuitComponent } from '../types/circuit';

interface SymbolProps {
  component: CircuitComponent;
  isSelected: boolean;
  onToggleSwitch?: (component: CircuitComponent) => void;
  onWiperChange?: (component: CircuitComponent, newWiper: number) => void;
}

export const SchematicSymbol: React.FC<SymbolProps> = ({
  component,
  isSelected,
  onToggleSwitch,
  onWiperChange,
}) => {
  const { type, params, state } = component;
  const strokeColor = isSelected ? '#38bdf8' : '#e2e8f0';
  const strokeWidth = isSelected ? 2.5 : 2;

  switch (type) {
    case 'resistor':
      return (
        <g className="select-none">
          {/* Zig-zag resistor body */}
          <path
            d="M -40 0 L -24 0 L -18 -10 L -10 10 L -2 -10 L 6 10 L 14 -10 L 20 10 L 24 0 L 40 0"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Label */}
          <text
            x="0"
            y="-16"
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatResistance(params.resistance ?? 1000)}
          </text>
        </g>
      );

    case 'potentiometer': {
      const wiper = params.wiper ?? 0.5;
      return (
        <g className="select-none">
          {/* Zig-zag resistor body between A and B */}
          <path
            d="M -40 0 L -24 0 L -18 -8 L -10 8 L -2 -8 L 6 8 L 14 -8 L 20 8 L 24 0 L 40 0"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* Wiper arrow to pin W (0, 40) */}
          <path
            d={`M ${(wiper - 0.5) * 36} 10 L 0 30 L 0 40`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
          />
          <polygon
            points={`${(wiper - 0.5) * 36},6 ${(wiper - 0.5) * 36 - 4},13 ${(wiper - 0.5) * 36 + 4},13`}
            fill="#f59e0b"
          />
          {/* Interactive slider track for wiper */}
          <line
            x1="-24"
            y1="-14"
            x2="24"
            y2="-14"
            stroke="#475569"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx={-24 + wiper * 48}
            cy="-14"
            r="6"
            fill="#f59e0b"
            stroke="#ffffff"
            strokeWidth="1.5"
            onTouchStart={(e) => {
              e.stopPropagation();
              if (e.touches.length === 0) return;
              const startX = e.touches[0].clientX;
              const startWiper = wiper;
              const onTouchMove = (moveEv: TouchEvent) => {
                if (moveEv.touches.length === 0) return;
                const delta = (moveEv.touches[0].clientX - startX) / 60;
                const nextW = Math.min(Math.max(startWiper + delta, 0), 1);
                onWiperChange?.(component, Math.round(nextW * 100) / 100);
              };
              const onTouchEnd = () => {
                window.removeEventListener('touchmove', onTouchMove);
                window.removeEventListener('touchend', onTouchEnd);
              };
              window.addEventListener('touchmove', onTouchMove);
              window.addEventListener('touchend', onTouchEnd);
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startWiper = wiper;
              const onMove = (moveEv: MouseEvent) => {
                const delta = (moveEv.clientX - startX) / 60;
                const nextW = Math.min(Math.max(startWiper + delta, 0), 1);
                onWiperChange?.(component, Math.round(nextW * 100) / 100);
              };
              const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />
          <text
            x="0"
            y="-22"
            textAnchor="middle"
            className="fill-amber-400 text-[10px] font-mono pointer-events-none select-none font-bold"
          >
            {Math.round(wiper * 100)}% ({formatResistance(params.resistance ?? 10000)})
          </text>
        </g>
      );
    }

    case 'capacitor':
      return (
        <g className="select-none">
          {/* Leads */}
          <line x1="-40" y1="0" x2="-8" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="8" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Parallel plates */}
          <line x1="-8" y1="-18" x2="-8" y2="18" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
          <line x1="8" y1="-18" x2="8" y2="18" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
          <text
            x="0"
            y="-22"
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatCapacitance(params.capacitance ?? 10e-6)}
          </text>
        </g>
      );

    case 'inductor':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-24" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path
            d="M -24 0 A 6 8 0 0 1 -12 0 A 6 8 0 0 1 0 0 A 6 8 0 0 1 12 0 A 6 8 0 0 1 24 0"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <line x1="24" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text
            x="0"
            y="-16"
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatInductance(params.inductance ?? 10e-3)}
          </text>
        </g>
      );

    case 'dc_source':
      return (
        <g className="select-none">
          {/* Leads */}
          <line x1="-40" y1="0" x2="-8" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="8" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Long line (+) on right (x=8), short thicker line (-) on left (x=-8) */}
          <line x1="8" y1="-18" x2="8" y2="18" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
          <line x1="-8" y1="-10" x2="-8" y2="10" stroke={strokeColor} strokeWidth={4} strokeLinecap="round" />
          {/* + and - indicators */}
          <text x="18" y="-10" className="fill-emerald-400 text-[12px] font-bold select-none">+</text>
          <text x="-24" y="-8" className="fill-rose-400 text-[13px] font-bold select-none">−</text>
          <text
            x="0"
            y="-22"
            textAnchor="middle"
            className="fill-slate-300 text-[11px] font-mono pointer-events-none select-none font-bold"
          >
            {params.voltage ?? 9}V
          </text>
        </g>
      );

    case 'ac_source':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="20" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Sine wave inside */}
          <path
            d="M -11 0 Q -5.5 -10 0 0 Q 5.5 10 11 0"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text
            x="0"
            y="-25"
            textAnchor="middle"
            className="fill-cyan-400 text-[11px] font-mono pointer-events-none select-none font-semibold"
          >
            {params.voltage ?? 5}Vpk {params.frequency ?? 50}Hz
          </text>
        </g>
      );

    case 'clock_source':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <rect x="-20" y="-18" width="40" height="36" rx="4" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Square wave inside */}
          <path
            d="M -12 6 L -6 6 L -6 -6 L 2 -6 L 2 6 L 10 6 L 10 -6"
            fill="none"
            stroke="#a855f7"
            strokeWidth="2"
          />
          <text
            x="0"
            y="-22"
            textAnchor="middle"
            className="fill-purple-400 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            CLK {params.frequency ?? 10}Hz
          </text>
        </g>
      );

    case 'ground':
      return (
        <g className="select-none">
          {/* Vertical stem from (0, -20) to (0, 0) */}
          <line x1="0" y1="-20" x2="0" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Three tapering horizontal lines */}
          <line x1="-16" y1="0" x2="16" y2="0" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-10" y1="6" x2="10" y2="6" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="-4" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <text
            x="0"
            y="24"
            textAnchor="middle"
            className="fill-slate-500 text-[9px] font-mono pointer-events-none select-none font-bold"
          >
            GND
          </text>
        </g>
      );

    case 'diode':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="14" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Triangle pointing right from -14 to 14 */}
          <polygon
            points="-14,-14 -14,14 14,0"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* Cathode bar at 14 */}
          <line x1="14" y1="-14" x2="14" y2="14" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          <text
            x="0"
            y="-18"
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-mono pointer-events-none select-none"
          >
            1N4148
          </text>
        </g>
      );

    case 'zener_diode':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="14" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon
            points="-14,-14 -14,14 14,0"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* Zener bent cathode bar */}
          <path
            d="M 9 -14 L 14 -14 L 14 14 L 19 14"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text
            x="0"
            y="-18"
            textAnchor="middle"
            className="fill-amber-400 text-[10px] font-mono pointer-events-none select-none font-bold"
          >
            {params.zenerVoltage ?? 5.1}V
          </text>
        </g>
      );

    case 'led': {
      const colorKey = params.ledColor || 'red';
      const colorMap: Record<string, { main: string; glow: string; text: string }> = {
        red: { main: '#ef4444', glow: '#f87171', text: '#fca5a5' },
        green: { main: '#22c55e', glow: '#4ade80', text: '#86efac' },
        blue: { main: '#3b82f6', glow: '#60a5fa', text: '#93c5fd' },
        yellow: { main: '#eab308', glow: '#facc15', text: '#fef08a' },
        white: { main: '#f8fafc', glow: '#ffffff', text: '#ffffff' },
      };
      const colors = colorMap[colorKey] ?? colorMap.red;
      const brightness = state?.brightness ?? 0;
      const isBlown = state?.isBlown;
      const isLit = brightness > 0.05 && !isBlown;

      return (
        <g className="select-none">
          {/* Multi-tier Luminous LED Glow */}
          {isLit && (
            <>
              {/* Outer soft ambient aura */}
              <circle
                cx="0"
                cy="0"
                r={22 + brightness * 20}
                fill={colors.glow}
                opacity={Math.min(0.18 + brightness * 0.35, 0.65)}
                className="pointer-events-none transition-all duration-75"
                filter="blur(8px)"
              />
              {/* Inner energetic radiance */}
              <circle
                cx="0"
                cy="0"
                r={12 + brightness * 10}
                fill={colors.main}
                opacity={Math.min(0.3 + brightness * 0.45, 0.85)}
                className="pointer-events-none transition-all duration-75"
                filter="blur(3px)"
              />
              {/* Hot center photon flare */}
              <circle
                cx="0"
                cy="0"
                r={3 + brightness * 3}
                fill="#ffffff"
                opacity={Math.min(0.6 + brightness * 0.4, 0.95)}
                className="pointer-events-none transition-all duration-75"
              />
            </>
          )}

          {/* Lead Wires */}
          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="14" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* Diode Triangle Body */}
          <polygon
            points="-14,-14 -14,14 14,0"
            fill={isBlown ? '#334155' : isLit ? colors.main : '#1e293b'}
            stroke={isLit ? colors.glow : strokeColor}
            strokeWidth={isLit ? 2 : strokeWidth}
            strokeLinejoin="round"
            className="transition-colors duration-100"
          />

          {/* Cathode Bar */}
          <line
            x1="14"
            y1="-14"
            x2="14"
            y2="14"
            stroke={isLit ? colors.glow : strokeColor}
            strokeWidth={isLit ? 3 : 2.5}
            strokeLinecap="round"
          />

          {/* Light emission arrows */}
          <g
            stroke={isLit ? colors.glow : '#64748b'}
            strokeWidth={isLit ? 2 : 1.5}
            strokeLinecap="round"
            className="transition-all duration-100"
          >
            <path d="M 0 -16 L 8 -25 M 5 -25 L 8 -25 L 8 -22" />
            <path d="M 8 -16 L 16 -25 M 13 -25 L 16 -25 L 16 -22" />
          </g>

          {/* Subtext info */}
          {isBlown ? (
            <text x="0" y="-30" textAnchor="middle" className="fill-rose-500 text-[10px] font-bold font-mono">
              💥 BLOWN ({formatCurrent(state?.current ?? 0)})
            </text>
          ) : isLit ? (
            <text x="0" y="-30" textAnchor="middle" className="fill-emerald-400 text-[10px] font-mono font-semibold">
              LED ({colorKey}) {((state?.current ?? 0) * 1000).toFixed(1)}mA
            </text>
          ) : (
            <text x="0" y="-30" textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
              LED ({colorKey})
            </text>
          )}
        </g>
      );
    }

    case 'npn':
      return (
        <g className="select-none">
          {/* Transistor circle envelope */}
          <circle cx="0" cy="0" r="28" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Base lead and vertical bar */}
          <line x1="-40" y1="0" x2="-12" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-12" y1="-18" x2="-12" y2="18" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          {/* Collector slant */}
          <line x1="-12" y1="-8" x2="18" y2="-22" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="-22" x2="20" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Emitter slant with outward arrow */}
          <line x1="-12" y1="8" x2="18" y2="22" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="22" x2="20" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Arrow pointing away from Base on Emitter */}
          <polygon points="12,14 18,22 8,20" fill={strokeColor} />
          <text x="-4" y="-32" textAnchor="middle" className="fill-slate-400 text-[9px] font-mono">
            NPN (β={params.beta ?? 100})
          </text>
        </g>
      );

    case 'pnp':
      return (
        <g className="select-none">
          <circle cx="0" cy="0" r="28" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="0" x2="-12" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-12" y1="-18" x2="-12" y2="18" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          {/* Emitter slant with inward arrow */}
          <line x1="-12" y1="-8" x2="18" y2="-22" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="-22" x2="20" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="-6,-13 -12,-8 -4,-6" fill={strokeColor} />
          {/* Collector slant */}
          <line x1="-12" y1="8" x2="18" y2="22" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="22" x2="20" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x="-4" y="-32" textAnchor="middle" className="fill-slate-400 text-[9px] font-mono">
            PNP (β={params.beta ?? 100})
          </text>
        </g>
      );

    case 'opamp':
      return (
        <g className="select-none">
          {/* Triangle body */}
          <polygon
            points="-30,-30 -30,30 30,0"
            fill="#0f172a"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* IN+ lead at (-40, -20) to (-30, -20) */}
          <line x1="-40" y1="-20" x2="-30" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x="-24" y="-16" className="fill-slate-400 text-[12px] font-bold">+</text>
          {/* IN- lead at (-40, 20) to (-30, 20) */}
          <line x1="-40" y1="20" x2="-30" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x="-24" y="24" className="fill-slate-400 text-[14px] font-bold">−</text>
          {/* OUT lead at (30, 0) to (40, 0) */}
          <line x1="30" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <text x="-4" y="4" textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
            OPAMP
          </text>
        </g>
      );

    case 'switch': {
      const isClosed = params.closed ?? true;
      return (
        <g
          className="cursor-pointer group"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSwitch?.(component);
          }}
        >
          {/* Terminal dots */}
          <circle cx="-20" cy="0" r="4" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="20" cy="0" r="4" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Blade contact */}
          {isClosed ? (
            <line x1="-20" y1="0" x2="20" y2="0" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <line x1="-20" y1="0" x2="16" y2="-16" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" />
          )}
          {/* Click to flip badge */}
          <rect
            x="-26"
            y="-30"
            width="52"
            height="16"
            rx="8"
            fill={isClosed ? '#064e3b' : '#881337'}
            stroke={isClosed ? '#10b981' : '#f43f5e'}
            strokeWidth="1"
            className="group-hover:scale-105 transition-transform"
          />
          <text
            x="0"
            y="-19"
            textAnchor="middle"
            className={`text-[9px] font-bold font-mono ${isClosed ? 'fill-emerald-300' : 'fill-rose-300'}`}
          >
            {isClosed ? 'CLOSED' : 'OPEN'}
          </text>
        </g>
      );
    }

    case 'push_button': {
      const isPressed = params.pressed ?? false;
      return (
        <g className="cursor-pointer">
          <line x1="-40" y1="0" x2="-18" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="-18" cy="0" r="3.5" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="18" cy="0" r="3.5" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Actuator plate */}
          <line
            x1="-22"
            y1={isPressed ? 0 : -8}
            x2="22"
            y2={isPressed ? 0 : -8}
            stroke={isPressed ? '#10b981' : strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1={isPressed ? 0 : -8}
            x2="0"
            y2={isPressed ? -10 : -18}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <text
            x="0"
            y="-22"
            textAnchor="middle"
            className="fill-slate-400 text-[9px] font-mono pointer-events-none"
          >
            PUSH
          </text>
        </g>
      );
    }

    case 'buzzer': {
      const isRinging = (state?.power ?? 0) > 0.001;
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-16" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="16" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="16" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="6" fill={isRinging ? '#eab308' : '#334155'} />
          {/* Sound waves if buzzing */}
          {isRinging && (
            <>
              <path d="M 18 -10 A 14 14 0 0 1 18 10" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" />
              <path d="M 23 -14 A 18 18 0 0 1 23 14" fill="none" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          <text x="0" y="-22" textAnchor="middle" className="fill-amber-400 text-[10px] font-mono font-bold">
            BUZZER
          </text>
        </g>
      );
    }

    case 'voltmeter': {
      const vDrop = state?.voltageDrop ?? 0;
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#06b6d4" strokeWidth={strokeWidth} />
          <text x="0" y="5" textAnchor="middle" className="fill-cyan-400 text-[16px] font-bold font-mono">
            V
          </text>
          <text x="0" y="-24" textAnchor="middle" className="fill-cyan-300 text-[11px] font-mono font-bold">
            {formatVoltage(vDrop)}
          </text>
        </g>
      );
    }

    case 'ammeter': {
      const iVal = state?.current ?? 0;
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#10b981" strokeWidth={strokeWidth} />
          <text x="0" y="5" textAnchor="middle" className="fill-emerald-400 text-[16px] font-bold font-mono">
            A
          </text>
          <text x="0" y="-24" textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono font-bold">
            {formatCurrent(iVal)}
          </text>
        </g>
      );
    }

    default:
      return null;
  }
};

export function formatResistance(val: number): string {
  if (val >= 1e6) return `${(val / 1e6).toFixed(val % 1e6 === 0 ? 0 : 1)}MΩ`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(val % 1e3 === 0 ? 0 : 1)}kΩ`;
  return `${Math.round(val)}Ω`;
}

export function formatCapacitance(val: number): string {
  if (val >= 1e-3) return `${(val * 1e3).toFixed(1)}mF`;
  if (val >= 1e-6) return `${(val * 1e6).toFixed(val * 1e6 < 10 ? 1 : 0)}µF`;
  if (val >= 1e-9) return `${(val * 1e9).toFixed(0)}nF`;
  return `${(val * 1e12).toFixed(0)}pF`;
}

export function formatInductance(val: number): string {
  if (val >= 1) return `${val.toFixed(1)}H`;
  if (val >= 1e-3) return `${(val * 1e3).toFixed(val * 1e3 < 10 ? 1 : 0)}mH`;
  return `${(val * 1e6).toFixed(0)}µH`;
}

export function formatVoltage(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(2)}kV`;
  if (abs >= 1) return `${v.toFixed(2)}V`;
  if (abs >= 1e-3) return `${(v * 1000).toFixed(1)}mV`;
  return `${(v * 1e6).toFixed(0)}µV`;
}

export function formatCurrent(i: number): string {
  const abs = Math.abs(i);
  if (abs >= 1) return `${i.toFixed(2)}A`;
  if (abs >= 1e-3) return `${(i * 1000).toFixed(2)}mA`;
  if (abs >= 1e-6) return `${(i * 1e6).toFixed(1)}µA`;
  return `${(i * 1e9).toFixed(0)}nA`;
}
