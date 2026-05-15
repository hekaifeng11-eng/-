/**
 * physics.js — 高性能 3D 弹簧-阻尼物理
 *
 * 核心优化：非汇聚态粒子直接冻结（不跑物理），汇聚态全力计算
 */

class PhysicsSystem {
  constructor(particles) {
    this.particles = particles;
    this.layerKeys = ['bg', 'mid', 'fg'];
  }

  step(dt, elapsed, scheduler) {
    dt = Math.min(dt, CONFIG.physics.maxDt);
    const data = this.particles.data;
    const n = this.particles.n;
    const spiral = CONFIG.physics.spiralStrength;
    const defs = [CONFIG.layers.bg, CONFIG.layers.mid, CONFIG.layers.fg];

    for (let i = 0; i < n; i++) {
      const off = i * STRIDE;
      const layer = data[off + P.LAYER];
      const def = defs[layer];
      const gateOpen = scheduler.isGateOpen(layer);

      // ─── 非汇聚态：冻结在散落位置（零计算） ───
      if (!gateOpen) {
        data[off + P.X] = data[off + P.SX];
        data[off + P.Y] = data[off + P.SY];
        data[off + P.Z] = data[off + P.SZ];
        data[off + P.VX] = 0;
        data[off + P.VY] = 0;
        data[off + P.VZ] = 0;
        continue;
      }

      const k = Math.max(0, def.stiffness) || 0;
      const b = Math.max(0, def.damping) || 0;

      const tx = data[off + P.TX];
      const ty = data[off + P.TY];
      const tz = data[off + P.TZ];

      let px = data[off + P.X];
      let py = data[off + P.Y];
      let pz = data[off + P.Z];
      let vx = data[off + P.VX];
      let vy = data[off + P.VY];
      let vz = data[off + P.VZ];

      // 螺旋扰动力（仅汇聚时）
      const ddx = tx - px;
      const ddy = ty - py;
      const approxD = Math.abs(ddx) + Math.abs(ddy);
      let sx = 0, sy = 0;
      if (approxD > 4) {
        const s = spiral * 0.5;
        sx = ddx > 0 ? -s : s;
        sy = ddy > 0 ? s : -s;
      }

      // X 轴
      vx += ((tx - px) * k - b * vx) * dt;
      px += vx * dt + sx * 0.3;

      // Y 轴（含螺旋偏转）
      vy += ((ty - py) * k - b * vy) * dt;
      py += vy * dt + sy * 0.3;

      // Z 轴（稍低刚度）
      const zk = k * 0.7;
      const zb = b * 0.8;
      vz += ((tz - pz) * zk - zb * vz) * dt;
      pz += vz * dt;

      data[off + P.X] = px;
      data[off + P.Y] = py;
      data[off + P.Z] = pz;
      data[off + P.VX] = vx;
      data[off + P.VY] = vy;
      data[off + P.VZ] = vz;
    }
  }
}
