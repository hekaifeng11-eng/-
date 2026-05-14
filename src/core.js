/**
 * core.js — 粒子数据容器 + 状态机
 *
 * ParticleArray: Float32Array 包装，STRIDE=13 字段布局
 * StateMachine: IDLE → SCATTERING → CONVERGING → SETTLED → IDLE
 */

// ─── 粒子字段偏移 ───
const P = {
  X: 0,          // 当前 x
  Y: 1,          // 当前 y
  Z: 2,          // 当前 z（3D 纵深，新增）
  VX: 3,         // 速度 x
  VY: 4,         // 速度 y
  VZ: 5,         // 速度 z（新增）
  TX: 6,         // 目标 x
  TY: 7,         // 目标 y
  TZ: 8,         // 目标 z（新增）
  SX: 9,         // 散落目标 x
  SY: 10,        // 散落目标 y
  SZ: 11,        // 散落目标 z（新增）
  SIZE: 12,      // 粒子大小
  R: 13,         // 红色通道
  G: 14,         // 绿色通道
  B: 15,         // 蓝色通道
  LAYER: 16,     // 层索引 (0=bg, 1=mid, 2=fg)
};
const STRIDE = 17;

// ─── 状态机 ───
const STATE = {
  IDLE:       'IDLE',
  SCATTERING: 'SCATTERING',
  CONVERGING: 'CONVERGING',
  SETTLED:    'SETTLED',
  ERROR:      'ERROR',
};

const VALID_TRANSITIONS = {
  [STATE.IDLE]:       [STATE.SCATTERING, STATE.CONVERGING, STATE.ERROR],
  [STATE.SCATTERING]: [STATE.CONVERGING],
  [STATE.CONVERGING]: [STATE.SETTLED, STATE.SCATTERING],
  [STATE.SETTLED]:    [STATE.SCATTERING, STATE.IDLE],
  [STATE.ERROR]:      [STATE.IDLE],
};

// ─── ParticleArray ───

class ParticleArray {
  constructor(n) {
    this.n = n;
    this.data = new Float32Array(n * STRIDE);
  }

  // 批量设置所有粒子的初始状态
  // 统一默认粒子颜色（暖金色调）
  static DEFAULT_COLOR = { x: 0, y: 0, r: 200, g: 150, b: 80 };

  init(centroidX, centroidY, layerDefs, samples) {
    let idx = 0;
    const layerKeys = ['bg', 'mid', 'fg'];
    const defaultSample = samples.length > 0 ? samples[samples.length - 1] : ParticleArray.DEFAULT_COLOR;
    const depthRange = CONFIG.camera ? CONFIG.camera.depthRange : 0;

    for (let li = 0; li < 3; li++) {
      const def = layerDefs[layerKeys[li]];
      const count = def.count;

      for (let i = 0; i < count && idx < this.n; i++, idx++) {
        const off = idx * STRIDE;
        const sample = idx < samples.length ? samples[idx] : defaultSample;

        // 初始位置 = 目标位置（粒子直接从这里开始，不经过爆开）
        this.data[off + P.X] = sample ? sample.x : centroidX;
        this.data[off + P.Y] = sample ? sample.y : centroidY;
        this.data[off + P.Z] = 0;
        this.data[off + P.VX] = 0;
        this.data[off + P.VY] = 0;
        this.data[off + P.VZ] = 0;

        // 目标位置（3D：用亮度映射 Z 深度）
        if (sample) {
          this.data[off + P.TX] = sample.x;
          this.data[off + P.TY] = sample.y;
          this.data[off + P.TZ] = sample.depth || 0;  // brightness→depth
          this.data[off + P.R] = sample.r;
          this.data[off + P.G] = sample.g;
          this.data[off + P.B] = sample.b;
        }

        // 散落目标（稍后由 ScatterStrategy 填充）
        this.data[off + P.SX] = 0;
        this.data[off + P.SY] = 0;
        this.data[off + P.SZ] = 0;

        const sizeRange = def.maxSize - def.minSize;
        this.data[off + P.SIZE] = def.minSize + Math.random() * sizeRange;

        this.data[off + P.LAYER] = li;
      }
    }

    // 如果样本不足，剩余粒子补位
    for (let i = idx; i < this.n; i++) {
      const off = i * STRIDE;
      const lastSample = samples[samples.length - 1] || { x: centroidX, y: centroidY, r: 200, g: 150, b: 80, depth: 0 };
      this.data[off + P.X] = lastSample.x;
      this.data[off + P.Y] = lastSample.y;
      this.data[off + P.Z] = lastSample.depth || 0;
      this.data[off + P.TX] = lastSample.x;
      this.data[off + P.TY] = lastSample.y;
      this.data[off + P.TZ] = lastSample.depth || 0;
      this.data[off + P.R] = lastSample.r;
      this.data[off + P.G] = lastSample.g;
      this.data[off + P.B] = lastSample.b;
      this.data[off + P.SIZE] = 2;
      this.data[off + P.LAYER] = 0;
    }
  }

  // 获取指定层的粒子索引范围
  layerRange(layerIndex) {
    const layerKeys = ['bg', 'mid', 'fg'];
    let start = 0;
    for (let i = 0; i < layerIndex; i++) {
      start += CONFIG.layers[layerKeys[i]].count;
    }
    const end = start + CONFIG.layers[layerKeys[layerIndex]].count;
    return { start: Math.min(start, this.n), end: Math.min(end, this.n) };
  }
}

// ─── StateMachine ───

class StateMachine {
  constructor() {
    this.state = STATE.IDLE;
  }

  transition(to) {
    const allowed = VALID_TRANSITIONS[this.state];
    if (allowed && allowed.includes(to)) {
      this.state = to;
      return true;
    }
    return false;
  }

  can(to) {
    const allowed = VALID_TRANSITIONS[this.state];
    return allowed && allowed.includes(to);
  }

  is(...states) {
    return states.includes(this.state);
  }

  reset() {
    this.state = STATE.IDLE;
  }
}
