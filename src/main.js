import * as THREE from 'three';
import { gsap } from 'gsap';
import { ParticleSystem } from './particle-system.js';
import { ModelLoader } from './model-loader.js';
import { loadPLY } from './ply-loader.js';
import { setupInteraction } from './interaction.js';
import { setupPanel } from './panel.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const particleRef = { current: null };

const camState = {
  angle: 0,
  distance: 500,
  height: 0,
  xOffset: 0,
  zOffset: 0,
  orbitSpeed: 0.08,
};

function updateCamera() {
  camera.position.x = camState.distance * Math.sin(camState.angle) + camState.xOffset;
  camera.position.z = camState.distance * Math.cos(camState.angle) + camState.zOffset;
  camera.position.y = camState.height;
  camera.lookAt(0, 0, 0);
}

function generateDefaultModel(count) {
  const R = 200, r = 80, p = 3, q = 2;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = 2 * Math.PI * i / count;
    const theta = p * t;
    const phi = q * t;
    pos[i * 3]     = (R + r * Math.cos(theta)) * Math.cos(phi);
    pos[i * 3 + 1] = (R + r * Math.cos(theta)) * Math.sin(phi);
    pos[i * 3 + 2] = r * Math.sin(theta);
    const zn = pos[i * 3 + 2] / (R + r);
    col[i * 3]     = 0.8 + 0.2 * (0.5 - zn * 0.5);
    col[i * 3 + 1] = 0.5 + 0.3 * (0.5 - zn * 0.3);
    col[i * 3 + 2] = 0.2 + 0.6 * (zn + 1) / 2;
  }
  return { attributes: { position: pos, color: col }, count };
}

let masterTL = null;

function createParticleSystem(data) {
  if (particleRef.current) {
    scene.remove(particleRef.current.points);
    particleRef.current.dispose();
  }
  if (masterTL) {
    masterTL.kill();
    masterTL = null;
  }

  const ps = new ParticleSystem(data.count, renderer, data.attributes.position, data.attributes.color);
  ps.points.frustumCulled = false;
  ps.setUniform('u_state', 0.0);
  particleRef.current = ps;
  scene.add(ps.points);

  camState.angle = 0;
  camState.distance = 500;
  camState.height = 0;
  camState.xOffset = 0;
  camState.zOffset = 0;
  updateCamera();

  setupCameraSequences();
}

function setupCameraSequences() {
  function seqPushPull() {
    const tl = gsap.timeline();
    tl.to(camState, {
      distance: 700, height: 80,
      duration: 4, ease: 'power2.inOut',
      onUpdate: updateCamera,
    }).to(camState, {
      distance: 300, height: -40,
      duration: 4, ease: 'power2.inOut',
      onUpdate: updateCamera,
    }).to(camState, {
      distance: 500, height: 0,
      duration: 4, ease: 'power2.inOut',
      onUpdate: updateCamera,
    });
    return tl;
  }

  function seqSway() {
    const tl = gsap.timeline();
    tl.to(camState, {
      xOffset: 120, zOffset: 80, height: 60,
      duration: 3, ease: 'sine.inOut',
      onUpdate: updateCamera,
    }).to(camState, {
      xOffset: -100, zOffset: -60, height: -50,
      duration: 3, ease: 'sine.inOut',
      onUpdate: updateCamera,
    }).to(camState, {
      xOffset: 0, zOffset: 0, height: 0,
      duration: 2, ease: 'sine.inOut',
      onUpdate: updateCamera,
    });
    return tl;
  }

  masterTL = gsap.timeline({ repeat: -1 });
  masterTL.add(seqPushPull());
  masterTL.add(seqSway());
  masterTL.timeScale(camState.orbitSpeed);
}

async function loadSceneFromModel(dataOrUrl, extension) {
  try {
    let data;
    if (typeof dataOrUrl === 'string') {
      console.log(`Loading ${extension}: ${dataOrUrl}`);
      switch (extension) {
        case 'glb':
        case 'gltf':
          data = await ModelLoader.loadGLB(dataOrUrl);
          break;
        case 'fbx':
          data = await ModelLoader.loadFBX(dataOrUrl);
          break;
        case 'ply':
          const plyResult = await loadPLY(dataOrUrl);
          data = {
            attributes: { position: plyResult.positions, color: plyResult.colors },
            count: plyResult.count,
          };
          break;
        default:
          throw new Error(`Unsupported format: ${extension}`);
      }
    } else {
      data = dataOrUrl;
    }
    const count = data.count ?? data.attributes.position.length / 3;
    console.log(`Loaded ${count} vertices`);
    createParticleSystem(data);
    hideStatus();
  } catch (err) {
    console.error('Model load failed:', err);
    showStatus(`加载失败: ${err.message}，回退到默认模型`);
    createParticleSystem(generateDefaultModel(500000));
  }
}

