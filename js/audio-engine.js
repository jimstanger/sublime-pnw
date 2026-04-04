/**
 * Sound Bath Audio Engine
 *
 * Models 3 Tibetan singing bowls at 69 Hz, 276 Hz, and 552 Hz.
 * Each bowl has three excitation modes synthesized differently:
 *
 *   Hit      — Struck with a mallet. Sharp attack, bright harmonics, exponential decay.
 *              Repeats periodically with slight timing randomization.
 *   Sing     — Rim rubbing. Continuous sustained tone with slow amplitude modulation,
 *              slight pitch wobble, detuned oscillator pairs, and filtered noise.
 *   Harmonic — Upper partials only. Bright, metallic, with beating between close partials.
 *
 * Bowl partial ratios are based on measured Tibetan bowl acoustics:
 *   (1, 2.71, 4.98, 5.22, 7.81)
 */

class BowlHit {
  constructor(ctx, freq, dest) {
    this.ctx = ctx;
    this.freq = freq;
    this.dest = dest;
    this.volume = 0;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(dest);
    this.hitInterval = null;
    this.partialRatios = [1.0, 2.71, 4.98, 5.22, 7.81];
    this.partialGains = [1.0, 0.4, 0.2, 0.15, 0.08];
    this.decayTimes =   [4.0, 2.5, 1.8, 1.6, 1.0]; // higher partials decay faster
  }

  _strike() {
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.partialRatios.length; i++) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      // Slight random detuning for naturalness
      const detune = (Math.random() - 0.5) * 3;
      osc.frequency.value = this.freq * this.partialRatios[i] + detune;
      env.gain.value = 0;
      osc.connect(env);
      env.connect(this.gainNode);

      const peak = this.partialGains[i] * 0.3;
      const decay = this.decayTimes[i] + (Math.random() - 0.5) * 0.3;

      // Attack
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.005);
      // Decay
      env.gain.setTargetAtTime(0, now + 0.005, decay);

      osc.start(now);
      osc.stop(now + decay * 6);
    }

    // Transient noise burst for the "click" of the strike
    const bufferSize = this.ctx.sampleRate * 0.04;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8);
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = this.freq * 3;
    noiseFilter.Q.value = 1.5;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.08;

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.04);
  }

  setVolume(value, rampTime = 0.1) {
    this.volume = value;
    const now = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(value, now, rampTime);

    if (value > 0.01 && !this.hitInterval) {
      this._strike();
      this._startLoop();
    } else if (value <= 0.01 && this.hitInterval) {
      this._stopLoop();
    }
  }

  _startLoop() {
    // Repeat strikes every 5-8 seconds with randomization
    const schedule = () => {
      const delay = 5000 + Math.random() * 3000;
      this.hitInterval = setTimeout(() => {
        if (this.volume > 0.01) {
          this._strike();
          schedule();
        } else {
          this.hitInterval = null;
        }
      }, delay);
    };
    schedule();
  }

  _stopLoop() {
    if (this.hitInterval) {
      clearTimeout(this.hitInterval);
      this.hitInterval = null;
    }
  }

  destroy() {
    this._stopLoop();
    this.gainNode.disconnect();
  }
}

class BowlSing {
  constructor(ctx, freq, dest) {
    this.ctx = ctx;
    this.freq = freq;
    this.dest = dest;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(dest);
    this.nodes = [];
    this._create();
  }

