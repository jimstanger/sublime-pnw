/**
 * Sound Bath App — Main controller
 * Wires up the audio engine, UI sliders, presets, and animation system.
 *
 * Slider layout (10 sliders, 3 bowls):
 *   Bowl 1 (69 Hz):  [0] Hit  [1] Sing  [2] Harmonic
 *   Bowl 2 (276 Hz): [3] Hit  [4] Sing  [5] Sing  [6] Harmonic
 *   Bowl 3 (552 Hz): [7] Hit  [8] Sing  [9] Harmonic
 */

(function () {
  'use strict';

  const engine = new AudioEngine();
  const visualizer = new Visualizer(document.getElementById('visualizer'));

  // --- State ---
  let sliderValues = [60, 80, 40, 50, 75, 65, 35, 45, 70, 30]; // default
  let animationMode = 'slow';
  let animationTimer = null;
  let isPlaying = false;

  // --- Presets tuned for hit/sing/harmonic per bowl ---
  const PRESETS = {
    //                   B1:Hit Sing Harm  B2:Hit Sing Sing Harm  B3:Hit Sing Harm
    default:    [60, 80, 40,   50, 75, 65, 35,   45, 70, 30],
    deep:       [90, 95, 70,   60, 50, 40, 20,   10,  5,  0],
    bright:     [10, 20, 15,   30, 40, 50, 45,   70, 90, 85],
    singing:    [ 0, 95,  0,    0, 90, 85,  0,    0, 80,  0],
    struck:     [95,  0, 30,   90,  0,  0, 25,   85,  0, 20],
    overtones:  [ 0, 20, 90,    0, 15,  0, 85,    0, 10, 80],
    meditation: [40, 70, 50,   30, 80, 60, 40,   20, 65, 35],
    warm:       [75, 90, 60,   65, 70, 55, 30,   15, 20, 10],
    random:     null,
  };

  // --- DOM refs ---
  const slidersContainer = document.getElementById('sliders-container');
  const powerBtn = document.getElementById('power-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const masterVol = document.getElementById('master-vol');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const animBtns = document.querySelectorAll('.anim-btn');

  // --- Build grouped sliders ---
  const configs = engine.getSliderConfigs();
  const sliderEls = [];
  const glowEls = [];

  // Group configs by bowl number
  const bowlGroups = [
    { bowl: 1, freq: '69 Hz',  indices: [0, 1, 2] },
    { bowl: 2, freq: '276 Hz', indices: [3, 4, 5, 6] },
    { bowl: 3, freq: '552 Hz', indices: [7, 8, 9] },
  ];

  bowlGroups.forEach((group, groupIdx) => {
    // Add separator between groups
    if (groupIdx > 0) {
      const sep = document.createElement('div');
      sep.className = 'bowl-separator';
      slidersContainer.appendChild(sep);
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'bowl-group';
    groupDiv.dataset.bowl = group.bowl;

    const label = document.createElement('div');
    label.className = 'bowl-group-label';
    label.textContent = `Bowl ${group.bowl} — ${group.freq}`;
    groupDiv.appendChild(label);

    const slidersDiv = document.createElement('div');
    slidersDiv.className = 'bowl-group-sliders';

    for (const i of group.indices) {
      const cfg = configs[i];
      const div = document.createElement('div');
      div.className = 'bowl-slider';
      div.innerHTML = `
        <span class="slider-label">${cfg.name}</span>
        <div class="vertical-slider-wrap">
          <input type="range" min="0" max="100" value="${sliderValues[i]}"
                 data-index="${i}" aria-label="Bowl ${group.bowl} ${cfg.name}">
        </div>
        <div class="slider-glow"></div>
      `;
      slidersDiv.appendChild(div);

      const input = div.querySelector('input[type="range"]');
      const glow = div.querySelector('.slider-glow');
      sliderEls[i] = input;
      glowEls[i] = glow;

      input.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        sliderValues[i] = val;
        updateChannel(i, val);
        updateGlow(i, val);
      });
    }

    groupDiv.appendChild(slidersDiv);
    slidersContainer.appendChild(groupDiv);
  });

  function updateChannel(index, value) {
    engine.setChannelVolume(index, value / 100, 0.08);
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
        engine.setChannelVolume(i, values[i] / 100, 0.5);
      } else {
        updateChannel(i, values[i]);
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
      for (let i = 0; i < sliderValues.length; i++) {
        updateChannel(i, sliderValues[i]);
      }
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
      const name = btn.dataset.preset;
      let values;

      if (name === 'random') {
        values = Array.from({ length: 10 }, () => Math.floor(Math.random() * 101));
      } else {
        values = [...PRESETS[name]];
      }

      applySliderValues(values, true);
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // --- Animation system ---
  const ANIM_SPEEDS = { off: 0, slow: 8000, medium: 4000, fast: 2000 };

  animBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      animationMode = btn.dataset.anim;
      animBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stopAnimation();
      if (isPlaying && animationMode !== 'off') startAnimation();
    });
  });

  function startAnimation() {
    if (animationMode === 'off') return;
    stopAnimation();

    const interval = ANIM_SPEEDS[animationMode];
    animationTimer = setInterval(() => {
      if (!isPlaying) return;
      const idx = Math.floor(Math.random() * 10);
      const current = sliderValues[idx];
      const delta = (Math.random() - 0.5) * 30;
      const newVal = Math.max(0, Math.min(100, Math.round(current + delta)));
      sliderValues[idx] = newVal;
      sliderEls[idx].value = newVal;
      updateGlow(idx, newVal);
      engine.setChannelVolume(idx, newVal / 100, 1.0);
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

  // Init glow bars
  for (let i = 0; i < sliderValues.length; i++) {
    updateGlow(i, sliderValues[i]);
  }

  visualizer.start();

})();
