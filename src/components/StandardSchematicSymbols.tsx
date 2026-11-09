/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ComponentType } from '../types/circuit';

interface StandardSymbolIconProps {
  type: ComponentType;
  className?: string;
}

export const StandardSymbolIcon: React.FC<StandardSymbolIconProps> = ({ type, className = 'w-5 h-5' }) => {
  const strokeColor = 'currentColor';
  const strokeWidth = 1.6;

  switch (type) {
    case 'dc_source':
      // Battery: Long thin plate (+), short thicker plate (-), leads
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="12" x2="8" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="8" y1="5" x2="8" y2="19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="12" y1="8" x2="12" y2="16" stroke={strokeColor} strokeWidth={2.5} strokeLinecap="round" />
          <line x1="16" y1="5" x2="16" y2="19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="16" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'ac_source':
      // Circle with a sine wave ~ inside
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d="M 8 12 Q 10 8 12 12 Q 14 16 16 12" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <line x1="1" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'clock_source':
      // Circle with digital square pulse inside
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d="M 7 14 L 9.5 14 L 9.5 10 L 14.5 10 L 14.5 14 L 17 14" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="square" fill="none" />
          <line x1="1" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'ground':
      // Earth ground: vertical stem with 3 descending parallel bars
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="12" y1="3" x2="12" y2="11" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="4" y1="11" x2="20" y2="11" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="7" y1="15" x2="17" y2="15" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="10" y1="19" x2="14" y2="19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      );

    case 'resistor':
      // Standard IEEE zigzag
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M 2 12 L 5 12 L 7 7 L 10 17 L 13 7 L 16 17 L 18 7 L 20 12 L 22 12"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'potentiometer':
      // Resistor zigzag with arrow pointing to wiper
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M 2 15 L 5 15 L 7 11 L 10 19 L 13 11 L 16 19 L 18 11 L 20 15 L 22 15"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M 12 3 L 12 9 M 10 6 L 12 9 L 14 6" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'capacitor':
      // Parallel plates
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="12" x2="10" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="10" y1="5" x2="10" y2="19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="14" y1="5" x2="14" y2="19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="14" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'inductor':
      // Coil loops
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="14" x2="4" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d="M 4 14 C 4 7, 9 7, 9 14" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          <path d="M 9 14 C 9 7, 14 7, 14 14" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          <path d="M 14 14 C 14 7, 19 7, 19 14" stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
          <line x1="19" y1="14" x2="22" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'diode':
      // Triangle pointing to vertical cathode bar
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="12" x2="8" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="8,6 8,18 16,12" fill="currentColor" opacity="0.3" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <line x1="16" y1="6" x2="16" y2="18" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="16" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'zener_diode':
      // Diode with bent cathode bar
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="12" x2="8" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="8,6 8,18 16,12" fill="currentColor" opacity="0.3" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <path d="M 14 5 L 16 6 L 16 18 L 18 19" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <line x1="16" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'led':
      // Diode with two emission arrows
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="14" x2="7" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="7,8 7,20 15,14" fill="currentColor" opacity="0.3" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <line x1="15" y1="8" x2="15" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="15" y1="14" x2="21" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Emission arrows */}
          <path d="M 12 7 L 16 3 M 13.5 3 L 16 3 L 16 5.5" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 16 9 L 20 5 M 17.5 5 L 20 5 L 20 7.5" stroke={strokeColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'npn':
      // BJT NPN: Circle, base, collector, emitter with arrow OUT
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="13" cy="12" r="9" stroke={strokeColor} strokeWidth={1.2} opacity="0.6" />
          <line x1="2" y1="12" x2="10" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="10" y1="6" x2="10" y2="18" stroke={strokeColor} strokeWidth={2.2} strokeLinecap="round" />
          <line x1="10" y1="9" x2="17" y2="4" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="10" y1="15" x2="17" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Arrow pointing OUT on emitter */}
          <polygon points="17,20 13.5,18 15.5,16" fill={strokeColor} />
        </svg>
      );

    case 'pnp':
      // BJT PNP: Circle, base, collector, emitter with arrow IN
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="13" cy="12" r="9" stroke={strokeColor} strokeWidth={1.2} opacity="0.6" />
          <line x1="2" y1="12" x2="10" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="10" y1="6" x2="10" y2="18" stroke={strokeColor} strokeWidth={2.2} strokeLinecap="round" />
          <line x1="10" y1="15" x2="17" y2="20" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="10" y1="9" x2="17" y2="4" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Arrow pointing IN on emitter */}
          <polygon points="10,9 13.5,8 12,11" fill={strokeColor} />
        </svg>
      );

    case 'n_mosfet':
      // N-MOSFET icon
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="13" cy="12" r="9" stroke={strokeColor} strokeWidth={1.2} opacity="0.6" />
          <line x1="2" y1="12" x2="9" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="9" y1="7" x2="9" y2="17" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          {/* Drain and Source bars */}
          <line x1="12" y1="7" x2="12" y2="10" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="8.5" x2="18" y2="8.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="8.5" x2="18" y2="3" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="12" y1="14" x2="12" y2="17" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="15.5" x2="18" y2="15.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="15.5" x2="18" y2="21" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Inward arrow on center substrate */}
          <line x1="12" y1="12" x2="16" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="16" y1="12" x2="16" y2="15.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="12,12 14.5,10.5 14.5,13.5" fill={strokeColor} />
        </svg>
      );

    case 'p_mosfet':
      // P-MOSFET icon
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="13" cy="12" r="9" stroke={strokeColor} strokeWidth={1.2} opacity="0.6" />
          <line x1="2" y1="12" x2="9" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="9" y1="7" x2="9" y2="17" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="7" x2="12" y2="10" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="8.5" x2="18" y2="8.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="8.5" x2="18" y2="3" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="12" y1="14" x2="12" y2="17" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="15.5" x2="18" y2="15.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="18" y1="15.5" x2="18" y2="21" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Outward arrow on center substrate */}
          <line x1="12" y1="12" x2="16" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="16" y1="12" x2="16" y2="8.5" stroke={strokeColor} strokeWidth={strokeWidth} />
          <polygon points="15.5,12 13,10.5 13,13.5" fill={strokeColor} />
        </svg>
      );

    case 'opamp':
      // Operational Amplifier triangle with +/- inputs
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <polygon points="6,3 6,21 20,12" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" fill="none" />
          <line x1="1" y1="8" x2="6" y2="8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="1" y1="16" x2="6" y2="16" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* - and + text symbols */}
          <line x1="8" y1="8" x2="11" y2="8" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="8" y1="16" x2="11" y2="16" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9.5" y1="14.5" x2="9.5" y2="17.5" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );

    case 'switch':
      // SPST open switch
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="12" x2="7" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="8" cy="12" r="1.8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="9" y1="11" x2="17" y2="5" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <circle cx="18" cy="12" r="1.8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="19" y1="12" x2="22" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
      );

    case 'push_button':
      // Push button normally open with plunger
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="2" y1="14" x2="7" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="8" cy="14" r="1.8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="16" cy="14" r="1.8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="17" y1="14" x2="22" y2="14" stroke={strokeColor} strokeWidth={strokeWidth} />
          {/* Plunger contact plate & button actuator */}
          <line x1="7" y1="9" x2="17" y2="9" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
          <line x1="12" y1="9" x2="12" y2="4" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="9" y1="4" x2="15" y2="4" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      );

    case 'buzzer':
      // Piezo buzzer / speaker
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <line x1="3" y1="12" x2="8" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <rect x="8" y="7" width="5" height="10" stroke={strokeColor} strokeWidth={strokeWidth} rx="1" fill="none" />
          <polygon points="13,9 18,5 18,19 13,15" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" fill="none" />
          <path d="M 20 8 Q 22 12 20 16" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      );

    case 'voltmeter':
      // Circle with 'V'
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="1" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d="M 8.5 8.5 L 12 15.5 L 15.5 8.5" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'ammeter':
      // Circle with 'A'
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="8" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="1" y1="12" x2="4" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <line x1="20" y1="12" x2="23" y2="12" stroke={strokeColor} strokeWidth={strokeWidth} />
          <path d="M 8.5 15.5 L 12 8.5 L 15.5 15.5" stroke={strokeColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9.8" y1="13" x2="14.2" y2="13" stroke={strokeColor} strokeWidth={1.5} />
        </svg>
      );

    case 'photoresistor':
      // Zigzag with two arrows pointing in
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="9" stroke={strokeColor} strokeWidth={1.2} strokeDasharray="2,2" />
          <path d="M 3 12 L 6 12 L 8 9 L 10 15 L 12 9 L 14 15 L 16 9 L 18 12 L 21 12" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <path d="M 4 4 L 7 7 M 6 3 L 7 7 L 3 6" stroke="#fbbf24" strokeWidth={1.4} strokeLinecap="round" />
          <path d="M 8 3 L 11 6 M 10 2 L 11 6 L 7 5" stroke="#fbbf24" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      );

    case 'thermistor':
      // Resistor with diagonal -t line
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path d="M 2 12 L 6 12 L 8 8 L 11 16 L 13 8 L 16 16 L 18 12 L 22 12" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          <path d="M 5 19 L 8 19 L 16 5" stroke="#f43f5e" strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );

    case 'pir_sensor':
      // Sensor module with dome and wave rays
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="4" width="18" height="16" rx="3" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="12" cy="12" r="4.5" stroke="#38bdf8" strokeWidth={1.4} />
          <path d="M 12 6 Q 14 4 17 6" stroke="#60a5fa" strokeWidth={1.2} strokeLinecap="round" />
          <circle cx="17" cy="7" r="1.2" fill="#34d399" />
        </svg>
      );

    case 'temp_sensor':
      // Thermometer inside sensor module
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="4" width="18" height="16" rx="3" stroke={strokeColor} strokeWidth={strokeWidth} />
          <rect x="10.5" y="7" width="3" height="7" rx="1.5" stroke="#f43f5e" strokeWidth={1.2} />
          <circle cx="12" cy="15" r="2.5" fill="#f43f5e" />
          <line x1="12" y1="9" x2="12" y2="13" stroke="#f43f5e" strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      );

    case 'sound_sensor':
      // Microphone module
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="4" width="18" height="16" rx="3" stroke={strokeColor} strokeWidth={strokeWidth} />
          <circle cx="11" cy="12" r="3.5" stroke="#38bdf8" strokeWidth={1.4} />
          <path d="M 15 9 Q 18 12 15 15" stroke="#60a5fa" strokeWidth={1.2} strokeLinecap="round" />
          <circle cx="17" cy="7" r="1.2" fill="#38bdf8" />
        </svg>
      );

    default:
      return null;
  }
};
