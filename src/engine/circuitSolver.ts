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
      if (comp.type === 'dc_source' || comp.type === 'ac_source' || comp.type === 'clock_source') {
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

  public reset() {
    this.prevCapacitorVoltages.clear();
    this.prevInductorCurrents.clear();
    this.prevDiodeVoltages.clear();
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
    const numNodes = topology.nodeCount; // node 0 is ground, nodes 1..numNodes-1 are unknowns

    // Branch equations for components enforcing voltage:
    // DC sources, AC sources, Clock sources, Ammeters, OpAmp outputs
    interface VoltageBranch {
      compId: string;
      nodePlus: number;
      nodeMinus: number;
      voltage: number;
      resistance?: number; // internal series resistance
    }

    // Identify non-linear components
    // Iteration loop for non-linear convergence (up to 4 iterations)
    let nodeVoltages = new Array(numNodes).fill(0);
    const MAX_ITERS = 4;

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
              voltage: comp.params.voltage ?? 9,
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
        } else if (comp.type === 'clock_source') {
          const outPin = comp.pins.find(p => p.name === 'OUT');
          const gndPin = comp.pins.find(p => p.name === 'GND');
          if (outPin && gndPin) {
            const vHigh = comp.params.voltage ?? 5;
            const freq = comp.params.frequency ?? 10;
            const duty = comp.params.dutyCycle ?? 0.5;
            const period = 1 / Math.max(freq, 0.001);
            const tInPeriod = (time % period) / period;
            const vInstant = tInPeriod < duty ? vHigh : 0;

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
        }
      }

      // Matrix dimension: unknowns are (numNodes - 1) node voltages (since node 0 is fixed at 0)
      // plus M voltage branch currents
      const numNodeUnknowns = Math.max(numNodes - 1, 0);
      const numBranchUnknowns = voltageBranches.length;
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
        } else if (comp.type === 'diode' || comp.type === 'led' || comp.type === 'zener_diode') {
          const anodePin = comp.pins.find(p => p.name === 'Anode');
          const cathodePin = comp.pins.find(p => p.name === 'Cathode');
          if (anodePin && cathodePin) {
            const na = topology.pinToNode.get(anodePin.id) ?? 0;
            const nk = topology.pinToNode.get(cathodePin.id) ?? 0;
            const va = nodeVoltages[na] ?? 0;
            const vk = nodeVoltages[nk] ?? 0;
            const vd = va - vk;

            const vf = comp.type === 'led' ? (comp.params.forwardVoltage ?? 2.0) : (comp.params.forwardVoltage ?? 0.7);
            const isZener = comp.type === 'zener_diode';
            const vz = comp.params.zenerVoltage ?? 5.1;

            let gd = 1e-6; // Reverse leakage conductance
            let id = 0;

            if (vd > vf) {
              // Forward conduction
              const rForward = 5; // 5 ohms dynamic series resistance
              gd = 1 / rForward;
              id = (vd - vf) / rForward;
            } else if (isZener && vd < -vz) {
              // Zener breakdown
              const rZener = 10;
              gd = 1 / rZener;
              id = (vd + vz) / rZener;
            }

            // Companion linearization: I = gd * vd + Ieq => Ieq = id - gd * vd
            const Ieq = id - gd * vd;
            stampConductance(na, nk, gd);
            stampCurrentSource(na, nk, Ieq);
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
            const beta = comp.params.beta ?? 100;

            // Base-Emitter diode
            let gbe = 1e-6;
            let ib = 0;
            if (vbe > 0.65) {
              const rbe = 25;
              gbe = 1 / rbe;
              ib = (vbe - 0.65) / rbe;
            }
            stampConductance(nb, ne, gbe);
            stampCurrentSource(nb, ne, ib - gbe * vbe);

            // Collector current Ic = beta * Ib (active) or saturated if Vce < 0.2V
            if (ib > 0 && vce > 0.05) {
              let ic = ib * beta;
              // saturation clamp
              if (vce < 0.2) {
                ic = ic * Math.max(vce / 0.2, 0);
              }
              stampCurrentSource(nc, ne, ic);
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
            const beta = comp.params.beta ?? 100;

            let geb = 1e-6;
            let ib = 0;
            if (veb > 0.65) {
              const reb = 25;
              geb = 1 / reb;
              ib = (veb - 0.65) / reb;
            }
            stampConductance(ne, nb, geb);
            stampCurrentSource(nb, ne, ib - geb * veb);

            if (ib > 0 && vec > 0.05) {
              let ic = ib * beta;
              if (vec < 0.2) {
                ic = ic * Math.max(vec / 0.2, 0);
              }
              stampCurrentSource(ne, nc, ic);
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

      // Solve linear system
      const solution = solveLinearSystem(A, b);
      if (solution) {
        // Update nodeVoltages: node 0 is 0V
        nodeVoltages = [0];
        for (let i = 0; i < numNodeUnknowns; i++) {
          nodeVoltages.push(solution[i]);
        }
      }
    }

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
        const vDrop = v1 - v2;
        componentVoltageDrops.set(comp.id, vDrop);

        let current = 0;
        if (comp.type === 'resistor' || comp.type === 'voltmeter' || comp.type === 'buzzer') {
          const R = Math.max(comp.params.resistance ?? 1000, 0.001);
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
          const vf = comp.type === 'led' ? (comp.params.forwardVoltage ?? 2.0) : (comp.params.forwardVoltage ?? 0.7);

          if (vd > vf) {
            current = (vd - vf) / 5;
          } else if (comp.type === 'zener_diode' && vd < -(comp.params.zenerVoltage ?? 5.1)) {
            current = (vd + (comp.params.zenerVoltage ?? 5.1)) / 10;
          } else {
            current = Math.max(0, vd * 1e-6);
          }

          if (comp.type === 'led') {
            const maxI = comp.params.maxCurrent ?? 0.035;
            // Any current > 0.3mA (0.0003A) triggers visible luminescence, scaling with current
            const normI = Math.max(0, current / maxI);
            const brightness = current > 0.0003 ? Math.min(0.3 + normI * 0.7, 1.8) : 0;
            const isBlown = current > maxI * 1.8;
            comp.state = {
              voltageDrop: vd,
              current,
              power: Math.abs(vd * current),
              brightness: isBlown ? 0 : brightness,
              isBlown,
            };
          }
        } else if (comp.type === 'dc_source' || comp.type === 'ac_source' || comp.type === 'clock_source') {
          current = 0;
        }

        componentCurrents.set(comp.id, current);
        if (comp.type !== 'led') {
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
