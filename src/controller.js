/**
 * controller.js — 聚合调度器 + 散落策略
 *
 * ConvergenceScheduler: 基于时间的三层门控
 *   - bg:  门开 @ t=0
 *   - mid: 门开 @ t=bgDelay (bg 60% 完成时)
 *   - fg:  门开 @ t=midDelay (mid 60% 完成时)
 *
 * ScatterStrategy: 粒子从质心向外爆炸式散落
 *   每个粒子分配一个椭圆上的随机位置作为散落目标
 */

// ─── ScatterStrategy ───

class ScatterStrategy {
  /**
   * 为所有粒子生成散落目标位置
   * @param {ParticleArray} particles
   * @param {number} cx - 质心 x
   * @param {number} cy - 质心 y
   * @param {number} canvasW
   * @param {number} canvasH
   */
  static scatter(particles, cx, cy, canvasW, canvasH) {
    const data = particles.data;
    const n = particles.n;
    const radius = Math.max(canvasW, canvasH) * CONFIG.physics.scatterRadius;

    for (let i = 0; i < n; i++) {
      const off = i * STRIDE;
      // 椭圆上随机角度和半径偏移
      const angle = Math.random() * Math.PI * 2;
      const rFactor = 0.4 + Math.random() * 1.2;  // 半径散布
      const rx = radius * rFactor;
      const ry = radius * rFactor * (canvasH / canvasW);

      const sx = cx + Math.cos(angle) * rx;
      const sy = cy + Math.sin(angle) * ry;

      data[off + P.SX] = Math.max(0, Math.min(canvasW, sx));
      data[off + P.SY] = Math.max(0, Math.min(canvasH, sy));

      // 初始速度：向外的小冲量
      data[off + P.VX] = Math.cos(angle) * (2 + Math.random() * 3);
      data[off + P.VY] = Math.sin(angle) * (2 + Math.random() * 3);
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
  }

  /** 重置计时器 */
  reset() {
    this.elapsed = 0;
  }

  /**
   * 步进时间
   * @param {number} dt - 帧时间 (秒)
   */
  advance(dt) {
    this.elapsed += dt;
  }

  /** 获取归一化进度 (0~1) */
  get progress() {
    return Math.min(1, this.elapsed / this.totalDuration);
  }

  /** 是否全部汇聚完成 */
  get isComplete() {
    return this.elapsed >= this.totalDuration;
  }

  /**
   * 判断指定层的门是否开启
   * @param {number} layerIndex
   * @returns {boolean}
   */
  isGateOpen(layerIndex) {
    const delay = this.gateDelays[layerIndex];
    // bg 层：散落阶段结束后门开（scatterDuration 之后）
    // mid/fg 层：前一层门开后 + staggerDelay 后门开
    const scatterEnd = CONFIG.physics.scatterDuration;

    if (layerIndex === 0) {
      return this.elapsed >= scatterEnd + delay;
    }

    const prevDelay = this.gateDelays[layerIndex - 1];
    const staggerDelay = 1.5;
    return this.elapsed >= (prevDelay + staggerDelay);
  }
}
