import * as THREE from 'three';
import { gsap } from 'gsap';
import { ParticleSystem } from './particle-system.js';
import { ModelLoader } from './model-loader.js';
import { setupInteraction } from './interaction.js';
import { setupPanel } from './panel.js';
import { PostProcessing } from './post-processing.js';
import { AnimationSequencer } from './animation-sequencer.js';
import { PRESETS } from './presets.js';
import { appState, getQualityCount } from './state.js';

let scene, camera, renderer, postProcessing;
let particleRef = { current: null };
let sequencer;
let guiRef = null;
let visibleTween = null;
let currentModelData = null;
let isActive = false;

const camState = {
  angle: 0,
  distance: 500,
  height: 0,
  xOffset: 0,
  zOffset: 0,
  orbitSpeed: 0.08,
};

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 500);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 1.2s ease';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.zIndex = '1';
  document.body.appendChild(renderer.domElement);

  postProcessing = new PostProcessing(renderer, scene, camera);
  sequencer = new AnimationSequencer(particleRef, null);
}

function updateCamera() {
  camera.position.x = camState.distance * Math.sin(camState.angle) + camState.xOffset;
  camera.position.z = camState.distance * Math.cos(camState.angle) + camState.zOffset;
  camera.position.y = camState.height;
  camera.lookAt(0, 0, 0);
}

function createParticleSystem(data) {
  if (visibleTween) { visibleTween.kill(); visibleTween = null; }
  if (particleRef.current) {
    scene.remove(particleRef.current.points);
    particleRef.current.dispose();
  }
  sequencer.kill();

  currentModelData = data;

  const ps = new ParticleSystem(data.count, renderer, data.attributes.position, data.attributes.color);
  ps.points.frustumCulled = false;
  ps.setUniform('u_state', 1.0);
  ps.setUniform('u_life', 0.0);
  particleRef.current = ps;
  scene.add(ps.points);

  camState.angle = 0;
  camState.distance = 500;
  camState.height = 0;
  camState.xOffset = 0;
  camState.zOffset = 0;
  updateCamera();

  const visibleObj = { count: 0 };
  visibleTween = gsap.to(visibleObj, {
    count: data.count,
    duration: 3.0,
    ease: 'power2.out',
    onUpdate: () => ps.setUniform('u_visibleCount', visibleObj.count),
    onComplete: () => { visibleTween = null; },
  });

  setTimeout(() => {
    sequencer.playFullSequence();
  }, 300);
}

function showParticleCanvas() {
  if (isActive) return;
  isActive = true;

  const landing = document.getElementById('landing');
  if (landing) {
    landing.style.opacity = '0';
    landing.style.pointerEvents = 'none';
    setTimeout(() => landing.remove(), 1200);
  }

  renderer.domElement.style.opacity = '1';
  renderer.domElement.style.pointerEvents = 'auto';

  setupInteraction(particleRef, camera, renderer);
  guiRef = setupPanel(particleRef, camera, camState, postProcessing, sequencer);
  setupParticleUI();
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  showLoadingStatus(`正在解析 ${file.name}...`);

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
      showLoadingStatus(`不支持的格式: .${ext}`);
      return;
    }

    console.log(`Loaded ${data.count} vertices from ${file.name}`);
    showParticleCanvas();
    createParticleSystem(data);
    hideLoadingStatus();
  } catch (err) {
    console.error('File load failed:', err);
    showLoadingStatus(`加载失败: ${err.message}`);
  }
}

