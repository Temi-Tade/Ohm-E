/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CircuitComponent, Wire } from '../types/circuit';
import { createComponent } from './componentFactory';

export interface CircuitPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  components: CircuitComponent[];
  wires: Wire[];
  defaultScopeChannels?: {
    timebase?: number;
    channel1?: { pinId: string; enabled?: boolean; voltsPerDiv?: number; offsetY?: number };
    channel2?: { pinId: string; enabled?: boolean; voltsPerDiv?: number; offsetY?: number };
  };
}

export function getPresetCircuits(): CircuitPreset[] {
  // 1. RC Low-Pass Filter
  const rcSource = createComponent('ac_source', 200, 300, { voltage: 5, frequency: 100, waveform: 'sine' });
  const rcResistor = createComponent('resistor', 360, 240, { resistance: 1000 });
  const rcCapacitor = createComponent('capacitor', 500, 320, { capacitance: 2.2e-6 });
  rcCapacitor.rotation = 90;
  const rcGround1 = createComponent('ground', 200, 420);
  const rcGround2 = createComponent('ground', 500, 420);

  const rcWires: Wire[] = [
    { id: 'w_rc_1', fromPinId: rcSource.pins[0].id, toPinId: rcResistor.pins[0].id }, // Source + to Resistor 1
    { id: 'w_rc_2', fromPinId: rcResistor.pins[1].id, toPinId: rcCapacitor.pins[0].id }, // Resistor 2 to Capacitor +
    { id: 'w_rc_3', fromPinId: rcSource.pins[1].id, toPinId: rcGround1.pins[0].id }, // Source - to GND
    { id: 'w_rc_4', fromPinId: rcCapacitor.pins[1].id, toPinId: rcGround2.pins[0].id }, // Cap - to GND
  ];

  // 2. RLC Resonant Tank (Damped Oscillation Ringing)
  const rlcClock = createComponent('clock_source', 180, 300, { voltage: 5, frequency: 50, dutyCycle: 0.5 });
  const rlcResistor = createComponent('resistor', 320, 240, { resistance: 47 });
  const rlcInductor = createComponent('inductor', 460, 240, { inductance: 10e-3 }); // 10mH
  const rlcCapacitor = createComponent('capacitor', 600, 320, { capacitance: 1e-6 }); // 1µF
  rlcCapacitor.rotation = 90;
  const rlcGnd1 = createComponent('ground', 180, 420);
  const rlcGnd2 = createComponent('ground', 600, 420);

  const rlcWires: Wire[] = [
    { id: 'w_rlc_1', fromPinId: rlcClock.pins[0].id, toPinId: rlcResistor.pins[0].id },
    { id: 'w_rlc_2', fromPinId: rlcResistor.pins[1].id, toPinId: rlcInductor.pins[0].id },
    { id: 'w_rlc_3', fromPinId: rlcInductor.pins[1].id, toPinId: rlcCapacitor.pins[0].id },
    { id: 'w_rlc_4', fromPinId: rlcClock.pins[1].id, toPinId: rlcGnd1.pins[0].id },
    { id: 'w_rlc_5', fromPinId: rlcCapacitor.pins[1].id, toPinId: rlcGnd2.pins[0].id },
  ];

  // 3. Interactive LED Switch Circuit
  const ledBattery = createComponent('dc_source', 200, 300, { voltage: 9 });
  const ledSwitch = createComponent('switch', 360, 240, { closed: true });
  const ledResistor = createComponent('resistor', 500, 240, { resistance: 330 });
  const ledComp = createComponent('led', 640, 320, { forwardVoltage: 2.0, ledColor: 'red', maxCurrent: 0.035 });
  ledComp.rotation = 90;
  const ledGnd1 = createComponent('ground', 200, 420);
  const ledGnd2 = createComponent('ground', 640, 420);

  const ledWires: Wire[] = [
    { id: 'w_led_1', fromPinId: ledBattery.pins[0].id, toPinId: ledSwitch.pins[0].id },
    { id: 'w_led_2', fromPinId: ledSwitch.pins[1].id, toPinId: ledResistor.pins[0].id },
    { id: 'w_led_3', fromPinId: ledResistor.pins[1].id, toPinId: ledComp.pins[0].id },
    { id: 'w_led_4', fromPinId: ledBattery.pins[1].id, toPinId: ledGnd1.pins[0].id },
    { id: 'w_led_5', fromPinId: ledComp.pins[1].id, toPinId: ledGnd2.pins[0].id },
  ];

  // 4. Potentiometer Voltage Divider
  const potSource = createComponent('dc_source', 180, 300, { voltage: 12 });
  const potComp = createComponent('potentiometer', 380, 260, { resistance: 10000, wiper: 0.6 });
  const potVoltmeter = createComponent('voltmeter', 540, 340);
  potVoltmeter.rotation = 90;
  const potGnd1 = createComponent('ground', 180, 420);
  const potGnd2 = createComponent('ground', 380, 420);
  const potGnd3 = createComponent('ground', 540, 420);

  const potWires: Wire[] = [
    { id: 'w_pot_1', fromPinId: potSource.pins[0].id, toPinId: potComp.pins[0].id }, // Source + to Pot A
    { id: 'w_pot_2', fromPinId: potComp.pins[1].id, toPinId: potGnd2.pins[0].id }, // Pot B to Ground
    { id: 'w_pot_3', fromPinId: potComp.pins[2].id, toPinId: potVoltmeter.pins[0].id }, // Wiper W to Voltmeter +
    { id: 'w_pot_4', fromPinId: potSource.pins[1].id, toPinId: potGnd1.pins[0].id }, // Source - to GND
    { id: 'w_pot_5', fromPinId: potVoltmeter.pins[1].id, toPinId: potGnd3.pins[0].id }, // Voltmeter - to GND
  ];

  // 5. Full-Wave Bridge Rectifier
  const brSource = createComponent('ac_source', 180, 280, { voltage: 12, frequency: 50 });
  const brD1 = createComponent('diode', 340, 200); // Top Left
  const brD2 = createComponent('diode', 480, 200); // Top Right
  const brD3 = createComponent('diode', 340, 360); // Bottom Left
  const brD4 = createComponent('diode', 480, 360); // Bottom Right
  const brCap = createComponent('capacitor', 620, 280, { capacitance: 47e-6 });
  brCap.rotation = 90;
  const brRes = createComponent('resistor', 740, 280, { resistance: 1000 });
  brRes.rotation = 90;
  const brGnd = createComponent('ground', 480, 460);

  const brWires: Wire[] = [
    { id: 'w_br_1', fromPinId: brSource.pins[0].id, toPinId: brD1.pins[0].id },
    { id: 'w_br_2', fromPinId: brD1.pins[0].id, toPinId: brD3.pins[1].id },
    { id: 'w_br_3', fromPinId: brSource.pins[1].id, toPinId: brD2.pins[1].id },
    { id: 'w_br_4', fromPinId: brD2.pins[1].id, toPinId: brD4.pins[0].id },
    { id: 'w_br_5', fromPinId: brD1.pins[1].id, toPinId: brD2.pins[0].id }, // Positive DC rail
    { id: 'w_br_6', fromPinId: brD2.pins[0].id, toPinId: brCap.pins[0].id },
    { id: 'w_br_7', fromPinId: brCap.pins[0].id, toPinId: brRes.pins[0].id },
    { id: 'w_br_8', fromPinId: brD3.pins[0].id, toPinId: brD4.pins[1].id }, // Negative DC rail
    { id: 'w_br_9', fromPinId: brD4.pins[1].id, toPinId: brCap.pins[1].id },
    { id: 'w_br_10', fromPinId: brCap.pins[1].id, toPinId: brRes.pins[1].id },
    { id: 'w_br_11', fromPinId: brD4.pins[1].id, toPinId: brGnd.pins[0].id },
  ];

  // 6. Transistor BJT Switch / LED Driver
  const bjtVcc = createComponent('dc_source', 180, 180, { voltage: 9 });
  const bjtClock = createComponent('clock_source', 180, 360, { voltage: 5, frequency: 2, dutyCycle: 0.5 });
  const bjtRb = createComponent('resistor', 340, 360, { resistance: 4700 });
  const bjtNpn = createComponent('npn', 460, 320);
  const bjtRc = createComponent('resistor', 480, 180, { resistance: 330 });
  bjtRc.rotation = 90;
  const bjtLed = createComponent('led', 480, 240, { ledColor: 'blue', forwardVoltage: 2.8, maxCurrent: 0.03 });
  bjtLed.rotation = 90;
  const bjtGnd1 = createComponent('ground', 180, 460);
  const bjtGnd2 = createComponent('ground', 480, 460);

  const bjtWires: Wire[] = [
    { id: 'w_bjt_1', fromPinId: bjtClock.pins[0].id, toPinId: bjtRb.pins[0].id },
    { id: 'w_bjt_2', fromPinId: bjtRb.pins[1].id, toPinId: bjtNpn.pins[0].id }, // Base
    { id: 'w_bjt_3', fromPinId: bjtVcc.pins[0].id, toPinId: bjtRc.pins[0].id },
    { id: 'w_bjt_4', fromPinId: bjtRc.pins[1].id, toPinId: bjtLed.pins[0].id },
    { id: 'w_bjt_5', fromPinId: bjtLed.pins[1].id, toPinId: bjtNpn.pins[1].id }, // Collector
    { id: 'w_bjt_6', fromPinId: bjtNpn.pins[2].id, toPinId: bjtGnd2.pins[0].id }, // Emitter to GND
    { id: 'w_bjt_7', fromPinId: bjtClock.pins[1].id, toPinId: bjtGnd1.pins[0].id },
    { id: 'w_bjt_8', fromPinId: bjtVcc.pins[1].id, toPinId: bjtGnd1.pins[0].id },
  ];

  return [
    {
      id: 'rc_filter',
      name: 'RC Low-Pass Filter',
      description: 'Frequency attenuation and phase lag demonstration with AC sine wave.',
      category: 'Filters',
      components: [rcSource, rcResistor, rcCapacitor, rcGround1, rcGround2],
      wires: rcWires,
      defaultScopeChannels: {
        timebase: 0.002, // 2ms/div (total span 20ms = 2 full cycles of 100Hz)
        channel1: { pinId: rcSource.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
        channel2: { pinId: rcCapacitor.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
      },
    },
    {
      id: 'rlc_resonance',
      name: 'RLC Underdamped Tank',
      description: 'Step pulse excitation demonstrating resonant frequency ringing.',
      category: 'Oscillations',
      components: [rlcClock, rlcResistor, rlcInductor, rlcCapacitor, rlcGnd1, rlcGnd2],
      wires: rlcWires,
      defaultScopeChannels: {
        timebase: 0.001, // 1ms/div
        channel1: { pinId: rlcClock.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
        channel2: { pinId: rlcCapacitor.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
      },
    },
    {
      id: 'led_switch',
      name: 'Interactive Switch & LED',
      description: 'Click switch to close/open circuit with glowing LED and current limiter.',
      category: 'Basics',
      components: [ledBattery, ledSwitch, ledResistor, ledComp, ledGnd1, ledGnd2],
      wires: ledWires,
      defaultScopeChannels: {
        timebase: 0.01,
        channel1: { pinId: ledSwitch.pins[1].id, enabled: true, voltsPerDiv: 5.0 },
        channel2: { pinId: ledComp.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
      },
    },
    {
      id: 'pot_divider',
      name: 'Potentiometer Voltage Divider',
      description: 'Adjustable voltage divider with live Voltmeter probe.',
      category: 'Basics',
      components: [potSource, potComp, potVoltmeter, potGnd1, potGnd2, potGnd3],
      wires: potWires,
      defaultScopeChannels: {
        timebase: 0.02,
        channel1: { pinId: potSource.pins[0].id, enabled: true, voltsPerDiv: 5.0 },
        channel2: { pinId: potComp.pins[2].id, enabled: true, voltsPerDiv: 5.0 },
      },
    },
    {
      id: 'bridge_rectifier',
      name: 'Full-Wave Bridge Rectifier',
      description: 'AC to smoothed DC conversion using 4 diodes and reservoir capacitor.',
      category: 'Power',
      components: [brSource, brD1, brD2, brD3, brD4, brCap, brRes, brGnd],
      wires: brWires,
      defaultScopeChannels: {
        timebase: 0.005,
        channel1: { pinId: brSource.pins[0].id, enabled: true, voltsPerDiv: 5.0 },
        channel2: { pinId: brCap.pins[0].id, enabled: true, voltsPerDiv: 5.0 },
      },
    },
    {
      id: 'bjt_switch',
      name: 'BJT Transistor LED Driver',
      description: 'NPN transistor operating as a saturated electronic switch.',
      category: 'Transistors',
      components: [bjtVcc, bjtClock, bjtRb, bjtNpn, bjtRc, bjtLed, bjtGnd1, bjtGnd2],
      wires: bjtWires,
      defaultScopeChannels: {
        timebase: 0.1,
        channel1: { pinId: bjtClock.pins[0].id, enabled: true, voltsPerDiv: 2.0 },
        channel2: { pinId: bjtNpn.pins[1].id, enabled: true, voltsPerDiv: 5.0 },
      },
    },
  ];
}
