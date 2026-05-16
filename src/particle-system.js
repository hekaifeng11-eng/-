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
    const w = nextPowerOf2(texSize);
    const h = nextPowerOf2(texSize);
    this.texWidth = w;
    this.texHeight = h;

    this.gpuCompute = new GPUComputationRenderer(w, h, renderer);
    this.gpuCompute.setDataType(THREE.FloatType);

    const targetData = new Float32Array(w * h * 4);
    for (let i = 0; i < count && i * 3 < targetPositions.length; i++) {
      targetData[i * 4]     = targetPositions[i * 3];
      targetData[i * 4 + 1] = targetPositions[i * 3 + 1];
      targetData[i * 4 + 2] = targetPositions[i * 3 + 2];
      targetData[i * 4 + 3] = 1.0;
    }
    this.targetTexture = new THREE.DataTexture(targetData, w, h, THREE.RGBAFormat, THREE.FloatType);
    this.targetTexture.minFilter = THREE.NearestFilter;
    this.targetTexture.magFilter = THREE.NearestFilter;
    this.targetTexture.needsUpdate = true;

    const scatterData = new Float32Array(w * h * 4);
    for (let i = 0; i < count; i++) {
      const [sx, sy, sz] = randomInSphere(SCATTER_RADIUS);
      scatterData[i * 4]     = sx;
      scatterData[i * 4 + 1] = sy;
      scatterData[i * 4 + 2] = sz;
      scatterData[i * 4 + 3] = 1.0;
    }
    this.scatterTexture = new THREE.DataTexture(scatterData, w, h, THREE.RGBAFormat, THREE.FloatType);
    this.scatterTexture.minFilter = THREE.NearestFilter;
    this.scatterTexture.magFilter = THREE.NearestFilter;
    this.scatterTexture.needsUpdate = true;

    const posData = new Float32Array(w * h * 4);
    for (let i = 0; i < count; i++) {
      const [sx, sy, sz] = randomInSphere(SCATTER_RADIUS);
      posData[i * 4]     = sx;
      posData[i * 4 + 1] = sy;
      posData[i * 4 + 2] = sz;
      posData[i * 4 + 3] = 0.5 + Math.random() * 1.5;
    }
    this.positionTexture = this.gpuCompute.createTexture();
    this.positionTexture.image.data.set(posData);

    const velData = new Float32Array(w * h * 4);
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
    vu.u_damping      = { value: 0.96 };
    vu.u_springK      = { value: 0.15 };
    vu.u_curlStrength = { value: 0.3 };
    vu.u_state        = { value: 0.0 };
    vu.u_time         = { value: 0 };
    vu.u_maxVel       = { value: 50.0 };
    vu.u_vortexStrength = { value: 0.0 };
    vu.u_vortexCenter   = { value: new THREE.Vector3(0, 0, 0) };
    vu.u_mousePos       = { value: new THREE.Vector3(0, 0, 0) };
    vu.u_mouseStrength  = { value: 0.0 };
    vu.targetTexture    = { value: this.targetTexture };
    vu.scatterTexture   = { value: this.scatterTexture };

    this.gpuCompute.init();

    const uvArray = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const px = i % w;
      const py = Math.floor(i / w);
      uvArray[i * 2]     = (px + 0.5) / w;
      uvArray[i * 2 + 1] = (py + 0.5) / h;
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
        u_texHeight:       { value: h },
        u_circleTexture:   { value: circleTexture },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.renderMat);
  }

  update(dt, time) {
    const pu = this.posVar.material.uniforms;
    pu.u_dt.value = dt;

    const vu = this.velVar.material.uniforms;
    vu.u_dt.value = dt;
    vu.u_time.value = time;

    this.gpuCompute.compute();

    const posTex = this.gpuCompute.getCurrentRenderTarget(this.posVar).texture;
    const velTex = this.gpuCompute.getCurrentRenderTarget(this.velVar).texture;

    this.renderMat.uniforms.u_positionTexture.value = posTex;
    this.renderMat.uniforms.u_velocityTexture.value = velTex;
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
