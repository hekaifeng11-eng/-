import GUI from 'lil-gui';
import { appState } from './state.js';
import { THEMES } from './param-mapper.js';

export function setupPanel(particleRef, camera, camState, postProcessing, sequencer, setTheme = null) {
  const gui = new GUI({ title: '粒子引擎 v9', width: 280 });

  if (setTheme) {
    const tf = gui.addFolder('主题风格');
    tf.add({
      get theme() { return 'digital_art'; },
      set theme(v) { setTheme(v); },
    }, 'theme', Object.keys(THEMES).reduce((acc, k) => { acc[k] = k; return acc; }, {}))
      .name('切换主题');
    tf.open();
  }

  const pf = gui.addFolder('粒子');
  pf.add({ get v() { return particleRef.current?.getUniform('u_pointSize') ?? 1.8; }, set v(val) { particleRef.current?.setUniform('u_pointSize', val); } }, 'v', 0.5, 8)
    .name('大小');
  pf.add({ get v() { return particleRef.current?.getUniform('u_opacity') ?? 0.7; }, set v(val) { particleRef.current?.setUniform('u_opacity', val); } }, 'v', 0.1, 1.0)
    .name('透明度');
  pf.add({ get v() { return particleRef.current?.getUniform('u_stretch') ?? 1.0; }, set v(val) { particleRef.current?.setUniform('u_stretch', val); } }, 'v', 0, 5.0)
    .name('拉伸强度');
  pf.open();

  const df = gui.addFolder('动态');
  df.add({ get v() { return particleRef.current?.getUniform('u_noiseStrength') ?? 0.3; }, set v(val) { particleRef.current?.setUniform('u_noiseStrength', val); } }, 'v', 0, 1.5)
    .name('噪声强度');
  df.add({ get v() { return particleRef.current?.getUniform('u_noiseSpeed') ?? 0.15; }, set v(val) { particleRef.current?.setUniform('u_noiseSpeed', val); } }, 'v', 0.01, 0.5)
    .name('噪声速度');
  df.add({ get v() { return particleRef.current?.getUniform('u_state') ?? 0.0; }, set v(val) { particleRef.current?.setUniform('u_state', val); } }, 'v', 0, 1)
    .name('散射/汇聚');
  df.open();

  const sf = gui.addFolder('阶段');
  sf.add({ scatter() { sequencer.setStage('scatter'); } }, 'scatter').name('散射');
  sf.add({ converge() { sequencer.setStage('converge'); } }, 'converge').name('汇聚');
  sf.add({ display() { sequencer.setStage('display'); } }, 'display').name('展示');
  sf.add({ vortex() { sequencer.setStage('vortex'); } }, 'vortex').name('涡旋');
  sf.add({ play() { sequencer.playFullSequence(); } }, 'play').name('自动播放');
  sf.open();

  if (postProcessing) {
    const bf = gui.addFolder('辉光');
    bf.add(appState, 'bloomEnabled').name('启用').onChange(v => {
      postProcessing.enabled = v;
    });
    bf.add(appState, 'bloomStrength', 0, 3, 0.01).name('强度').onChange(v => {
      postProcessing.setBloomParams(v, appState.bloomRadius, appState.bloomThreshold);
    });
    bf.add(appState, 'bloomRadius', 0, 1, 0.01).name('半径').onChange(v => {
      postProcessing.setBloomParams(appState.bloomStrength, v, appState.bloomThreshold);
    });
    bf.add(appState, 'bloomThreshold', 0, 1, 0.01).name('阈值').onChange(v => {
      postProcessing.setBloomParams(appState.bloomStrength, appState.bloomRadius, v);
    });
    bf.open();
  }

  const cf = gui.addFolder('摄像机');
  cf.add(camera, 'fov', 30, 90)
    .name('视场角')
    .onChange(() => camera.updateProjectionMatrix());
  cf.add(camState, 'orbitSpeed', 0.01, 0.5)
    .name('轨道速度');
  cf.add(camState, 'distance', 100, 1500)
    .name('摄像机距离');
  cf.open();

  return gui;
}
