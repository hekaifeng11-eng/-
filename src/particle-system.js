import * as THREE from 'three';
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

    console.log(`[ParticleSystem] GPU纹理尺寸: ${w}x${hPot} (particles=${count.toLocaleString()})`);

    // 目标纹理（模型顶点）
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

    // 散射纹理（随机球面）
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

    // UV 数组
    const uvArray = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const px = i % w;
      const py = Math.floor(i / w);
      uvArray[i * 2]     = (px + 0.5) / w;
      uvArray[i * 2 + 1] = (py + 0.5) / hPot;
    }

    // 颜色
    const colorArray = colors || new Float32Array(count * 3);
    if (!colors) {
      for (let i = 0; i < count; i++) {
        const t = i / count;
        colorArray[i * 3]     = 0.8 + 0.2 * (1 - t);
        colorArray[i * 3 + 1] = 0.5 + 0.4 * (1 - t);
        colorArray[i * 3 + 2] = 0.2 + 0.3 * t;
      }
    }

    // 软光晕圆形纹理
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

    // 计算模型包围盒
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < count && i * 3 < targetPositions.length; i++) {
      const x = targetPositions[i * 3];
      const y = targetPositions[i * 3 + 1];
      const z = targetPositions[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const modelCenter = new THREE.Vector3(
      (minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5
    );
    const modelRadius = Math.max(
      (maxX - minX) * 0.5, (maxY - minY) * 0.5, (maxZ - minZ) * 0.5
    );

    console.log(`[ParticleSystem] 模型包围盒: center=(${modelCenter.x.toFixed(0)},${modelCenter.y.toFixed(0)},${modelCenter.z.toFixed(0)}), radius=${modelRadius.toFixed(0)}, Y范围=[${minY.toFixed(0)},${maxY.toFixed(0)}]`);

    // 渲染材质
    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: renderVertex,
      fragmentShader: renderFragment,
      uniforms: {
        u_targetTexture: { value: this.targetTexture },
        u_scatterTexture: { value: this.scatterTexture },
        u_state:        { value: 0.0 },
        u_time:         { value: 0.0 },
        u_pointSize:    { value: 4.0 },
        u_opacity:      { value: 0.85 },
        u_stretch:      { value: 1.0 },
        u_visibleCount: { value: 0.0 },
        u_texWidth:     { value: w },
        u_texHeight:    { value: hPot },
        u_circleTexture:{ value: circleTexture },
        u_noiseStrength:{ value: 0.3 },
        u_noiseSpeed:   { value: 0.15 },
        u_transitionMode: { value: 0.0 },
        u_modelCenter:  { value: modelCenter },
        u_modelRadius:  { value: modelRadius },
        u_modelMinY:    { value: minY },
        u_modelMaxY:    { value: maxY },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // 几何体
    const geometry = new THREE.BufferGeometry();
    const dummyPos = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
    geometry.setAttribute('a_uv', new THREE.BufferAttribute(uvArray, 2));
    geometry.setAttribute('a_color', new THREE.BufferAttribute(colorArray, 3));

    this.points = new THREE.Points(geometry, this.renderMat);
    console.log('[ParticleSystem] 粒子系统构建完成 (无GPU Compute)');
  }

  update(dt, time) {
    this.renderMat.uniforms.u_time.value = time;
  }

  setUniform(name, value) {
    const ru = this.renderMat.uniforms;
    if (name in ru) { ru[name].value = value; return; }
  }

  getUniform(name) {
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
  }
}
