export const THEMES = {
  'touchdesigner': {
    label: 'TouchDesigner',
    springK: 2.5,
    damping: 0.94,
    curlStrength: 0.6,
    pointSize: 2.0,
    opacity: 0.75,
    bloomStrength: 1.0,
    bloomRadius: 0.5,
    bloomThreshold: 0.7,
    paletteShift: 0.05,
    saturation: 1.3,
    brightness: 1.1,
    contrast: 1.15,
  },
  'digital_art': {
    label: '数字艺术',
    springK: 1.8,
    damping: 0.955,
    curlStrength: 0.4,
    pointSize: 1.8,
    opacity: 0.7,
    bloomStrength: 0.8,
    bloomRadius: 0.45,
    bloomThreshold: 0.75,
    paletteShift: 0.02,
    saturation: 1.2,
    brightness: 1.05,
    contrast: 1.1,
  },
  'ai_generated': {
    label: 'AI生成',
    springK: 1.2,
    damping: 0.962,
    curlStrength: 0.5,
    pointSize: 1.6,
    opacity: 0.65,
    bloomStrength: 0.9,
    bloomRadius: 0.55,
    bloomThreshold: 0.7,
    paletteShift: 0.08,
    saturation: 1.1,
    brightness: 1.0,
    contrast: 1.05,
  },
  'loot': {
    label: 'Loot',
    springK: 2.0,
    damping: 0.95,
    curlStrength: 0.35,
    pointSize: 2.2,
    opacity: 0.8,
    bloomStrength: 1.2,
    bloomRadius: 0.6,
    bloomThreshold: 0.65,
    paletteShift: 0.03,
    saturation: 0.9,
    brightness: 0.95,
    contrast: 1.2,
  },
  'visual': {
    label: '视觉冲击',
    springK: 3.0,
    damping: 0.93,
    curlStrength: 0.8,
    pointSize: 2.5,
    opacity: 0.85,
    bloomStrength: 1.5,
    bloomRadius: 0.65,
    bloomThreshold: 0.6,
    paletteShift: 0.1,
    saturation: 1.5,
    brightness: 1.2,
    contrast: 1.3,
  },
  'scifi': {
    label: '科幻',
    springK: 2.2,
    damping: 0.95,
    curlStrength: 0.45,
    pointSize: 1.7,
    opacity: 0.72,
    bloomStrength: 1.1,
    bloomRadius: 0.5,
    bloomThreshold: 0.72,
    paletteShift: 0.06,
    saturation: 1.1,
    brightness: 1.15,
    contrast: 1.15,
  },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function mapModelToParams(profile, themeOverride = null) {
  const types = profile.classification || ['organic'];
  const themeKey = themeOverride || 'digital_art';
  const themeBase = THEMES[themeKey] || THEMES.digital_art;

  const complexityFactor = profile.complexity || 0.5;
  const symmetryFactor = profile.symmetry || 0.5;
  const densityFactor = Math.min(1, (profile.density || 0.001) * 100);

  const isComplex = types.includes('highly_complex') || types.includes('complex');
  const isSymmetric = types.includes('highly_symmetric') || types.includes('symmetric');
  const isFlat = types.includes('flat');
  const isCompact = types.includes('compact') || types.includes('spherical');
  const isElongated = types.includes('elongated') || types.includes('tall');

  const springK = clamp(
    themeBase.springK
    + (isComplex ? 0.5 : 0)
    + (isSymmetric ? -0.3 : 0)
    + (isFlat ? 0.2 : 0)
    + (densityFactor > 0.7 ? -0.2 : 0),
    0.5, 5.0
  );

  const damping = clamp(
    themeBase.damping
    + (isComplex ? 0.01 : 0)
    + (densityFactor > 0.5 ? -0.01 : 0.01),
    0.9, 0.99
  );

  const curlStrength = clamp(
    themeBase.curlStrength
    + (isComplex ? 0.15 : -0.1)
    + (isSymmetric ? -0.1 : 0)
    + (complexityFactor * 0.3),
    0.05, 1.5
  );

  const pointSize = clamp(
    themeBase.pointSize
    + (isElongated ? 0.2 : 0)
    + (isCompact ? -0.1 : 0)
    + (densityFactor > 0.7 ? -0.1 : 0.1),
    1.0, 4.0
  );

  const opacity = clamp(
    themeBase.opacity
    + (isFlat ? 0.05 : -0.03),
    0.4, 0.95
  );

  const bloomStrength = clamp(
    themeBase.bloomStrength
    + (isComplex ? 0.1 : 0)
    + (isFlat ? 0.1 : -0.1),
    0.3, 2.0
  );

  const bloomRadius = clamp(themeBase.bloomRadius, 0.2, 0.8);
  const bloomThreshold = clamp(themeBase.bloomThreshold, 0.5, 0.9);

  const particleCountFactor = clamp(
    0.5
    + complexityFactor * 0.3
    + (isElongated ? 0.1 : 0)
    + (isCompact ? -0.05 : 0),
    0.3, 1.0
  );

  const colorParams = {
    paletteShift: themeBase.paletteShift,
    saturation: themeBase.saturation,
    brightness: themeBase.brightness,
    contrast: themeBase.contrast,
  };

  if (profile.colorProfile && profile.colorProfile.isRich) {
    colorParams.saturation = clamp(colorParams.saturation * 0.85, 0.6, 1.8);
    colorParams.paletteShift = 0;
  }

  const stretchFactor = clamp(
    0.5 + complexityFactor * 1.5 + (isElongated ? 0.5 : 0),
    0.2, 3.0
  );

  const visibleTweenDuration = clamp(
    1.5 + complexityFactor * 2.0,
    1.0, 4.0
  );

  const orbitSpeed = clamp(
    0.06 + symmetryFactor * 0.02 - complexityFactor * 0.02,
    0.03, 0.15
  );

  return {
    springK,
    damping,
    curlStrength,
    pointSize,
    opacity,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    particleCountFactor,
    colorParams,
    stretchFactor,
    visibleTweenDuration,
    orbitSpeed,
    theme: themeKey,
    modelTypes: types,
  };
}

export function generateThemeColorPalette(profile, themeOverride = null) {
  const themeKey = themeOverride || 'digital_art';
  const themeBase = THEMES[themeKey] || THEMES.digital_art;

  const basePalettes = {
    touchdesigner: [
      [0.1, 0.9, 1.0], [0.8, 0.2, 0.9], [0.2, 1.0, 0.6],
      [1.0, 0.3, 0.4], [0.3, 0.5, 1.0], [0.9, 0.7, 0.2],
    ],
    digital_art: [
      [0.2, 0.7, 1.0], [0.9, 0.3, 0.7], [0.3, 1.0, 0.5],
      [1.0, 0.5, 0.2], [0.5, 0.3, 1.0], [0.1, 0.8, 0.8],
    ],
    ai_generated: [
      [0.3, 0.6, 1.0], [0.8, 0.4, 0.6], [0.4, 0.9, 0.4],
      [1.0, 0.6, 0.3], [0.6, 0.2, 0.9], [0.2, 0.7, 0.7],
    ],
    loot: [
      [0.6, 0.5, 0.3], [0.7, 0.3, 0.2], [0.4, 0.3, 0.5],
      [0.8, 0.6, 0.1], [0.3, 0.4, 0.6], [0.5, 0.2, 0.3],
    ],
    visual: [
      [1.0, 0.1, 0.3], [0.1, 1.0, 0.5], [0.3, 0.2, 1.0],
      [1.0, 0.8, 0.1], [1.0, 0.2, 0.8], [0.1, 0.9, 1.0],
    ],
    scifi: [
      [0.1, 0.5, 1.0], [0.2, 1.0, 0.7], [0.8, 0.2, 1.0],
      [1.0, 0.4, 0.1], [0.2, 0.8, 1.0], [0.5, 0.1, 0.8],
    ],
  };

  const palette = basePalettes[themeKey] || basePalettes.digital_art;

  if (profile.colorProfile && profile.colorProfile.isRich) {
    const [mr, mg, mb] = profile.colorProfile.mean;
    const h = profile.colorProfile.dominantHue || 0.5;
    const s = profile.colorProfile.saturation || 0.5;

    const modelColors = [];
    for (let i = 0; i < 6; i++) {
      const hueShift = (h + i / 6 + themeBase.paletteShift * (i - 2.5)) % 1;
      const hue = hueShift * 6;
      const c = s * 0.8;
      const x = c * (1 - Math.abs((hue % 2) - 1));
      const m = 0.5 - c * 0.3;
      let r, g, b;
      if (hue < 1) { r = c; g = x; b = 0; }
      else if (hue < 2) { r = x; g = c; b = 0; }
      else if (hue < 3) { r = 0; g = c; b = x; }
      else if (hue < 4) { r = 0; g = x; b = c; }
      else if (hue < 5) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      modelColors.push([
        clamp(r + m, 0, 1),
        clamp(g + m, 0, 1),
        clamp(b + m, 0, 1),
      ]);
    }
    return modelColors;
  }

  return palette;
}
