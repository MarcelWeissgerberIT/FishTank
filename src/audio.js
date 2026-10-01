// Procedural aquarium ambience: filtered noise "water hum" + random bubble blips.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.bubbleRate = 1;
  }

  start() {
    if (!this.ctx) this.init();
    this.ctx.resume();
    this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.4);
    this.on = true;
    this.schedule();
  }

  stop() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    this.on = false;
    clearTimeout(this.timer);
  }

  init() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // brown noise buffer
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    // slow swell
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.12;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();

    // trickle (filter outflow)
    const src2 = ctx.createBufferSource();
    src2.buffer = buf;
    src2.loop = true;
    src2.playbackRate.value = 3.1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g2 = ctx.createGain();
    g2.gain.value = 0.05;
    src2.connect(bp).connect(g2).connect(this.master);
    src2.start();
  }

  blip(strength = 1) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f0 = 300 + Math.random() * 700;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (2 + Math.random() * 1.5), t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.1);
  }

  knock() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t + i * 0.16);
      o.frequency.exponentialRampToValueAtTime(90, t + i * 0.16 + 0.08);
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.5, t + i * 0.16 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.12);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.16);
      o.stop(t + i * 0.16 + 0.15);
    }
  }

  schedule() {
    if (!this.on) return;
    if (this.bubbleRate > 0) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) setTimeout(() => this.on && this.blip(0.4 + Math.random()), i * 40 * Math.random());
    }
    const delay = this.bubbleRate > 0 ? 120 + Math.random() * 600 / this.bubbleRate : 1000;
    this.timer = setTimeout(() => this.schedule(), delay);
  }
}
