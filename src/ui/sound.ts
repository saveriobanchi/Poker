/**
 * Table sounds, synthesized with Web Audio at runtime: no audio files, nothing
 * to license, works offline. Card snaps are filtered noise bursts; chips are
 * short inharmonic metallic partials; spells are soft detuned shimmers.
 * iOS needs a user gesture before audio can start, so the context is created lazily.
 */
type Discipline = 'Ember' | 'Veil' | 'Thorn' | 'Mirror';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Call from a user gesture (first tap). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
  }

  private ready(): AudioContext | null {
    return this.muted || !this.ctx || this.ctx.state !== 'running' ? null : this.ctx;
  }

  private burst(at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(at, Math.random() * 0.3, dur + 0.02);
  }

  private tone(at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  /** A card sliding and snapping onto felt. */
  card(delay = 0): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    this.burst(t, 0.07, 2600, 0.8, 0.5);
    this.burst(t + 0.05, 0.035, 5200, 1.2, 0.35, 'highpass');
  }

  /** Chips clacking into the pot. */
  chips(count = 3): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t = t0 + i * 0.045 + Math.random() * 0.02;
      const base = 2900 + Math.random() * 500;
      this.tone(t, base, 0.06, 0.12);
      this.tone(t, base * 1.63, 0.045, 0.07);
      this.tone(t, base * 2.41, 0.03, 0.04);
      this.burst(t, 0.02, 6000, 1, 0.12, 'highpass');
    }
  }

  /** Knuckles on the rail. */
  check(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.burst(t, 0.09, 180, 1.5, 0.9, 'lowpass');
    this.burst(t + 0.11, 0.08, 200, 1.5, 0.7, 'lowpass');
  }

  fold(): void {
    const ctx = this.ready();
    if (!ctx) return;
    this.burst(ctx.currentTime, 0.12, 1400, 0.6, 0.25);
  }

  shuffle(): void {
    const ctx = this.ready();
    if (!ctx) return;
    for (let i = 0; i < 14; i++) this.burst(ctx.currentTime + i * 0.022, 0.03, 3000 + i * 60, 1, 0.18);
  }

  spell(discipline: Discipline): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const roots: Record<Discipline, number> = { Ember: 220, Veil: 293.7, Thorn: 196, Mirror: 329.6 };
    const root = roots[discipline];
    for (const [mult, gain] of [
      [1, 0.08],
      [1.5, 0.05],
      [2.01, 0.04],
      [3.0, 0.02],
    ] as const) {
      this.tone(t, root * mult, 0.9, gain, 'triangle');
      this.tone(t + 0.04, root * mult * 1.006, 0.8, gain * 0.6, 'sine');
    }
    this.burst(t, 0.5, discipline === 'Ember' ? 900 : 4200, 2, 0.12);
  }

  win(): void {
    this.chips(9);
  }
}
