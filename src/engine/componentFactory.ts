/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitComponent, ComponentType, Pin } from '../types/circuit';

let idCounter = 1;
export function generateId(prefix: string = 'comp'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

export function rotatePoint(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: Math.round(x * cos - y * sin),
    y: Math.round(x * sin + y * cos),
  };
}

export function getPinAbsolutePos(component: CircuitComponent, pin: Pin): { x: number; y: number } {
  const rotated = rotatePoint(pin.x, pin.y, component.rotation || 0);
  return {
    x: component.x + rotated.x,
    y: component.y + rotated.y,
  };
}

export function createComponent(
  type: ComponentType,
  x: number,
  y: number,
  customParams?: Partial<CircuitComponent['params']>
): CircuitComponent {
  const id = generateId(type);

  switch (type) {
    case 'dc_source':
      return {
        id,
        type,
        name: 'DC Source',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: '+', x: -40, y: 0 },
          { id: `${id}_n`, name: '-', label: '-', x: 40, y: 0 },
        ],
        params: {
          voltage: 5.0,
          ...customParams,
        },
      };

    case 'ac_source':
      return {
        id,
        type,
        name: 'AC Source',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: '~', x: 40, y: 0 },
          { id: `${id}_n`, name: '-', label: '⏚', x: -40, y: 0 },
        ],
        params: {
          voltage: 5.0, // Peak voltage
          frequency: 50.0, // Hz
          waveform: 'sine',
          phase: 0,
          ...customParams,
        },
      };

    case 'square_wave':
      return {
        id,
        type,
        name: 'Square Wave Gen',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: 'OUT', x: 40, y: 0 },
          { id: `${id}_n`, name: '-', label: '⏚', x: -40, y: 0 },
        ],
        params: {
          voltage: 5.0,
          dcOffset: 0.0,
          frequency: 50.0,
          phase: 0,
          ...customParams,
        },
      };

    case 'pulse_gen':
      return {
        id,
        type,
        name: 'Pulse Wave Gen',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_out`, name: 'OUT', label: 'OUT', x: 40, y: 0 },
          { id: `${id}_gnd`, name: 'GND', label: '⏚', x: -40, y: 0 },
        ],
        params: {
          voltage: 5.0,
          lowVoltage: 0.0,
          frequency: 50.0,
          dutyCycle: 0.5,
          ...customParams,
        },
      };

    case 'ground':
      return {
        id,
        type,
        name: 'Ground',
        x,
        y,
        rotation: 0,
        pins: [{ id: `${id}_g`, name: 'GND', label: 'GND', x: 0, y: -20 }],
        params: {
          voltage: 0,
          ...customParams,
        },
      };

    case 'resistor':
      return {
        id,
        type,
        name: 'Resistor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          resistance: 1000, // 1kΩ
          ...customParams,
        },
      };

    case 'potentiometer':
      return {
        id,
        type,
        name: 'Potentiometer',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_a`, name: 'A', label: 'A', x: -40, y: 0 },
          { id: `${id}_b`, name: 'B', label: 'B', x: 40, y: 0 },
          { id: `${id}_w`, name: 'W', label: 'W', x: 0, y: 40 },
        ],
        params: {
          resistance: 10000, // 10kΩ
          wiper: 0.5,
          ...customParams,
        },
      };

    case 'capacitor':
      return {
        id,
        type,
        name: 'Capacitor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '+', label: '+', x: -40, y: 0 },
          { id: `${id}_2`, name: '-', label: '-', x: 40, y: 0 },
        ],
        params: {
          capacitance: 10e-6, // 10µF
          prevVoltage: 0,
          ...customParams,
        },
      };

    case 'inductor':
      return {
        id,
        type,
        name: 'Inductor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          inductance: 10e-3, // 10mH
          prevCurrent: 0,
          ...customParams,
        },
      };

    case 'transformer':
      return {
        id,
        type,
        name: 'Transformer',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p1`, name: 'P1', label: 'P1', x: -40, y: -20 },
          { id: `${id}_p2`, name: 'P2', label: 'P2', x: -40, y: 20 },
          { id: `${id}_s1`, name: 'S1', label: 'S1', x: 40, y: -20 },
          { id: `${id}_s2`, name: 'S2', label: 'S2', x: 40, y: 20 },
        ],
        params: {
          turnsRatio: 1.0, // Ns / Np
          windingResistance: 0.5,
          inductance: 1.0, // 1H magnetizing inductance
          ...customParams,
        },
      };

    case 'diode':
      return {
        id,
        type,
        name: 'Diode',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_a`, name: 'Anode', label: 'A', x: -40, y: 0 },
          { id: `${id}_k`, name: 'Cathode', label: 'K', x: 40, y: 0 },
        ],
        params: {
          forwardVoltage: 0.7,
          ...customParams,
        },
      };

    case 'zener_diode':
      return {
        id,
        type,
        name: 'Zener Diode',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_a`, name: 'Anode', label: 'A', x: -40, y: 0 },
          { id: `${id}_k`, name: 'Cathode', label: 'K', x: 40, y: 0 },
        ],
        params: {
          forwardVoltage: 0.7,
          zenerVoltage: 5.1,
          ...customParams,
        },
      };

    case 'led':
      return {
        id,
        type,
        name: 'LED',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_a`, name: 'Anode', label: 'A', x: -40, y: 0 },
          { id: `${id}_k`, name: 'Cathode', label: 'K', x: 40, y: 0 },
        ],
        params: {
          forwardVoltage: 2.0,
          ledColor: 'red',
          maxCurrent: 0.035, // 35mA
          ...customParams,
        },
      };

    case 'npn':
      return {
        id,
        type,
        name: 'NPN Transistor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_b`, name: 'Base', label: 'B', x: -40, y: 0 },
          { id: `${id}_c`, name: 'Collector', label: 'C', x: 20, y: -40 },
          { id: `${id}_e`, name: 'Emitter', label: 'E', x: 20, y: 40 },
        ],
        params: {
          beta: 100,
          forwardVoltage: 0.7,
          ...customParams,
        },
      };

    case 'pnp':
      return {
        id,
        type,
        name: 'PNP Transistor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_b`, name: 'Base', label: 'B', x: -40, y: 0 },
          { id: `${id}_c`, name: 'Collector', label: 'C', x: 20, y: 40 },
          { id: `${id}_e`, name: 'Emitter', label: 'E', x: 20, y: -40 },
        ],
        params: {
          beta: 100,
          forwardVoltage: 0.7,
          ...customParams,
        },
      };

    case 'n_mosfet':
      return {
        id,
        type,
        name: 'N-MOSFET',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_g`, name: 'Gate', label: 'G', x: -40, y: 0 },
          { id: `${id}_d`, name: 'Drain', label: 'D', x: 20, y: -40 },
          { id: `${id}_s`, name: 'Source', label: 'S', x: 20, y: 40 },
        ],
        params: {
          vth: 2.0,
          transconductance: 0.05,
          rdsOn: 0.2,
          ...customParams,
        },
      };

    case 'p_mosfet':
      return {
        id,
        type,
        name: 'P-MOSFET',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_g`, name: 'Gate', label: 'G', x: -40, y: 0 },
          { id: `${id}_s`, name: 'Source', label: 'S', x: 20, y: -40 },
          { id: `${id}_d`, name: 'Drain', label: 'D', x: 20, y: 40 },
        ],
        params: {
          vth: -2.0,
          transconductance: 0.05,
          rdsOn: 0.2,
          ...customParams,
        },
      };

    case 'opamp':
      return {
        id,
        type,
        name: 'Op-Amp',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_in_pos`, name: 'IN+', label: '+', x: -40, y: -20 },
          { id: `${id}_in_neg`, name: 'IN-', label: '-', x: -40, y: 20 },
          { id: `${id}_out`, name: 'OUT', label: 'OUT', x: 40, y: 0 },
        ],
        params: {
          gain: 100000,
          vcc: 15,
          vee: -15,
          ...customParams,
        },
      };

    case 'switch':
      return {
        id,
        type,
        name: 'SPST Switch',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          closed: true,
          ...customParams,
        },
      };

    case 'push_button':
      return {
        id,
        type,
        name: 'Push Button',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          pressed: false,
          ...customParams,
        },
      };

    case 'relay':
      return {
        id,
        type,
        name: 'SPDT Relay',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_c1`, name: 'COIL+', label: 'A1', x: -40, y: -20 },
          { id: `${id}_c2`, name: 'COIL-', label: 'A2', x: -40, y: 20 },
          { id: `${id}_nc`, name: 'NC', label: 'NC', x: 40, y: -40 },
          { id: `${id}_com`, name: 'COM', label: 'COM', x: 40, y: 0 },
          { id: `${id}_no`, name: 'NO', label: 'NO', x: 40, y: 40 },
        ],
        params: {
          coilResistance: 100, // 100 ohm coil
          pickupVoltage: 3.5, // Pull-in threshold (5V nominal coil)
          energized: false,
          ...customParams,
        },
      };

    case 'buzzer':
      return {
        id,
        type,
        name: 'Piezo Buzzer',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: '+', x: -40, y: 0 },
          { id: `${id}_n`, name: '-', label: '-', x: 40, y: 0 },
        ],
        params: {
          resistance: 200,
          frequency: 880,
          ...customParams,
        },
      };

    case 'voltmeter':
      return {
        id,
        type,
        name: 'Voltmeter',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: '+', x: -40, y: 0 },
          { id: `${id}_n`, name: '-', label: '-', x: 40, y: 0 },
        ],
        params: {
          resistance: 1e7, // 10MΩ input impedance
          ...customParams,
        },
      };

    case 'ammeter':
      return {
        id,
        type,
        name: 'Ammeter',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_p`, name: '+', label: '+', x: -40, y: 0 },
          { id: `${id}_n`, name: '-', label: '-', x: 40, y: 0 },
        ],
        params: {
          resistance: 0.001, // 1mΩ shunt
          ...customParams,
        },
      };

    case 'photoresistor':
      return {
        id,
        type,
        name: 'Photoresistor (LDR)',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          lux: 250, // 250 lux
          resistance: 2500, // ~2.5kΩ
          ...customParams,
        },
      };

    case 'thermistor':
      return {
        id,
        type,
        name: 'NTC Thermistor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_1`, name: '1', x: -40, y: 0 },
          { id: `${id}_2`, name: '2', x: 40, y: 0 },
        ],
        params: {
          temperature: 25, // 25°C
          resistance: 10000, // 10kΩ at 25°C
          beta: 3950,
          ...customParams,
        },
      };

    case 'pir_sensor':
      return {
        id,
        type,
        name: 'PIR Motion Sensor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_vcc`, name: 'VCC', label: '+', x: -40, y: -20 },
          { id: `${id}_gnd`, name: 'GND', label: '−', x: -40, y: 20 },
          { id: `${id}_out`, name: 'OUT', label: 'OUT', x: 40, y: 0 },
        ],
        params: {
          motionDetected: false,
          ...customParams,
        },
      };

    case 'temp_sensor':
      return {
        id,
        type,
        name: 'Analog Temp Sensor (LM35)',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_vcc`, name: 'VCC', label: '+', x: -40, y: -20 },
          { id: `${id}_gnd`, name: 'GND', label: '−', x: -40, y: 20 },
          { id: `${id}_out`, name: 'VOUT', label: 'OUT', x: 40, y: 0 },
        ],
        params: {
          temperature: 25, // 25°C
          ...customParams,
        },
      };

    case 'sound_sensor':
      return {
        id,
        type,
        name: 'Sound Sensor',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_vcc`, name: 'VCC', label: '+', x: -40, y: -20 },
          { id: `${id}_gnd`, name: 'GND', label: '−', x: -40, y: 20 },
          { id: `${id}_out`, name: 'OUT', label: 'OUT', x: 40, y: 0 },
        ],
        params: {
          soundLevel: 40,
          sensitivity: 60,
          ...customParams,
        },
      };

    case 'junction':
      return {
        id,
        type,
        name: 'Wire Node Junction',
        x,
        y,
        rotation: 0,
        pins: [
          { id: `${id}_0`, name: '•', x: 0, y: 0 },
        ],
        params: {
          ...customParams,
        },
      };

    default:
      throw new Error(`Unknown component type: ${type}`);
  }
}
