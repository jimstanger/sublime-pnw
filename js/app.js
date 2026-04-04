/**
 * Sound Bath App — Main controller
 * Wires up the audio engine, UI sliders, presets, and animation system.
 */

(function () {
  'use strict';

  const engine = new AudioEngine();
  const visualizer = new Visualizer(document.getElementById('visualizer'));

  // --- State ---
  let sliderValues = [80, 70, 60, 75, 50, 65, 55, 45, 35, 25]; // default preset
  let animationMode = 'slow'; // off | slow | medium | fast
  let animationTimer = null;
  let isPlaying = false;

  // --- Presets ---
  const PRESETS = {
    default:    [80, 70, 60, 75, 50, 65, 55, 45, 35, 25],
    deep:       [100, 90, 80, 60, 30, 20, 10, 5, 0, 0],
    bright:     [10, 15, 20, 30, 50, 70, 80, 90, 95, 100],
    hollow:     [90, 20, 80, 15, 70, 10, 60, 5, 50, 0],
    celestial:  [20, 30, 40, 50, 60, 70, 80, 90, 95, 100],
    meditation: [60, 50, 40, 70, 30, 60, 20, 50, 10, 40],
    chakra:     [70, 0, 70, 0, 70, 0, 70, 0, 70, 0],
    rain:       [40, 45, 50, 55, 60, 65, 60, 55, 50, 45],
    random:     null, // generated on click
  };

  // --- DOM refs ---
  const slidersContainer = document.getElementById('sliders-container');
  const powerBtn = document.getElementById('power-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const masterVol = document.getElementById('master-vol');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const animBtns = document.querySelectorAll('.anim-btn');

  // --- Build sliders ---
  const bowlConfigs = engine.getBowlConfigs();
  const sliderEls = [];
  const glowEls = [];

  bowlConfigs.forEach((config, i) => {
    const div = document.createElement('div');
    div.className = 'bowl-slider';
    div.innerHTML = `
      <span class="slider-label">${config.name}</span>
      <div class="vertical-slider-wrap">
        <input type="range" min="0" max="100" value="${sliderValues[i]}"
               data-index="${i}" aria-label="${config.name} bowl at ${config.note}">
      </div>
      <div class="slider-glow"></div>
      <span class="freq-label">${config.note}</span>
    `;
    slidersContainer.appendChild(div);

    const input = div.querySelector('input[type="range"]');
    const glow = div.querySelector('.slider-glow');
    sliderEls.push(input);
    glowEls.push(glow);

    input.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      sliderValues[i] = val;
      updateBowl(i, val);
      updateGlow(i, val);
    });
  });

  function updateBowl(index, value) {
    engine.setBowlVolume(index, value / 100, 0.08);
  }

  function updateGlow(index, value) {
    const height = (value / 100) * 30;
    glowEls[index].style.height = height + 'px';
  }

  function applySliderValues(values, smooth = false) {
    for (let i = 0; i < values.length; i++) {
      sliderValues[i] = values[i];
      sliderEls[i].value = values[i];
      updateGlow(i, values[i]);
      if (smooth) {
        engine.setBowlVolume(i, values[i] / 100, 0.5);
      } else {
        updateBowl(i, values[i]);
      }
    }
  }

  // --- Power button ---
  powerBtn.addEventListener('click', async () => {
    if (!isPlaying) {
      await engine.play();
      isPlaying = true;
      powerBtn.classList.add('active');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      visualizer.start();

      // Apply current slider values
      for (let i = 0; i < sliderValues.length; i++) {
        updateBowl(i, sliderValues[i]);
      }

      // Start animation if enabled
      startAnimation();
    } else {
      engine.pause();
      isPlaying = false;
      powerBtn.classList.remove('active');
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      stopAnimation();
    }
  });

  // --- Master volume ---
  masterVol.addEventListener('input', (e) => {
    engine.setMasterVolume(parseInt(e.target.value, 10) / 100);
  });

  // --- Presets ---
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const presetName = btn.dataset.preset;
      let values;

      if (presetName === 'random') {
        values = Array.from({ length: 10 }, () => Math.floor(Math.random() * 101));
      } else {
        values = [...PRESETS[presetName]];
      }

      applySliderValues(values, true);

      // Update active state
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // --- Animation system ---
  // Slowly varies slider values to create an evolving soundscape
  const ANIM_SPEEDS = {
    off: 0,
    slow: 8000,
    medium: 4000,
    fast: 2000,
  };

  animBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      animationMode = btn.dataset.anim;
      animBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      stopAnimation();
      if (isPlaying && animationMode !== 'off') {
        startAnimation();
      }
    });
  });

  function startAnimation() {
    if (animationMode === 'off') return;
    stopAnimation();

    const interval = ANIM_SPEEDS[animationMode];

    animationTimer = setInterval(() => {
      if (!isPlaying) return;

      // Pick a random slider and nudge it
      const idx = Math.floor(Math.random() * 10);
      const current = sliderValues[idx];
      const delta = (Math.random() - 0.5) * 30;
      const newVal = Math.max(0, Math.min(100, Math.round(current + delta)));

      sliderValues[idx] = newVal;
      sliderEls[idx].value = newVal;
      updateGlow(idx, newVal);
      engine.setBowlVolume(idx, newVal / 100, 1.0); // slow ramp for smooth transition
    }, interval);
  }

  function stopAnimation() {
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  // --- Visualizer update loop ---
  function updateVisualizerLevels() {
    if (isPlaying) {
      visualizer.setBowlLevels(sliderValues.map(v => v / 100));
    } else {
      visualizer.setBowlLevels(new Array(10).fill(0));
    }
    requestAnimationFrame(updateVisualizerLevels);
  }
  updateVisualizerLevels();

  // --- Init glow bars ---
  for (let i = 0; i < sliderValues.length; i++) {
    updateGlow(i, sliderValues[i]);
  }

  // Start visualizer (runs with low opacity even before playing)
  visualizer.start();

})();
