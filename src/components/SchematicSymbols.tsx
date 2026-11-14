/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CircuitComponent } from '../types/circuit';

interface SymbolProps {
  component: CircuitComponent;
  isSelected: boolean;
  isRunning?: boolean;
  onToggleSwitch?: (component: CircuitComponent) => void;
  onWiperChange?: (component: CircuitComponent, newWiper: number) => void;
  onTogglePushButton?: (component: CircuitComponent) => void;
  onPressPushButton?: (component: CircuitComponent, pressed: boolean) => void;
}

interface UprightTextProps extends React.SVGProps<SVGTextElement> {
  x: number;
  y: number;
  rot?: number;
}

/**
 * Text that can be oriented vertically (up to 90° clockwise or anticlockwise),
 * but never flipped upside-down (180° is un-flipped to stay upright).
 */
export const UprightText: React.FC<UprightTextProps> = ({
  x,
  y,
  rot = 0,
  children,
  ...props
}) => {
  const normalizedRot = ((rot % 360) + 360) % 360;
  // If inverted/upside-down (180 deg), flip 180 deg around (x, y) to keep text upright
  const flipAngle = normalizedRot === 180 ? 180 : 0;
  return (
    <text
      x={x}
      y={y}
      transform={flipAngle ? `rotate(${flipAngle}, ${x}, ${y})` : undefined}
      {...props}
    >
      {children}
    </text>
  );
};

