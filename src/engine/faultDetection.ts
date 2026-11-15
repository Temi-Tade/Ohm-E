/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitComponent, Wire } from '../types/circuit';
import { buildNodeTopology, SimulationResult } from './circuitSolver';
import { ToastVariant } from '../components/ToastContainer';

export interface DetectedFault {
  key: string;
  variant: ToastVariant;
  title: string;
  description: string;
}

const SOURCE_TYPES = new Set(['dc_source', 'ac_source', 'square_wave', 'pulse_gen']);
const SHORTABLE_TWO_PIN_TYPES = new Set([
  'resistor',
  'capacitor',
  'inductor',
  'diode',
  'zener_diode',
  'led',
  'incandescent_bulb',
  'dc_motor',
  'ac_motor',
  'buzzer',
  'photoresistor',
  'thermistor',
  'voltmeter',
  'ohmmeter',
]);

function formatAmps(amps: number): string {
  const abs = Math.abs(amps);
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)} kA`;
  if (abs >= 1) return `${abs.toFixed(1)} A`;
  return `${(abs * 1000).toFixed(0)} mA`;
}

/**
 * Checks whether any component's terminals are directly shorted to the same node
 * via wires or snapped pins (works even when the simulation is paused).
 */
export function evaluateTopologyFaults(
  components: CircuitComponent[],
  wires: Wire[]
): DetectedFault[] {
  if (components.length === 0) return [];

  const topology = buildNodeTopology(components, wires);
  const faults: DetectedFault[] = [];

  for (const comp of components) {
    if (SOURCE_TYPES.has(comp.type) && comp.pins.length >= 2) {
      const n0 = topology.pinToNode.get(comp.pins[0].id);
      const n1 = topology.pinToNode.get(comp.pins[1].id);
      if (n0 !== undefined && n0 === n1) {
        faults.push({
          key: `short-src:${comp.id}`,
          variant: 'error',
          title: `Short circuit on ${comp.name}`,
          description: 'Positive and negative terminals are shorted together.',
        });
      }
      continue;
    }

    if (SHORTABLE_TWO_PIN_TYPES.has(comp.type) && comp.pins.length >= 2) {
      const n0 = topology.pinToNode.get(comp.pins[0].id);
      const n1 = topology.pinToNode.get(comp.pins[1].id);
      if (n0 !== undefined && n0 === n1) {
        faults.push({
          key: `short-comp:${comp.id}`,
          variant: 'warning',
          title: `${comp.name} is shorted`,
          description: 'Both terminals are connected to the same node.',
        });
      }
      continue;
    }

    if (comp.type === 'transformer') {
      const p1 = comp.pins.find((p) => p.name === 'P1') ?? comp.pins[0];
      const p2 = comp.pins.find((p) => p.name === 'P2') ?? comp.pins[1];
      const s1 = comp.pins.find((p) => p.name === 'S1') ?? comp.pins[2];
      const s2 = comp.pins.find((p) => p.name === 'S2') ?? comp.pins[3];
      const np1 = p1 ? topology.pinToNode.get(p1.id) : undefined;
      const np2 = p2 ? topology.pinToNode.get(p2.id) : undefined;
      const ns1 = s1 ? topology.pinToNode.get(s1.id) : undefined;
      const ns2 = s2 ? topology.pinToNode.get(s2.id) : undefined;
      if (np1 !== undefined && np1 === np2) {
        faults.push({
          key: `short-tr-p:${comp.id}`,
          variant: 'error',
          title: `Short circuit on ${comp.name}`,
          description: 'Primary winding terminals (P1, P2) are shorted together.',
        });
      }
      if (ns1 !== undefined && ns1 === ns2) {
        faults.push({
          key: `short-tr-s:${comp.id}`,
          variant: 'error',
          title: `Short circuit on ${comp.name}`,
          description: 'Secondary winding terminals (S1, S2) are shorted together.',
        });
      }
      continue;
    }

    if (comp.type === 'relay') {
      const cPlus = comp.pins.find((p) => p.name === 'COIL+') ?? comp.pins[0];
      const cMinus = comp.pins.find((p) => p.name === 'COIL-') ?? comp.pins[1];
      const np = cPlus ? topology.pinToNode.get(cPlus.id) : undefined;
      const nm = cMinus ? topology.pinToNode.get(cMinus.id) : undefined;
      if (np !== undefined && np === nm) {
        faults.push({
          key: `short-relay:${comp.id}`,
          variant: 'warning',
          title: `${comp.name} coil shorted`,
          description: 'Coil terminals are connected to the same node.',
        });
      }
      continue;
    }

    if (comp.type === 'potentiometer') {
      const aPin = comp.pins.find((p) => p.name === 'A') ?? comp.pins[0];
      const bPin = comp.pins.find((p) => p.name === 'B') ?? comp.pins[1];
      const na = aPin ? topology.pinToNode.get(aPin.id) : undefined;
      const nb = bPin ? topology.pinToNode.get(bPin.id) : undefined;
      if (na !== undefined && na === nb) {
        faults.push({
          key: `short-pot:${comp.id}`,
          variant: 'warning',
          title: `${comp.name} terminals shorted`,
          description: 'End terminals A and B are wired to the same node.',
        });
      }
    }
  }

  return faults;
}

/**
 * Checks runtime simulation faults (low-resistance dead-short currents,
 * burned-out LEDs/bulbs, and live-circuit ohmmeter warnings).
 */
export function evaluateRuntimeFaults(
  components: CircuitComponent[],
  simResult: SimulationResult | null
): DetectedFault[] {
  if (!simResult || components.length === 0) return [];

  const faults: DetectedFault[] = [];

  for (const comp of components) {
    if (SOURCE_TYPES.has(comp.type) && comp.pins.length >= 2) {
      const n0 = comp.pins[0].nodeId;
      const n1 = comp.pins[1].nodeId;
      // Only flag loop overcurrent if not already a direct pin-to-pin short
      if (n0 !== n1) {
        const current = Math.abs(simResult.componentCurrents.get(comp.id) ?? 0);
        const vDrop = Math.abs(simResult.componentVoltageDrops.get(comp.id) ?? 0);
        const effResistance = vDrop / Math.max(current, 1e-9);
        if (vDrop > 0.2 && current >= 5 && effResistance < 0.5) {
          faults.push({
            key: `overcurrent-src:${comp.id}`,
            variant: 'error',
            title: `Short circuit across ${comp.name}`,
            description: `Excessive current (${formatAmps(current)}) in low-resistance path.`,
          });
        }
      }
    }

    if (
      (comp.type === 'led' || comp.type === 'incandescent_bulb') &&
      comp.state?.isBlown
    ) {
      faults.push({
        key: `blown:${comp.id}`,
        variant: 'error',
        title: `${comp.name} burned out`,
        description: 'Overcurrent or overvoltage damaged this component. Restart to reset.',
      });
    }

    if (
      comp.type === 'ohmmeter' &&
      comp.state !== undefined &&
      Number.isNaN(comp.state.measuredResistance)
    ) {
      faults.push({
        key: `live-ohmmeter:${comp.id}`,
        variant: 'warning',
        title: 'Ohmmeter on live circuit',
        description: 'Disconnect active power sources before measuring resistance.',
      });
    }
  }

  return faults;
}