  _create() {
    const ctx = this.ctx;
    const freq = this.freq;

    // The "singing" sound: fundamental + first overtone, each with a detuned pair
    // to create natural beating / chorus effect
    const voices = [
      { f: freq,         gain: 0.20, detune: 0.4,  type: 'sine'     },
      { f: freq,         gain: 0.12, detune: -0.5, type: 'triangle' },
      { f: freq * 2.71,  gain: 0.06, detune: 0.7,  type: 'sine'     },
      { f: freq * 2.71,  gain: 0.04, detune: -0.6, type: 'sine'     },
    ];

    for (const v of voices) {
      const osc = ctx.createOscillator();
      osc.type = v.type;
      osc.frequency.value = v.f + v.detune;
      const g = ctx.createGain();
      g.gain.value = v.gain;

      // Slow amplitude modulation (tremolo) for organic feel
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15 + Math.random() * 0.2; // 0.15-0.35 Hz
      lfoGain.gain.value = v.gain * 0.3; // 30% depth
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);

      // Slow pitch wobble
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.type = 'sine';
      vibrato.frequency.value = 0.08 + Math.random() * 0.1;
      vibratoGain.gain.value = v.f * 0.001; // very subtle
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      osc.connect(g);
      g.connect(this.gainNode);

      osc.start();
      lfo.start();
      vibrato.start();

      this.nodes.push(osc, lfo, vibrato);
    }

    // Filtered noise layer — the breathy, airy quality of the mallet on metal
    this._addBreathNoise();
  }

  _addBreathNoise() {
    const ctx = this.ctx;
    // Create a looping noise buffer
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = this.freq * 2;
    filter.Q.value = 2.0;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.012;

    // Modulate the noise amplitude slowly
    const noiseLfo = ctx.createOscillator();
    const noiseLfoGain = ctx.createGain();
    noiseLfo.type = 'sine';
    noiseLfo.frequency.value = 0.2 + Math.random() * 0.15;
    noiseLfoGain.gain.value = 0.006;
    noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(noiseGain.gain);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gainNode);

    noise.start();
    noiseLfo.start();

    this.nodes.push(noise, noiseLfo);
  }

  setVolume(value, rampTime = 0.1) {
    const now = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(value, now, rampTime);
  }

  destroy() {
    for (const n of this.nodes) {
      n.stop();
      n.disconnect();
    }
    this.gainNode.disconnect();
    this.nodes = [];
  }
}

class BowlHarmonic {
  constructor(ctx, freq, dest) {
    this.ctx = ctx;
    this.freq = freq;
    this.dest = dest;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(dest);
    this.nodes = [];
    this._create();
  }

  _create() {
    const ctx = this.ctx;
    const freq = this.freq;

    // Harmonics mode: suppress fundamental, emphasize upper partials.
    // Use very slight detuning (~0.5-1 Hz beat) for gentle shimmer,
    // not the fast warble of wide detuning.
    const partials = [
      { ratio: 2.71,  gain: 0.15 },
      { ratio: 4.98,  gain: 0.10 },
      { ratio: 5.22,  gain: 0.08 },
      { ratio: 7.81,  gain: 0.04 },
    ];

    for (const p of partials) {
      const centerFreq = freq * p.ratio;
      // Detune by only ~0.4 Hz each side for a gentle ~0.8 Hz shimmer
      const detuneHz = 0.4;

      for (const offset of [-detuneHz, detuneHz]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = centerFreq + offset;
        const g = ctx.createGain();
        g.gain.value = p.gain;

        // Very subtle amplitude drift — just enough to feel alive
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.03 + Math.random() * 0.04; // 0.03-0.07 Hz
        lfoGain.gain.value = p.gain * 0.08; // 8% depth (was 25%)
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        osc.connect(g);
        g.connect(this.gainNode);

        osc.start();
        lfo.start();
        this.nodes.push(osc, lfo);
      }
    }

    // A touch of fundamental for body, but very quiet
    const fundOsc = ctx.createOscillator();
    fundOsc.type = 'sine';
    fundOsc.frequency.value = freq;
    const fundGain = ctx.createGain();
    fundGain.gain.value = 0.03;
    fundOsc.connect(fundGain);
    fundGain.connect(this.gainNode);
    fundOsc.start();
    this.nodes.push(fundOsc);
  }

  setVolume(value, rampTime = 0.1) {
    const now = this.ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(value, now, rampTime);
  }

  destroy() {
    for (const n of this.nodes) {
      n.stop();
      n.disconnect();
    }
    this.gainNode.disconnect();
    this.nodes = [];
  }
}

