/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitComponent, Wire, Pin } from '../types/circuit';
import { getPinAbsolutePos } from './componentFactory';

// Matrix solver using Gaussian Elimination with partial pivoting
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];

  // Deep copy matrix and vector
  const M = A.map(row => [...row]);
  const x = [...b];

  for (let k = 0; k < n; k++) {
    // Partial pivoting
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const val = Math.abs(M[i][k]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = i;
      }
    }

    if (maxVal < 1e-12) {
      // Matrix is singular or ill-conditioned; apply small Tikhonov regularizer
      M[k][k] += 1e-9;
    }

    if (maxRow !== k) {
      // Swap rows in M
      const tempRow = M[k];
      M[k] = M[maxRow];
      M[maxRow] = tempRow;
      // Swap elements in x
      const tempVal = x[k];
      x[k] = x[maxRow];
      x[maxRow] = tempVal;
    }

    // Elimination
    const pivot = M[k][k];
    if (Math.abs(pivot) < 1e-15) continue;

    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / pivot;
      x[i] -= factor * x[k];
      for (let j = k; j < n; j++) {
        M[i][j] -= factor * M[k][j];
      }
    }
  }

  // Back substitution
  const result = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * result[j];
    }
    const diag = M[i][i];
    result[i] = Math.abs(diag) > 1e-15 ? sum / diag : 0;
  }

  return result;
}

export interface NodeMap {
  pinToNode: Map<string, number>;
  nodeCount: number;
  groundNode: number; // usually 0
}

export function buildNodeTopology(components: CircuitComponent[], wires: Wire[]): NodeMap {
  // Disjoint Set / Union-Find for pins
  const parent = new Map<string, string>();

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  }

  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }

  // Register all component pins
  for (const comp of components) {
    for (const pin of comp.pins) {
      find(pin.id);
    }
  }

  // Union connected wires
  for (const wire of wires) {
    if (wire.fromPinId && wire.toPinId) {
      union(wire.fromPinId, wire.toPinId);
    }
  }

  // Also union pins that are physically placed on top of each other (within 10px snap)
  const pinPositions: { pinId: string; x: number; y: number }[] = [];
  for (const comp of components) {
    for (const pin of comp.pins) {
      const pos = getPinAbsolutePos(comp, pin);
      pinPositions.push({ pinId: pin.id, x: pos.x, y: pos.y });
    }
  }

  for (let i = 0; i < pinPositions.length; i++) {
    for (let j = i + 1; j < pinPositions.length; j++) {
      const dx = pinPositions[i].x - pinPositions[j].x;
      const dy = pinPositions[i].y - pinPositions[j].y;
      if (dx * dx + dy * dy < 64) {
        // within 8px
        union(pinPositions[i].pinId, pinPositions[j].pinId);
      }
    }
  }

  // Identify ground components
  const groundRoots = new Set<string>();
  for (const comp of components) {
    if (comp.type === 'ground' && comp.pins.length > 0) {
      groundRoots.add(find(comp.pins[0].id));
    }
  }

  // Map each unique root to an integer node index (0 is Ground)
  const rootToNode = new Map<string, number>();
  let nextNodeIdx = 1;

  // Designate ground root if present
  let hasGround = false;
  for (const gRoot of groundRoots) {
    rootToNode.set(gRoot, 0);
    hasGround = true;
  }

  // If no ground component exists, pick a reference root as ground (e.g. negative terminal of first DC or AC source)
  if (!hasGround && components.length > 0) {
    let fallbackPin: string | null = null;
    for (const comp of components) {
      if (
        comp.type === 'dc_source' ||
        comp.type === 'ac_source' ||
        comp.type === 'square_wave' ||
        comp.type === 'pulse_gen'
      ) {
        const negPin = comp.pins.find(p => p.name === '-' || p.name === 'GND');
        if (negPin) {
          fallbackPin = negPin.id;
          break;
        }
      }
    }
    if (!fallbackPin && components[0].pins.length > 0) {
      fallbackPin = components[0].pins[0].id;
    }
    if (fallbackPin) {
      rootToNode.set(find(fallbackPin), 0);
    }
  }

  // Assign numbers to all remaining roots
  for (const comp of components) {
    for (const pin of comp.pins) {
      const r = find(pin.id);
      if (!rootToNode.has(r)) {
        rootToNode.set(r, nextNodeIdx++);
      }
    }
  }

  const pinToNode = new Map<string, number>();
  for (const comp of components) {
    for (const pin of comp.pins) {
      const node = rootToNode.get(find(pin.id)) ?? 0;
      pinToNode.set(pin.id, node);
      pin.nodeId = node;
    }
  }

  return {
    pinToNode,
    nodeCount: nextNodeIdx, // total nodes including node 0
    groundNode: 0,
  };
}

export interface SimulationResult {
  nodeVoltages: number[];
  pinVoltages: Map<string, number>;
  componentCurrents: Map<string, number>;
  componentVoltageDrops: Map<string, number>;
  wireCurrents: Map<string, number>;
}

export class CircuitSimulator {
  private prevCapacitorVoltages = new Map<string, number>();
  private prevInductorCurrents = new Map<string, number>();
  private prevDiodeVoltages = new Map<string, number>();
  private relayStates = new Map<string, boolean>();
  private prevNodeVoltages: number[] = [];

  public reset() {
    this.prevCapacitorVoltages.clear();
    this.prevInductorCurrents.clear();
    this.prevDiodeVoltages.clear();
    this.relayStates.clear();
    this.prevNodeVoltages = [];
  }

