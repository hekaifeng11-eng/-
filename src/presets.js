export function generateTorusKnot(count) {
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

export function generateSphere(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const R = 200;
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = R * Math.cbrt(Math.random());
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    const t = i / count;
    col[i * 3]     = 0.3 + 0.4 * t;
    col[i * 3 + 1] = 0.6 + 0.3 * (1 - t);
    col[i * 3 + 2] = 0.9 - 0.3 * t;
  }
  return { attributes: { position: pos, color: col }, count };
}

export function generateDNA(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const R = 120;
  const height = 500;
  const turns = 5;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const y = (t - 0.5) * height;
    const angle = t * turns * 2 * Math.PI;
    const strand = i % 2;
    const offset = strand * Math.PI;
    const r = R + (Math.random() - 0.5) * 10;
    pos[i * 3]     = r * Math.cos(angle + offset);
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = r * Math.sin(angle + offset);
    if (strand === 0) {
      col[i * 3]     = 0.9;
      col[i * 3 + 1] = 0.3;
      col[i * 3 + 2] = 0.5;
    } else {
      col[i * 3]     = 0.3;
      col[i * 3 + 1] = 0.6;
      col[i * 3 + 2] = 0.9;
    }
  }
  return { attributes: { position: pos, color: col }, count };
}

export function generateGalaxy(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const arms = 4;
  const R = 300;
  for (let i = 0; i < count; i++) {
    const armIdx = i % arms;
    const armAngle = (armIdx / arms) * 2 * Math.PI;
    const dist = Math.random() * R;
    const spiralAngle = armAngle + dist * 0.015;
    const spread = (1 - dist / R) * 30 + 5;
    pos[i * 3]     = Math.cos(spiralAngle) * dist + (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.3;
    pos[i * 3 + 2] = Math.sin(spiralAngle) * dist + (Math.random() - 0.5) * spread;
    const t = dist / R;
    col[i * 3]     = 1.0 - t * 0.5;
    col[i * 3 + 1] = 0.7 - t * 0.3;
    col[i * 3 + 2] = 0.4 + t * 0.5;
  }
  return { attributes: { position: pos, color: col }, count };
}

export function generateHeart(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const scale = 12;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * 2 * Math.PI;
    const r = Math.random() * 0.3 + 0.85;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const z = (Math.random() - 0.5) * 8;
    pos[i * 3]     = x * scale * r;
    pos[i * 3 + 1] = y * scale * r;
    pos[i * 3 + 2] = z * scale;
    const depth = (z + 4) / 8;
    col[i * 3]     = 0.9 + 0.1 * depth;
    col[i * 3 + 1] = 0.2 + 0.15 * depth;
    col[i * 3 + 2] = 0.4 + 0.2 * depth;
  }
  return { attributes: { position: pos, color: col }, count };
}

export const PRESETS = {
  '环面结': generateTorusKnot,
  '球体': generateSphere,
  'DNA双螺旋': generateDNA,
  '银河系': generateGalaxy,
  '爱心': generateHeart,
};