const statusEl = document.createElement('div');
statusEl.style.cssText =
  'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
  + 'color:rgba(255,255,255,0.5);font:14px monospace;text-align:center;'
  + 'pointer-events:none;z-index:10;';

function showStatus(msg) {
  statusEl.textContent = msg;
  document.body.appendChild(statusEl);
}

function hideStatus() {
  statusEl.remove();
}

const fpsEl = document.createElement('div');
fpsEl.style.cssText =
  'position:fixed;top:16px;right:20px;'
  + 'color:rgba(255,255,255,0.3);font:12px monospace;'
  + 'pointer-events:none;z-index:10;';
document.body.appendChild(fpsEl);

function setupFileUpload() {
  const zone = document.createElement('div');
  zone.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
    + 'padding:12px 24px;border:1px dashed rgba(255,255,255,0.2);'
    + 'border-radius:8px;color:rgba(255,255,255,0.35);'
    + 'font:12px monospace;cursor:pointer;z-index:10;'
    + 'transition:border-color 0.3s,color 0.3s;';
  zone.textContent = '拖拽 GLB/FBX/PLY 到此处 或 点击选择';

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.style.borderColor = 'rgba(255,255,255,0.6)';
    zone.style.color = 'rgba(255,255,255,0.7)';
  });
  zone.addEventListener('dragleave', () => {
    zone.style.borderColor = 'rgba(255,255,255,0.2)';
    zone.style.color = 'rgba(255,255,255,0.35)';
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.style.borderColor = 'rgba(255,255,255,0.2)';
    zone.style.color = 'rgba(255,255,255,0.35)';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  zone.addEventListener('click', () => input.click());

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.glb,.gltf,.fbx,.ply';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  document.body.appendChild(zone);
  document.body.appendChild(input);
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  showStatus(`正在加载 ${file.name}...`);

  try {
    let data;
    if (ext === 'glb' || ext === 'gltf') {
      data = await ModelLoader.loadGLBFromFile(file);
    } else if (ext === 'fbx') {
      data = await ModelLoader.loadFBXFromFile(file);
    } else if (ext === 'ply') {
      const text = await file.text();
      const { parsePLY } = await import('./ply-loader.js');
      const plyResult = parsePLY(text);
      data = {
        attributes: { position: plyResult.positions, color: plyResult.colors },
        count: plyResult.count,
      };
    } else {
      showStatus(`不支持的文件格式: .${ext}（支持 glb/gltf/fbx/ply）`);
      setTimeout(hideStatus, 3000);
      return;
    }

    console.log(`Loaded ${data.count} vertices from ${file.name}`);
    createParticleSystem(data);
    hideStatus();
  } catch (err) {
    console.error('File load failed:', err);
    showStatus(`加载失败: ${err.message}`);
    setTimeout(hideStatus, 3000);
  }
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

let lastTime = performance.now();
let frameCount = 0;
let fpsAccum = 0;
const PARTICLE_COUNT = 500000;

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  frameCount++;
  fpsAccum += dt;
  if (fpsAccum >= 1) {
    const currentCount = particleRef.current?.count ?? PARTICLE_COUNT;
    fpsEl.textContent = `${Math.round(frameCount / fpsAccum)} fps | ${(currentCount / 1000).toFixed(0)}K pts`;
    frameCount = 0;
    fpsAccum = 0;
  }

  camState.angle += dt * camState.orbitSpeed;
  updateCamera();

  if (particleRef.current) {
    particleRef.current.update(dt, now / 1000);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

showStatus('正在加载默认模型...');
setTimeout(() => {
  loadSceneFromModel(generateDefaultModel(PARTICLE_COUNT), null);
  setupInteraction(particleRef);
  setupPanel(particleRef, camera, camState);
  setupFileUpload();
  animate();
}, 100);
