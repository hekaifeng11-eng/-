import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { computePositionFrag, computeVelocityFrag } from './shaders/compute.glsl.js';
import { renderVertex, renderFragment } from './shaders/render.glsl.js';

const SCATTER_RADIUS = 800;

function randomInSphere(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  ];
}

function nextPowerOf2(v) {
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  return v + 1;
}

export class ParticleSystem {
  constructor(count, renderer, targetPositions, colors) {
    this.count = count;

    const texSize = Math.ceil(Math.sqrt(count));
    const w = Math.min(4096, nextPowerOf2(texSize));
    const h = Math.ceil(count / w);
    const hPot = Math.min(4096, nextPowerOf2(h));
    this.texWidth = w;
    this.texHeight = hPot;

    console.log(`[ParticleSystem] GPU纹理尺寸: ${w}x${hPot} (texSize=${texSize}, particles=${count.toLocaleString()})`);

    this.gpuCompute = new GPUComputationRenderer(w, hPot, renderer);
    this.gpuCompute.setDataType(THREE.FloatType);

    const targetData = new Float32Array(w * hPot * 4);
    for (let i = 0; i < count && i * 3 < targetPositions.length; i++) {
      targetData[i * 4]     = targetPositions[i * 3];
      targetData[i * 4 + 1] = targetPositions[i * 3 + 1];
      targetData[i * 4 + 2] = targetPositions[i * 3 + 2];
      targetData[i * 4 + 3] = 1.0;
    }
    this.targetTexture = new THREE.DataTexture(targetData, w, hPot, THREE.RGBAFormat, THREE.FloatType);
    this.targetTexture.minFilter = THREE.NearestFilter;
    this.targetTexture.magFilter = THREE.NearestFilter;
    this.targetTexture.needsUpdate = true;

    const scatterData = new Float32Array(w * hPot * 4);
    for (let i = 0; i < count; i++) {
      const [sx, sy, sz] = randomInSphere(SCATTER_RADIUS);
      scatterData[i * 4]     = sx;
      scatterData[i * 4 + 1] = sy;
      scatterData[i * 4 + 2] = sz;
      scatterData[i * 4 + 3] = 1.0;
    }
    this.scatterTexture = new THREE.DataTexture(scatterData, w, hPot, THREE.RGBAFormat, THREE.FloatType);
    this.scatterTexture.minFilter = THREE.NearestFilter;
    this.scatterTexture.magFilter = THREE.NearestFilter;
    this.scatterTexture.needsUpdate = true;

    const posData = new Float32Array(w * hPot * 4);
    for (let i = 0; i < count && i * 3 < targetPositions.length; i++) {
      posData[i * 4]     = targetPositions[i * 3];
      posData[i * 4 + 1] = targetPositions[i * 3 + 1];
      posData[i * 4 + 2] = targetPositions[i * 3 + 2];
      posData[i * 4 + 3] = 0.5 + Math.random() * 1.5;
    }
    this.positionTexture = this.gpuCompute.createTexture();
    this.positionTexture.image.data.set(posData);

    const velData = new Float32Array(w * hPot * 4);
    this.velocityTexture = this.gpuCompute.createTexture();
    this.velocityTexture.image.data.set(velData);

    this.posVar = this.gpuCompute.addVariable('positionTexture', computePositionFrag, this.positionTexture);
    this.velVar = this.gpuCompute.addVariable('velocityTexture', computeVelocityFrag, this.velocityTexture);

    this.gpuCompute.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);
    this.gpuCompute.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);

    const pu = this.posVar.material.uniforms;
    pu.u_dt           = { value: 0.016 };
    pu.u_life         = { value: 0.0 };

    const vu = this.velVar.material.uniforms;
    vu.u_dt           = { value: 0.016 };
    vu.u_damping      = { value: 0.955 };
    vu.u_springK      = { value: 2.0 };
    vu.u_curlStrength = { value: 0.3 };
    vu.u_state        = { value: 0.0 };
    vu.u_time         = { value: 0 };
    vu.u_maxVel       = { value: 500.0 };
    vu.u_vortexStrength = { value: 0.0 };
    vu.u_vortexCenter   = { value: new THREE.Vector3(0, 0, 0) };
    vu.u_mousePos       = { value: new THREE.Vector3(0, 0, 0) };
    vu.u_mouseStrength  = { value: 0.0 };
    vu.targetTexture    = { value: this.targetTexture };
    vu.scatterTexture   = { value: this.scatterTexture };

    console.log('[ParticleSystem] 初始化 GPU 计算管线...');
    const initError = this.gpuCompute.init();
    if (initError !== null && initError !== undefined) {
      throw new Error('GPU computation init failed: ' + initError);
    }
    console.log('[ParticleSystem] GPU 计算管线就绪');

    console.log(`[ParticleSystem] 诊断: targetTexture前5个顶点:`,
      Array.from(targetPositions.slice(0, 15)).map(v => v.toFixed(2)));
    console.log(`[ParticleSystem] 诊断: targetData纹理前20个float:`,
      Array.from(targetData.slice(0, 20)).map(v => v.toFixed(2)));
    console.log(`[ParticleSystem] 诊断: posData纹理前20个float:`,
      Array.from(posData.slice(0, 20)).map(v => v.toFixed(2)));
    console.log(`[ParticleSystem] 诊断: velData纹理前20个float:`,
      Array.from(velData.slice(0, 20)).map(v => v.toFixed(2)));

    const uvArray = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const px = i % w;
      const py = Math.floor(i / w);
      uvArray[i * 2]     = (px + 0.5) / w;
      uvArray[i * 2 + 1] = (py + 0.5) / hPot;
    }

    const colorArray = colors || new Float32Array(count * 3);
    if (!colors) {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        colorArray[i * 3]     = 0.8 + 0.2 * (1 - t);
        colorArray[i * 3 + 1] = 0.5 + 0.4 * (1 - t);
        colorArray[i * 3 + 2] = 0.2 + 0.3 * t;
      }
    }

    const geometry = new THREE.BufferGeometry();
    const dummyPos = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
    geometry.setAttribute('a_uv', new THREE.BufferAttribute(uvArray, 2));
    geometry.setAttribute('a_color', new THREE.BufferAttribute(colorArray, 3));

    const circleSize = 64;
    const circleDataRGBA = new Uint8Array(circleSize * circleSize * 4);
    for (let y = 0; y < circleSize; y++) {
      for (let x = 0; x < circleSize; x++) {
        const dx = (x + 0.5) / circleSize - 0.5;
        const dy = (y + 0.5) / circleSize - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const val = Math.max(0, Math.min(255, Math.round((1.0 - dist * 2.0) * 255)));
        const idx = (y * circleSize + x) * 4;
        circleDataRGBA[idx]     = val;
        circleDataRGBA[idx + 1] = val;
        circleDataRGBA[idx + 2] = val;
        circleDataRGBA[idx + 3] = 255;
      }
    }
    const circleTexture = new THREE.DataTexture(circleDataRGBA, circleSize, circleSize,
      THREE.RGBAFormat, THREE.UnsignedByteType);
    circleTexture.needsUpdate = true;

    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: renderVertex,
      fragmentShader: renderFragment,
      uniforms: {
        u_positionTexture: { value: null },
        u_velocityTexture: { value: null },
        u_pointSize:       { value: 4.0 },
        u_opacity:         { value: 0.85 },
        u_stretch:         { value: 1.0 },
        u_visibleCount:    { value: 0.0 },
        u_texWidth:        { value: w },
        u_texHeight:       { value: hPot },
        u_circleTexture:   { value: circleTexture },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.renderMat);
    console.log('[ParticleSystem] 粒子系统构建完成');
  }

  update(dt, time) {
    // 诊断模式：跳过 GPU compute，直接用 target 模型顶点作为粒子位置
    this.renderMat.uniforms.u_positionTexture.value = this.targetTexture;
    this.renderMat.uniforms.u_velocityTexture.value = this.velocityTexture;
    return;

    if (!this._diagDone) {
      this._diagDone = true;
      try {
        const posRT = this.gpuCompute.getCurrentRenderTarget(this.posVar);
        const velRT = this.gpuCompute.getCurrentRenderTarget(this.velVar);
        const posPixels = new Float32Array(4 * 4);
        const velPixels = new Float32Array(4 * 4);
        const renderer = this.gpuCompute.renderer;
        renderer.readRenderTargetPixels(posRT, 0, 0, 1, 4, posPixels);
        renderer.readRenderTargetPixels(velRT, 0, 0, 1, 4, velPixels);
        console.log(`[ParticleSystem] GPU回读 position(0,0)~(0,3):`,
          Array.from(posPixels).map(v => v.toFixed(3)));
        console.log(`[ParticleSystem] GPU回读 velocity(0,0)~(0,3):`,
          Array.from(velPixels).map(v => v.toFixed(3)));
      } catch (e) {
        console.warn('[ParticleSystem] GPU回读失败:', e.message);
      }
    }
  }

  setUniform(name, value) {
    const pu = this.posVar.material.uniforms;
    if (name in pu) { pu[name].value = value; return; }
    const vu = this.velVar.material.uniforms;
    if (name in vu) { vu[name].value = value; return; }
    const ru = this.renderMat.uniforms;
    if (name in ru) { ru[name].value = value; return; }
  }

  getUniform(name) {
    const pu = this.posVar.material.uniforms;
    if (name in pu) return pu[name].value;
    const vu = this.velVar.material.uniforms;
    if (name in vu) return vu[name].value;
    const ru = this.renderMat.uniforms;
    if (name in ru) return ru[name].value;
    return undefined;
  }

  dispose() {
    this.points.geometry.dispose();
    this.renderMat.uniforms.u_circleTexture.value.dispose();
    this.renderMat.dispose();
    this.targetTexture.dispose();
    this.scatterTexture.dispose();
    this.gpuCompute.dispose();
  }
}
