/**
 * controller.js — 3D 散落策略 + 波状汇聚调度
 */

// ─── ScatterStrategy ───

class ScatterStrategy {
  /**
   * 在 3D 球体内散落粒子，直接设当前位置到散落点（跳过爆开阶段）
   */
  static scatter(particles, cx, cy, canvasW, canvasH) {
    const data = particles.data;
    const n = particles.n;
    const radius = Math.max(canvasW, canvasH) * CONFIG.physics.scatterRadius;

    for (let i = 0; i < n; i++) {
      const off = i * STRIDE;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.3 + Math.random() * 0.7);

      const sx = cx + r * Math.sin(phi) * Math.cos(theta);
      const sy = cy + r * Math.sin(phi) * Math.sin(theta);
      const sz = (Math.random() - 0.5) * radius * 1.2;

      data[off + P.SX] = sx;
      data[off + P.SY] = sy;
      data[off + P.SZ] = sz;

      // 直接设当前位置到散落点（跳过爆开，消除揭幕感）
      data[off + P.X] = sx;
      data[off + P.Y] = sy;
      data[off + P.Z] = sz;

      // 微小随机速度让初始态有"活着"的感觉
      data[off + P.VX] = (Math.random() - 0.5) * 0.5;
      data[off + P.VY] = (Math.random() - 0.5) * 0.5;
      data[off + P.VZ] = (Math.random() - 0.5) * 0.5;
    }
  }
}

// ─── ConvergenceScheduler ───

class ConvergenceScheduler {
  constructor() {
    this.elapsed = 0;
    this.totalDuration = CONFIG.physics.totalDuration;
    this.gateDelays = [
      CONFIG.layers.bg.gateDelay,
      CONFIG.layers.mid.gateDelay,
      CONFIG.layers.fg.gateDelay,
    ];
    this.centerX = 0;
    this.centerY = 0;
    this.maxDist = 1;
    this.waveDuration = CONFIG.physics.convergeWaveDuration;
  }

  reset() {
    this.elapsed = 0;
  }

  setCenter(cx, cy, maxD) {
    this.centerX = cx;
    this.centerY = cy;
    this.maxDist = Math.max(maxD, 1);
  }

  advance(dt) {
    this.elapsed += dt;
  }

  get progress() {
    return Math.min(1, this.elapsed / this.totalDuration);
  }

  get isComplete() {
    return this.elapsed >= this.totalDuration;
  }

  /**
   * 判断指定粒子的层门是否开启
   */
  isGateOpen(layerIndex) {
    const scatterEnd = 1.0; // 短"漂浮"阶段（代替 scatterDuration=0）
    const staggerDelay = 1.5;

    if (layerIndex === 0) {
      return this.elapsed >= scatterEnd + this.gateDelays[0];
    }

    const prevOpen = scatterEnd + this.gateDelays[layerIndex - 1];
    return this.elapsed >= prevOpen + staggerDelay;
  }
}
