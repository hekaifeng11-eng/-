/**
 * physics.js — 弹簧-阻尼物理系统
 *
 * 半隐式欧拉积分：
 *   v += (k * (target - pos) - b * v) * dt
 *   pos += v * dt
 *
 * PhysicsSystem: 按三层不同参数驱动所有粒子
 */

// ─── 纯函数：单粒子弹簧-阻尼步进 ───

function springDamper(pos, vel, target, k, b, dt) {
  // guard: 防止负值或 NaN 参数
  k = (typeof k === 'number' && k >= 0) ? k : 0;
  b = (typeof b === 'number' && b >= 0) ? b : 0;
  dt = (typeof dt === 'number' && dt > 0) ? dt : 1/60;
  const force = (target - pos) * k - b * vel;
  const newVel = vel + force * dt;
  const newPos = pos + newVel * dt;
  return { pos: newPos, vel: newVel };
}

// ─── PhysicsSystem ───

class PhysicsSystem {
  constructor(particles) {
    this.particles = particles;
    this.layerKeys = ['bg', 'mid', 'fg'];
  }

  /**
   * 步进所有粒子一层
   * @param {number} dt - 帧时间 (秒)
   * @param {number} elapsed - 已过时间 (秒)
   * @param {Function} isGateOpen - (layerIndex) => bool，判断该层门是否开启
   */
  step(dt, elapsed, isGateOpen) {
    dt = Math.min(dt, CONFIG.physics.maxDt);  // 防止 tab 切换后 dt 爆炸
    const data = this.particles.data;
    const n = this.particles.n;

    for (let i = 0; i < n; i++) {
      const off = i * STRIDE;
      const layer = data[off + P.LAYER];
      const def = CONFIG.layers[this.layerKeys[layer]];
      const gateOpen = isGateOpen(layer);

      // 选择目标位置：门开 → 图片目标，门关 → 散落目标
      const tx = gateOpen ? data[off + P.TX] : data[off + P.SX];
      const ty = gateOpen ? data[off + P.TY] : data[off + P.SY];

      // 门关时加微漂移噪声（防止粒子冻住）
      const noise = gateOpen ? 0 : CONFIG.physics.driftNoise;
      const noiseX = (Math.random() - 0.5) * noise;
      const noiseY = (Math.random() - 0.5) * noise;

      // X 轴
      const xResult = springDamper(
        data[off + P.X], data[off + P.VX],
        tx + noiseX, def.stiffness, def.damping, dt
      );
      data[off + P.X] = xResult.pos;
      data[off + P.VX] = xResult.vel;

      // Y 轴
      const yResult = springDamper(
        data[off + P.Y], data[off + P.VY],
        ty + noiseY, def.stiffness, def.damping, dt
      );
      data[off + P.Y] = yResult.pos;
      data[off + P.VY] = yResult.vel;
    }
  }
}
