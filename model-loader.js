import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MAX_PARTICLES = 500000;

let _sampleCanvas = null;
let _sampleCtx = null;
let _currentImageSrc = null;

function sampleTextureColor(material, uvx, uvy) {
  if (!material || !material.map || !material.map.image) return null;
  const img = material.map.image;
  try {
    if (!_sampleCanvas) {
      _sampleCanvas = document.createElement('canvas');
      _sampleCtx = _sampleCanvas.getContext('2d');
    }
    if (_currentImageSrc !== img.src) {
      _sampleCanvas.width = img.width || img.videoWidth || 1;
      _sampleCanvas.height = img.height || img.videoHeight || 1;
      _sampleCtx.drawImage(img, 0, 0);
      _currentImageSrc = img.src;
    }
    const px = Math.floor(uvx * (_sampleCanvas.width - 1));
    const py = Math.floor((1 - uvy) * (_sampleCanvas.height - 1));
    const data = _sampleCtx.getImageData(Math.max(0, px), Math.max(0, py), 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255];
  } catch {
    return null;
  }
}

function disposeScene(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function mergeGeometries(geometries, meshes) {
  let totalVerts = 0;
  const hasColor = geometries.some(g => g.attributes.color);
  const hasUV = geometries.some(g => g.attributes.uv);

  for (const g of geometries) totalVerts += g.attributes.position.count;

  let indices;
  if (totalVerts > MAX_PARTICLES) {
    indices = randomSample(totalVerts, MAX_PARTICLES);
  } else if (totalVerts > 0) {
    indices = fillSample(totalVerts, MAX_PARTICLES);
  } else {
    throw new Error('Model has no vertices');
  }

  const count = indices.length;
  const pos = new Float32Array(count * 3);
  const col = (hasColor || hasUV) ? new Float32Array(count * 3) : null;

  const offsets = [];
  let acc = 0;
  for (const g of geometries) {
    offsets.push(acc);
    acc += g.attributes.position.count;
  }

  const needsJitter = totalVerts < MAX_PARTICLES;
  const textureColorCache = new Map();
  const tempVec = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const idx = indices[i];
    let geoIdx = 0;
    while (geoIdx < offsets.length - 1 && idx >= offsets[geoIdx + 1]) geoIdx++;
    const localIdx = idx - offsets[geoIdx];
    const g = geometries[geoIdx];
    const pAttr = g.attributes.position;

    if (meshes && meshes[geoIdx]) {
      const mesh = meshes[geoIdx];
      mesh.updateWorldMatrix(true, false);
      tempVec.fromBufferAttribute(pAttr, localIdx).applyMatrix4(mesh.matrixWorld);
      pos[i * 3]     = tempVec.x;
      pos[i * 3 + 1] = tempVec.y;
      pos[i * 3 + 2] = tempVec.z;
    } else {
      pos[i * 3]     = pAttr.array[localIdx * 3];
      pos[i * 3 + 1] = pAttr.array[localIdx * 3 + 1];
      pos[i * 3 + 2] = pAttr.array[localIdx * 3 + 2];
    }

    // NOTE: jitter is intentionally NOT applied here.
    // It must be applied AFTER normalizeModel() so the offset is
    // relative to the normalized 400-unit coordinate space, not the
    // raw (potentially tiny or huge) model space.  See normalizeModel().

    if (col) {
      let colorSet = false;

      const cAttr = g.attributes.color;
      if (cAttr) {
        col[i * 3]     = cAttr.array[localIdx * 3];
        col[i * 3 + 1] = cAttr.array[localIdx * 3 + 1];
        col[i * 3 + 2] = cAttr.array[localIdx * 3 + 2];
        colorSet = true;
      }

      if (!colorSet && meshes && meshes[geoIdx] && g.attributes.uv) {
        const mesh = meshes[geoIdx];
        const uvAttr = g.attributes.uv;
        const uvx = uvAttr.array[localIdx * 2];
        const uvy = uvAttr.array[localIdx * 2 + 1];

        const mat = mesh.material;
        if (mat) {
          const materials = Array.isArray(mat) ? mat : [mat];
          for (const m of materials) {
            if (m.map && m.map.image) {
              const cacheKey = `${geoIdx}_${Math.round(uvx * 100)}_${Math.round(uvy * 100)}`;
              let sampled;
              if (textureColorCache.has(cacheKey)) {
                sampled = textureColorCache.get(cacheKey);
              } else {
                sampled = sampleTextureColor(m, uvx, uvy);
                if (sampled) textureColorCache.set(cacheKey, sampled);
              }
              if (sampled) {
                col[i * 3]     = sampled[0];
                col[i * 3 + 1] = sampled[1];
                col[i * 3 + 2] = sampled[2];
                colorSet = true;
                break;
              }
            }
          }
        }
      }

      if (!colorSet) {
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0.7;
      }
    }
  }

  return {
    attributes: { position: pos, color: col },
    count,
    needsJitter,
  };
}