export const SchematicSymbol: React.FC<SymbolProps> = ({
  component,
  isSelected,
  isRunning = true,
  onToggleSwitch,
  onWiperChange,
  onTogglePushButton,
  onPressPushButton,
}) => {
  const { type, params, state } = component;
  const rot = component.rotation || 0;
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
          <UprightText
            x={0}
            y={-16}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatResistance(params.resistance ?? 1000)}
          </UprightText>
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
          <UprightText
            x={0}
            y={-22}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatCapacitance(params.capacitance ?? 10e-6)}
          </UprightText>
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
          <UprightText
            x={0}
            y={-16}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-mono pointer-events-none select-none font-medium"
          >
            {formatInductance(params.inductance ?? 10e-3)}
          </UprightText>
        </g>
      );

    case 'transformer': {
      const ratio = params.turnsRatio ?? 1.0;
      const ratioText =
        ratio >= 1
          ? `1:${Number(ratio.toFixed(2))}`
          : `${Number((1 / Math.max(ratio, 0.01)).toFixed(2))}:1`;
      return (
        <g className="select-none">
          {/* Primary leads P1(-40,-20), P2(-40,20) */}
          <line x1="-40" y1="-20" x2="-14" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="20" x2="-14" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Primary Winding Coils (vertical arcs bulging toward core) */}
          <path
            d="M -14 -20 A 6 5 0 0 1 -14 -10 A 6 5 0 0 1 -14 0 A 6 5 0 0 1 -14 10 A 6 5 0 0 1 -14 20"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Laminated Iron Core Bars */}
          <line x1="-2" y1="-22" x2="-2" y2="22" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="2" y1="-22" x2="2" y2="22" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />

          {/* Secondary Winding Coils */}
          <path
            d="M 14 -20 A 6 5 0 0 0 14 -10 A 6 5 0 0 0 14 0 A 6 5 0 0 0 14 10 A 6 5 0 0 0 14 20"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Secondary leads S1(40,-20), S2(40,20) */}
          <line x1="14" y1="-20" x2="40" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="14" y1="20" x2="40" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* Polarity dots */}
          <circle cx="-22" cy="-13" r="2" fill="#38bdf8" />
          <circle cx="22" cy="-13" r="2" fill="#38bdf8" />

          <UprightText
            x={0}
            y={-27}
            rot={rot}
            textAnchor="middle"
            className="fill-sky-300 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            {ratioText}
          </UprightText>
        </g>
      );
    }

    case 'dc_source':
      return (
        <g className="select-none">
          {/* Leads */}
          <line x1="-40" y1="0" x2="-8" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="8" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Long line (+) on left (x=-8), short thicker line (-) on right (x=8) */}
          <line x1="-8" y1="-18" x2="-8" y2="18" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
          <line x1="8" y1="-10" x2="8" y2="10" stroke={strokeColor} strokeWidth={4} strokeLinecap="round" />
          {/* + and - indicators: + on left hand side, - on right */}
          <UprightText x={-22} y={-10} rot={rot} className="fill-emerald-400 text-[12px] font-bold select-none">+</UprightText>
          <UprightText x={18} y={-8} rot={rot} className="fill-rose-400 text-[13px] font-bold select-none">−</UprightText>
          <UprightText
            x={0}
            y={-22}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-300 text-[11px] font-mono pointer-events-none select-none font-bold"
          >
            {params.voltage ?? 5}V
          </UprightText>
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
          <UprightText
            x={0}
            y={-25}
            rot={rot}
            textAnchor="middle"
            className="fill-cyan-400 text-[11px] font-mono pointer-events-none select-none font-semibold"
          >
            {params.voltage ?? 5}Vpk {params.frequency ?? 50}Hz
          </UprightText>
        </g>
      );

    case 'square_wave':
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-20" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="0" cy="0" r="20" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Symmetrical Bipolar Square Wave */}
          <path
            d="M -12 5 L -7 5 L -7 -6 L 0 -6 L 0 6 L 7 6 L 7 -6 L 12 -6"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
          <UprightText
            x={0}
            y={-25}
            rot={rot}
            textAnchor="middle"
            className="fill-amber-400 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            SQ {params.voltage ?? 5}V {params.frequency ?? 50}Hz
          </UprightText>
        </g>
      );

    case 'pulse_gen': {
      const duty = Math.min(Math.max(params.dutyCycle ?? 0.5, 0.05), 0.95);
      const pulseW = 22 * duty;
      return (
        <g className="select-none">
          <line x1="-40" y1="0" x2="-21" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="21" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <rect x="-21" y="-19" width="42" height="38" rx="6" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Dynamic Pulse Wave reflecting live Duty Cycle */}
          <path
            d={`M -14 7 L -10 7 L -10 -7 L ${(-10 + pulseW).toFixed(1)} -7 L ${(-10 + pulseW).toFixed(1)} 7 L 14 7`}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
            strokeLinecap="square"
          />
          <UprightText
            x={0}
            y={-24}
            rot={rot}
            textAnchor="middle"
            className="fill-cyan-400 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            {params.frequency ?? 50}Hz • {Math.round((params.dutyCycle ?? 0.5) * 100)}%
          </UprightText>
        </g>
      );
    }

    case 'ground':
      return (
        <g className="select-none">
          {/* Vertical stem from (0, -20) to (0, 0) */}
          <line x1="0" y1="-20" x2="0" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Three tapering horizontal lines */}
          <line x1="-16" y1="0" x2="16" y2="0" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-10" y1="6" x2="10" y2="6" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="-4" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
          <UprightText
            x={0}
            y={24}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-500 text-[9px] font-mono pointer-events-none select-none font-bold"
          >
            GND
          </UprightText>
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
          <UprightText
            x={0}
            y={-18}
            rot={rot}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-mono pointer-events-none select-none"
          >
            1N4148
          </UprightText>
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
          <UprightText
            x={0}
            y={-18}
            rot={rot}
            textAnchor="middle"
            className="fill-amber-400 text-[10px] font-mono pointer-events-none select-none font-bold"
          >
            {params.zenerVoltage ?? 5.1}V
          </UprightText>
        </g>
      );

    case 'led': {
      const colorKey = params.ledColor || 'red';
      const colorHexMap = {
        red: '#ef4444',
        green: '#10b981',
        blue: '#3b82f6',
        yellow: '#eab308',
        white: '#f8fafc',
      };
      const litColor = colorHexMap[colorKey];
      const brightness = Math.min(1.5, Math.max(0, state?.brightness ?? 0));
      const isBlown = state?.isBlown;
      const isLit = brightness > 0.02 && !isBlown;
      const gradId = `led-glow-${component.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

      return (
        <g className="select-none">
          <defs>
            <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={Math.min(0.9, brightness * 0.85)} />
              <stop offset="25%" stopColor={litColor} stopOpacity={Math.min(0.8, brightness * 0.75)} />
              <stop offset="60%" stopColor={litColor} stopOpacity={Math.min(0.35, brightness * 0.3)} />
              <stop offset="100%" stopColor={litColor} stopOpacity="0" />
            </radialGradient>
          </defs>

          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="14" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* Glowing Aura / Halo if illuminated (VoltSim style) */}
          {isLit && (
            <>
              {/* Wide ambient radial halo */}
              <circle
                cx="0"
                cy="0"
                r={26 + brightness * 16}
                fill={`url(#${gradId})`}
                className="pointer-events-none"
              />
              {/* Intense blurred core bloom */}
              <circle
                cx="0"
                cy="0"
                r={14 + brightness * 6}
                fill={litColor}
                opacity={Math.min(0.65, brightness * 0.6)}
                style={{ filter: 'blur(4px)' }}
                className="pointer-events-none"
              />
            </>
          )}

          {/* Diode body */}
          <polygon
            points="-14,-14 -14,14 14,0"
            fill={isBlown ? '#334155' : isLit ? litColor : strokeColor}
            stroke={isBlown ? '#ef4444' : strokeColor}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <line
            x1="14"
            y1="-14"
            x2="14"
            y2="14"
            stroke={isBlown ? '#ef4444' : strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Light emission arrows */}
          {!isBlown && (
            <>
              <line x1="2" y1="-14" x2="10" y2="-22" stroke={isLit ? litColor : '#94a3b8'} strokeWidth="1.5" />
              <polygon points="10,-22 6,-20 8,-17" fill={isLit ? litColor : '#94a3b8'} />
              <line x1="8" y1="-10" x2="16" y2="-18" stroke={isLit ? litColor : '#94a3b8'} strokeWidth="1.5" />
              <polygon points="16,-18 12,-16 14,-13" fill={isLit ? litColor : '#94a3b8'} />
            </>
          )}

          {/* Subtext info: only show warning if blown, no LED color or LED text label */}
          {isBlown && (
            <UprightText x={0} y={-30} rot={rot} textAnchor="middle" className="fill-rose-500 text-[10px] font-bold font-mono">
              💥 BLOWN ({formatCurrent(state?.current ?? 0)})
            </UprightText>
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
          {/* Terminal labels positioned directly on top of the terminals */}
          <UprightText x={-36} y={-8} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            B
          </UprightText>
          <UprightText x={32} y={-38} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            C
          </UprightText>
          <UprightText x={32} y={42} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            E
          </UprightText>
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
          {/* Terminal labels positioned directly on top of the terminals */}
          <UprightText x={-36} y={-8} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            B
          </UprightText>
          <UprightText x={32} y={-38} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            E
          </UprightText>
          <UprightText x={32} y={42} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            C
          </UprightText>
        </g>
      );

    case 'n_mosfet':
      return (
        <g className="select-none">
          {/* Envelope circle */}
          <circle cx="0" cy="0" r="28" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Gate lead & plate */}
          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-14" y1="-16" x2="-14" y2="16" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Dielectric insulation gap */}
          {/* Drain channel bar & lead */}
          <line x1="-6" y1="-16" x2="-6" y2="-6" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-6" y1="-11" x2="18" y2="-11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="-11" x2="20" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Source channel bar & lead */}
          <line x1="-6" y1="6" x2="-6" y2="16" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-6" y1="11" x2="18" y2="11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="11" x2="20" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Substrate center bar with arrow pointing IN towards channel (N-type) */}
          <line x1="-6" y1="0" x2="6" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="6" y1="0" x2="6" y2="11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="-5,0 0,-4 0,4" fill={strokeColor} />
          {/* Terminal labels positioned directly on top of the terminals outside the circle */}
          <UprightText x={-36} y={-8} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            G
          </UprightText>
          <UprightText x={32} y={-38} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            D
          </UprightText>
          <UprightText x={32} y={42} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            S
          </UprightText>
        </g>
      );

    case 'p_mosfet':
      return (
        <g className="select-none">
          {/* Envelope circle */}
          <circle cx="0" cy="0" r="28" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Gate lead & plate */}
          <line x1="-40" y1="0" x2="-14" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-14" y1="-16" x2="-14" y2="16" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Source channel bar & lead (top for P-channel) */}
          <line x1="-6" y1="-16" x2="-6" y2="-6" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-6" y1="-11" x2="18" y2="-11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="-11" x2="20" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Drain channel bar & lead (bottom for P-channel) */}
          <line x1="-6" y1="6" x2="-6" y2="16" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="-6" y1="11" x2="18" y2="11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="11" x2="20" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Substrate center bar with arrow pointing OUT away from channel (P-type) */}
          <line x1="-6" y1="0" x2="6" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="6" y1="0" x2="6" y2="-11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="5,0 0,-4 0,4" fill={strokeColor} />
          {/* Terminal labels positioned directly on top of the terminals outside the circle */}
          <UprightText x={-36} y={-8} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            G
          </UprightText>
          <UprightText x={32} y={-38} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            S
          </UprightText>
          <UprightText x={32} y={42} rot={rot} textAnchor="middle" className="fill-slate-300 text-[10px] font-mono font-bold select-none">
            D
          </UprightText>
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
          <UprightText x={-24} y={-16} rot={rot} className="fill-slate-400 text-[12px] font-bold">+</UprightText>
          {/* IN- lead at (-40, 20) to (-30, 20) */}
          <line x1="-40" y1="20" x2="-30" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <UprightText x={-24} y={24} rot={rot} className="fill-slate-400 text-[14px] font-bold">−</UprightText>
          {/* OUT lead at (30, 0) to (40, 0) */}
          <line x1="30" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
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
          <UprightText
            x={0}
            y={-19}
            rot={rot}
            textAnchor="middle"
            className={`text-[9px] font-bold font-mono ${isClosed ? 'fill-emerald-300' : 'fill-rose-300'}`}
          >
            {isClosed ? 'CLOSED' : 'OPEN'}
          </UprightText>
        </g>
      );
    }

    case 'push_button': {
      const isPressed = params.pressed ?? false;
      return (
        <g
          className="cursor-pointer group select-none"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePushButton?.(component);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPressPushButton?.(component, true);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onPressPushButton?.(component, false);
          }}
          onMouseLeave={() => {
            if (isPressed) {
              onPressPushButton?.(component, false);
            }
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            onPressPushButton?.(component, true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPressPushButton?.(component, false);
          }}
        >
          {/* Terminals */}
          <line x1="-40" y1="0" x2="-18" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="-18" cy="0" r="3.5" fill="#0f172a" stroke={isPressed ? '#10b981' : strokeColor} strokeWidth={strokeWidth} />
          <circle cx="18" cy="0" r="3.5" fill="#0f172a" stroke={isPressed ? '#10b981' : strokeColor} strokeWidth={strokeWidth} />

          {/* Actuator contact plate: snaps down to contact level y=0 when pressed */}
          <line
            x1="-22"
            y1={isPressed ? 0 : -9}
            x2="22"
            y2={isPressed ? 0 : -9}
            stroke={isPressed ? '#10b981' : strokeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Actuator plunger stem */}
          <line
            x1="0"
            y1={isPressed ? 0 : -9}
            x2="0"
            y2={isPressed ? -10 : -19}
            stroke={isPressed ? '#10b981' : strokeColor}
            strokeWidth="2.5"
          />
          {/* Tactile push button cap */}
          <rect
            x="-12"
            y={isPressed ? -16 : -25}
            width="24"
            height="6"
            rx="2"
            fill={isPressed ? '#10b981' : '#334155'}
            stroke={isPressed ? '#34d399' : '#64748b'}
            strokeWidth="1.5"
            className="transition-all"
          />

          {/* Push Label */}
          <UprightText
            x={0}
            y={isPressed ? -20 : -29}
            rot={rot}
            textAnchor="middle"
            className={`text-[9px] font-bold font-mono select-none transition-colors ${isPressed ? 'fill-emerald-400' : 'fill-slate-400'}`}
          >
            {isPressed ? 'PRESSED' : 'PUSH'}
          </UprightText>

          {/* Expanded transparent hit area for effortless clicking and holding */}
          <rect
            x="-32"
            y="-32"
            width="64"
            height="44"
            fill="#000000"
            fillOpacity="0.0001"
            pointerEvents="all"
          />
        </g>
      );
    }

    case 'relay': {
      const isEnergized = state?.energized ?? params.energized ?? false;
      const coilColor = isEnergized ? '#38bdf8' : strokeColor;
      const armTargetY = isEnergized ? 26 : -26;
      return (
        <g className="select-none">
          {/* Housing Package */}
          <rect
            x="-30"
            y="-44"
            width="60"
            height="88"
            rx="6"
            fill="#0f172a"
            stroke={isSelected ? '#38bdf8' : '#334155'}
            strokeWidth={isSelected ? 2 : 1.5}
          />

          {/* Coil leads A1(-40,-20), A2(-40,20) */}
          <line x1="-40" y1="-20" x2="-20" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="20" x2="-20" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-20" y1="-20" x2="-15" y2="-16" stroke={coilColor} strokeWidth={strokeWidth} />
          <line x1="-20" y1="20" x2="-15" y2="16" stroke={coilColor} strokeWidth={strokeWidth} />

          {/* Electromagnet Coil */}
          <rect
            x="-23"
            y="-16"
            width="14"
            height="32"
            rx="2"
            fill={isEnergized ? 'rgba(56, 189, 248, 0.2)' : '#1e293b'}
            stroke={coilColor}
            strokeWidth="1.8"
          />
          <line x1="-23" y1="-6" x2="-9" y2="4" stroke={coilColor} strokeWidth="1.4" />
          <line x1="-23" y1="4" x2="-9" y2="-6" stroke={coilColor} strokeWidth="1.4" />

          {/* Mechanical Magnetic Linkage (dashed) */}
          <line
            x1="-9"
            y1="0"
            x2="13"
            y2="0"
            stroke={isEnergized ? '#38bdf8' : '#475569'}
            strokeWidth="1.3"
            strokeDasharray="3,2"
          />

          {/* Contact Terminals: NC(40,-40), COM(40,0), NO(40,40) */}
          <line x1="12" y1="-32" x2="22" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="22" y1="-40" x2="40" y2="-40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="11" cy="-29" r="3" fill={!isEnergized ? '#f59e0b' : '#0f172a'} stroke={!isEnergized ? '#fbbf24' : '#64748b'} strokeWidth="1.5" />

          <line x1="24" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="24" cy="0" r="3" fill="#0f172a" stroke={strokeColor} strokeWidth="1.5" />

          <line x1="12" y1="32" x2="22" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="22" y1="40" x2="40" y2="40" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="11" cy="29" r="3" fill={isEnergized ? '#10b981' : '#0f172a'} stroke={isEnergized ? '#34d399' : '#64748b'} strokeWidth="1.5" />

          {/* Switched Contact Blade */}
          <line
            x1="24"
            y1="0"
            x2="11"
            y2={armTargetY}
            stroke={isEnergized ? '#10b981' : '#f59e0b'}
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Pin Annotations */}
          <UprightText x={-26} y={-24} rot={rot} className="fill-slate-400 text-[8px] font-mono font-bold">+</UprightText>
          <UprightText x={-26} y={30} rot={rot} className="fill-slate-400 text-[8px] font-mono font-bold">−</UprightText>
          <UprightText x={22} y={-28} rot={rot} textAnchor="end" className="fill-amber-400/90 text-[7.5px] font-mono font-bold">NC</UprightText>
          <UprightText x={28} y={-5} rot={rot} textAnchor="end" className="fill-slate-300 text-[7.5px] font-mono font-bold">COM</UprightText>
          <UprightText x={22} y={34} rot={rot} textAnchor="end" className="fill-emerald-400/90 text-[7.5px] font-mono font-bold">NO</UprightText>

          {/* Status indicator dot & label */}
          <circle cx="-22" cy="-35" r="2.8" fill={isEnergized ? '#10b981' : '#334155'} />
          <UprightText
            x={-16}
            y={-32}
            rot={rot}
            className={`text-[8px] font-mono font-bold ${isEnergized ? 'fill-emerald-400' : 'fill-slate-400'}`}
          >
            {isEnergized ? 'ON' : 'OFF'}
          </UprightText>
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
          <UprightText x={0} y={-22} rot={rot} textAnchor="middle" className="fill-amber-400 text-[10px] font-mono font-bold">
            BUZZER
          </UprightText>
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
          <UprightText x={0} y={5} rot={rot} textAnchor="middle" className="fill-cyan-400 text-[16px] font-bold font-mono">
            V
          </UprightText>
          <UprightText x={0} y={-24} rot={rot} textAnchor="middle" className="fill-cyan-300 text-[11px] font-mono font-bold">
            {formatVoltage(vDrop)}
          </UprightText>
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
          <UprightText x={0} y={5} rot={rot} textAnchor="middle" className="fill-emerald-400 text-[16px] font-bold font-mono">
            A
          </UprightText>
          <UprightText x={0} y={-24} rot={rot} textAnchor="middle" className="fill-emerald-300 text-[11px] font-mono font-bold">
            {formatCurrent(iVal)}
          </UprightText>
        </g>
      );
    }

    case 'photoresistor': {
      const lux = params.lux ?? 250;
      const calcR = Math.max(500 + 500000 / (lux + 1), 10);
      return (
        <g className="select-none">
          {/* Enclosing circle */}
          <circle cx="0" cy="0" r="24" fill="#0f172a" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="3,3" />
          {/* Resistor zigzag */}
          <path
            d="M -40 0 L -20 0 L -15 -8 L -9 8 L -3 -8 L 3 8 L 9 -8 L 15 8 L 20 0 L 40 0"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* Light rays pointing inwards from top-left */}
          <line x1="-22" y1="-26" x2="-14" y2="-16" stroke="#fbbf24" strokeWidth="1.8" />
          <polygon points="-12,-14 -16,-19 -18,-15" fill="#fbbf24" />
          <line x1="-12" y1="-30" x2="-4" y2="-20" stroke="#fbbf24" strokeWidth="1.8" />
          <polygon points="-2,-18 -6,-23 -8,-19" fill="#fbbf24" />
          <UprightText
            x={0}
            y={-28}
            rot={rot}
            textAnchor="middle"
            className="fill-amber-400 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            {lux} lx ({formatResistance(calcR)})
          </UprightText>
        </g>
      );
    }

    case 'thermistor': {
      const tempC = params.temperature ?? 25;
      const T = tempC + 273.15;
      const T0 = 298.15;
      const R0 = params.resistance ?? 10000;
      const B = params.beta ?? 3950;
      const calcR = Math.min(Math.max(R0 * Math.exp(B * (1 / T - 1 / T0)), 10), 1e7);
      return (
        <g className="select-none">
          {/* Resistor zigzag */}
          <path
            d="M -40 0 L -24 0 L -18 -8 L -10 8 L -2 -8 L 6 8 L 14 -8 L 20 8 L 24 0 L 40 0"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
          {/* Thermistor diagonal slash with foot (-t°) */}
          <line x1="-18" y1="16" x2="18" y2="-16" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
          <line x1="-24" y1="16" x2="-18" y2="16" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
          <UprightText
            x={0}
            y={-22}
            rot={rot}
            textAnchor="middle"
            className="fill-rose-400 text-[10px] font-mono pointer-events-none select-none font-semibold"
          >
            {tempC}°C ({formatResistance(calcR)})
          </UprightText>
        </g>
      );
    }

    case 'pir_sensor': {
      const isMotion = params.motionDetected ?? false;
      return (
        <g className="select-none">
          {/* Main Sensor Module Body */}
          <rect
            x="-28"
            y="-28"
            width="56"
            height="56"
            rx="6"
            fill="#0f172a"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          {/* Left supply leads (VCC, GND) */}
          <line x1="-40" y1="-20" x2="-28" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="20" x2="-28" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Right output lead (OUT) */}
          <line x1="28" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* PIR Fresnel Dome graphic */}
          <circle cx="2" cy="0" r="14" fill="#1e293b" stroke={strokeColor} strokeWidth="1.5" />
          <path d="M -5 -8 Q 2 -12 9 -8" fill="none" stroke="#64748b" strokeWidth="1.2" />
          <path d="M -8 0 Q 2 -3 12 0" fill="none" stroke="#64748b" strokeWidth="1.2" />
          <path d="M -5 8 Q 2 12 9 8" fill="none" stroke="#64748b" strokeWidth="1.2" />

          {/* Indicator LED */}
          <circle
            cx="18"
            cy="-18"
            r="3"
            fill={isMotion ? '#10b981' : '#334155'}
            stroke={isMotion ? '#34d399' : '#475569'}
            strokeWidth="1"
          />

          {/* Terminal labels */}
          <UprightText x={-20} y={-16} rot={rot} className="fill-emerald-400 text-[9px] font-mono font-bold">+</UprightText>
          <UprightText x={-20} y={23} rot={rot} className="fill-rose-400 text-[10px] font-mono font-bold">−</UprightText>
          <UprightText x={14} y={3} rot={rot} textAnchor="middle" className="fill-sky-400 text-[8px] font-mono font-bold">OUT</UprightText>

          <UprightText
            x={0}
            y={-32}
            rot={rot}
            textAnchor="middle"
            className="fill-sky-300 text-[9px] font-mono pointer-events-none select-none font-bold"
          >
            PIR {isMotion ? '• ACTIVE' : ''}
          </UprightText>
        </g>
      );
    }

    case 'temp_sensor': {
      const tempC = params.temperature ?? 25;
      return (
        <g className="select-none">
          {/* Sensor IC Body */}
          <rect
            x="-28"
            y="-28"
            width="56"
            height="56"
            rx="6"
            fill="#0f172a"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          {/* Leads */}
          <line x1="-40" y1="-20" x2="-28" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="20" x2="-28" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="28" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* Thermometer icon inside */}
          <rect x="-4" y="-12" width="6" height="16" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="1.2" />
          <circle cx="-1" cy="6" r="5" fill="#f43f5e" />
          <line x1="-1" y1="-6" x2="-1" y2="4" stroke="#f43f5e" strokeWidth="2.5" />

          {/* Terminal labels */}
          <UprightText x={-20} y={-16} rot={rot} className="fill-emerald-400 text-[9px] font-mono font-bold">+</UprightText>
          <UprightText x={-20} y={23} rot={rot} className="fill-rose-400 text-[10px] font-mono font-bold">−</UprightText>
          <UprightText x={15} y={3} rot={rot} textAnchor="middle" className="fill-sky-400 text-[8px] font-mono font-bold">OUT</UprightText>

          <UprightText
            x={0}
            y={-32}
            rot={rot}
            textAnchor="middle"
            className="fill-rose-300 text-[9px] font-mono pointer-events-none select-none font-bold"
          >
            LM35 {tempC}°C
          </UprightText>
        </g>
      );
    }

    case 'sound_sensor': {
      const soundLevel = params.soundLevel ?? 40;
      const sensitivity = params.sensitivity ?? 60;
      const isTriggered = soundLevel >= sensitivity;
      return (
        <g className="select-none">
          {/* Sensor Body */}
          <rect
            x="-28"
            y="-28"
            width="56"
            height="56"
            rx="6"
            fill="#0f172a"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          {/* Leads */}
          <line x1="-40" y1="-20" x2="-28" y2="-20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="-40" y1="20" x2="-28" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="28" y1="0" x2="40" y2="0" stroke={strokeColor} strokeWidth={strokeWidth} />

          {/* Microphone element */}
          <circle cx="-2" cy="0" r="10" fill="#1e293b" stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 10 -6 Q 16 0 10 6" fill="none" stroke={isTriggered ? '#38bdf8' : '#64748b'} strokeWidth="1.5" />
          <path d="M 13 -9 Q 21 0 13 9" fill="none" stroke={isTriggered ? '#38bdf8' : '#475569'} strokeWidth="1.2" />

          {/* Indicator LED */}
          <circle
            cx="18"
            cy="-18"
            r="3"
            fill={isTriggered ? '#38bdf8' : '#334155'}
            stroke={isTriggered ? '#7dd3fc' : '#475569'}
            strokeWidth="1"
          />

          {/* Terminal labels */}
          <UprightText x={-20} y={-16} rot={rot} className="fill-emerald-400 text-[9px] font-mono font-bold">+</UprightText>
          <UprightText x={-20} y={23} rot={rot} className="fill-rose-400 text-[10px] font-mono font-bold">−</UprightText>
          <UprightText x={14} y={3} rot={rot} textAnchor="middle" className="fill-sky-400 text-[8px] font-mono font-bold">OUT</UprightText>

          <UprightText
            x={0}
            y={-32}
            rot={rot}
            textAnchor="middle"
            className="fill-cyan-300 text-[9px] font-mono pointer-events-none select-none font-bold"
          >
            MIC {soundLevel}dB
          </UprightText>
        </g>
      );
    }

    case 'junction':
      return (
        <g className="select-none">
          <circle cx="0" cy="0" r="4" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
        </g>
      );

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
  if (val >= 1e-6) return `${(val * 1e6).toFixed(1)}µF`;
  if (val >= 1e-9) return `${(val * 1e9).toFixed(1)}nF`;
  return `${Math.round(val * 1e12)}pF`;
}

export function formatInductance(val: number): string {
  if (val >= 1) return `${val.toFixed(1)}H`;
  if (val >= 1e-3) return `${(val * 1e3).toFixed(1)}mH`;
  return `${(val * 1e6).toFixed(1)}µH`;
}

export function formatVoltage(val: number): string {
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(2)}kV`;
  if (Math.abs(val) >= 1) return `${val.toFixed(2)}V`;
  if (Math.abs(val) >= 1e-3) return `${(val * 1e3).toFixed(1)}mV`;
  return `${(val * 1e6).toFixed(1)}µV`;
}

export function formatCurrent(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1) return `${val.toFixed(2)}A`;
  if (abs >= 1e-3) return `${(val * 1e3).toFixed(1)}mA`;
  if (abs >= 1e-6) return `${(val * 1e6).toFixed(1)}µA`;
  return `${(val * 1e9).toFixed(1)}nA`;
}
