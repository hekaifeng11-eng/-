import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { computePositionFrag, computeVelocityFrag } from './shaders/compute.glsl.js';
import { renderVertex, renderFragment } from './shaders/render.glsl.js';

const SIZE_MULTIPLIER = 2;
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
    const w = nextPowerOf2(texSize * SIZE_MULTIPLIER);
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
    this.scatterTexture.needsUpdate = true;

    const posData = new Float32Array(w * h * 4);
    posData.set(targetData);
    this.positionTexture = this.gpuCompute.createTexture();
    this.positionTexture.image.data.set(posData);

    const velData = new Float32Array(w * h * 4);
    this.velocityTexture = this.gpuCompute.createTexture();
    this.velocityTexture.image.data.set(velData);

    this.posVar = this.gpuCompute.addVariable('positionTexture', computePositionFrag, this.positionTexture);
    this.velVar = this.gpuCompute.addVariable('velocityTexture', computeVelocityFrag, this.velocityTexture);

    this.gpuCompute.setVariableDependencies(this.posVar, [this.velVar]);
    this.gpuCompute.setVariableDependencies(this.velVar, [this.posVar]);

    const pu = this.posVar.material.uniforms;
    pu.positionTexture = { value: null };
    pu.u_dt           = { value: 0.016 };

    const vu = this.velVar.material.uniforms;
    vu.velocityTexture = { value: null };
    vu.u_dt           = { value: 0.016 };
    vu.u_damping      = { value: 0.96 };
    vu.u_springK      = { value: 0.15 };
    vu.u_curlStrength = { value: 0.3 };
    vu.u_state        = { value: 0.0 };
    vu.u_time         = { value: 0 };
    vu.u_maxVel       = { value: 50.0 };
    vu.targetTexture  = { value: this.targetTexture };
    vu.scatterTexture = { value: this.scatterTexture };

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
    const circleData = new Uint8Array(circleSize * circleSize);
    for (let y = 0; y < circleSize; y++) {
      for (let x = 0; x < circleSize; x++) {
        const dx = (x + 0.5) / circleSize - 0.5;
        const dy = (y + 0.5) / circleSize - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        circleData[y * circleSize + x] = Math.max(0, Math.min(255,
          Math.round((1.0 - dist * 2.0) * 255)));
      }
    }
    const circleTexture = new THREE.DataTexture(circleData, circleSize, circleSize,
      THREE.RedFormat, THREE.UnsignedByteType);
    circleTexture.needsUpdate = true;

    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: renderVertex,
      fragmentShader: renderFragment,
      uniforms: {
        u_positionTexture: { value: null },
        u_pointSize:       { value: 4.0 },
        u_opacity:         { value: 0.85 },
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

    pu.positionTexture.value =
      this.gpuCompute.getCurrentRenderTarget(this.posVar).texture;
    vu.velocityTexture.value =
      this.gpuCompute.getCurrentRenderTarget(this.velVar).texture;

    this.gpuCompute.compute();

    this.renderMat.uniforms.u_positionTexture.value =
      this.gpuCompute.getCurrentRenderTarget(this.posVar).texture;
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
    this.renderMat.dispose();
    this.targetTexture.dispose();
    this.scatterTexture.dispose();
    this.gpuCompute.dispose();
  }
}
