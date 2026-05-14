/**
 * config.js — 粒子汇聚效果全局常量
 * 所有可调参数集中管理，方便调试和视觉调优
 */
const CONFIG = {
  // ── 画布 ──
  canvas: {
    bgColor: '#0a0a0f',      // 深色背景
    width: window.innerWidth,
    height: window.innerHeight,
  },

  // ── 粒子 ──
  particles: {
    maxCount: 10000,          // 粒子总数上限
    minImageDim: 100,         // 最短边最小值 (px)
    maxImageDim: 300,         // 采样缩放宽度 (px)
    defaultStep: 3,           // 采样步长
    alphaThreshold: 20,       // 透明跳过阈值 (0-255)
  },

  // ── 三层景深参数 ──
  layers: {
    bg: {
      count: 5000,
      minSize: 1,
      maxSize: 3,
      stiffness: 0.12,
      damping: 0.65,
      noiseAmp: 0.3,
      gateDelay: 0,           // 秒
    },
    mid: {
      count: 3500,
      minSize: 4,
      maxSize: 8,
      stiffness: 0.08,
      damping: 0.45,
      noiseAmp: 0.8,
      gateDelay: 1.5,
    },
    fg: {
      count: 1500,
      minSize: 10,
      maxSize: 25,
      stiffness: 0.04,
      damping: 0.25,
      noiseAmp: 2.0,
      gateDelay: 3.0,
    },
  },

  // ── 物理 ──
  physics: {
    dt: 1 / 60,
    maxDt: 1 / 30,            // dt 上限（防 tab 切换后爆炸）
    settleDuration: 2.0,      // 聚合完成后浮动时间 (秒)
    scatterDuration: 1.5,     // 散落阶段持续时间 (秒)
    totalDuration: 8.0,       // 总动画时长 (秒)
    scatterRadius: 0.6,       // 散落椭圆半径比例 (相对画布)
    driftNoise: 0.5,          // 门关时粒子微漂移幅度 (像素)
  },

  // ── 颜色 ──
  color: {
    warmR: 1.08,              // R 通道暖调增益
    warmG: 1.04,              // G 通道暖调增益
    warmB: 0.88,              // B 通道暖调增益（削减蓝）
    gamma: 0.9,               // 颜色伽马校正
  },

  // ── 渲染 ──
  render: {
    bgAlpha: 0.9,
    midAlpha: 0.85,
    fgAlpha: 0.75,
  },
};
