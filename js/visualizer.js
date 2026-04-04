/**
 * Canvas visualizer - creates ambient, meditative visuals
 * that respond to the audio levels of each singing bowl.
 */

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.ripples = [];
    this.bowlLevels = new Array(10).fill(0);
    this.animationId = null;
    this.time = 0;
    this.isActive = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
  }

  setBowlLevels(levels) {
    for (let i = 0; i < levels.length && i < this.bowlLevels.length; i++) {
      // Smooth the transition
      this.bowlLevels[i] += (levels[i] - this.bowlLevels[i]) * 0.08;
    }
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this._animate();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  _animate() {
    if (!this.isActive) return;
    this.animationId = requestAnimationFrame(() => this._animate());
    this.time += 0.008;
    this._draw();
  }

  _draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Fade trail effect
    ctx.fillStyle = 'rgba(10, 10, 18, 0.15)';
    ctx.fillRect(0, 0, w, h);

    const totalEnergy = this.bowlLevels.reduce((a, b) => a + b, 0) / 10;

    // Draw concentric singing bowl rings
    this._drawBowlRings(totalEnergy);

    // Draw floating particles
    this._drawParticles(totalEnergy);

    // Draw central glow
    this._drawCenterGlow(totalEnergy);
  }

  _drawBowlRings(energy) {
    const { ctx, cx, cy } = this;
    // Colors grouped by bowl: Bowl 1 amber, Bowl 2 rose, Bowl 3 teal
    const colors = [
      '#c9a84c', '#d4b85c', '#b89840',  // Bowl 1 (69 Hz): Hit, Sing, Harmonic
      '#c97daa', '#d48dba', '#b96d9a', '#a85d8a',  // Bowl 2 (276 Hz)
      '#4cc9a8', '#5cd9b8', '#3cb998',  // Bowl 3 (552 Hz)
    ];

    for (let i = 0; i < 10; i++) {
      const level = this.bowlLevels[i];
      if (level < 0.01) continue;

      const baseRadius = 60 + i * 35;
      const radius = baseRadius + Math.sin(this.time * (0.3 + i * 0.07)) * 15 * level;
      const alpha = level * 0.3;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = colors[i];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5 + level * 2;
      ctx.stroke();

      // Second ring with slight offset for depth
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawParticles(energy) {
    const { ctx, cx, cy, canvas } = this;

    // Spawn new particles based on energy
    if (energy > 0.05 && Math.random() < energy * 0.3) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 300;
      this.particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.2,
        life: 1,
        decay: 0.002 + Math.random() * 0.005,
        size: 1 + Math.random() * 2.5,
        hue: 30 + Math.random() * 30,
      });
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 60%, 65%, ${p.life * 0.6})`;
      ctx.fill();
    }

    // Limit particle count
    if (this.particles.length > 200) {
      this.particles.splice(0, this.particles.length - 200);
    }
  }

  _drawCenterGlow(energy) {
    const { ctx, cx, cy } = this;

    if (energy < 0.01) return;

    const pulseSize = 30 + Math.sin(this.time * 0.5) * 10 * energy;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseSize + 40);
    gradient.addColorStop(0, `rgba(212, 160, 23, ${energy * 0.25})`);
    gradient.addColorStop(0.5, `rgba(184, 134, 11, ${energy * 0.08})`);
    gradient.addColorStop(1, 'rgba(184, 134, 11, 0)');

    ctx.beginPath();
    ctx.arc(cx, cy, pulseSize + 40, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

window.Visualizer = Visualizer;
