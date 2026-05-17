export const appState = {
  particleCount: 500000,
  qualityLevel: 1,
  qualityLevels: [250000, 500000, 1000000],
  autoSequence: true,
  bloomEnabled: true,
  bloomStrength: 0.8,
  bloomRadius: 0.45,
  bloomThreshold: 0.75,
};

export function getQualityCount() {
  return appState.qualityLevels[appState.qualityLevel] || 500000;
}
