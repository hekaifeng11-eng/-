import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MAX_PARTICLES = 500000;

function mergeGeometries(geometries) {
  let totalVerts = 0;
  const hasColor = geometries.some(g => g.attributes.color);

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
  const col = hasColor ? new Float32Array(count * 3) : null;

  const offsets = [];
  let acc = 0;
  for (const g of geometries) {
    offsets.push(acc);
    acc += g.attributes.position.count;
  }

  const needsJitter = totalVerts < MAX_PARTICLES;

  for (let i = 0; i < count; i++) {
    const idx = indices[i];
    let geoIdx = 0;
    while (geoIdx < offsets.length - 1 && idx >= offsets[geoIdx + 1]) geoIdx++;
    const localIdx = idx - offsets[geoIdx];
    const g = geometries[geoIdx];
    const pAttr = g.attributes.position;

    pos[i * 3]     = pAttr.array[localIdx * 3];
    pos[i * 3 + 1] = pAttr.array[localIdx * 3 + 1];
    pos[i * 3 + 2] = pAttr.array[localIdx * 3 + 2];

    if (needsJitter) {
      pos[i * 3]     += (Math.random() - 0.5) * 2.0;
      pos[i * 3 + 1] += (Math.random() - 0.5) * 2.0;
      pos[i * 3 + 2] += (Math.random() - 0.5) * 2.0;
    }

    if (col) {
      const cAttr = g.attributes.color;
      if (cAttr) {
        col[i * 3]     = cAttr.array[localIdx * 3];
        col[i * 3 + 1] = cAttr.array[localIdx * 3 + 1];
        col[i * 3 + 2] = cAttr.array[localIdx * 3 + 2];
      } else {
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0.7;
      }
    }
  }

  return {
    attributes: { position: pos, color: col },
    count,
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
  object.traverse(child => {
    if (child.isMesh && child.geometry) {
      const g = child.geometry;
      if (g.attributes.position && g.attributes.position.count > 0) {
        geos.push(g);
      }
    }
  });
  return geos;
}

export function normalizeModel(positions) {
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

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (positions[i * 3]     - cx) * scale;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - cy) * scale;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * scale;
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
              const geos = collectGeometries(gltf.scene);
              if (geos.length === 0) return reject(new Error('No meshes found in GLB'));
              const data = mergeGeometries(geos);
              normalizeModel(data.attributes.position);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          undefined,
          err => reject(new Error(`GLB load failed: ${err.message}`))
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static loadGLBFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const loader = new GLTFLoader();
          loader.parse(
            reader.result,
            '',
            gltf => {
              try {
                const geos = collectGeometries(gltf.scene);
                if (geos.length === 0) return reject(new Error('No meshes found in GLB'));
                const data = mergeGeometries(geos);
                normalizeModel(data.attributes.position);
                resolve(data);
              } catch (e) {
                reject(e);
              }
            },
            err => reject(new Error(`GLB parse failed: ${err.message}`))
          );
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
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
              const geos = collectGeometries(group);
              if (geos.length === 0) return reject(new Error('No meshes found in FBX'));
              const data = mergeGeometries(geos);
              normalizeModel(data.attributes.position);
              resolve(data);
            } catch (e) {
              reject(e);
            }
          },
          undefined,
          err => reject(new Error(`FBX load failed: ${err.message}`))
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
          const group = loader.parse(reader.result, '');
          const geos = collectGeometries(group);
          if (geos.length === 0) return reject(new Error('No meshes found in FBX'));
          const data = mergeGeometries(geos);
          normalizeModel(data.attributes.position);
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
