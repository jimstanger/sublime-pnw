/**
 * Sound Bath Audio Engine
 * Synthesizes singing bowl tones using Web Audio API.
 * Each bowl is created from a fundamental frequency plus inharmonic partials
 * that mimic the physics of real Tibetan singing bowls.
 */

class SingingBowl {
  constructor(audioCtx, frequency, destination) {
    this.audioCtx = audioCtx;
    this.frequency = frequency;
    this.destination = destination;
    this.gainNode = audioCtx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
    this.oscillators = [];
    this._createPartials();
  }

  _createPartials() {
    // Singing bowls have inharmonic partials - these ratios approximate
    // the characteristic metallic resonance of Tibetan singing bowls
    const partials = [
      { ratio: 1.0,    gain: 1.0   },  // fundamental
      { ratio: 2.71,   gain: 0.35  },  // first overtone (characteristic)
      { ratio: 4.98,   gain: 0.15  },  // second overtone
      { ratio: 5.22,   gain: 0.12  },  // beating pair with above
      { ratio: 7.81,   gain: 0.06  },  // upper partial
    ];

    for (const partial of partials) {
      const osc = this.audioCtx.createOscillator();
      const partialGain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = this.frequency * partial.ratio;
      partialGain.gain.value = partial.gain;

      osc.connect(partialGain);
      partialGain.connect(this.gainNode);
      osc.start();

      this.oscillators.push({ osc, gain: partialGain, partial });
    }
  }

  setVolume(value, rampTime = 0.1) {
    const now = this.audioCtx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(value, now, rampTime);
  }

  getVolume() {
    return this.gainNode.gain.value;
  }

  destroy() {
    for (const { osc } of this.oscillators) {
      osc.stop();
      osc.disconnect();
    }
    this.gainNode.disconnect();
    this.oscillators = [];
  }
}

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.compressor = null;
    this.convolver = null;
    this.bowls = [];
    this.isPlaying = false;
    this.initialized = false;

    // 10 singing bowl frequencies spanning a wide range
    // Tuned to create a harmonious, meditative drone
    this.bowlConfigs = [
      { freq: 110.00, name: 'Sub',     note: 'A2'  },
      { freq: 146.83, name: 'Bass',    note: 'D3'  },
      { freq: 174.61, name: 'Low',     note: 'F3'  },
      { freq: 220.00, name: 'Root',    note: 'A3'  },
      { freq: 277.18, name: 'Mid',     note: 'C#4' },
      { freq: 329.63, name: 'Heart',   note: 'E4'  },
      { freq: 392.00, name: 'Throat',  note: 'G4'  },
      { freq: 440.00, name: 'Third',   note: 'A4'  },
      { freq: 554.37, name: 'Crown',   note: 'C#5' },
      { freq: 659.25, name: 'Ether',   note: 'E5'  },
    ];
  }

  async init() {
    if (this.initialized) return;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create dynamics compressor to prevent clipping
    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.1;

    // Create master gain
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.7;

    // Create reverb for spaciousness
    this.convolver = this.audioCtx.createConvolver();
    this.convolver.buffer = this._createReverbIR(4.0, 2.5);

    // Wet/dry mix for reverb
    this.dryGain = this.audioCtx.createGain();
    this.dryGain.gain.value = 0.6;
    this.wetGain = this.audioCtx.createGain();
    this.wetGain.gain.value = 0.4;

    // Routing: bowls -> compressor -> dry + wet(reverb) -> master -> output
    this.compressor.connect(this.dryGain);
    this.compressor.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);

    // Create all singing bowls
    for (const config of this.bowlConfigs) {
      const bowl = new SingingBowl(this.audioCtx, config.freq, this.compressor);
      this.bowls.push(bowl);
    }

    this.initialized = true;
  }

  _createReverbIR(duration, decay) {
    const sampleRate = this.audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
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
    // Fade out all bowls smoothly
    for (const bowl of this.bowls) {
      bowl.setVolume(0, 0.3);
    }
    this.isPlaying = false;
  }

  setMasterVolume(value) {
    if (!this.masterGain) return;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(value, now, 0.05);
  }

  setBowlVolume(index, value, rampTime = 0.1) {
    if (!this.bowls[index]) return;
    if (this.isPlaying) {
      this.bowls[index].setVolume(value * 0.25, rampTime); // scale down to avoid clipping
    }
  }

  getBowlConfigs() {
    return this.bowlConfigs;
  }

  getAnalyserData() {
    if (!this.initialized) return null;
    // Create analyser on demand
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

// Export as global
window.AudioEngine = AudioEngine;
