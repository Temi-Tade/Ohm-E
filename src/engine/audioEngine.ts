/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isMuted: boolean = false;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      this.oscillator = this.ctx.createOscillator();
      this.oscillator.type = 'square';
      this.oscillator.frequency.setValueAtTime(880, this.ctx.currentTime);
      this.oscillator.connect(this.gainNode);
      this.oscillator.start();
    } catch {
      // Audio context may not be allowed until user gesture
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }

  public updateBuzzer(voltage: number, frequency: number = 880) {
    if (this.isMuted) return;
    if (!this.ctx) {
      if (Math.abs(voltage) > 0.5) {
        this.init();
      } else {
        return;
      }
    }

    if (!this.ctx || !this.gainNode || !this.oscillator) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const absV = Math.abs(voltage);
    if (absV > 0.3) {
      // Scale gain smoothly based on voltage up to 9V
      const targetGain = Math.min(Math.max((absV - 0.3) / 10, 0), 0.15);
      const targetFreq = Math.min(Math.max(frequency, 100), 5000);
      this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
      this.oscillator.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.03);
    } else {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
  }

  public stop() {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }
}

export const audioEngine = new AudioEngine();