// ─── Main Engine ────────────────────────────────────────────

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.compressor = null;
    this.channels = []; // 10 channel objects, each with a setVolume method
    this.isPlaying = false;
    this.initialized = false;

    // 3 bowls, 10 slider channels total
    // Bowl 1 (69 Hz):  Hit, Sing, Harmonic
    // Bowl 2 (276 Hz): Hit, Sing, Sing, Harmonic
    // Bowl 3 (552 Hz): Hit, Sing, Harmonic
    this.sliderConfigs = [
      { bowl: 1, freq:  69, mode: 'hit',      name: 'Hit',      note: '69 Hz'  },
      { bowl: 1, freq:  69, mode: 'sing',     name: 'Sing',     note: '69 Hz'  },
      { bowl: 1, freq:  69, mode: 'harmonic', name: 'Harmonic', note: '69 Hz'  },
      { bowl: 2, freq: 276, mode: 'hit',      name: 'Hit',      note: '276 Hz' },
      { bowl: 2, freq: 276, mode: 'sing',     name: 'Sing',     note: '276 Hz' },
      { bowl: 2, freq: 276, mode: 'sing2',    name: 'Sing',     note: '276 Hz' },
      { bowl: 2, freq: 276, mode: 'harmonic', name: 'Harmonic', note: '276 Hz' },
      { bowl: 3, freq: 552, mode: 'hit',      name: 'Hit',      note: '552 Hz' },
      { bowl: 3, freq: 552, mode: 'sing',     name: 'Sing',     note: '552 Hz' },
      { bowl: 3, freq: 552, mode: 'harmonic', name: 'Harmonic', note: '552 Hz' },
    ];
  }

  async init() {
    if (this.initialized) return;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Dynamics compressor
    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 15;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;

    // Master gain
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.7;

    // Reverb
    this.convolver = this.audioCtx.createConvolver();
    this.convolver.buffer = this._createReverbIR(5.0, 2.0);

    this.dryGain = this.audioCtx.createGain();
    this.dryGain.gain.value = 0.55;
    this.wetGain = this.audioCtx.createGain();
    this.wetGain.gain.value = 0.45;

    this.compressor.connect(this.dryGain);
    this.compressor.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);

    // Create channels for each slider
    for (const cfg of this.sliderConfigs) {
      let channel;
      // The second "sing" for bowl 2 uses a slightly different detune offset
      // to sound distinct from the first sing
      const freq = cfg.mode === 'sing2' ? cfg.freq * 1.002 : cfg.freq;
      const mode = cfg.mode === 'sing2' ? 'sing' : cfg.mode;

      if (mode === 'hit') {
        channel = new BowlHit(this.audioCtx, freq, this.compressor);
      } else if (mode === 'sing') {
        channel = new BowlSing(this.audioCtx, freq, this.compressor);
      } else {
        channel = new BowlHarmonic(this.audioCtx, freq, this.compressor);
      }
      this.channels.push(channel);
    }

    this.initialized = true;
  }

  _createReverbIR(duration, decay) {
    const rate = this.audioCtx.sampleRate;
    const len = rate * duration;
    const buf = this.audioCtx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // Shaped reverb: early reflections + late diffuse tail
        const t = i / len;
        const earlyGain = t < 0.02 ? 1.0 : 0;
        const lateGain = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * (earlyGain * 0.3 + lateGain);
      }
    }
    return buf;
  }

  async play() {
    if (!this.initialized) await this.init();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this.isPlaying = true;
  }

  pause() {
    if (!this.initialized) return;
    for (const ch of this.channels) {
      ch.setVolume(0, 0.5);
    }
    this.isPlaying = false;
  }

  setMasterVolume(value) {
    if (!this.masterGain) return;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(value, now, 0.05);
  }

  setChannelVolume(index, value, rampTime = 0.1) {
    if (!this.channels[index]) return;
    if (this.isPlaying) {
      this.channels[index].setVolume(value * 0.5, rampTime);
    }
  }

  getSliderConfigs() {
    return this.sliderConfigs;
  }

  getAnalyserData() {
    if (!this.initialized) return null;
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain.connect(this.analyser);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

window.AudioEngine = AudioEngine;