function randomSample(total, n) {
  const arr = new Uint32Array(total);
  for (let i = 0; i < total; i++) arr[i] = i;
  for (let i = 0; i < n && i < total; i++) {
    const j = i + Math.floor(Math.random() * (total - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return Array.from(arr.slice(0, n));
}

function fillSample(total, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(Math.floor(Math.random() * total));
  }
  return arr;
}

function collectGeometries(object) {
  const geos = [];
  const meshes = [];
  object.traverse(child => {
    if (child.isMesh && child.geometry) {
      const g = child.geometry;
      if (g.attributes.position && g.attributes.position.count > 0) {
        geos.push(g);
        meshes.push(child);
      }
    }
  });
  return { geos, meshes };
}

export function normalizeModel(positions, needsJitter = false) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;
  const maxExtent = Math.max(sx, sy, sz, 0.001);
  const scale = 400 / maxExtent;

  // Jitter applied post-normalization: ±0.6 units in normalized 400-unit
  // space.  This is just enough to separate stacked duplicate particles
  // (which appear when fillSample repeats vertices) without visibly
  // blurring the model silhouette.
  const jitter = needsJitter ? 1.2 : 0;

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (positions[i * 3]     - cx) * scale + (needsJitter ? (Math.random() - 0.5) * jitter : 0);
    positions[i * 3 + 1] = (positions[i * 3 + 1] - cy) * scale + (needsJitter ? (Math.random() - 0.5) * jitter : 0);
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * scale + (needsJitter ? (Math.random() - 0.5) * jitter : 0);
  }

  return { scale, center: [cx, cy, cz], extent: [sx, sy, sz] };
}

export class ModelLoader {
  static loadGLB(url) {
    return new Promise((resolve, reject) => {
      try {
        const loader = new GLTFLoader();
        loader.load(
          url,
          gltf => {
            try {
              const { geos, meshes } = collectGeometries(gltf.scene);
              if (geos.length === 0) return reject(new Error('No meshes found in GLB'));
              const data = mergeGeometries(geos, meshes);
              normalizeModel(data.attributes.position, data.needsJitter);
              disposeScene(gltf.scene);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          undefined,
          err => reject(new Error(`GLB load failed: ${err ? err.message || err : 'unknown error'}`))
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static loadGLBFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(reader.result, '');
          const { geos, meshes } = collectGeometries(gltf.scene);
          if (geos.length === 0) return reject(new Error('No meshes found in GLB'));
          const data = mergeGeometries(geos, meshes);
          normalizeModel(data.attributes.position, data.needsJitter);
          disposeScene(gltf.scene);
          resolve(data);
        } catch (e) {
          reject(new Error(`GLB parse failed: ${e.message || e}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  static loadGLTFFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(reader.result, '');
          const { geos, meshes } = collectGeometries(gltf.scene);
          if (geos.length === 0) return reject(new Error('No meshes found in GLTF'));
          const data = mergeGeometries(geos, meshes);
          normalizeModel(data.attributes.position, data.needsJitter);
          disposeScene(gltf.scene);
          resolve(data);
        } catch (e) {
          reject(new Error(`GLTF parse failed: ${e.message || e}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static loadFBX(url) {
    return new Promise((resolve, reject) => {
      try {
        const loader = new FBXLoader();
        loader.load(
          url,
          group => {
            try {
              const { geos, meshes } = collectGeometries(group);
              if (geos.length === 0) return reject(new Error('No meshes found in FBX'));
              const data = mergeGeometries(geos, meshes);
              normalizeModel(data.attributes.position, data.needsJitter);
              disposeScene(group);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          undefined,
          err => reject(new Error(`FBX load failed: ${err ? err.message || err : 'unknown error'}`))
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static loadFBXFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const loader = new FBXLoader();
          let group;
          try {
            group = loader.parse(reader.result, '');
          } catch (parseErr) {
            const decoder = new TextDecoder();
            const text = decoder.decode(reader.result);
            group = loader.parse(text, '');
          }
          const { geos, meshes } = collectGeometries(group);
          if (geos.length === 0) return reject(new Error('No meshes found in FBX'));
          const data = mergeGeometries(geos, meshes);
          normalizeModel(data.attributes.position, data.needsJitter);
          disposeScene(group);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }
}
