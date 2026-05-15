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
    maxCount: 500000,         // 粒子总数上限
    minImageDim: 100,         // 最短边最小值 (px)
    maxImageDim: 1200,        // 采样缩放宽度 (px)
    defaultStep: 1,           // 采样步长
    alphaThreshold: 20,       // 透明跳过阈值 (0-255)
  },

  // ── 三层景深参数 ──
  layers: {
    bg: {
      count: 200000,
      minSize: 1,
      maxSize: 1.5,
      stiffness: 0.10,
      damping: 0.55,
      noiseAmp: 0.3,
      gateDelay: 0,
    },
    mid: {
      count: 200000,
      minSize: 1.5,
      maxSize: 3,
      stiffness: 0.08,
      damping: 0.40,
      noiseAmp: 0.8,
      gateDelay: 1.5,
    },
    fg: {
      count: 100000,
      minSize: 3,
      maxSize: 8,
      stiffness: 0.05,
      damping: 0.25,
      noiseAmp: 2.0,
      gateDelay: 3.0,
    },
  },

  // ── 物理 ──
  physics: {
    dt: 1 / 60,
    maxDt: 1 / 30,            // dt 上限（防 tab 切换后爆炸）
    totalDuration: 10.0,      // 总动画时长 (秒)
    scatterRadius: 0.7,       // 散落球体半径比例 (相对画布对角线)
    driftNoise: 0.3,          // 门关时粒子微漂移幅度 (像素)
    spiralStrength: 0.2,      // 螺旋路径偏转强度
    convergeWaveDuration: 2.5,// 波状汇聚传播时间 (秒)
    overshoot: 1.15,          // 汇聚超调量
  },

  // ── 3D 摄像机 ──
  camera: {
    orbitAngle: 0,            // 摄像机初始角度
    focalLength: 400,         // 焦距，越小透视越强
    orbitSpeed: 0.30,         // 绕 Y 轴旋转速度 (弧度/秒)
    depthRange: 350,          // Z 轴深度范围 (像素)
    glowIntensity: 0.6,       // 辉光强度
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