  /**
   * Advance simulation by dt seconds.
   * Uses Modified Nodal Analysis with companion models for transient passives and
   * Newton-Raphson-like iterative linearization for diodes and transistors.
   */
  public step(
    components: CircuitComponent[],
    wires: Wire[],
    time: number,
    dt: number
  ): SimulationResult {
    const topology = buildNodeTopology(components, wires);
    const transformers = components.filter(c => c.type === 'transformer');
    const transformerCoreNodes = new Map<string, number>();
    transformers.forEach((tr, idx) => {
      transformerCoreNodes.set(tr.id, topology.nodeCount + idx);
    });
    const numNodes = topology.nodeCount + transformers.length; // node 0 is ground, nodes 1..numNodes-1 are unknowns

    // Branch equations for components enforcing voltage:
    // DC sources, AC sources, Square Wave, Pulse Wave, Clock sources, Ammeters, OpAmp outputs, Transformers
    interface VoltageBranch {
      compId: string;
      nodePlus: number;
      nodeMinus: number;
      voltage: number;
      resistance?: number; // internal series resistance
    }

    // Initialize node voltages: carry over from previous step if topology is unchanged
    let nodeVoltages = (this.prevNodeVoltages && this.prevNodeVoltages.length === numNodes)
      ? [...this.prevNodeVoltages]
      : new Array(numNodes).fill(0);
    let lastSolution: number[] | null = null;
    let lastVoltageBranches: VoltageBranch[] = [];
    const MAX_ITERS = 25;

    for (let iter = 0; iter < MAX_ITERS; iter++) {
      const voltageBranches: VoltageBranch[] = [];

      for (const comp of components) {
        if (comp.type === 'dc_source') {
          const pPin = comp.pins.find(p => p.name === '+');
          const nPin = comp.pins.find(p => p.name === '-');
          if (pPin && nPin) {
            voltageBranches.push({
              compId: comp.id,
              nodePlus: topology.pinToNode.get(pPin.id) ?? 0,
              nodeMinus: topology.pinToNode.get(nPin.id) ?? 0,
              voltage: comp.params.voltage ?? 5,
            });
          }
        } else if (comp.type === 'ac_source') {
          const pPin = comp.pins.find(p => p.name === '+');
          const nPin = comp.pins.find(p => p.name === '-');
          if (pPin && nPin) {
            const vPeak = comp.params.voltage ?? 5;
            const freq = comp.params.frequency ?? 50;
            const phase = ((comp.params.phase ?? 0) * Math.PI) / 180;
            let vInstant = 0;
            const wave = comp.params.waveform || 'sine';
            const theta = 2 * Math.PI * freq * time + phase;

            if (wave === 'sine') {
              vInstant = vPeak * Math.sin(theta);
            } else if (wave === 'square') {
              vInstant = Math.sin(theta) >= 0 ? vPeak : -vPeak;
            } else if (wave === 'triangle') {
              const norm = (theta % (2 * Math.PI)) / (2 * Math.PI);
              vInstant = vPeak * (4 * Math.abs(norm - 0.5) - 1);
            } else {
              vInstant = vPeak * Math.sin(theta);
            }

            voltageBranches.push({
              compId: comp.id,
              nodePlus: topology.pinToNode.get(pPin.id) ?? 0,
              nodeMinus: topology.pinToNode.get(nPin.id) ?? 0,
              voltage: vInstant,
            });
          }
        } else if (comp.type === 'square_wave') {
          const pPin = comp.pins.find(p => p.name === '+');
          const nPin = comp.pins.find(p => p.name === '-');
          if (pPin && nPin) {
            const vAmp = comp.params.voltage ?? 5;
            const dcOffset = comp.params.dcOffset ?? 0;
            const freq = comp.params.frequency ?? 50;
            const phaseCycles = (comp.params.phase ?? 0) / 360;
            const cyclePos = (((time * freq + phaseCycles) % 1) + 1) % 1;
            const vInstant = (cyclePos < 0.5 ? vAmp : -vAmp) + dcOffset;

            voltageBranches.push({
              compId: comp.id,
              nodePlus: topology.pinToNode.get(pPin.id) ?? 0,
              nodeMinus: topology.pinToNode.get(nPin.id) ?? 0,
              voltage: vInstant,
            });
          }
        } else if (comp.type === 'pulse_gen') {
          const outPin = comp.pins.find(p => p.name === 'OUT');
          const gndPin = comp.pins.find(p => p.name === 'GND');
          if (outPin && gndPin) {
            const vHigh = comp.params.voltage ?? 5;
            const vLow = comp.params.lowVoltage ?? 0;
            const freq = Math.max(comp.params.frequency ?? 50, 0.001);
            const duty = Math.min(Math.max(comp.params.dutyCycle ?? 0.5, 0.01), 0.99);
            const period = 1 / freq;
            const tInPeriod = (((time % period) / period) + 1) % 1;
            const vInstant = tInPeriod < duty ? vHigh : vLow;

            voltageBranches.push({
              compId: comp.id,
              nodePlus: topology.pinToNode.get(outPin.id) ?? 0,
              nodeMinus: topology.pinToNode.get(gndPin.id) ?? 0,
              voltage: vInstant,
            });
          }
        } else if (comp.type === 'ammeter') {
          const pPin = comp.pins[0];
          const nPin = comp.pins[1];
          if (pPin && nPin) {
            voltageBranches.push({
              compId: comp.id,
              nodePlus: topology.pinToNode.get(pPin.id) ?? 0,
              nodeMinus: topology.pinToNode.get(nPin.id) ?? 0,
              voltage: 0, // ideal ammeter is 0V drop
            });
          }
        } else if (comp.type === 'opamp') {
          const inPos = comp.pins.find(p => p.name === 'IN+');
          const inNeg = comp.pins.find(p => p.name === 'IN-');
          const out = comp.pins.find(p => p.name === 'OUT');
          if (inPos && inNeg && out) {
            const nodePos = topology.pinToNode.get(inPos.id) ?? 0;
            const nodeNeg = topology.pinToNode.get(inNeg.id) ?? 0;
            const nodeOut = topology.pinToNode.get(out.id) ?? 0;
            const vPos = nodeVoltages[nodePos] ?? 0;
            const vNeg = nodeVoltages[nodeNeg] ?? 0;
            const gain = comp.params.gain ?? 100000;
            const vcc = comp.params.vcc ?? 15;
            const vee = comp.params.vee ?? -15;
            const targetOut = Math.min(Math.max((vPos - vNeg) * gain, vee), vcc);

            voltageBranches.push({
              compId: comp.id,
              nodePlus: nodeOut,
              nodeMinus: 0, // referenced to ground
              voltage: targetOut,
              resistance: 10, // 10Ω output impedance
            });
          }
        } else if (comp.type === 'pir_sensor') {
          const vccPin = comp.pins.find(p => p.name === 'VCC');
          const gndPin = comp.pins.find(p => p.name === 'GND');
          const outPin = comp.pins.find(p => p.name === 'OUT');
          if (vccPin && gndPin && outPin) {
            const nVcc = topology.pinToNode.get(vccPin.id) ?? 0;
            const nGnd = topology.pinToNode.get(gndPin.id) ?? 0;
            const nOut = topology.pinToNode.get(outPin.id) ?? 0;
            const vSup = (nodeVoltages[nVcc] ?? 0) - (nodeVoltages[nGnd] ?? 0);
            const isMotion = comp.params.motionDetected ?? false;
            // Active if powered (VCC-GND >= 2.5V): 3.3V logic high on motion, 0V idle
            const outV = vSup >= 2.5 && isMotion ? Math.min(vSup, 3.3) : 0;
            voltageBranches.push({
              compId: comp.id,
              nodePlus: nOut,
              nodeMinus: nGnd,
              voltage: outV,
              resistance: 40,
            });
          }
        } else if (comp.type === 'temp_sensor') {
          const vccPin = comp.pins.find(p => p.name === 'VCC');
          const gndPin = comp.pins.find(p => p.name === 'GND');
          const outPin = comp.pins.find(p => p.name === 'VOUT');
          if (vccPin && gndPin && outPin) {
            const nVcc = topology.pinToNode.get(vccPin.id) ?? 0;
            const nGnd = topology.pinToNode.get(gndPin.id) ?? 0;
            const nOut = topology.pinToNode.get(outPin.id) ?? 0;
            const vSup = (nodeVoltages[nVcc] ?? 0) - (nodeVoltages[nGnd] ?? 0);
            const temp = comp.params.temperature ?? 25; // °C
            // LM35/TMP36 linear output: 10mV/°C + 0.5V offset
            const targetOut = vSup >= 2.5 ? Math.max(0, Math.min(0.5 + 0.01 * temp, vSup - 0.1)) : 0;
            voltageBranches.push({
              compId: comp.id,
              nodePlus: nOut,
              nodeMinus: nGnd,
              voltage: targetOut,
              resistance: 20,
            });
          }
        } else if (comp.type === 'sound_sensor') {
          const vccPin = comp.pins.find(p => p.name === 'VCC');
          const gndPin = comp.pins.find(p => p.name === 'GND');
          const outPin = comp.pins.find(p => p.name === 'OUT');
          if (vccPin && gndPin && outPin) {
            const nVcc = topology.pinToNode.get(vccPin.id) ?? 0;
            const nGnd = topology.pinToNode.get(gndPin.id) ?? 0;
            const nOut = topology.pinToNode.get(outPin.id) ?? 0;
            const vSup = (nodeVoltages[nVcc] ?? 0) - (nodeVoltages[nGnd] ?? 0);
            const soundLevel = comp.params.soundLevel ?? 40;
            const sensitivity = comp.params.sensitivity ?? 60;
            const isTriggered = soundLevel >= sensitivity;
            const outV = vSup >= 2.5 && isTriggered ? Math.min(vSup, 3.3) : 0;
            voltageBranches.push({
              compId: comp.id,
              nodePlus: nOut,
              nodeMinus: nGnd,
              voltage: outV,
              resistance: 50,
            });
          }
        }
      }

      // Matrix dimension: unknowns are (numNodes - 1) node voltages (since node 0 is fixed at 0)
      // plus M voltage branch currents + T transformer secondary coupling branches
      const numNodeUnknowns = Math.max(numNodes - 1, 0);
      const numBranchUnknowns = voltageBranches.length + transformers.length;
      const matrixSize = numNodeUnknowns + numBranchUnknowns;

      if (matrixSize === 0) break;

      const A: number[][] = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(0));
      const b: number[] = new Array(matrixSize).fill(0);

      // Helper to stamp conductance G between node1 and node2
      const stampConductance = (node1: number, node2: number, G: number) => {
        if (!isFinite(G) || G <= 0) return;
        const i = node1 - 1; // 0-based index for node unknowns (node 0 is skipped)
        const j = node2 - 1;

        if (node1 > 0) A[i][i] += G;
        if (node2 > 0) A[j][j] += G;
        if (node1 > 0 && node2 > 0) {
          A[i][j] -= G;
          A[j][i] -= G;
        }
      };

      // Helper to stamp current source flowing from node1 to node2
      const stampCurrentSource = (node1: number, node2: number, I: number) => {
        if (!isFinite(I) || I === 0) return;
        if (node1 > 0) b[node1 - 1] -= I;
        if (node2 > 0) b[node2 - 1] += I;
      };

      // Stamp components
      for (const comp of components) {
        if (comp.type === 'resistor' || comp.type === 'voltmeter' || comp.type === 'buzzer') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const R = Math.max(comp.params.resistance ?? 1000, 0.001);
          stampConductance(n1, n2, 1 / R);
        } else if (comp.type === 'photoresistor') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const lux = Math.max(comp.params.lux ?? 250, 0);
          // R(lux) ~ 500 + 500000 / (lux + 1)
          const R = Math.max(500 + 500000 / (lux + 1), 10);
          stampConductance(n1, n2, 1 / R);
        } else if (comp.type === 'thermistor') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const tempC = comp.params.temperature ?? 25;
          const T = tempC + 273.15;
          const T0 = 298.15; // 25°C in Kelvin
          const R0 = comp.params.resistance ?? 10000;
          const B = comp.params.beta ?? 3950;
          const R = Math.min(Math.max(R0 * Math.exp(B * (1 / T - 1 / T0)), 10), 1e7);
          stampConductance(n1, n2, 1 / R);
        } else if (comp.type === 'switch') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const isClosed = comp.params.closed ?? true;
          const R = isClosed ? 0.0001 : 1e8;
          stampConductance(n1, n2, 1 / R);
        } else if (comp.type === 'push_button') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const isPressed = comp.params.pressed ?? false;
          const R = isPressed ? 0.0001 : 1e8;
          stampConductance(n1, n2, 1 / R);
        } else if (comp.type === 'potentiometer') {
          const pinA = comp.pins.find(p => p.name === 'A');
          const pinB = comp.pins.find(p => p.name === 'B');
          const pinW = comp.pins.find(p => p.name === 'W');
          if (pinA && pinB && pinW) {
            const na = topology.pinToNode.get(pinA.id) ?? 0;
            const nb = topology.pinToNode.get(pinB.id) ?? 0;
            const nw = topology.pinToNode.get(pinW.id) ?? 0;
            const totalR = Math.max(comp.params.resistance ?? 10000, 10);
            const w = Math.min(Math.max(comp.params.wiper ?? 0.5, 0.001), 0.999);
            const rAW = totalR * w;
            const rWB = totalR * (1 - w);
            stampConductance(na, nw, 1 / rAW);
            stampConductance(nw, nb, 1 / rWB);
          }
        } else if (comp.type === 'capacitor') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const C = Math.max(comp.params.capacitance ?? 10e-6, 1e-12);
          // Companion model (Backward Euler): G_eq = C / dt, I_eq = G_eq * V_prev
          const Geq = C / dt;
          const vPrev = this.prevCapacitorVoltages.get(comp.id) ?? 0;
          const Ieq = Geq * vPrev;
          stampConductance(n1, n2, Geq);
          // Current flowing into n1 from n2 is Ieq
          stampCurrentSource(n2, n1, Ieq);
        } else if (comp.type === 'inductor') {
          const n1 = topology.pinToNode.get(comp.pins[0].id) ?? 0;
          const n2 = topology.pinToNode.get(comp.pins[1].id) ?? 0;
          const L = Math.max(comp.params.inductance ?? 10e-3, 1e-9);
          // Companion model (Backward Euler): G_eq = dt / L, I_eq = I_prev
          const Geq = dt / L;
          const iPrev = this.prevInductorCurrents.get(comp.id) ?? 0;
          stampConductance(n1, n2, Geq);
          stampCurrentSource(n1, n2, iPrev);
        } else if (comp.type === 'relay') {
          const coilP = comp.pins.find(p => p.name === 'COIL+') ?? comp.pins[0];
          const coilM = comp.pins.find(p => p.name === 'COIL-') ?? comp.pins[1];
          const ncPin = comp.pins.find(p => p.name === 'NC');
          const comPin = comp.pins.find(p => p.name === 'COM');
          const noPin = comp.pins.find(p => p.name === 'NO');
          if (coilP && coilM) {
            const nCp = topology.pinToNode.get(coilP.id) ?? 0;
            const nCm = topology.pinToNode.get(coilM.id) ?? 0;
            const rCoil = Math.max(comp.params.coilResistance ?? 100, 1);
            stampConductance(nCp, nCm, 1 / rCoil);
          }
          if (comPin && noPin && ncPin) {
            const nCom = topology.pinToNode.get(comPin.id) ?? 0;
            const nNo = topology.pinToNode.get(noPin.id) ?? 0;
            const nNc = topology.pinToNode.get(ncPin.id) ?? 0;
            const isEnergized = this.relayStates.get(comp.id) ?? comp.params.energized ?? false;
            stampConductance(nCom, nNo, isEnergized ? 1 / 0.01 : 1e-8);
            stampConductance(nCom, nNc, isEnergized ? 1e-8 : 1 / 0.01);
          }
        } else if (comp.type === 'transformer') {
          const p1 = comp.pins.find(p => p.name === 'P1') ?? comp.pins[0];
          const p2 = comp.pins.find(p => p.name === 'P2') ?? comp.pins[1];
          const s1 = comp.pins.find(p => p.name === 'S1') ?? comp.pins[2];
          const s2 = comp.pins.find(p => p.name === 'S2') ?? comp.pins[3];
          const nCore = transformerCoreNodes.get(comp.id) ?? 0;
          if (p1 && p2 && s1 && s2 && nCore > 0) {
            const nP1 = topology.pinToNode.get(p1.id) ?? 0;
            const nP2 = topology.pinToNode.get(p2.id) ?? 0;
            const nS2 = topology.pinToNode.get(s2.id) ?? 0;
            const rp = Math.max(comp.params.windingResistance ?? 0.5, 0.05);
            const lm = Math.max(comp.params.inductance ?? 1.0, 0.01);
            const iMagPrev = this.prevInductorCurrents.get(`${comp.id}_mag`) ?? 0;

            // Primary series resistance Rp + magnetizing inductor Lm
            stampConductance(nP1, nCore, 1 / rp);
            stampConductance(nCore, nP2, dt / lm);
            stampCurrentSource(nCore, nP2, iMagPrev);
            // Tiny galvanic tie so isolated secondary windings never produce a singular matrix
            stampConductance(nS2, 0, 1e-9);
            stampConductance(nP2, 0, 1e-9);
          }
        } else if (comp.type === 'diode' || comp.type === 'led' || comp.type === 'zener_diode') {
          const anodePin = comp.pins.find(p => p.name === 'Anode');
          const cathodePin = comp.pins.find(p => p.name === 'Cathode');
          if (anodePin && cathodePin) {
            const na = topology.pinToNode.get(anodePin.id) ?? 0;
            const nk = topology.pinToNode.get(cathodePin.id) ?? 0;
            const va = nodeVoltages[na] ?? 0;
            const vk = nodeVoltages[nk] ?? 0;
            const vd = va - vk;

            const isLed = comp.type === 'led';
            const defaultVf = isLed ? (comp.params.ledColor === 'blue' || comp.params.ledColor === 'white' ? 2.8 : 1.8) : 0.7;
            const vf = comp.params.forwardVoltage ?? defaultVf;
            const isZener = comp.type === 'zener_diode';
            const vz = comp.params.zenerVoltage ?? 5.1;

            if (vd > vf) {
              // Forward conduction with dynamic series resistance
              const rForward = isLed ? 12 : 1.0;
              const gd = 1 / rForward;
              const Ieq = -vf / rForward;
              stampConductance(na, nk, gd);
              stampCurrentSource(na, nk, Ieq);
            } else if (isZener && vd < -vz) {
              // Zener breakdown
              const rZener = 5;
              const gd = 1 / rZener;
              const Ieq = vz / rZener;
              stampConductance(na, nk, gd);
              stampCurrentSource(na, nk, Ieq);
            } else {
              // Reverse cut-off: pure leakage conductance with NO current source offset
              // Allows capacitors to discharge naturally without artificial charge clamping
              const gLeak = 1e-9;
              stampConductance(na, nk, gLeak);
            }
          }
        } else if (comp.type === 'npn') {
          const bPin = comp.pins.find(p => p.name === 'Base');
          const cPin = comp.pins.find(p => p.name === 'Collector');
          const ePin = comp.pins.find(p => p.name === 'Emitter');
          if (bPin && cPin && ePin) {
            const nb = topology.pinToNode.get(bPin.id) ?? 0;
            const nc = topology.pinToNode.get(cPin.id) ?? 0;
            const ne = topology.pinToNode.get(ePin.id) ?? 0;
            const vb = nodeVoltages[nb] ?? 0;
            const vc = nodeVoltages[nc] ?? 0;
            const ve = nodeVoltages[ne] ?? 0;
            const vbe = vb - ve;
            const vce = vc - ve;
            const beta = Math.max(comp.params.beta ?? 100, 1);

            // Base-Emitter diode with series base resistance
            const rbe = 30;
            let gbe = 1e-6;
            let ib = 0;
            if (vbe > 0.6) {
              gbe = 1 / rbe;
              ib = Math.max(0, (vbe - 0.65) / rbe);
              stampConductance(nb, ne, gbe);
              stampCurrentSource(nb, ne, -0.65 * gbe);
            } else {
              stampConductance(nb, ne, 1e-6);
            }

            // Collector-Emitter channel: continuous transconductance in active mode
            if (ib > 0 && vce > 0) {
              if (vce < 0.2) {
                // Saturated: small saturation resistance (2 ohms)
                stampConductance(nc, ne, 0.5);
              } else {
                // Active mode: transconductance gm = beta * gbe
                const gm = Math.min(beta * gbe, 5.0);
                if (nc > 0 && nb > 0) A[nc - 1][nb - 1] += gm;
                if (nc > 0 && ne > 0) A[nc - 1][ne - 1] -= gm;
                if (ne > 0 && nb > 0) A[ne - 1][nb - 1] -= gm;
                if (ne > 0 && ne > 0) A[ne - 1][ne - 1] += gm;
                stampCurrentSource(nc, ne, -0.65 * gm);
              }
            } else {
              stampConductance(nc, ne, 1e-7);
            }
          }
        } else if (comp.type === 'pnp') {
          const bPin = comp.pins.find(p => p.name === 'Base');
          const cPin = comp.pins.find(p => p.name === 'Collector');
          const ePin = comp.pins.find(p => p.name === 'Emitter');
          if (bPin && cPin && ePin) {
            const nb = topology.pinToNode.get(bPin.id) ?? 0;
            const nc = topology.pinToNode.get(cPin.id) ?? 0;
            const ne = topology.pinToNode.get(ePin.id) ?? 0;
            const vb = nodeVoltages[nb] ?? 0;
            const vc = nodeVoltages[nc] ?? 0;
            const ve = nodeVoltages[ne] ?? 0;
            const veb = ve - vb;
            const vec = ve - vc;
            const beta = Math.max(comp.params.beta ?? 100, 1);

            const reb = 30;
            let geb = 1e-6;
            let ib = 0;
            if (veb > 0.6) {
              geb = 1 / reb;
              ib = Math.max(0, (veb - 0.65) / reb);
              stampConductance(ne, nb, geb);
              stampCurrentSource(ne, nb, -0.65 * geb);
            } else {
              stampConductance(ne, nb, 1e-6);
            }

            if (ib > 0 && vec > 0) {
              if (vec < 0.2) {
                stampConductance(ne, nc, 0.5);
              } else {
                const gm = Math.min(beta * geb, 5.0);
                if (ne > 0 && ne > 0) A[ne - 1][ne - 1] += gm;
                if (ne > 0 && nb > 0) A[ne - 1][nb - 1] -= gm;
                if (nc > 0 && ne > 0) A[nc - 1][ne - 1] -= gm;
                if (nc > 0 && nb > 0) A[nc - 1][nb - 1] += gm;
                stampCurrentSource(ne, nc, -0.65 * gm);
              }
            } else {
              stampConductance(ne, nc, 1e-7);
            }
          }
        } else if (comp.type === 'n_mosfet') {
          const gPin = comp.pins.find(p => p.name === 'Gate');
          const dPin = comp.pins.find(p => p.name === 'Drain');
          const sPin = comp.pins.find(p => p.name === 'Source');
          if (gPin && dPin && sPin) {
            const ng = topology.pinToNode.get(gPin.id) ?? 0;
            const nd = topology.pinToNode.get(dPin.id) ?? 0;
            const ns = topology.pinToNode.get(sPin.id) ?? 0;
            const vg = nodeVoltages[ng] ?? 0;
            const vd = nodeVoltages[nd] ?? 0;
            const vs = nodeVoltages[ns] ?? 0;
            const vgs = vg - vs;
            const vds = vd - vs;
            const vth = comp.params.vth ?? 2.0;
            const K = Math.max(comp.params.transconductance ?? 0.05, 1e-4);
            const rdsOn = Math.max(comp.params.rdsOn ?? 0.2, 0.01);

            // Gate input has virtually infinite impedance
            stampConductance(ng, ns, 1e-9);

            if (vgs > vth && vds > 0) {
              const vov = vgs - vth; // overdrive
              if (vds < vov) {
                // Ohmic / Triode region: linear resistance Rdson
                const ron = Math.max(rdsOn, 1 / (K * Math.max(vov, 0.05)));
                stampConductance(nd, ns, 1 / ron);
              } else {
                // Saturation region: Id = 0.5 * K * Vov^2
                const idSat = 0.5 * K * vov * vov;
                const gds = Math.min(Math.max(idSat / Math.max(vds, 0.1), 1 / 1e4), 1 / rdsOn);
                stampConductance(nd, ns, gds);
              }
            } else {
              // Cutoff / off state
              stampConductance(nd, ns, 1e-7);
            }
          }
        } else if (comp.type === 'p_mosfet') {
          const gPin = comp.pins.find(p => p.name === 'Gate');
          const dPin = comp.pins.find(p => p.name === 'Drain');
          const sPin = comp.pins.find(p => p.name === 'Source');
          if (gPin && dPin && sPin) {
            const ng = topology.pinToNode.get(gPin.id) ?? 0;
            const nd = topology.pinToNode.get(dPin.id) ?? 0;
            const ns = topology.pinToNode.get(sPin.id) ?? 0;
            const vg = nodeVoltages[ng] ?? 0;
            const vd = nodeVoltages[nd] ?? 0;
            const vs = nodeVoltages[ns] ?? 0;
            const vsg = vs - vg;
            const vsd = vs - vd;
            const vthMag = Math.abs(comp.params.vth ?? -2.0);
            const K = Math.max(comp.params.transconductance ?? 0.05, 1e-4);
            const rdsOn = Math.max(comp.params.rdsOn ?? 0.2, 0.01);

            stampConductance(ng, ns, 1e-9);

            if (vsg > vthMag && vsd > 0) {
              const vov = vsg - vthMag;
              if (vsd < vov) {
                const ron = Math.max(rdsOn, 1 / (K * Math.max(vov, 0.05)));
                stampConductance(ns, nd, 1 / ron);
              } else {
                const idSat = 0.5 * K * vov * vov;
                const gsd = Math.min(Math.max(idSat / Math.max(vsd, 0.1), 1 / 1e4), 1 / rdsOn);
                stampConductance(ns, nd, gsd);
              }
            } else {
              stampConductance(ns, nd, 1e-7);
            }
          }
        }
      }

      // Stamp voltage branches (MNA B and C submatrices)
      for (let k = 0; k < voltageBranches.length; k++) {
        const branch = voltageBranches[k];
        const branchRow = numNodeUnknowns + k;
        const nPlus = branch.nodePlus;
        const nMinus = branch.nodeMinus;

        // V_plus - V_minus = V_branch
        if (nPlus > 0) {
          A[branchRow][nPlus - 1] = 1;
          A[nPlus - 1][branchRow] = 1;
        }
        if (nMinus > 0) {
          A[branchRow][nMinus - 1] = -1;
          A[nMinus - 1][branchRow] = -1;
        }

        // Internal resistance if any
        if (branch.resistance && branch.resistance > 0) {
          A[branchRow][branchRow] = -branch.resistance;
        }

        b[branchRow] = branch.voltage;
      }

      // Stamp Transformer ideal magnetic coupling rows: (Vs1 - Vs2) - n*(Vcore - Vp2) - Rs*Isec = 0
      for (let tIdx = 0; tIdx < transformers.length; tIdx++) {
        const tr = transformers[tIdx];
        const p2 = tr.pins.find(p => p.name === 'P2') ?? tr.pins[1];
        const s1 = tr.pins.find(p => p.name === 'S1') ?? tr.pins[2];
        const s2 = tr.pins.find(p => p.name === 'S2') ?? tr.pins[3];
        const nCore = transformerCoreNodes.get(tr.id) ?? 0;
        const nP2 = p2 ? (topology.pinToNode.get(p2.id) ?? 0) : 0;
        const nS1 = s1 ? (topology.pinToNode.get(s1.id) ?? 0) : 0;
        const nS2 = s2 ? (topology.pinToNode.get(s2.id) ?? 0) : 0;
        const turnsRatio = Math.max(tr.params.turnsRatio ?? 1.0, 0.01);
        const rs = Math.max((tr.params.windingResistance ?? 0.5) * 0.4, 0.05);
        const branchRow = numNodeUnknowns + voltageBranches.length + tIdx;

        if (nS1 > 0) {
          A[branchRow][nS1 - 1] += 1;
          A[nS1 - 1][branchRow] += 1;
        }
        if (nS2 > 0) {
          A[branchRow][nS2 - 1] -= 1;
          A[nS2 - 1][branchRow] -= 1;
        }
        if (nCore > 0) {
          A[branchRow][nCore - 1] -= turnsRatio;
          A[nCore - 1][branchRow] -= turnsRatio;
        }
        if (nP2 > 0) {
          A[branchRow][nP2 - 1] += turnsRatio;
          A[nP2 - 1][branchRow] += turnsRatio;
        }
        A[branchRow][branchRow] -= rs;
        b[branchRow] = 0;
      }

      // Solve linear system
      const solution = solveLinearSystem(A, b);
      lastVoltageBranches = voltageBranches;
      if (solution) {
        lastSolution = solution;
        const nextVoltages = [0];
        for (let i = 0; i < numNodes - 1; i++) {
          nextVoltages.push(solution[i]);
        }

        let maxDiff = 0;
        for (let i = 1; i <= numNodeUnknowns; i++) {
          const diff = Math.abs((nodeVoltages[i] ?? 0) - nextVoltages[i]);
          if (diff > maxDiff) maxDiff = diff;
        }

        if (iter === 0) {
          nodeVoltages = nextVoltages;
        } else {
          // Fast relaxation to ensure quick, stable convergence
          for (let i = 1; i <= numNodeUnknowns; i++) {
            nodeVoltages[i] = 0.2 * nodeVoltages[i] + 0.8 * nextVoltages[i];
          }
        }

        if (iter > 1 && maxDiff < 1e-4) {
          break;
        }
      }
    }

    // Retain converged node voltages for warm start on subsequent simulation steps
    this.prevNodeVoltages = [...nodeVoltages];

    // Update states and extract currents
    const pinVoltages = new Map<string, number>();
    const componentCurrents = new Map<string, number>();
    const componentVoltageDrops = new Map<string, number>();

    for (const comp of components) {
      for (const pin of comp.pins) {
        const node = topology.pinToNode.get(pin.id) ?? 0;
        const v = nodeVoltages[node] ?? 0;
        pinVoltages.set(pin.id, v);
        pin.voltage = v;
      }

      // Compute voltage drop and current for standard 2-terminal components
      if (comp.pins.length >= 2) {
        const v1 = pinVoltages.get(comp.pins[0].id) ?? 0;
        const v2 = pinVoltages.get(comp.pins[1].id) ?? 0;
        let vDrop = v1 - v2;
        componentVoltageDrops.set(comp.id, vDrop);

        let current = 0;
        if (comp.type === 'resistor' || comp.type === 'voltmeter' || comp.type === 'buzzer') {
          const R = Math.max(comp.params.resistance ?? 1000, 0.001);
          current = vDrop / R;
        } else if (comp.type === 'photoresistor') {
          const lux = Math.max(comp.params.lux ?? 250, 0);
          const R = Math.max(500 + 500000 / (lux + 1), 10);
          current = vDrop / R;
        } else if (comp.type === 'thermistor') {
          const tempC = comp.params.temperature ?? 25;
          const T = tempC + 273.15;
          const T0 = 298.15;
          const R0 = comp.params.resistance ?? 10000;
          const B = comp.params.beta ?? 3950;
          const R = Math.min(Math.max(R0 * Math.exp(B * (1 / T - 1 / T0)), 10), 1e7);
          current = vDrop / R;
        } else if (comp.type === 'switch') {
          const isClosed = comp.params.closed ?? true;
          current = isClosed ? vDrop / 0.0001 : vDrop / 1e8;
        } else if (comp.type === 'push_button') {
          const isPressed = comp.params.pressed ?? false;
          current = isPressed ? vDrop / 0.0001 : vDrop / 1e8;
        } else if (comp.type === 'capacitor') {
          const C = Math.max(comp.params.capacitance ?? 10e-6, 1e-12);
          const vPrev = this.prevCapacitorVoltages.get(comp.id) ?? 0;
          current = (C / dt) * (vDrop - vPrev);
          this.prevCapacitorVoltages.set(comp.id, vDrop);
        } else if (comp.type === 'inductor') {
          const L = Math.max(comp.params.inductance ?? 10e-3, 1e-9);
          const iPrev = this.prevInductorCurrents.get(comp.id) ?? 0;
          current = iPrev + (dt / L) * vDrop;
          this.prevInductorCurrents.set(comp.id, current);
        } else if (comp.type === 'diode' || comp.type === 'led' || comp.type === 'zener_diode') {
          const anodePin = comp.pins.find(p => p.name === 'Anode') ?? comp.pins[0];
          const cathodePin = comp.pins.find(p => p.name === 'Cathode') ?? comp.pins[1];
          const va = pinVoltages.get(anodePin.id) ?? 0;
          const vk = pinVoltages.get(cathodePin.id) ?? 0;
          const vd = va - vk;
          const isLed = comp.type === 'led';
          const defaultVf = isLed ? (comp.params.ledColor === 'blue' || comp.params.ledColor === 'white' ? 2.8 : 1.8) : 0.7;
          const vf = comp.params.forwardVoltage ?? defaultVf;

          if (vd > vf) {
            const rForward = isLed ? 12 : 1.0;
            current = (vd - vf) / rForward;
          } else if (isLed && vd > vf - 0.25) {
            // Soft sub-threshold knee for natural illumination
            const vDiff = vd - (vf - 0.25);
            current = (vDiff * vDiff) / (24 * 0.25);
          } else if (comp.type === 'zener_diode' && vd < -(comp.params.zenerVoltage ?? 5.1)) {
            current = (vd + (comp.params.zenerVoltage ?? 5.1)) / 5;
          } else {
            current = Math.max(0, vd * 1e-9);
          }

          if (isLed) {
            const maxI = comp.params.maxCurrent ?? 0.035;
            const normI = Math.max(0, current / maxI);
            const instantBrightness = Math.min(normI, 1.4);
            const prevBright = comp.state?.brightness ?? 0;
            // Time-constant persistence (25ms tau) so AC ripple stays smoothly lit regardless of dt
            const decay = Math.exp(-dt / 0.025);
            const brightness = Math.max(instantBrightness, prevBright * decay);
            const isBlown = current > 0.35; // Extreme 350mA destruction threshold
            comp.state = {
              voltageDrop: vd,
              current,
              power: Math.abs(vd * current),
              brightness: isBlown ? 0 : brightness,
              isBlown,
            };
          }
        } else if (comp.type === 'npn') {
          const bPin = comp.pins.find(p => p.name === 'Base');
          const cPin = comp.pins.find(p => p.name === 'Collector');
          const ePin = comp.pins.find(p => p.name === 'Emitter');
          if (bPin && cPin && ePin) {
            const vb = pinVoltages.get(bPin.id) ?? 0;
            const vc = pinVoltages.get(cPin.id) ?? 0;
            const ve = pinVoltages.get(ePin.id) ?? 0;
            const vbe = vb - ve;
            const vce = vc - ve;
            const beta = Math.max(comp.params.beta ?? 100, 1);
            const ib = vbe > 0.6 ? Math.max(0, (vbe - 0.65) / 30) : 0;
            const ic = vce > 0 ? (vce < 0.2 ? Math.max(0, vce * 0.5) : ib * beta) : 0;
            current = ic;
            vDrop = vce;
            comp.state = {
              voltageDrop: vDrop,
              current: ic,
              power: Math.abs(vce * ic),
            };
          }
        } else if (comp.type === 'pnp') {
          const bPin = comp.pins.find(p => p.name === 'Base');
          const cPin = comp.pins.find(p => p.name === 'Collector');
          const ePin = comp.pins.find(p => p.name === 'Emitter');
          if (bPin && cPin && ePin) {
            const vb = pinVoltages.get(bPin.id) ?? 0;
            const vc = pinVoltages.get(cPin.id) ?? 0;
            const ve = pinVoltages.get(ePin.id) ?? 0;
            const veb = ve - vb;
            const vec = ve - vc;
            const beta = Math.max(comp.params.beta ?? 100, 1);
            const ib = veb > 0.6 ? Math.max(0, (veb - 0.65) / 30) : 0;
            const ic = vec > 0 ? (vec < 0.2 ? Math.max(0, vec * 0.5) : ib * beta) : 0;
            current = ic;
            vDrop = vec;
            comp.state = {
              voltageDrop: vDrop,
              current: ic,
              power: Math.abs(vec * ic),
            };
          }
        } else if (comp.type === 'n_mosfet') {
          const gPin = comp.pins.find(p => p.name === 'Gate');
          const dPin = comp.pins.find(p => p.name === 'Drain');
          const sPin = comp.pins.find(p => p.name === 'Source');
          if (gPin && dPin && sPin) {
            const vg = pinVoltages.get(gPin.id) ?? 0;
            const vd = pinVoltages.get(dPin.id) ?? 0;
            const vs = pinVoltages.get(sPin.id) ?? 0;
            const vgs = vg - vs;
            const vds = vd - vs;
            const vth = comp.params.vth ?? 2.0;
            const K = Math.max(comp.params.transconductance ?? 0.05, 1e-4);
            let id = 0;
            if (vgs > vth && vds > 0) {
              const vov = vgs - vth;
              id = vds < vov ? K * (vov * vds - 0.5 * vds * vds) : 0.5 * K * vov * vov;
            }
            current = id;
            vDrop = vds;
            comp.state = {
              voltageDrop: vDrop,
              current: id,
              power: Math.abs(vds * id),
              vgs,
              vds,
            };
          }
        } else if (comp.type === 'p_mosfet') {
          const gPin = comp.pins.find(p => p.name === 'Gate');
          const dPin = comp.pins.find(p => p.name === 'Drain');
          const sPin = comp.pins.find(p => p.name === 'Source');
          if (gPin && dPin && sPin) {
            const vg = pinVoltages.get(gPin.id) ?? 0;
            const vd = pinVoltages.get(dPin.id) ?? 0;
            const vs = pinVoltages.get(sPin.id) ?? 0;
            const vsg = vs - vg;
            const vsd = vs - vd;
            const vthMag = Math.abs(comp.params.vth ?? -2.0);
            const K = Math.max(comp.params.transconductance ?? 0.05, 1e-4);
            let id = 0;
            if (vsg > vthMag && vsd > 0) {
              const vov = vsg - vthMag;
              id = vsd < vov ? K * (vov * vsd - 0.5 * vsd * vsd) : 0.5 * K * vov * vov;
            }
            current = id;
            vDrop = vsd;
            comp.state = {
              voltageDrop: vDrop,
              current: id,
              power: Math.abs(vsd * id),
              vgs: -vsg,
              vds: -vsd,
            };
          }
        } else if (comp.type === 'relay') {
          const coilP = comp.pins.find(p => p.name === 'COIL+') ?? comp.pins[0];
          const coilM = comp.pins.find(p => p.name === 'COIL-') ?? comp.pins[1];
          const vCp = pinVoltages.get(coilP.id) ?? 0;
          const vCm = pinVoltages.get(coilM.id) ?? 0;
          const vCoil = vCp - vCm;
          const rCoil = Math.max(comp.params.coilResistance ?? 100, 1);
          const iCoil = vCoil / rCoil;
          const prevEnergized = this.relayStates.get(comp.id) ?? comp.params.energized ?? false;
          const pickup = Math.max(comp.params.pickupVoltage ?? 3.5, 0.1);
          const dropout = pickup * 0.6;
          const nextEnergized = prevEnergized
            ? Math.abs(vCoil) >= dropout
            : Math.abs(vCoil) >= pickup;

          this.relayStates.set(comp.id, nextEnergized);
          comp.params.energized = nextEnergized;
          vDrop = vCoil;
          current = iCoil;
          comp.state = {
            voltageDrop: vCoil,
            current: iCoil,
            power: Math.abs(vCoil * iCoil),
            energized: nextEnergized,
          };
        } else if (comp.type === 'transformer') {
          const p1 = comp.pins.find(p => p.name === 'P1') ?? comp.pins[0];
          const p2 = comp.pins.find(p => p.name === 'P2') ?? comp.pins[1];
          const s1 = comp.pins.find(p => p.name === 'S1') ?? comp.pins[2];
          const s2 = comp.pins.find(p => p.name === 'S2') ?? comp.pins[3];
          const nCore = transformerCoreNodes.get(comp.id) ?? 0;
          const vP1 = pinVoltages.get(p1.id) ?? 0;
          const vP2 = pinVoltages.get(p2.id) ?? 0;
          const vS1 = pinVoltages.get(s1.id) ?? 0;
          const vS2 = pinVoltages.get(s2.id) ?? 0;
          const vCore = nodeVoltages[nCore] ?? vP1;

          const rp = Math.max(comp.params.windingResistance ?? 0.5, 0.05);
          const lm = Math.max(comp.params.inductance ?? 1.0, 0.01);
          const iMagPrev = this.prevInductorCurrents.get(`${comp.id}_mag`) ?? 0;
          const iMagNext = iMagPrev + (dt / lm) * (vCore - vP2);
          this.prevInductorCurrents.set(`${comp.id}_mag`, iMagNext);

          const iPrimary = (vP1 - vCore) / rp;
          const tIdx = transformers.findIndex(t => t.id === comp.id);
          const numNodeUnknowns = Math.max(numNodes - 1, 0);
          const iBranch =
            lastSolution && tIdx >= 0
              ? lastSolution[numNodeUnknowns + lastVoltageBranches.length + tIdx] ?? 0
              : 0;
          const iSecondary = -iBranch;

          vDrop = vP1 - vP2;
          current = iPrimary;
          comp.state = {
            voltageDrop: vDrop,
            current: iPrimary,
            power: Math.abs((vS1 - vS2) * iSecondary),
            secondaryVoltage: vS1 - vS2,
            secondaryCurrent: iSecondary,
          };
        } else if (
          comp.type === 'dc_source' ||
          comp.type === 'ac_source' ||
          comp.type === 'square_wave' ||
          comp.type === 'pulse_gen' ||
          comp.type === 'ammeter'
        ) {
          const bIdx = lastVoltageBranches.findIndex(b => b.compId === comp.id);
          const numNodeUnknowns = Math.max(numNodes - 1, 0);
          if (lastSolution && bIdx >= 0) {
            current = -(lastSolution[numNodeUnknowns + bIdx] ?? 0);
          } else {
            current = 0;
          }
        }

        componentCurrents.set(comp.id, current);
        if (
          comp.type !== 'led' &&
          comp.type !== 'npn' &&
          comp.type !== 'pnp' &&
          comp.type !== 'n_mosfet' &&
          comp.type !== 'p_mosfet' &&
          comp.type !== 'relay' &&
          comp.type !== 'transformer'
        ) {
          comp.state = {
            voltageDrop: vDrop,
            current,
            power: Math.abs(vDrop * current),
            audioFrequency: comp.type === 'buzzer' ? (comp.params.frequency || 880) : undefined,
          };
        }
      }
    }

    // Compute wire currents based on node connectivity
    const wireCurrents = new Map<string, number>();
    for (const wire of wires) {
      const vFrom = pinVoltages.get(wire.fromPinId) ?? 0;
      const vTo = pinVoltages.get(wire.toPinId) ?? 0;
      wire.voltage = (vFrom + vTo) / 2;

      // Estimate wire current from adjacent components
      let currentVal = 0;
      for (const comp of components) {
        if (comp.pins.some(p => p.id === wire.fromPinId || p.id === wire.toPinId)) {
          const cI = componentCurrents.get(comp.id) ?? 0;
          if (Math.abs(cI) > Math.abs(currentVal)) {
            currentVal = cI;
          }
        }
      }
      wire.current = currentVal;
      wireCurrents.set(wire.id, currentVal);
    }

    return {
      nodeVoltages,
      pinVoltages,
      componentCurrents,
      componentVoltageDrops,
      wireCurrents,
    };
  }
}