function showLoadingStatus(msg) {
  let el = document.getElementById('loading-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-status';
    el.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
      + 'color:rgba(255,255,255,0.7);font:14px monospace;text-align:center;'
      + 'pointer-events:none;z-index:100;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

function hideLoadingStatus() {
  const el = document.getElementById('loading-status');
  if (el) el.remove();
}

function setupLandingPage() {
  const landing = document.createElement('div');
  landing.id = 'landing';
  landing.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:50;'
    + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'background:#07070c;'
    + 'transition:opacity 1.2s ease;';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 25%{transform:translate(80px,-60px) scale(1.1)} 50%{transform:translate(-40px,-120px) scale(0.9)} 75%{transform:translate(-80px,40px) scale(1.05)} }
    @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 25%{transform:translate(-100px,80px) scale(0.95)} 50%{transform:translate(60px,100px) scale(1.1)} 75%{transform:translate(100px,-30px) scale(1)} }
    @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(0.9)} 33%{transform:translate(120px,60px) scale(1.1)} 66%{transform:translate(-80px,-80px) scale(1)} }
    @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
    @keyframes gridMove { 0%{background-position:0 0} 100%{background-position:60px 60px} }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
    @keyframes borderGlow { 0%,100%{border-color:rgba(255,255,255,0.08)} 50%{border-color:rgba(255,255,255,0.2)} }
    .landing-orb { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
    .landing-title { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:clamp(28px,5vw,56px); font-weight:200; letter-spacing:0.3em; color:rgba(255,255,255,0.85); margin-bottom:12px; animation:fadeInUp 1s ease 0.2s both; }
    .landing-sub { font-family:monospace; font-size:clamp(11px,1.5vw,14px); color:rgba(255,255,255,0.3); letter-spacing:0.15em; margin-bottom:60px; animation:fadeInUp 1s ease 0.5s both; }
    .landing-drop { position:relative; width:clamp(280px,40vw,480px); height:200px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; cursor:pointer; transition:all 0.4s ease; animation:fadeInUp 1s ease 0.8s both, borderGlow 4s ease infinite; background:rgba(255,255,255,0.02); }
    .landing-drop:hover { border-color:rgba(255,255,255,0.3); background:rgba(255,255,255,0.04); }
    .landing-drop.dragover { border-color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.06); transform:scale(1.02); }
    .landing-drop-icon { width:48px; height:48px; opacity:0.25; transition:opacity 0.3s; }
    .landing-drop:hover .landing-drop-icon { opacity:0.5; }
    .landing-drop-text { font-family:monospace; font-size:13px; color:rgba(255,255,255,0.3); transition:color 0.3s; }
    .landing-drop:hover .landing-drop-text { color:rgba(255,255,255,0.6); }
    .landing-drop-hint { font-family:monospace; font-size:11px; color:rgba(255,255,255,0.15); }
    .landing-grid { position:absolute; top:0; left:0; width:100%; height:100%; background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px); background-size:60px 60px; animation:gridMove 20s linear infinite; pointer-events:none; }
    .landing-formats { position:absolute; bottom:40px; font-family:monospace; font-size:11px; color:rgba(255,255,255,0.12); letter-spacing:0.1em; animation:fadeInUp 1s ease 1.2s both; }
  `;
  document.head.appendChild(style);

  const grid = document.createElement('div');
  grid.className = 'landing-grid';
  landing.appendChild(grid);

  const orb1 = document.createElement('div');
  orb1.className = 'landing-orb';
  orb1.style.cssText = 'width:400px;height:400px;top:10%;left:15%;background:rgba(80,40,160,0.15);animation:orb1 25s ease-in-out infinite;';
  landing.appendChild(orb1);

  const orb2 = document.createElement('div');
  orb2.className = 'landing-orb';
  orb2.style.cssText = 'width:350px;height:350px;bottom:15%;right:10%;background:rgba(30,80,160,0.12);animation:orb2 30s ease-in-out infinite;';
  landing.appendChild(orb2);

  const orb3 = document.createElement('div');
  orb3.className = 'landing-orb';
  orb3.style.cssText = 'width:250px;height:250px;top:50%;left:60%;background:rgba(160,40,80,0.1);animation:orb3 22s ease-in-out infinite;';
  landing.appendChild(orb3);

  const title = document.createElement('div');
  title.className = 'landing-title';
  title.textContent = 'PARTICLE ENGINE';
  landing.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'landing-sub';
  sub.textContent = '3D MODEL TO PARTICLE SYSTEM';
  landing.appendChild(sub);

  const dropZone = document.createElement('div');
  dropZone.className = 'landing-drop';

  const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  iconSvg.setAttribute('class', 'landing-drop-icon');
  iconSvg.setAttribute('viewBox', '0 0 24 24');
  iconSvg.setAttribute('fill', 'none');
  iconSvg.setAttribute('stroke', 'white');
  iconSvg.setAttribute('stroke-width', '1.5');
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path2.setAttribute('points', '17 8 12 3 7 8');
  const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  path3.setAttribute('x1', '12'); path3.setAttribute('y1', '3'); path3.setAttribute('x2', '12'); path3.setAttribute('y2', '15');
  iconSvg.appendChild(path1);
  iconSvg.appendChild(path2);
  iconSvg.appendChild(path3);
  dropZone.appendChild(iconSvg);

  const dropText = document.createElement('div');
  dropText.className = 'landing-drop-text';
  dropText.textContent = '拖拽 3D 模型文件到此处';
  dropZone.appendChild(dropText);

  const dropHint = document.createElement('div');
  dropHint.className = 'landing-drop-hint';
  dropHint.textContent = '或 点击选择文件';
  dropZone.appendChild(dropHint);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.glb,.gltf,.fbx,.ply';
  fileInput.style.display = 'none';

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  landing.appendChild(dropZone);
  landing.appendChild(fileInput);

  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!isActive) {
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    }
  });

  const formats = document.createElement('div');
  formats.className = 'landing-formats';
  formats.textContent = 'SUPPORTED  ·  GLB  ·  GLTF  ·  FBX  ·  PLY';
  landing.appendChild(formats);

  document.body.appendChild(landing);
}

function setupParticleUI() {
  const topBar = document.createElement('div');
  topBar.id = 'top-bar';
  topBar.style.cssText =
    'position:fixed;top:0;left:0;right:0;height:56px;'
    + 'display:flex;align-items:center;justify-content:center;gap:10px;'
    + 'padding:0 20px;z-index:20;'
    + 'opacity:0;transition:opacity 0.4s ease;'
    + 'background:linear-gradient(to bottom,rgba(10,10,15,0.85),transparent);'
    + 'pointer-events:none;';

  Object.keys(PRESETS).forEach(name => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.style.cssText =
      'padding:5px 14px;border:1px solid rgba(255,255,255,0.15);'
      + 'border-radius:4px;background:rgba(255,255,255,0.04);'
      + 'color:rgba(255,255,255,0.5);font:11px monospace;cursor:pointer;'
      + 'transition:all 0.2s ease;pointer-events:auto;';
    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'rgba(255,255,255,0.4)';
      btn.style.color = 'rgba(255,255,255,0.9)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.color = 'rgba(255,255,255,0.5)';
    });
    btn.addEventListener('click', () => {
      const gen = PRESETS[name];
      const data = gen(appState.particleCount);
      createParticleSystem(data);
    });
    topBar.appendChild(btn);
  });

  const bottomBar = document.createElement('div');
  bottomBar.id = 'bottom-bar';
  bottomBar.style.cssText =
    'position:fixed;bottom:0;left:0;right:0;height:50px;'
    + 'display:flex;align-items:center;justify-content:center;'
    + 'z-index:20;'
    + 'opacity:0;transition:opacity 0.4s ease;'
    + 'background:linear-gradient(to top,rgba(10,10,15,0.85),transparent);'
    + 'pointer-events:none;';

  const miniDrop = document.createElement('div');
  miniDrop.style.cssText =
    'padding:8px 20px;border:1px dashed rgba(255,255,255,0.15);'
    + 'border-radius:6px;color:rgba(255,255,255,0.3);'
    + 'font:11px monospace;cursor:pointer;pointer-events:auto;'
    + 'transition:all 0.3s;';
  miniDrop.textContent = '拖拽新模型 或 点击选择';

  const fileInput2 = document.createElement('input');
  fileInput2.type = 'file';
  fileInput2.accept = '.glb,.gltf,.fbx,.ply';
  fileInput2.style.display = 'none';

  miniDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    miniDrop.style.borderColor = 'rgba(255,255,255,0.5)';
    miniDrop.style.color = 'rgba(255,255,255,0.7)';
  });
  miniDrop.addEventListener('dragleave', () => {
    miniDrop.style.borderColor = 'rgba(255,255,255,0.15)';
    miniDrop.style.color = 'rgba(255,255,255,0.3)';
  });
  miniDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    miniDrop.style.borderColor = 'rgba(255,255,255,0.15)';
    miniDrop.style.color = 'rgba(255,255,255,0.3)';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  miniDrop.addEventListener('click', () => fileInput2.click());
  fileInput2.addEventListener('change', () => {
    if (fileInput2.files[0]) handleFile(fileInput2.files[0]);
  });

  bottomBar.appendChild(miniDrop);

  document.body.appendChild(topBar);
  document.body.appendChild(bottomBar);
  document.body.appendChild(fileInput2);

  let hideTimer = null;
  const showBars = () => {
    topBar.style.opacity = '1';
    bottomBar.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      topBar.style.opacity = '0';
      bottomBar.style.opacity = '0';
    }, 4000);
  };

  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 70 || e.clientY > window.innerHeight - 70) showBars();
  });

  showBars();
}

const fpsEl = document.createElement('div');
fpsEl.style.cssText =
  'position:fixed;top:14px;right:18px;'
  + 'color:rgba(255,255,255,0.25);font:11px monospace;'
  + 'pointer-events:none;z-index:30;display:none;';
document.body.appendChild(fpsEl);

window.addEventListener('resize', () => {
  if (!renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  postProcessing.setSize(w, h);
});

let lastTime = performance.now();
let frameCount = 0;
let fpsAccum = 0;
let lowFpsCount = 0;

function animate() {
  requestAnimationFrame(animate);
  if (!isActive || !particleRef.current) return;

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  frameCount++;
  fpsAccum += dt;
  if (fpsAccum >= 1) {
    const fps = Math.round(frameCount / fpsAccum);
    fpsEl.textContent = `${fps} fps | ${(particleRef.current.count / 1000).toFixed(0)}K`;

    if (fps < 25 && appState.qualityLevel > 0) {
      lowFpsCount++;
      if (lowFpsCount >= 3) {
        appState.qualityLevel = Math.max(0, appState.qualityLevel - 1);
        appState.particleCount = getQualityCount();
        lowFpsCount = 0;
        if (currentModelData) createParticleSystem(currentModelData);
      }
    } else {
      lowFpsCount = 0;
    }

    frameCount = 0;
    fpsAccum = 0;
  }

  camState.angle += dt * camState.orbitSpeed;
  updateCamera();

  particleRef.current.update(dt, now / 1000);
  postProcessing.render();
}

initThree();
setupLandingPage();
animate();
