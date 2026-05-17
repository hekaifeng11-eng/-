export function analyzeModel(positions, colors, count) {
  const profile = {
    vertexCount: count,
    boundingBox: { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] },
    centroid: [0, 0, 0],
    density: 0,
    complexity: 0,
    colorProfile: null,
    spatialDistribution: null,
    symmetry: 0,
    surfaceArea: 0,
    volumeEstimate: 0,
  };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
    sumX += x; sumY += y; sumZ += z;
  }

  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;

  profile.boundingBox = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    size: [sx, sy, sz],
  };

  profile.centroid = [sumX / count, sumY / count, sumZ / count];
  profile.volumeEstimate = sx * sy * sz;

  if (profile.volumeEstimate > 0) {
    profile.density = count / profile.volumeEstimate;
  }

  const bucketSize = Math.max(1, Math.ceil(Math.cbrt(count)));
  const buckets = new Map();

  for (let i = 0; i < count; i++) {
    const bx = Math.floor((positions[i * 3] - minX) / (sx || 1) * bucketSize);
    const by = Math.floor((positions[i * 3 + 1] - minY) / (sy || 1) * bucketSize);
    const bz = Math.floor((positions[i * 3 + 2] - minZ) / (sz || 1) * bucketSize);
    const key = `${Math.max(0, Math.min(bx, bucketSize - 1))}_${Math.max(0, Math.min(by, bucketSize - 1))}_${Math.max(0, Math.min(bz, bucketSize - 1))}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const filledBuckets = buckets.size;
  const totalBuckets = bucketSize * bucketSize * bucketSize;
  profile.spatialDistribution = filledBuckets / Math.min(totalBuckets, filledBuckets * 10);
  profile.complexity = Math.min(1, filledBuckets / Math.min(totalBuckets, count));

  if (colors && colors.length >= count * 3) {
    let rSum = 0, gSum = 0, bSum = 0;
    let rVar = 0, gVar = 0, bVar = 0;
    const hueHist = new Array(36).fill(0);
    const satHist = new Array(10).fill(0);
    let colorCount = 0;

    for (let i = 0; i < count; i++) {
      const cr = colors[i * 3];
      const cg = colors[i * 3 + 1];
      const cb = colors[i * 3 + 2];
      if (cr === 0.7 && cg === 0.7 && cb === 0.7) continue;
      rSum += cr; gSum += cg; bSum += cb;
      colorCount++;

      const maxC = Math.max(cr, cg, cb);
      const minC = Math.min(cr, cg, cb);
      const delta = maxC - minC;
      let hue = 0;
      if (delta > 0.001) {
        if (maxC === cr) hue = ((cg - cb) / delta) % 6;
        else if (maxC === cg) hue = (cb - cr) / delta + 2;
        else hue = (cr - cg) / delta + 4;
        hue = (hue / 6 + 1) % 1;
      }
      const sat = maxC > 0.001 ? delta / maxC : 0;
      hueHist[Math.floor(hue * 36)]++;
      satHist[Math.floor(sat * 9.99)]++;
    }

    if (colorCount > 0) {
      const meanR = rSum / colorCount;
      const meanG = gSum / colorCount;
      const meanB = bSum / colorCount;

      for (let i = 0; i < count; i++) {
        const cr = colors[i * 3], cg = colors[i * 3 + 1], cb = colors[i * 3 + 2];
        if (cr === 0.7 && cg === 0.7 && cb === 0.7) continue;
        rVar += (cr - meanR) ** 2;
        gVar += (cg - meanG) ** 2;
        bVar += (cb - meanB) ** 2;
      }
      rVar /= colorCount; gVar /= colorCount; bVar /= colorCount;

      const maxHueIdx = hueHist.indexOf(Math.max(...hueHist));
      const dominantHue = maxHueIdx / 36;
      const hueEntropy = hueHist.reduce((e, v) => {
        const p = v / colorCount;
        return p > 0 ? e - p * Math.log2(p) : e;
      }, 0);

      profile.colorProfile = {
        mean: [meanR, meanG, meanB],
        variance: [rVar, gVar, bVar],
        dominantHue,
        hueDiversity: Math.min(1, hueEntropy / Math.log2(36)),
        saturation: satHist.indexOf(Math.max(...satHist)) / 9,
        isRich: (rVar + gVar + bVar) > 0.15,
        distinctColorCount: hueHist.filter(v => v > 0).length,
      };
    }
  }

  let symX = 0, symY = 0, symZ = 0;
  const halfCount = Math.floor(count / 2);
  const [cx, cy, cz] = profile.centroid;
  for (let i = 0; i < halfCount; i++) {
    const xi = positions[i * 3], yi = positions[i * 3 + 1], zi = positions[i * 3 + 2];
    const j = Math.floor(Math.random() * count);
    const xj = positions[j * 3], yj = positions[j * 3 + 1], zj = positions[j * 3 + 2];
    const mirrorX = 2 * cx - xi;
    const mirrorY = 2 * cy - yi;
    const mirrorZ = 2 * cz - zi;
    symX += Math.exp(-(((xj - mirrorX) / (sx * 0.1 + 1)) ** 2));
    symY += Math.exp(-(((yj - mirrorY) / (sy * 0.1 + 1)) ** 2));
    symZ += Math.exp(-(((zj - mirrorZ) / (sz * 0.1 + 1)) ** 2));
  }
  profile.symmetry = (symX + symY + symZ) / (halfCount * 3);

  return profile;
}

export function classifyModelType(profile) {
  const { symmetry, complexity, density, boundingBox } = profile;
  const [sx, sy, sz] = boundingBox.size;
  const aspectRatio = Math.max(sx, sz) / Math.max(sy, 0.001);
  const flatness = Math.min(sx, sy, sz) / Math.max(sx, sy, sz, 0.001);

  const types = [];

  if (symmetry > 0.7) types.push('symmetric');
  if (symmetry > 0.9) types.push('highly_symmetric');
  if (complexity > 0.4) types.push('complex');
  if (complexity > 0.7) types.push('highly_complex');
  if (density > 0.01) types.push('dense');
  if (flatness < 0.15) types.push('flat');
  if (aspectRatio > 3) types.push('elongated');
  if (aspectRatio > 5) types.push('tall');
  if (flatness > 0.5) types.push('compact');
  if (flatness > 0.7) types.push('spherical');
  if (types.length === 0) types.push('organic');

  return types;
}
