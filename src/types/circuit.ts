/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ComponentType =
  | 'dc_source'
  | 'ac_source'
  | 'square_wave'
  | 'pulse_gen'
  | 'ground'
  | 'resistor'
  | 'potentiometer'
  | 'capacitor'
  | 'inductor'
  | 'transformer'
  | 'diode'
  | 'zener_diode'
  | 'led'
  | 'npn'
  | 'pnp'
  | 'n_mosfet'
  | 'p_mosfet'
  | 'opamp'
  | 'switch'
  | 'push_button'
  | 'relay'
  | 'buzzer'
  | 'voltmeter'
  | 'ammeter'
  | 'photoresistor'
  | 'thermistor'
  | 'pir_sensor'
  | 'temp_sensor'
  | 'sound_sensor'
  | 'junction';

export interface Pin {
  id: string;
  name: string;
  label?: string;
  x: number; // offset relative to component center (grid units or px)
  y: number;
  nodeId?: number; // assigned by topology analyzer
  voltage?: number;
  current?: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  name: string;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  pins: Pin[];
  params: ComponentParams;
  // Live state updated by simulation
  state?: {
    voltageDrop?: number;
    current?: number;
    power?: number;
    brightness?: number; // for LED: 0 to 1
    isBlown?: boolean;
    audioFrequency?: number;
    vgs?: number;
    vds?: number;
    energized?: boolean; // for Relay
    secondaryVoltage?: number; // for Transformer
    secondaryCurrent?: number; // for Transformer
  };
}

export interface ComponentParams {
  // Sources
  voltage?: number; // V
  lowVoltage?: number; // Low level V for pulse generator
  dcOffset?: number; // DC offset for square wave
  frequency?: number; // Hz for AC / Square / Pulse / Clock
  phase?: number; // degrees
  waveform?: 'sine' | 'square' | 'triangle' | 'sawtooth';
  dutyCycle?: number; // 0.0 - 1.0 for pulse/clock

  // Passives
  resistance?: number; // Ohms
  capacitance?: number; // Farads
  inductance?: number; // Henries
  wiper?: number; // 0.0 - 1.0 for potentiometer
  turnsRatio?: number; // Ns / Np for transformer (e.g. 1.0, 0.5, 2.0)
  windingResistance?: number; // Primary/secondary series winding R

  // Semiconductors
  forwardVoltage?: number; // V for diode/LED (e.g. 0.7V, 2.0V)
  zenerVoltage?: number; // V for zener
  ledColor?: 'red' | 'green' | 'blue' | 'yellow' | 'white';
  maxCurrent?: number; // A (e.g. 0.04A for LED)
  beta?: number; // hFE for BJT (e.g. 100)

  // MOSFETs
  vth?: number; // Threshold voltage Vth (V, e.g. 2.0V for NMOS, -2.0V for PMOS)
  transconductance?: number; // Gain parameter K in A/V^2 (e.g. 0.05)
  rdsOn?: number; // On-state saturation resistance (e.g. 0.2 ohm)

  // OpAmp
  gain?: number; // Open loop gain (e.g. 100000)
  vcc?: number; // + rail (e.g. 15V)
  vee?: number; // - rail (e.g. -15V)

  // Controls
  closed?: boolean; // for switch
  pressed?: boolean; // for push button
  coilResistance?: number; // Ohms for relay coil
  pickupVoltage?: number; // Activation threshold V for relay
  energized?: boolean; // Relay coil state

  // Sensors
  lux?: number; // 0 to 1000 lux for photoresistor
  temperature?: number; // -40 to 125 °C for thermistor & temp sensor
  motionDetected?: boolean; // true/false for PIR motion sensor
  soundLevel?: number; // 0 to 100 dB for acoustic sensor
  sensitivity?: number; // threshold sensitivity (0-100)

  // Internal states for transient solver
  prevVoltage?: number;
  prevCurrent?: number;
}

export interface WirePoint {
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  fromPinId: string;
  toPinId: string;
  points?: WirePoint[]; // intermediate waypoints if routed
  current?: number; // simulated current flowing from -> to
  voltage?: number; // voltage of the wire node
}

export interface ScopeChannel {
  id: number; // Channel index 0..3
  name: string;
  color: string;
  enabled: boolean;
  pinId?: string; // which pin or node it probes
  voltsPerDiv: number; // e.g. 1.0 (V/div)
  offsetY: number; // divisions offset (-4 to +4)
  coupling: 'dc' | 'ac';
}

export interface ScopeProbe {
  id: string; // unique probe id
  targetId: string; // component id or wire id
  type: 'component' | 'wire';
  name: string;
  color: string;
  channelIndex: number; // 0, 1, or 2
}

export interface ScopeSample {
  time: number;
  v?: number; // legacy fallback
  // Channel 0 (e.g. Orange)
  v0?: number;
  i0?: number;
  // Channel 1 (e.g. Cyan)
  v1?: number;
  i1?: number;
  // Channel 2 (e.g. Emerald/Purple)
  v2?: number;
  i2?: number;
  [key: string]: number | undefined;
}

export interface ScopeMeasurement {
  vpp: number;
  vrms: number;
  vmax: number;
  vmin: number;
  freq: number;
  iavg?: number;
  imax?: number;
  imin?: number;
  irms?: number;
}

export interface CircuitState {
  components: CircuitComponent[];
  wires: Wire[];
  time: number;
  step: number;
  simSpeed: number; // 0.1 to 5
  isRunning: boolean;
  flowMode: 'conventional' | 'electron' | 'none';
  showVoltColors: boolean;
  soundEnabled: boolean;
}
