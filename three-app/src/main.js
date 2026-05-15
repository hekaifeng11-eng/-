/**
 * main.js — 粒子引擎入口（模块四：GSAP 运镜系统）
 *
 * Three.js + GPGPU FBO 粒子系统
 * 运镜：3 套 GSAP 循环序列（环绕·推拉·摇摆）
 */

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ParticleSystem } from './particle-system.js';

// ─── 场景 ───

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

// ─── 相机 ───

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);

// ─── 渲染器 ───

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ─── 粒子数 ───

const PARTICLE_COUNT = 500000;

// ─── 生成初始位置：环面结 (torus knot 3,2) ───

function generateTorusKnot(count, R, r, p, q) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = 2 * Math.PI * i / count;
    const theta = p * t;
    const phi = q * t;
    const x = (R + r * Math.cos(theta)) * Math.cos(phi);
    const y = (R + r * Math.cos(theta)) * Math.sin(phi);
    const z = r * Math.sin(theta);
    pos[i * 3]     = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    // Cool→Warm 渐变
    const zn = z / (R + r);
    col[i * 3]     = 0.8 + 0.2 * (0.5 - zn * 0.5);
    col[i * 3 + 1] = 0.5 + 0.3 * (0.5 - zn * 0.3);
    col[i * 3 + 2] = 0.2 + 0.6 * (zn + 1) / 2;
  }
  return { positions: pos, colors: col };
}

console.log(`Generating ${PARTICLE_COUNT} particles...`);
const { positions, colors } = generateTorusKnot(PARTICLE_COUNT, 200, 80, 3, 2);

// ─── FBO GPGPU 粒子系统 ───

const particleSystem = new ParticleSystem(PARTICLE_COUNT, renderer, positions, colors);
scene.add(particleSystem.points);

// ─── GSAP 运镜系统 ───

const camState = { angle: 0, distance: 500, height: 0, xOffset: 0, zOffset: 0 };

function updateCamera() {
  camera.position.x = camState.distance * Math.sin(camState.angle) + camState.xOffset;
  camera.position.z = camState.distance * Math.cos(camState.angle) + camState.zOffset;
  camera.position.y = camState.height;
  camera.lookAt(0, 0, 0);
}

// 序列 1：环绕 — 绕 Y 轴 360° 旋转
function seqOrbit() {
  const tl = gsap.timeline();
  tl.to(camState, {
    angle: Math.PI * 2,
    duration: 12,
    ease: 'none',
    onUpdate: updateCamera,
  });
  return tl;
}

// 序列 2：推拉 — 距离变化 + 轻微升高
function seqPushPull() {
  const tl = gsap.timeline();
  tl.to(camState, {
    distance: 700,
    height: 80,
    duration: 4,
    ease: 'power2.inOut',
    onUpdate: updateCamera,
  }).to(camState, {
    distance: 300,
    height: -40,
    duration: 4,
    ease: 'power2.inOut',
    onUpdate: updateCamera,
  });
  return tl;
}

// 序列 3：摇摆 — 小幅 XYZ 弧线摆动
function seqSway() {
  const tl = gsap.timeline();
  tl.to(camState, {
    xOffset: 120,
    zOffset: 80,
    height: 60,
    duration: 3,
    ease: 'sine.inOut',
    onUpdate: updateCamera,
  }).to(camState, {
    xOffset: -100,
    zOffset: -60,
    height: -50,
    duration: 3,
    ease: 'sine.inOut',
    onUpdate: updateCamera,
  }).to(camState, {
    xOffset: 0,
    zOffset: 0,
    height: 0,
    duration: 2,
    ease: 'sine.inOut',
    onUpdate: updateCamera,
  });
  return tl;
}

// 组装主时间线
const masterTL = gsap.timeline({ repeat: -1 });
masterTL.add(seqOrbit());
masterTL.add(seqPushPull());
masterTL.add(seqSway());

// ─── FPS 显示 ───

const fpsEl = document.createElement('div');
fpsEl.style.cssText = 'position:fixed;top:16px;right:20px;color:rgba(255,255,255,0.3);font:12px monospace;pointer-events:none;';
document.body.appendChild(fpsEl);

// ─── 窗口适配 ───

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ─── 动画循环 ───

let lastTime = performance.now();
let frameCount = 0;
let fpsAccum = 0;

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // FPS
  frameCount++;
  fpsAccum += dt;
  if (fpsAccum >= 1) {
    fpsEl.textContent = `${Math.round(frameCount / fpsAccum)} fps | ${(PARTICLE_COUNT / 1000).toFixed(0)}K pts`;
    frameCount = 0;
    fpsAccum = 0;
  }

  // GPGPU 更新
  particleSystem.update(dt, now / 1000);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
