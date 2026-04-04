/**
 * Rain Drum — Steel Tongue Drum
 *
 * A full-screen grid where each cell is a tongue on a large steel tongue drum.
 * Rolling a mouse or dragging a finger across cells triggers the tones, like
 * rain falling on the drum's surface.
 *
 * 16 tongues tuned to D pentatonic across two octaves (D3–D5).
 * Synthesis models the warm, bell-like character of a large steel tongue drum:
 *   - Fundamental with slight downward pitch bend on attack
 *   - Strong 2nd harmonic, softer 3rd and 4th
 *   - Soft filtered noise transient for the mallet contact
 *   - Long exponential decay (3-5 seconds)
 */

(function () {
  'use strict';

  // --- Tongue tuning: D major pentatonic across two octaves ---
  // Large tongue drums are typically tuned to a pentatonic scale.
  // D pentatonic: D, E, F#, A, B
  const TONGUES = [
    { note: 'D3',  freq: 146.83 },
    { note: 'E3',  freq: 164.81 },
    { note: 'F#3', freq: 185.00 },
    { note: 'A3',  freq: 220.00 },
    { note: 'B3',  freq: 246.94 },
    { note: 'D4',  freq: 293.66 },
    { note: 'E4',  freq: 329.63 },
    { note: 'F#4', freq: 369.99 },
    { note: 'A4',  freq: 440.00 },
    { note: 'B4',  freq: 493.88 },
    { note: 'D5',  freq: 587.33 },
    { note: 'E5',  freq: 659.25 },
    { note: 'F#5', freq: 739.99 },
    { note: 'A5',  freq: 880.00 },
    { note: 'B5',  freq: 987.77 },
    { note: 'D6',  freq: 1174.66 },
  ];

  // Color hues mapped from warm (low) to cool (high)
  const HUE_START = 30;  // warm amber
  const HUE_END = 220;   // cool blue

  // --- Audio setup ---
  let audioCtx = null;
  let masterGain = null;
  let compressor = null;
  let convolver = null;

  function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.6;

    // Reverb for the resonant space
    convolver = audioCtx.createConvolver();
    convolver.buffer = createReverbIR(3.5, 2.2);

    const dryGain = audioCtx.createGain();
    dryGain.gain.value = 0.55;
    const wetGain = audioCtx.createGain();
    wetGain.gain.value = 0.45;

    compressor.connect(dryGain);
    compressor.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
  }

  function createReverbIR(duration, decay) {
    const rate = audioCtx.sampleRate;
    const len = rate * duration;
    const buf = audioCtx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  // --- Tongue strike synthesis ---
  function strikeTongue(freq) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;

    // Harmonics of a steel tongue drum (more harmonic than singing bowls)
    const harmonics = [
      { ratio: 1,   gain: 0.30, decay: 4.0  },  // fundamental (dominant)
      { ratio: 2,   gain: 0.14, decay: 3.0  },  // octave (strong in tongue drums)
      { ratio: 3,   gain: 0.05, decay: 2.2  },  // 12th
      { ratio: 4,   gain: 0.025, decay: 1.8 },  // double octave
      { ratio: 5.43, gain: 0.01, decay: 1.2 },  // inharmonic partial for character
    ];

    for (const h of harmonics) {
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq * h.ratio;

      // Slight downward pitch bend on attack (characteristic of struck metal)
      if (h.ratio === 1) {
        osc.frequency.setValueAtTime(freq * 1.008, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.06);
      }

      // Velocity variation: slight random volume
      const velocity = 0.85 + Math.random() * 0.3;
      const peakGain = h.gain * velocity;

      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(peakGain, now + 0.004); // fast attack
      env.gain.setTargetAtTime(0, now + 0.004, h.decay);       // long decay

      osc.connect(env);
      env.connect(compressor);

      osc.start(now);
      osc.stop(now + h.decay * 6);
    }

    // Soft mallet contact noise
    const noiseLen = audioCtx.sampleRate * 0.025;
    const noiseBuf = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 6);
    }

    const noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = freq * 2.5;
    noiseFilter.Q.value = 1.0;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.04;

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(compressor);

    noiseSrc.start(now);
    noiseSrc.stop(now + 0.025);
  }

  // --- Grid setup ---
  const gridEl = document.getElementById('grid');
  const hintEl = document.getElementById('hint');
  const cells = [];
  let hintHidden = false;

  // Track which cell was last triggered to avoid re-triggering on hover within same cell
  let lastTriggeredIndex = -1;
  // Debounce per cell: minimum time before same cell can re-trigger
  const RETRIGGER_DELAY = 400; // ms
  const cellLastTriggerTime = new Array(TONGUES.length).fill(0);

  TONGUES.forEach((tongue, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;

    // Background tint based on pitch
    const hue = HUE_START + (HUE_END - HUE_START) * (i / (TONGUES.length - 1));
    cell.style.backgroundColor = `hsla(${hue}, 25%, 8%, 1)`;
    cell.dataset.hue = hue;

    cell.innerHTML = `
      <span class="cell-note">${tongue.note}</span>
      <span class="cell-freq">${Math.round(tongue.freq)} Hz</span>
    `;

    gridEl.appendChild(cell);
    cells.push(cell);
  });

  function triggerCell(index) {
    const now = Date.now();
    if (now - cellLastTriggerTime[index] < RETRIGGER_DELAY) return;
    cellLastTriggerTime[index] = now;

    initAudio();

    const tongue = TONGUES[index];
    const cell = cells[index];
    const hue = parseFloat(cell.dataset.hue);

    strikeTongue(tongue.freq);

    // Visual feedback: flash + ripple
    cell.classList.add('active');
    cell.style.backgroundColor = `hsla(${hue}, 40%, 16%, 1)`;

    // Create ripple
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    const size = Math.max(cell.offsetWidth, cell.offsetHeight);
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = '50%';
    ripple.style.top = '50%';
    ripple.style.marginLeft = -size / 2 + 'px';
    ripple.style.marginTop = -size / 2 + 'px';
    ripple.style.background = `radial-gradient(circle, hsla(${hue}, 50%, 60%, 0.35), transparent 70%)`;
    cell.appendChild(ripple);

    // Clean up
    setTimeout(() => {
      cell.classList.remove('active');
      cell.style.backgroundColor = `hsla(${hue}, 25%, 8%, 1)`;
    }, 600);

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 1200);

    // Hide hint after first interaction
    if (!hintHidden) {
      hintHidden = true;
      hintEl.classList.add('hidden');
    }
  }

  // --- Mouse interaction ---
  gridEl.addEventListener('mousemove', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.index, 10);
    if (idx !== lastTriggeredIndex) {
      lastTriggeredIndex = idx;
      triggerCell(idx);
    }
  });

  // Reset when mouse leaves the grid
  gridEl.addEventListener('mouseleave', () => {
    lastTriggeredIndex = -1;
  });

  // Click also triggers
  gridEl.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.index, 10);
    cellLastTriggerTime[idx] = 0; // force re-trigger on click
    lastTriggeredIndex = idx;
    triggerCell(idx);
  });

  // --- Touch interaction ---
  let lastTouchIndex = -1;

  function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const cell = el.closest('.cell');
    if (!cell) return;
    const idx = parseInt(cell.dataset.index, 10);
    if (idx !== lastTouchIndex) {
      lastTouchIndex = idx;
      triggerCell(idx);
    }
  }

  gridEl.addEventListener('touchstart', (e) => {
    lastTouchIndex = -1;
    handleTouch(e);
  }, { passive: false });

  gridEl.addEventListener('touchmove', handleTouch, { passive: false });

  gridEl.addEventListener('touchend', () => {
    lastTouchIndex = -1;
  });

})();
