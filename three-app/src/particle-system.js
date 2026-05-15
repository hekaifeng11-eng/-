/**
 * particle-system.js — FBO GPGPU 粒子系统
 *
 * 使用 Three.js GPUComputationRenderer 做 ping-pong FBO，
 * 将粒子位置/速度存在纹理中，每帧 GPU 计算更新。
 */

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { computePositionFrag, computeVelocityFrag } from './shaders/compute.glsl.js';
import { renderVertex, renderFragment } from './shaders/render.glsl.js';

const SIZE_MULTIPLIER = 2; // 纹理尺寸 = ceil(sqrt(n)) * 2

export class ParticleSystem {
  /**
   * @param {number} count - 粒子数
   * @param {THREE.WebGLRenderer} renderer
   * @param {Float32Array} [initialPositions] - 初始位置 [x0,y0,z0, x1,y1,z1, ...]
   * @param {Float32Array} [initialColors] - 初始颜色 [r0,g0,b0, r1,g1,b1, ...]
   */
  constructor(count, renderer, initialPositions, initialColors) {
    this.count = count;

    // 计算纹理尺寸
    const texSize = Math.ceil(Math.sqrt(count));
    const w = nextPowerOf2(texSize * SIZE_MULTIPLIER);
    const h = nextPowerOf2(texSize);
    this.texWidth = w;
    this.texHeight = h;

    // 创建 GPU Computation Renderer
    this.gpuCompute = new GPUComputationRenderer(w, h, renderer);
    this.gpuCompute.setDataType(THREE.HalfFloatType);

    // 位置纹理数据
    const posData = new Float32Array(w * h * 4);
    if (initialPositions) {
      for (let i = 0; i < count && i * 3 < initialPositions.length; i++) {
        posData[i * 4]     = initialPositions[i * 3];
        posData[i * 4 + 1] = initialPositions[i * 3 + 1];
        posData[i * 4 + 2] = initialPositions[i * 3 + 2];
        posData[i * 4 + 3] = 1.0;
      }
    }
    this.positionTexture = this.gpuCompute.createTexture();
    this.positionTexture.image.data.set(posData);

    // 速度纹理数据
    const velData = new Float32Array(w * h * 4);
    this.velocityTexture = this.gpuCompute.createTexture();
    this.velocityTexture.image.data.set(velData);

    // 添加计算变量
    this.posVar = this.gpuCompute.addVariable('positionTexture', computePositionFrag, this.positionTexture);
    this.velVar = this.gpuCompute.addVariable('velocityTexture', computeVelocityFrag, this.velocityTexture);

    // 设置计算依赖：pos 依赖 vel，vel 依赖 pos
    this.gpuCompute.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);
    this.gpuCompute.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);

    // 计算 uniform
    this.posUniforms = this.posVar.material.uniforms;
    this.posUniforms.u_dt = { value: 0.016 };
    this.posUniforms.u_damping = { value: 0.98 };
    this.posUniforms.u_curlStrength = { value: 0.3 };
    this.posUniforms.u_time = { value: 0 };

    this.velUniforms = this.velVar.material.uniforms;
    this.velUniforms.u_dt = { value: 0.016 };
    this.velUniforms.u_damping = { value: 0.95 };

    // 初始化 GPU compute
    this.gpuCompute.init();

    // 创建 UV attribute（映射纹理像素到顶点）
    const uvArray = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const px = i % w;
      const py = Math.floor(i / w);
      uvArray[i * 2]     = (px + 0.5) / w;
      uvArray[i * 2 + 1] = (py + 0.5) / h;
    }

    // 颜色数据
    const colorArray = initialColors || new Float32Array(count * 3);
    if (!initialColors) {
      // 默认 Color Gradient：基于位置索引的暖色
      for (let i = 0; i < count; i++) {
        const t = i / count;
        colorArray[i * 3]     = 0.8 + 0.2 * (1 - t);  // R: warm
        colorArray[i * 3 + 1] = 0.5 + 0.4 * (1 - t);  // G
        colorArray[i * 3 + 2] = 0.2 + 0.3 * t;        // B: cool
      }
    }

    // 构建几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('a_uv', new THREE.BufferAttribute(uvArray, 2));
    geometry.setAttribute('a_color', new THREE.BufferAttribute(colorArray, 3));

    // 渲染材质（从 FBO 纹理读取位置）
    this.renderMat = new THREE.ShaderMaterial({
      vertexShader: renderVertex,
      fragmentShader: renderFragment,
      uniforms: {
        u_positionTexture: { value: null },
        u_pointSize: { value: 6.0 },
        u_color: { value: new THREE.Color(1, 0.7, 0.3) },
        u_opacity: { value: 0.9 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.renderMat);
  }

  /** 每帧更新 */
  update(dt, time) {
    // 更新计算 uniform
    this.posUniforms.u_dt.value = dt;
    this.posUniforms.u_time.value = time;
    this.velUniforms.u_dt.value = dt;

    // GPU 计算
    this.gpuCompute.compute();

    // 将计算结果传给渲染材质
    this.renderMat.uniforms.u_positionTexture.value =
      this.gpuCompute.getCurrentRenderTarget(this.posVar).texture;
  }

  /** 资源释放 */
  dispose() {
    this.points.geometry.dispose();
    this.renderMat.dispose();
    this.gpuCompute.dispose();
  }
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
